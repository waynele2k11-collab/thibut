/**
 * INNGEST CLIENT + DURABLE BACKGROUND PIPELINES (T-203, T-400, T-409)
 *
 * 1. `generatePersonalizationJob` (`"personalization/requested"`):
 *    - Enforces `PolicyGuard` (`allowAIRestyle`, `allowDerivative`, `INV-010`, `INV-012`) before any artwork derivative.
 *    - Renders calligraphy strictly via `CalligraphyService` (NEVER `visual-provider` raster text — `TB-CALLI-002`).
 * 2. `processOrderFulfillment` (`"order/placed"`):
 *    - Loads `Order` with `buyer`, `items` (`catalogVariant.providerVariants`, `personalizationVersion.printAsset`).
 *    - Parses & validates `order.shippingAddressJson` with `zod` and `order.buyer?.name ?? "Customer"`.
 *    - Resolves Printful integer `externalVariantId` from `ProviderVariant`.
 *    - Resolves or generates `4500x5400` `PRINT_MASTER` HTTPS URL (`printAsset` or `renderAndStorePrintMaster`).
 *    - Executes durable two-step Printful flow: `"create-printful-draft"` (`external_id: order.orderNumber`) -> `"confirm-printful-order"`.
 */

import { Inngest } from "inngest";
import { z } from "zod";
import {
  culturalIntelligence,
  type CulturalAnalysisInput,
  type SupportedTargetLanguage,
} from "@/lib/ai/cultural-provider";
import { interpretationEngine } from "@/lib/ai/InterpretationEngine";
import { visualAI } from "@/lib/ai/visual-provider";
import { CalligraphyService } from "@/lib/calligraphy/CalligraphyService";
import {
  sendDigitalDownloadEmail,
  sendOrderConfirmationEmail,
  type DigitalDownloadEmailParams,
} from "@/lib/email";
import { PrintfulProvider } from "@/lib/fulfillment/PrintfulProvider";
import type { FulfillmentOrderRequest } from "@/lib/fulfillment/types";
import {
  adaptLegacyComposition,
  renderAndStorePrintMaster,
} from "@/lib/print-generator";
import {
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_WIDTH,
} from "@/lib/print/types";
import prisma from "@/lib/prisma";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { PolicyGuard } from "@/lib/services/PolicyGuard";

export interface InngestStepRunner {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<T>;
}

export type PrintfulFulfillmentClient = Pick<
  PrintfulProvider,
  "createDraftOrder" | "confirmOrder"
>;

export class OrderFulfillmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderFulfillmentValidationError";
  }
}

const defaultPrintful = new PrintfulProvider();

// ── Inngest client singleton ──────────────────────────────────────────────────
export const inngest = new Inngest({
  id: "thibut",
  ...(process.env.INNGEST_EVENT_KEY
    ? { eventKey: process.env.INNGEST_EVENT_KEY }
    : {}),
});

// ── Schemas ───────────────────────────────────────────────────────────────────

export const PersonalizationJobEventSchema = z.object({
  sessionId: z.string().uuid(),
  interpretationId: z.string().uuid().optional(),
  inputText: z.string().trim().min(1).max(500).optional(),
  targetLanguage: z
    .enum(["Vietnamese", "Japanese", "Chinese", "Korean"])
    .optional(),
  mode: z.enum(["NAME", "QUOTE", "STORY", "CREATOR_ART"]).optional(),
  designId: z.string().uuid().optional(),
  stylePack: z.string().trim().min(1).max(80),
  composition: z.string().trim().min(1).max(60),
  creatorArtworkUrl: z.string().url().optional(),
  aiRestyle: z.boolean().optional(),
});

export type PersonalizationRequestedPayload = z.infer<
  typeof PersonalizationJobEventSchema
>;

export const OrderPlacedEventSchema = z.object({
  orderId: z.string().trim().min(1),
});

export const OrderPaidEventSchema = z.object({
  orderId: z.string().trim().min(1),
  orderNumber: z.string().trim().min(1),
  buyerEmail: z.string().email().nullable().optional(),
  hasPhysicalItems: z.boolean().default(false),
  digitalItems: z
    .array(
      z.object({
        orderItemId: z.string().trim().min(1),
        productName: z.string().trim().min(1),
      })
    )
    .default([]),
});

export type OrderPaidEventPayload = z.infer<typeof OrderPaidEventSchema>;

const StripeNestedShippingSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.object({
    line1: z.string().trim().min(1),
    line2: z.string().trim().nullable().optional(),
    city: z.string().trim().min(1),
    state: z.string().trim().nullable().optional(),
    country: z.string().trim().min(2).max(2),
    postal_code: z.string().trim().min(1),
  }),
});

const StripeFlatAddressSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional(),
  line1: z.string().trim().min(1),
  line2: z.string().trim().nullable().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().min(2).max(2),
  postal_code: z.string().trim().min(1),
});

const InternalShippingAddressSchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  company: z.string().trim().nullable().optional(),
  address1: z.string().trim().min(1),
  address2: z.string().trim().nullable().optional(),
  city: z.string().trim().min(1),
  stateCode: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  countryCode: z.string().trim().min(2).max(2).optional(),
  country: z.string().trim().min(2).max(2).optional(),
  zip: z.string().trim().min(1).optional(),
  postalCode: z.string().trim().min(1).optional(),
  postal_code: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

/**
 * Validates `order.shippingAddressJson` strictly with Zod and merges `order.buyer?.name ?? "Customer"`.
 * Never falls back to hardcoded placeholder street addresses (T-203).
 */
export function parseValidatedOrderRecipient(params: {
  shippingAddressJson: unknown;
  buyerName?: string | null;
  buyerEmail?: string | null;
}): FulfillmentOrderRequest["recipient"] {
  const fallbackName = params.buyerName?.trim() || "Customer";
  const fallbackEmail = params.buyerEmail?.trim() || undefined;

  if (
    params.shippingAddressJson === null ||
    params.shippingAddressJson === undefined
  ) {
    throw new OrderFulfillmentValidationError(
      "Order is missing shippingAddressJson"
    );
  }

  const nested = StripeNestedShippingSchema.safeParse(
    params.shippingAddressJson
  );
  if (nested.success) {
    const { address } = nested.data;
    const email = nested.data.email || fallbackEmail;
    if (!email) {
      throw new OrderFulfillmentValidationError(
        "Order is missing recipient email for Printful fulfillment"
      );
    }
    return {
      name: nested.data.name?.trim() || fallbackName,
      address1: address.line1,
      address2: address.line2 || undefined,
      city: address.city,
      stateCode: address.state || undefined,
      countryCode: address.country.toUpperCase(),
      zip: address.postal_code,
      phone: nested.data.phone || undefined,
      email,
    };
  }

  const flat = StripeFlatAddressSchema.safeParse(params.shippingAddressJson);
  if (flat.success) {
    const email = flat.data.email || fallbackEmail;
    if (!email) {
      throw new OrderFulfillmentValidationError(
        "Order is missing recipient email for Printful fulfillment"
      );
    }
    return {
      name: flat.data.name?.trim() || fallbackName,
      address1: flat.data.line1,
      address2: flat.data.line2 || undefined,
      city: flat.data.city,
      stateCode: flat.data.state || undefined,
      countryCode: flat.data.country.toUpperCase(),
      zip: flat.data.postal_code,
      phone: flat.data.phone || undefined,
      email,
    };
  }

  const internal = InternalShippingAddressSchema.safeParse(
    params.shippingAddressJson
  );
  if (internal.success) {
    const country = internal.data.countryCode ?? internal.data.country;
    const zip =
      internal.data.zip ??
      internal.data.postalCode ??
      internal.data.postal_code;
    const email = internal.data.email || fallbackEmail;
    if (!country || !zip || !email) {
      throw new OrderFulfillmentValidationError(
        "Order shippingAddressJson is missing countryCode, zip, or email"
      );
    }
    return {
      name: internal.data.name?.trim() || fallbackName,
      company: internal.data.company || undefined,
      address1: internal.data.address1,
      address2: internal.data.address2 || undefined,
      city: internal.data.city,
      stateCode: internal.data.stateCode || internal.data.state || undefined,
      countryCode: country.toUpperCase(),
      zip,
      phone: internal.data.phone || undefined,
      email,
    };
  }

  throw new OrderFulfillmentValidationError(
    "Order shippingAddressJson failed schema validation"
  );
}

function resolvePublicPrintAssetUrl(objectKey: string): string {
  const trimmed = objectKey.trim();
  if (!trimmed) {
    throw new OrderFulfillmentValidationError("Print asset objectKey is empty");
  }
  if (trimmed === "https://example.com/fallback.png") {
    throw new OrderFulfillmentValidationError(
      "Placeholder fallback print asset URL is forbidden"
    );
  }

  if (trimmed.startsWith("https://")) {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() === "example.com") {
      throw new OrderFulfillmentValidationError(
        "Example domain print asset URLs are forbidden"
      );
    }
    return parsed.toString();
  }

  if (trimmed.startsWith("http://")) {
    throw new OrderFulfillmentValidationError(
      "Print master asset URL must use HTTPS"
    );
  }

  const rawBase =
    process.env.PUBLIC_ASSET_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://storage.thibut.com";

  const baseUrl = new URL(rawBase);
  if (baseUrl.protocol !== "https:") {
    throw new OrderFulfillmentValidationError(
      "Configured PUBLIC_ASSET_BASE_URL must use HTTPS"
    );
  }

  const normalizedBase = baseUrl.toString().endsWith("/")
    ? baseUrl.toString()
    : `${baseUrl.toString()}/`;
  return new URL(trimmed.replace(/^\/+/, ""), normalizedBase).toString();
}

function resolvePrintfulExternalVariantId(
  providerVariants:
    | ReadonlyArray<{
        externalVariantId: string;
        active?: boolean;
        provider?: { code: string; active?: boolean } | null;
      }>
    | null
    | undefined
): string {
  if (!providerVariants || providerVariants.length === 0) {
    throw new OrderFulfillmentValidationError(
      "CatalogVariant has no mapped ProviderVariant records for fulfillment"
    );
  }

  const preferred =
    providerVariants.find(
      (pv) =>
        pv.active !== false &&
        (!pv.provider ||
          (pv.provider.code.toUpperCase() === "PRINTFUL" &&
            pv.provider.active !== false))
    ) ?? providerVariants.find((pv) => pv.active !== false);

  if (!preferred) {
    throw new OrderFulfillmentValidationError(
      "No active Printful ProviderVariant found for order item"
    );
  }

  const cleanId = preferred.externalVariantId.trim();
  if (!/^\d+$/.test(cleanId) || Number.parseInt(cleanId, 10) <= 0) {
    throw new OrderFulfillmentValidationError(
      `ProviderVariant externalVariantId "${cleanId}" is not a valid Printful integer variant ID`
    );
  }

  return cleanId;
}

interface OrderItemForPrintResolution {
  id: string;
  designVersionId: string;
  placement: string;
  quantity: number;
  catalogVariant?: {
    providerVariants?: Array<{
      externalVariantId: string;
      active?: boolean;
      provider?: { code: string; active?: boolean } | null;
    }>;
  } | null;
  personalizationVersion?: {
    id: string;
    styleSnapshot?: unknown;
    printAsset?: {
      id: string;
      objectKey: string;
      width?: number | null;
      height?: number | null;
    } | null;
    session?: {
      compositionJson?: unknown;
    } | null;
    designVersion?: {
      assets?: Array<{
        type: string;
        asset: {
          id: string;
          objectKey: string;
          width?: number | null;
          height?: number | null;
        };
      }>;
    } | null;
  } | null;
  snapshot?: {
    personalizationJson?: unknown;
  } | null;
}

async function resolveItemPrintMasterUrl(params: {
  item: OrderItemForPrintResolution;
  buyerId: string | null;
}): Promise<string> {
  const { item, buyerId } = params;
  const existingPrintAsset = item.personalizationVersion?.printAsset;

  if (existingPrintAsset?.objectKey) {
    if (
      (existingPrintAsset.width !== null &&
        existingPrintAsset.width !== undefined &&
        existingPrintAsset.width !== PRINT_MASTER_WIDTH) ||
      (existingPrintAsset.height !== null &&
        existingPrintAsset.height !== undefined &&
        existingPrintAsset.height !== PRINT_MASTER_HEIGHT)
    ) {
      throw new OrderFulfillmentValidationError(
        `Existing printAsset ${existingPrintAsset.id} has invalid dimensions ${String(existingPrintAsset.width)}x${String(existingPrintAsset.height)}; expected ${PRINT_MASTER_WIDTH}x${PRINT_MASTER_HEIGHT}`
      );
    }
    return resolvePublicPrintAssetUrl(existingPrintAsset.objectKey);
  }

  // Check if a DesignComposition JSON exists to deterministically render a 4500x5400 @ 300 DPI PRINT_MASTER
  const rawComposition =
    item.personalizationVersion?.session?.compositionJson ??
    item.personalizationVersion?.styleSnapshot ??
    item.snapshot?.personalizationJson ??
    null;

  if (rawComposition !== null && rawComposition !== undefined) {
    const composition = adaptLegacyComposition(rawComposition);
    const rendered = await renderAndStorePrintMaster(composition, {
      ownerId: buyerId,
      designVersionId: item.designVersionId,
      personalizationVersionId: item.personalizationVersion?.id,
      persistAsset: true,
    });

    if (
      rendered.width !== PRINT_MASTER_WIDTH ||
      rendered.height !== PRINT_MASTER_HEIGHT ||
      !rendered.objectKey
    ) {
      throw new OrderFulfillmentValidationError(
        "Generated Print Master failed 4500x5400 verification"
      );
    }

    return resolvePublicPrintAssetUrl(rendered.objectKey);
  }

  // Non-personalized DesignVersion PRINT_MASTER fallback
  const dvPrintMaster = item.personalizationVersion?.designVersion?.assets?.find(
    (a) => a.type === "PRINT_MASTER"
  )?.asset;

  if (dvPrintMaster?.objectKey) {
    if (
      (dvPrintMaster.width !== null &&
        dvPrintMaster.width !== undefined &&
        dvPrintMaster.width !== PRINT_MASTER_WIDTH) ||
      (dvPrintMaster.height !== null &&
        dvPrintMaster.height !== undefined &&
        dvPrintMaster.height !== PRINT_MASTER_HEIGHT)
    ) {
      throw new OrderFulfillmentValidationError(
        `DesignVersion PRINT_MASTER asset has invalid dimensions; expected ${PRINT_MASTER_WIDTH}x${PRINT_MASTER_HEIGHT}`
      );
    }
    return resolvePublicPrintAssetUrl(dvPrintMaster.objectKey);
  }

  throw new OrderFulfillmentValidationError(
    `OrderItem ${item.id} has neither a 4500x5400 printAsset nor a valid DesignComposition`
  );
}

// ── 1. Personalization Job Handler (T-400, T-409) ────────────────────────────

export async function executeGeneratePersonalizationJob(params: {
  event: { data: unknown };
  step: InngestStepRunner;
}) {
  const payload = PersonalizationJobEventSchema.parse(params.event.data);
  const { step } = params;

  const resolvedContext = await step.run(
    "resolve-authoritative-interpretation",
    async () => {
      const session = await prisma.personalizationSession.findUnique({
        where: { id: payload.sessionId },
      });

      const effectiveDesignId = payload.designId ?? session?.designId ?? null;
      const effectiveMode = payload.mode ?? session?.mode ?? "QUOTE";
      const wantsRestyle = Boolean(
        payload.aiRestyle || payload.creatorArtworkUrl
      );

      // Enforce creator policy BEFORE any restyling or calligraphy rendering (T-409, INV-010, INV-012)
      await PolicyGuard.enforcePersonalizationContext({
        designId: effectiveDesignId,
        mode: effectiveMode,
        textTreatment: session?.textTreatment ?? undefined,
        hasCalligraphy: true,
        aiRestyle: wantsRestyle,
        derivative: wantsRestyle,
      });

      if (payload.interpretationId) {
        const interp = await prisma.interpretation.findUnique({
          where: { id: payload.interpretationId },
        });
        if (!interp || interp.sessionId !== payload.sessionId) {
          throw new Error(
            "Authoritative interpretation not found for session"
          );
        }

        const rawSourceText = session?.inputText ?? interp.text;
        const existingPk = await prisma.phraseKnowledge.findFirst({
          where: {
            normalizedInput:
              CulturalKnowledgeService.normalizeInput(rawSourceText),
            targetLanguage: interp.language,
            interpretationType: interp.type,
            renderedText: interp.text,
          },
          select: { id: true },
        });

        return {
          effectiveDesignId,
          interpretationId: interp.id,
          phraseKnowledgeId: existingPk?.id ?? interp.id,
          authoritativeText: interp.text,
          targetLanguage: interp.language,
        };
      }

      const rawInputText = payload.inputText ?? session?.inputText;
      const targetLanguage: SupportedTargetLanguage =
        payload.targetLanguage ??
        ((session?.targetLanguage as SupportedTargetLanguage | null) ||
          "Japanese");

      if (!rawInputText) {
        throw new Error(
          "Personalization job requires either interpretationId or inputText"
        );
      }

      const analysisInput: CulturalAnalysisInput = {
        inputText: rawInputText,
        targetLanguage,
        mode: effectiveMode,
      };

      const analysis = await culturalIntelligence.analyze(analysisInput);
      const primary =
        analysis.interpretations.find((i) => i.recommended) ??
        analysis.interpretations[0];

      const classifiedType = interpretationEngine.classifyInput(rawInputText);
      const storedPk = await CulturalKnowledgeService.storeGenerated({
        rawInput: rawInputText,
        inputType: classifiedType,
        sourceLanguage: analysis.inputAnalysis.detectedLanguage,
        targetLanguage: primary.language,
        interpretationType: primary.type,
        renderedText: primary.text,
        romanization: primary.romanization,
        meaning: primary.meaning,
        explanation: primary.warning,
        confidence: primary.confidence,
        verificationStatus: "GENERATED",
        source: "AI",
      });

      return {
        effectiveDesignId,
        interpretationId: null as string | null,
        phraseKnowledgeId: storedPk.id,
        authoritativeText: primary.text,
        targetLanguage: primary.language,
      };
    }
  );

  let creatorDerivativeUrl: string | null = null;
  if (payload.creatorArtworkUrl) {
    const derivative = await step.run("restyle-creator-artwork", async () => {
      if (!resolvedContext.effectiveDesignId) {
        await PolicyGuard.assertPermission(null, "allowAIRestyle");
      }
      return visualAI.generateCreatorArtworkDerivative({
        designId: resolvedContext.effectiveDesignId ?? "",
        creatorArtworkUrl: payload.creatorArtworkUrl!,
        styleTheme: payload.stylePack,
      });
    });
    creatorDerivativeUrl = derivative.imageUrl;
  }

  // Generate calligraphy candidates strictly via CalligraphyService (T-400, TB-CALLI-002)
  const renderResult = await step.run(
    "render-calligraphy-candidates",
    async () => {
      return CalligraphyService.renderCalligraphy({
        phraseKnowledgeId: resolvedContext.phraseKnowledgeId,
        authoritativeText: resolvedContext.authoritativeText,
        targetLanguage: resolvedContext.targetLanguage,
        stylePackId: payload.stylePack,
        orientationPreference:
          payload.composition === "Vertical" ? "VERTICAL" : "HORIZONTAL",
        variationCount: 6,
      });
    }
  );

  await step.run("store-personalization-results", async () => {
    await prisma.personalizationSession.update({
      where: { id: payload.sessionId },
      data: {
        status: "READY",
        ...(resolvedContext.interpretationId
          ? { selectedInterpretationId: resolvedContext.interpretationId }
          : {}),
      },
    });
    return { sessionId: payload.sessionId, status: "READY" as const };
  });

  return {
    sessionId: payload.sessionId,
    status: "READY" as const,
    rendererVersion: renderResult.rendererVersion,
    script: renderResult.script,
    creatorDerivativeUrl,
    candidates: renderResult.candidates.map((c, index) => ({
      id: c.id,
      index: index + 1,
      imageUrl: c.previewAssetUrl,
      stylePack: c.stylePackId,
      variationType: c.variationType,
      variationName: c.variationName,
      provider: c.provider,
      seed: c.seed,
      validationStatus: c.validationStatus,
    })),
  };
}

export const generatePersonalizationJob = inngest.createFunction(
  {
    id: "personalization-pipeline",
    name: "Personalization Pipeline",
    triggers: [{ event: "personalization/requested" }],
  },
  async ({ event, step }) =>
    executeGeneratePersonalizationJob({
      event: { data: event.data },
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// Backwards-compatible alias
export const personalizationPipeline = generatePersonalizationJob;

export async function triggerPersonalizationPipeline(
  data: PersonalizationRequestedPayload
): Promise<string> {
  const validated = PersonalizationJobEventSchema.parse(data);
  const result = await inngest.send({
    name: "personalization/requested",
    data: validated,
  });
  return (result as { ids?: string[] }).ids?.[0] ?? "queued";
}

// ── 2. Order Fulfillment Pipeline (T-203) ────────────────────────────────────

export async function executeOrderFulfillmentJob(params: {
  event: { data: unknown };
  step: InngestStepRunner;
  printfulClient?: PrintfulFulfillmentClient;
}) {
  const { orderId } = OrderPlacedEventSchema.parse(params.event.data);
  const { step } = params;
  const printfulClient = params.printfulClient ?? defaultPrintful;

  // Step 1: Load Order with buyer, catalogVariant.providerVariants, personalizationVersion.printAsset
  const order = await step.run("fetch-order", async () => {
    const found = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: {
          include: {
            catalogVariant: {
              include: {
                product: true,
                providerVariants: {
                  include: { provider: true },
                },
              },
            },
            personalizationVersion: {
              include: {
                printAsset: true,
                session: true,
                designVersion: {
                  include: {
                    assets: {
                      include: { asset: true },
                    },
                  },
                },
              },
            },
            snapshot: true,
          },
        },
      },
    });

    if (!found) {
      throw new Error(`Order ${orderId} not found`);
    }
    return found;
  });

  if (order.fulfillmentStatus !== "PENDING") {
    return {
      skipped: true as const,
      reason: "Order not in PENDING state",
      providerOrderId: order.externalFulfillmentId ?? null,
    };
  }

  if (order.items.length === 0) {
    throw new OrderFulfillmentValidationError(
      `Order ${order.id} has no items to fulfill`
    );
  }

  // In-house made-to-order items (BRD v1.0 §10) are produced by ThiBút, never by Printful.
  const inHouseItems = order.items.filter(
    (item) => item.catalogVariant?.product?.fulfillmentMode === "IN_HOUSE"
  );
  const providerItems = order.items.filter(
    (item) => item.catalogVariant?.product?.fulfillmentMode !== "IN_HOUSE"
  );

  if (inHouseItems.length > 0) {
    await step.run("notify-in-house-order", async () => {
      const recipientEmail = order.buyer?.email ?? order.buyerEmail ?? null;
      if (!recipientEmail) {
        return { sent: false as const, reason: "no-recipient-email" };
      }
      const result = await sendOrderConfirmationEmail({
        email: recipientEmail,
        orderNumber: order.orderNumber,
        items: inHouseItems.map((item) => ({
          title: item.snapshot?.designTitle ?? "ThiBút keepsake",
          detail: [
            item.snapshot?.productName,
            item.snapshot?.size,
            item.placement === "both" ? "Double-sided" : "Single-sided",
          ]
            .filter((part): part is string => Boolean(part))
            .join(" · "),
          quantity: item.quantity,
        })),
      });
      return { sent: result.sent };
    });
  }

  if (providerItems.length === 0) {
    await step.run("start-in-house-production", async () => {
      await prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: "IN_PRODUCTION" },
      });
      return { fulfillmentStatus: "IN_PRODUCTION" as const };
    });
    return {
      success: true as const,
      providerOrderId: null,
      fulfillmentStatus: "IN_PRODUCTION" as const,
    };
  }

  // Step 2: Create Printful Draft Order (idempotent via external_id: order.orderNumber)
  const draftResult = await step.run("create-printful-draft", async () => {
    if (order.externalFulfillmentId) {
      return { providerOrderId: order.externalFulfillmentId };
    }

    const recipient = parseValidatedOrderRecipient({
      shippingAddressJson: order.shippingAddressJson,
      buyerName: order.buyer?.name ?? "Customer",
      buyerEmail: order.buyer?.email ?? order.buyerEmail ?? null,
    });

    const fulfillmentItems: FulfillmentOrderRequest["items"] = [];

    for (const item of providerItems) {
      const externalVariantId = resolvePrintfulExternalVariantId(
        item.catalogVariant?.providerVariants
      );
      const printMasterUrl = await resolveItemPrintMasterUrl({
        item,
        buyerId: order.buyerId ?? null,
      });

      const placementOpt = (item.placement || "front").toLowerCase();
      const files =
        placementOpt === "both"
          ? [
              { url: printMasterUrl, placement: "front" },
              { url: printMasterUrl, placement: "back" },
            ]
          : [{ url: printMasterUrl, placement: placementOpt }];

      fulfillmentItems.push({
        variantId: externalVariantId,
        quantity: item.quantity,
        files,
      });
    }

    const draftOrder = await printfulClient.createDraftOrder({
      externalId: order.orderNumber,
      recipient,
      items: fulfillmentItems,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        externalFulfillmentId: draftOrder.id,
      },
    });

    return { providerOrderId: draftOrder.id };
  });

  // Step 3: Confirm Printful Order & Transition Order.fulfillmentStatus -> PROCESSING
  await step.run("confirm-printful-order", async () => {
    await printfulClient.confirmOrder(draftResult.providerOrderId);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        externalFulfillmentId: draftResult.providerOrderId,
        fulfillmentStatus: "PROCESSING",
      },
    });

    return {
      providerOrderId: draftResult.providerOrderId,
      fulfillmentStatus: "PROCESSING" as const,
    };
  });

  return {
    success: true as const,
    providerOrderId: draftResult.providerOrderId,
    fulfillmentStatus: "PROCESSING" as const,
  };
}

export const processOrderFulfillment = inngest.createFunction(
  {
    id: "process-order-fulfillment",
    name: "Process Order Fulfillment",
    triggers: [{ event: "order/placed" }],
  },
  async ({ event, step }) =>
    executeOrderFulfillmentJob({
      event: { data: event.data },
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

export async function triggerOrderFulfillment(
  orderId: string
): Promise<string> {
  const validated = OrderPlacedEventSchema.parse({ orderId });
  const result = await inngest.send({
    name: "order/placed",
    data: validated,
  });
  return (result as { ids?: string[] }).ids?.[0] ?? "queued";
}

// ── 3. Durable Post-Commit Order Paid Side Effects (R-203) ───────────────────

export async function executeDeliverOrderPaidEffects(params: {
  event: { data: unknown };
  step: InngestStepRunner;
  emailSender?: (
    input: DigitalDownloadEmailParams
  ) => Promise<{ sent: boolean; downloadLink: string }>;
}) {
  const payload = OrderPaidEventSchema.parse(params.event.data);
  const { step } = params;
  const emailSender = params.emailSender ?? sendDigitalDownloadEmail;

  const sentItemIds: string[] = [];
  if (payload.buyerEmail && payload.digitalItems.length > 0) {
    for (const item of payload.digitalItems) {
      await step.run(`send-digital-email-${item.orderItemId}`, async () =>
        emailSender({
          email: payload.buyerEmail!,
          orderNumber: payload.orderNumber,
          orderId: payload.orderId,
          orderItemId: item.orderItemId,
          productName: item.productName,
        })
      );
      sentItemIds.push(item.orderItemId);
    }
  }

  return {
    orderId: payload.orderId,
    emailsDispatched: sentItemIds.length,
    sentItemIds,
  };
}

export const deliverOrderPaidEffects = inngest.createFunction(
  {
    id: "deliver-order-paid-effects",
    name: "Deliver Order Paid Effects",
    retries: 5,
    triggers: [{ event: "order/paid" }],
  },
  async ({ event, step }) =>
    executeDeliverOrderPaidEffects({
      event: { data: event.data },
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// ── 4. Hourly Abandoned Pending Order Cleanup Cron (R-105) ───────────────────

export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export async function executeCleanupExpiredPendingOrders(params: {
  step: InngestStepRunner;
  now?: Date;
}) {
  const { step } = params;
  const now = params.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - PENDING_ORDER_TTL_MS);

  return step.run("cancel-expired-pending-orders", async () => {
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        createdAt: { lt: staleCutoff },
      },
      include: {
        items: {
          include: {
            personalizationVersion: true,
          },
        },
      },
      take: 250,
    });

    if (expiredOrders.length === 0) {
      return { cancelledOrders: 0, unlockedSessions: 0, revertedCarts: 0 };
    }

    const orderIds = expiredOrders.map((o) => o.id);
    const sessionIds = Array.from(
      new Set(
        expiredOrders.flatMap((o) =>
          o.items
            .map((i) => i.personalizationVersion?.sessionId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      )
    );

    const linkedQuotes = await prisma.priceQuote.findMany({
      where: { orderId: { in: orderIds } },
      select: { cartId: true },
    });
    const cartIds = Array.from(
      new Set(
        linkedQuotes
          .map((q) => q.cartId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    return prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: {
          id: { in: orderIds },
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: now,
        },
      });

      const unlocked =
        sessionIds.length > 0
          ? await tx.personalizationSession.updateMany({
              where: {
                id: { in: sessionIds },
                status: "CHECKED_OUT",
              },
              data: { status: "SELECTED" },
            })
          : { count: 0 };

      const reverted =
        cartIds.length > 0
          ? await tx.cart.updateMany({
              where: {
                id: { in: cartIds },
                status: "CHECKOUT",
              },
              data: { status: "ACTIVE" },
            })
          : { count: 0 };

      return {
        cancelledOrders: cancelled.count,
        unlockedSessions: unlocked.count,
        revertedCarts: reverted.count,
      };
    });
  });
}

export const cleanupExpiredPendingOrders = inngest.createFunction(
  {
    id: "cleanup-expired-pending-orders",
    name: "Cleanup Expired Pending Orders",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) =>
    executeCleanupExpiredPendingOrders({
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// ── 5. Stale Unversioned Draft Session Cleanup Cron (R-301) ──────────────────

export const STALE_DRAFT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function executeCleanupStaleDraftSessions(params: {
  step: InngestStepRunner;
  now?: Date;
}) {
  const { step } = params;
  const now = params.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DRAFT_SESSION_TTL_MS);

  return step.run("delete-stale-draft-sessions", async () => {
    const staleSessions = await prisma.personalizationSession.findMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: staleCutoff },
        versions: { none: {} },
      },
      select: { id: true },
      take: 500,
    });

    if (staleSessions.length === 0) {
      return { deletedSessions: 0 };
    }

    const sessionIds = staleSessions.map((s) => s.id);
    return prisma.$transaction(async (tx) => {
      const comps = await tx.userComposition.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      if (comps.length > 0) {
        const compIds = comps.map((c) => c.id);
        await tx.userCompositionLayer.deleteMany({
          where: { compositionId: { in: compIds } },
        });
        await tx.userComposition.deleteMany({
          where: { id: { in: compIds } },
        });
      }
      await tx.personalizationCandidate.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      await tx.interpretation.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      const deleted = await tx.personalizationSession.deleteMany({
        where: {
          id: { in: sessionIds },
          status: "DRAFT",
          versions: { none: {} },
        },
      });
      return { deletedSessions: deleted.count };
    });
  });
}

export const cleanupStaleDraftSessions = inngest.createFunction(
  {
    id: "cleanup-stale-draft-sessions",
    name: "Cleanup Stale Draft Sessions",
    triggers: [{ cron: "15 3 * * *" }],
  },
  async ({ step }) =>
    executeCleanupStaleDraftSessions({
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

export const inngestFunctions = [
  generatePersonalizationJob,
  processOrderFulfillment,
  deliverOrderPaidEffects,
  cleanupExpiredPendingOrders,
  cleanupStaleDraftSessions,
];
