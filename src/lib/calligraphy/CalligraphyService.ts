import { DesignCacheService } from "../services/DesignCacheService";
import { CalliffusionProvider } from "./providers/CalliffusionProvider";
import { DeterministicBrushProvider } from "./providers/DeterministicBrushProvider";
import { StructureConditionedAIProvider } from "./providers/StructureConditionedAIProvider";
import { ScriptDetector, UnsupportedScriptError } from "./ScriptDetector";
import type {
  BrushVariationType,
  CalligraphyCandidate,
  CalligraphyRenderRequest,
  CalligraphyRenderResult,
  CalligraphyRendererProvider,
} from "./types";

const MAX_DERIVATIVE_SVG_BYTES = 100 * 1024; // 100 KB ceiling (T-405)

const VALID_VARIATION_TYPES = new Set<BrushVariationType>([
  "01_CONTROLLED",
  "02_BOLD",
  "03_DRY_BRUSH",
  "04_EXPRESSIVE",
  "05_MINIMAL",
  "06_SIGNATURE",
]);

function parseVariationNote(rawNote: string | null | undefined): {
  variationType: BrushVariationType;
  variationName: string;
  variationNote: string;
} {
  const safe = rawNote?.trim() || "01_CONTROLLED|Controlled|Cached brush variation";
  const parts = safe.split("|");
  if (parts.length >= 3 && VALID_VARIATION_TYPES.has(parts[0] as BrushVariationType)) {
    return {
      variationType: parts[0] as BrushVariationType,
      variationName: parts[1],
      variationNote: parts.slice(2).join("|"),
    };
  }
  const colonIdx = safe.indexOf(":");
  if (colonIdx > 0) {
    const prefix = safe.slice(0, colonIdx).trim();
    if (VALID_VARIATION_TYPES.has(prefix as BrushVariationType)) {
      return {
        variationType: prefix as BrushVariationType,
        variationName: safe.slice(colonIdx + 1).trim() || "Brush Variation",
        variationNote: safe,
      };
    }
  }
  return {
    variationType: "01_CONTROLLED",
    variationName: safe,
    variationNote: safe,
  };
}

export class ProviderLicenseError extends Error {
  public readonly status = 403 as const;
  public readonly providerId: string;

  constructor(providerId: string, licensingStatus: string) {
    super(
      `Calligraphy provider "${providerId}" rejected by commercial licensing gate (status="${licensingStatus}", TB-CALLI-008)`
    );
    this.name = "ProviderLicenseError";
    this.providerId = providerId;
  }
}

export class ProviderUnavailableError extends Error {
  public readonly status = 503 as const;
  public readonly providerId: string;

  constructor(providerId: string) {
    super(`Calligraphy provider "${providerId}" is currently unavailable`);
    this.name = "ProviderUnavailableError";
    this.providerId = providerId;
  }
}

export class CalligraphyService {
  private static providers: Map<string, CalligraphyRendererProvider> = new Map<
    string,
    CalligraphyRendererProvider
  >([
    ["deterministic-brush-v1", new DeterministicBrushProvider()],
    ["structure-guided-ai-v1", new StructureConditionedAIProvider()],
    ["calliffusion-v2-candidate", new CalliffusionProvider()],
  ]);

  private static readonly defaultProviderId = "deterministic-brush-v1";

  public static registerProviderForTest(
    provider: CalligraphyRendererProvider
  ): void {
    this.providers.set(provider.id, provider);
  }

  public static unregisterProviderForTest(providerId: string): void {
    this.providers.delete(providerId);
  }

  /**
   * Renders calligraphy candidates for an authoritative text (TB-CALLI-001..010).
   *
   * - Enforces central commercial licensing gate (`APPROVED` | `PROPRIETARY_VERIFIED`) + `validateAvailability()` (T-407, TB-CALLI-008).
   * - Throws `UnsupportedScriptError` for `UNKNOWN` scripts (TB-CALLI-006).
   * - Keys cache deterministically on `(phraseKnowledgeId, stylePackId, provider.version, script)` (T-403, TB-CALLI-010).
   * - Filters out `REVIEW` / `FAIL` / `REJECTED` candidates from customer-facing responses (TB-CALLI-003).
   */
  public static async renderCalligraphy(params: {
    phraseKnowledgeId: string;
    authoritativeText: string;
    targetLanguage?: string | null;
    stylePackId: string;
    orientationPreference?: "AUTO" | "VERTICAL" | "HORIZONTAL";
    variationCount?: number;
    providerId?: string;
    seed?: number;
    includeReviewCandidates?: boolean;
  }): Promise<CalligraphyRenderResult> {
    const startTime = Date.now();
    const {
      phraseKnowledgeId,
      authoritativeText,
      stylePackId,
      orientationPreference,
      variationCount = 6,
      includeReviewCandidates = false,
    } = params;

    // 1. Resolve Provider & Enforce Central Commercial Licensing Gate (T-407, TB-CALLI-008)
    const requestedProviderId = params.providerId ?? this.defaultProviderId;
    const provider = this.providers.get(requestedProviderId);
    if (!provider) {
      throw new ProviderLicenseError(requestedProviderId, "UNREGISTERED");
    }

    const capabilities = await provider.getCapabilities();
    const effectiveLicenseStatus =
      provider.commercialLicensingStatus ?? capabilities.commercialLicensingStatus;

    if (
      effectiveLicenseStatus !== "APPROVED" &&
      effectiveLicenseStatus !== "PROPRIETARY_VERIFIED"
    ) {
      throw new ProviderLicenseError(provider.id, effectiveLicenseStatus);
    }

    if (
      capabilities.commercialLicensingStatus !== "APPROVED" &&
      capabilities.commercialLicensingStatus !== "PROPRIETARY_VERIFIED"
    ) {
      throw new ProviderLicenseError(
        provider.id,
        capabilities.commercialLicensingStatus
      );
    }

    const available = await provider.validateAvailability();
    if (!available) {
      throw new ProviderUnavailableError(provider.id);
    }

    // 2. Detect Script Family & Reject UNKNOWN (TB-CALLI-006)
    const normalizedText = authoritativeText.normalize("NFC").trim();
    const detectedScript = ScriptDetector.detect(normalizedText);
    if (detectedScript === "UNKNOWN") {
      throw new UnsupportedScriptError(normalizedText);
    }

    // 3. Deterministic Cache Lookup (T-403, TB-CALLI-010)
    // Keyed on { phraseKnowledgeId, stylePackId, rendererVersion: provider.version, script: detectedScript }
    let cachedDesign: Awaited<
      ReturnType<typeof DesignCacheService.findReusableDesign>
    > = null;
    try {
      cachedDesign = await DesignCacheService.findReusableDesign({
        phraseKnowledgeId,
        stylePackId,
        rendererVersion: provider.version,
        script: detectedScript,
      });
    } catch {
      // Allow offline execution when DB is unreachable
      cachedDesign = null;
    }

    if (cachedDesign && cachedDesign.variations.length > 0) {
      const readyVariations = cachedDesign.variations.filter(
        (v) => v.status === "READY"
      );

      if (readyVariations.length >= variationCount) {
        await DesignCacheService.recordUsage(cachedDesign.id).catch(() => undefined);

        const cachedCandidates: CalligraphyCandidate[] = readyVariations
          .slice(0, variationCount)
          .map((v) => {
            const parsed = parseVariationNote(v.variationNote);
            return {
              id: v.id,
              variationType: parsed.variationType,
              variationName: parsed.variationName,
              variationNote: parsed.variationNote,
              authoritativeText: normalizedText,
              previewAssetUrl: v.assetId,
              productionAssetUrl: v.assetId,
              provider: v.provider,
              modelVersion: cachedDesign.rendererVersion,
              stylePackId,
              seed: v.variationIndex * 17,
              validationStatus: "PASS",
              validationReasons: [
                "Restored from verified deterministic design cache (TB-CALLI-010).",
              ],
              generationDurationMs: 1,
              createdAt: cachedDesign.createdAt ?? new Date(),
            };
          });

        return {
          phraseKnowledgeId,
          stylePackId,
          rendererVersion: cachedDesign.rendererVersion,
          script: detectedScript,
          candidates: cachedCandidates,
          durationMs: Date.now() - startTime,
          cacheHit: true,
        };
      }
    }

    // 4. Generate Raw Candidates
    const renderRequest: CalligraphyRenderRequest = {
      phraseKnowledgeId,
      authoritativeText: normalizedText,
      script: detectedScript,
      language: params.targetLanguage || "Unknown",
      stylePackId,
      variationCount,
      orientationPreference,
      rendererVersion: provider.version,
      seed: params.seed ?? 1000,
    };

    const result = await provider.generate(renderRequest);

    // 5. Enforce TB-CALLI-003 Customer Visibility Gate + T-405 Lightweight Payload Ceiling
    const customerReadyCandidates = result.candidates.filter((c) => {
      if (
        c.humanReviewStatus === "REJECTED" ||
        c.humanReviewStatus === "UNSURE"
      ) {
        return false;
      }
      if (
        c.productionSvg &&
        Buffer.byteLength(c.productionSvg, "utf8") >= MAX_DERIVATIVE_SVG_BYTES
      ) {
        return false;
      }
      if (includeReviewCandidates) {
        return c.validationStatus === "PASS" || c.validationStatus === "REVIEW";
      }
      return c.validationStatus === "PASS";
    });

    // Only persist strictly PASS / customer-approved variations in GeneratedDesign cache
    const cacheableCandidates = customerReadyCandidates.filter(
      (c) =>
        c.validationStatus === "PASS" &&
        Buffer.byteLength(c.previewAssetUrl, "utf8") < MAX_DERIVATIVE_SVG_BYTES
    );

    if (cacheableCandidates.length > 0) {
      await DesignCacheService.storeRenderedDesign({
        phraseKnowledgeId,
        stylePackId,
        rendererVersion: provider.version,
        script: detectedScript,
        variations: cacheableCandidates.map((c, idx) => ({
          variationIndex: idx + 1,
          variationNote: `${c.variationType}|${c.variationName}|${c.variationNote}`,
          renderedText: normalizedText,
          assetId: c.productionAssetUrl ?? c.previewAssetUrl,
          provider: c.provider,
          status: "READY",
        })),
      }).catch(() => {
        // Non-fatal in offline/read-only environments
      });
    }

    return {
      phraseKnowledgeId,
      stylePackId,
      rendererVersion: provider.version,
      script: detectedScript,
      candidates: customerReadyCandidates,
      durationMs: Date.now() - startTime,
      cacheHit: false,
    };
  }

  public static getRegisteredProviders(): {
    id: string;
    name: string;
    version: string;
    commercialLicensingStatus: string;
  }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      commercialLicensingStatus: p.commercialLicensingStatus,
    }));
  }
}
