import "server-only";
import prisma from "@/lib/prisma";
import type { DesignComposition } from "@/lib/print/types";

export type CreatorPolicyPermission =
  | "allowName"
  | "allowQuote"
  | "allowTranslation"
  | "allowCalligraphy"
  | "allowRecolor"
  | "allowCrop"
  | "allowBackgroundRemoval"
  | "allowAIRestyle"
  | "allowDerivative"
  | "allowCommercialUse"
  | "allowModelTraining";

export interface EffectiveDesignPolicy {
  designId: string | null;
  versionNumber: number | null;
  isPlatformBlank: boolean;
  allowName: boolean;
  allowQuote: boolean;
  allowTranslation: boolean;
  allowCalligraphy: boolean;
  allowRecolor: boolean;
  allowCrop: boolean;
  allowBackgroundRemoval: boolean;
  allowAIRestyle: boolean;
  allowDerivative: boolean;
  allowCommercialUse: boolean;
  allowModelTraining: false; // INV-010: ALWAYS false
}

export interface PersonalizationPolicyContext {
  designId?: string | null;
  mode?: "NAME" | "QUOTE" | "STORY" | "CREATOR_ART";
  textTreatment?: "KEEP_ORIGINAL" | "TRANSLATE" | "PHONETIC";
  hasCalligraphy?: boolean;
  recolor?: boolean;
  crop?: boolean;
  removeBackground?: boolean;
  aiRestyle?: boolean;
  derivative?: boolean;
  commercialUse?: boolean;
  modelTraining?: boolean;
}

export interface CompositionPolicyContext {
  designId?: string | null;
  composition: DesignComposition;
  mode?: string | null;
  commercialUse?: boolean;
}

const STANDARD_SUMI_INK_HEX = new Set(["#121212", "#0b0b0b", "#000000"]);

export class CreatorPolicyViolationError extends Error {
  public readonly status = 403 as const;
  public readonly permission: CreatorPolicyPermission;

  constructor(permission: CreatorPolicyPermission, message?: string) {
    super(
      message ??
        `Creator policy forbids "${permission}" on this design (INV-012)`
    );
    this.name = "CreatorPolicyViolationError";
    this.permission = permission;
  }
}

const PLATFORM_BLANK_POLICY: EffectiveDesignPolicy = {
  designId: null,
  versionNumber: null,
  isPlatformBlank: true,
  allowName: true,
  allowQuote: true,
  allowTranslation: true,
  allowCalligraphy: true,
  allowRecolor: true,
  allowCrop: true,
  allowBackgroundRemoval: true,
  allowAIRestyle: false,
  allowDerivative: true,
  allowCommercialUse: false,
  allowModelTraining: false,
};

/**
 * Conservative defaults matching Prisma `DesignPolicyVersion` schema defaults
 * when a creator `designId` is attached before a policy version row is written.
 */
function buildConservativeCreatorPolicy(designId: string): EffectiveDesignPolicy {
  return {
    designId,
    versionNumber: null,
    isPlatformBlank: false,
    allowName: true,
    allowQuote: true,
    allowTranslation: true,
    allowCalligraphy: true,
    allowRecolor: false,
    allowCrop: false,
    allowBackgroundRemoval: true,
    allowAIRestyle: false,
    allowDerivative: false,
    allowCommercialUse: false,
    allowModelTraining: false,
  };
}

/**
 * Enforces creator artwork permission matrix (T-409, INV-010, INV-012, TB-CALLI-009).
 */
export class PolicyGuard {
  /**
   * Loads the latest `DesignPolicyVersion` for `designId` (`versionNumber: "desc"`).
   * - When `designId` is null/empty: returns safe platform blank studio permissions.
   * - When `designId` is present: enforces creator permissions and asserts `allowModelTraining === false` (INV-010).
   */
  public static async loadPolicy(
    designId?: string | null
  ): Promise<EffectiveDesignPolicy> {
    const cleanDesignId = designId?.trim() || null;
    if (!cleanDesignId) {
      return { ...PLATFORM_BLANK_POLICY };
    }

    const latest = await prisma.designPolicyVersion.findFirst({
      where: { designId: cleanDesignId },
      orderBy: { versionNumber: "desc" },
    });

    if (!latest) {
      return buildConservativeCreatorPolicy(cleanDesignId);
    }

    // INV-010 & TB-CALLI-009: Model training on creator artwork MUST ALWAYS be false.
    if (latest.allowModelTraining !== false) {
      throw new CreatorPolicyViolationError(
        "allowModelTraining",
        "Model training permission on creator artwork is strictly prohibited (INV-010)"
      );
    }

    return {
      designId: cleanDesignId,
      versionNumber: latest.versionNumber,
      isPlatformBlank: false,
      allowName: Boolean(latest.allowName),
      allowQuote: Boolean(latest.allowQuote),
      allowTranslation: Boolean(latest.allowTranslation),
      allowCalligraphy: Boolean(latest.allowCalligraphy),
      allowRecolor: Boolean(latest.allowRecolor),
      allowCrop: Boolean(latest.allowCrop),
      allowBackgroundRemoval: Boolean(latest.allowBackgroundRemoval),
      allowAIRestyle: Boolean(latest.allowAIRestyle),
      allowDerivative: Boolean(latest.allowDerivative),
      allowCommercialUse: Boolean(latest.allowCommercialUse),
      allowModelTraining: false,
    };
  }

  /**
   * Asserts a single permission on `designId`, throwing `CreatorPolicyViolationError` (403) if disallowed.
   */
  public static async assertPermission(
    designId: string | null | undefined,
    permission: CreatorPolicyPermission
  ): Promise<EffectiveDesignPolicy> {
    if (permission === "allowModelTraining") {
      throw new CreatorPolicyViolationError(
        "allowModelTraining",
        "AI model training on artwork is strictly prohibited (INV-010)"
      );
    }

    const policy = await this.loadPolicy(designId);
    if (!policy[permission]) {
      throw new CreatorPolicyViolationError(permission);
    }
    return policy;
  }

  /**
   * Asserts all requested permissions in order.
   */
  public static async assertPermissions(
    designId: string | null | undefined,
    permissions: readonly CreatorPolicyPermission[]
  ): Promise<EffectiveDesignPolicy> {
    if (permissions.includes("allowModelTraining")) {
      throw new CreatorPolicyViolationError(
        "allowModelTraining",
        "AI model training on artwork is strictly prohibited (INV-010)"
      );
    }

    const policy = await this.loadPolicy(designId);
    for (const permission of permissions) {
      if (!policy[permission]) {
        throw new CreatorPolicyViolationError(permission);
      }
    }
    return policy;
  }

  /**
   * Evaluates a full personalization / restyling / composition context against the creator's policy.
   */
  public static async enforcePersonalizationContext(
    context: PersonalizationPolicyContext
  ): Promise<EffectiveDesignPolicy> {
    if (context.modelTraining === true) {
      throw new CreatorPolicyViolationError(
        "allowModelTraining",
        "AI model training is strictly prohibited (INV-010)"
      );
    }

    const policy = await this.loadPolicy(context.designId);

    // Even in platform blank mode, AI restyle requires an explicit creator design granting allowAIRestyle
    if (context.aiRestyle && !policy.allowAIRestyle) {
      throw new CreatorPolicyViolationError(
        "allowAIRestyle",
        "Creator policy forbids AI restyling of this artwork (INV-012)"
      );
    }

    if (policy.isPlatformBlank) {
      if (context.commercialUse && !policy.allowCommercialUse) {
        throw new CreatorPolicyViolationError("allowCommercialUse");
      }
      return policy;
    }

    const required: CreatorPolicyPermission[] = [];

    if (context.mode === "NAME") {
      required.push("allowName");
    } else if (context.mode === "QUOTE" || context.mode === "STORY") {
      required.push("allowQuote");
    }

    if (
      context.textTreatment === "TRANSLATE" ||
      context.textTreatment === "PHONETIC"
    ) {
      required.push("allowTranslation");
    }

    if (context.hasCalligraphy) {
      required.push("allowCalligraphy");
    }
    if (context.recolor) {
      required.push("allowRecolor");
    }
    if (context.crop) {
      required.push("allowCrop");
    }
    if (context.removeBackground) {
      required.push("allowBackgroundRemoval");
    }
    if (context.derivative) {
      required.push("allowDerivative");
    }
    if (context.commercialUse) {
      required.push("allowCommercialUse");
    }

    for (const permission of required) {
      if (!policy[permission]) {
        throw new CreatorPolicyViolationError(permission);
      }
    }

    return policy;
  }

  /**
   * Enforces creator permissions against a validated Studio `DesignComposition`
   * before saving session mutations or adding personalized creator designs to cart (T-409, INV-012).
   */
  public static async enforceCompositionPolicy(
    input: CompositionPolicyContext
  ): Promise<EffectiveDesignPolicy> {
    const normalizedMode =
      input.mode === "NAME" ||
      input.mode === "QUOTE" ||
      input.mode === "STORY" ||
      input.mode === "CREATOR_ART"
        ? input.mode
        : undefined;

    const hasCalligraphy = input.composition.layers.some(
      (layer) => layer.type === "calligraphy" || layer.type === "seal"
    );

    const recolor =
      !STANDARD_SUMI_INK_HEX.has(input.composition.color.toLowerCase()) ||
      input.composition.layers.some(
        (layer) =>
          layer.type === "calligraphy" &&
          !STANDARD_SUMI_INK_HEX.has(layer.colorHex.toLowerCase())
      );

    const crop = input.composition.layers.some(
      (layer) =>
        layer.type === "asset" &&
        (layer.fillMode === "cover" || layer.transform.scale > 1.05)
    );

    return this.enforcePersonalizationContext({
      designId: input.designId,
      mode: normalizedMode,
      hasCalligraphy,
      recolor,
      crop,
      commercialUse: input.commercialUse,
    });
  }
}
