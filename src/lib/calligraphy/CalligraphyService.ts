import {
  CalligraphyRendererProvider,
  CalligraphyRenderRequest,
  CalligraphyRenderResult,
  CalligraphyCandidate,
  ScriptType,
} from "./types";
import { ScriptDetector } from "./ScriptDetector";
import { DeterministicBrushProvider } from "./providers/DeterministicBrushProvider";
import { StructureConditionedAIProvider } from "./providers/StructureConditionedAIProvider";
import { CalliffusionProvider } from "./providers/CalliffusionProvider";
import { DesignCacheService } from "../services/DesignCacheService";

export class CalligraphyService {
  private static providers: Map<string, CalligraphyRendererProvider> = new Map([
    ["deterministic-brush-v1", new DeterministicBrushProvider()],
    ["structure-guided-ai-v1", new StructureConditionedAIProvider()],
    ["calliffusion-v2-candidate", new CalliffusionProvider()],
  ]);

  private static defaultProviderId = "deterministic-brush-v1";

  /**
   * Main entry point to render calligraphy candidates for a given authoritative text.
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
  }): Promise<CalligraphyRenderResult> {
    const startTime = Date.now();
    const { phraseKnowledgeId, authoritativeText, stylePackId, orientationPreference, variationCount = 6 } = params;

    // 1. Detect Script Family
    const detectedScript = ScriptDetector.detect(authoritativeText);

    // 2. Validate Compatibility
    const compatibility = ScriptDetector.isScriptCompatible(detectedScript, stylePackId);
    const effectiveStylePackId = compatibility.recommendedStylePackId;

    // 3. Cache Lookup (TB-CALLI-010)
    const cachedDesign = await DesignCacheService.findReusableDesign({
      phraseKnowledgeId,
      stylePackId: effectiveStylePackId,
      rendererVersion: "V1",
    });

    if (cachedDesign && cachedDesign.variations && cachedDesign.variations.length >= variationCount) {
      console.log(`[CalligraphyService] CACHE HIT: Found ${cachedDesign.variations.length} variations for phrase ${phraseKnowledgeId}`);
      
      const cachedCandidates: CalligraphyCandidate[] = cachedDesign.variations.map((v) => ({
        id: v.id,
        variationType: (v.variationNote?.split(":")[0] || "01_CONTROLLED") as any,
        variationName: v.variationNote?.split(":")[1]?.trim() || "Brush Variation",
        variationNote: v.variationNote || "Cached brush variation",
        authoritativeText,
        previewAssetUrl: v.assetId,
        productionAssetUrl: v.assetId,
        provider: v.provider,
        stylePackId: effectiveStylePackId,
        seed: v.variationIndex * 17,
        validationStatus: v.status === "READY" ? "PASS" : "FAIL",
        validationReasons: ["Restored from verified design cache (TB-CALLI-010)."],
        generationDurationMs: 5,
        createdAt: new Date(),
      }));

      return {
        phraseKnowledgeId,
        stylePackId: effectiveStylePackId,
        rendererVersion: "V1",
        candidates: cachedCandidates,
        durationMs: Date.now() - startTime,
        cacheHit: true,
      };
    }

    // 4. Select Provider
    const providerId = params.providerId || this.defaultProviderId;
    const provider = this.providers.get(providerId) || this.providers.get(this.defaultProviderId)!;

    // 5. Generate Raw Candidates
    const renderRequest: CalligraphyRenderRequest = {
      phraseKnowledgeId,
      authoritativeText,
      script: detectedScript,
      language: params.targetLanguage || "Unknown",
      stylePackId: effectiveStylePackId,
      variationCount,
      orientationPreference,
      rendererVersion: provider.version,
      seed: params.seed || 1000,
    };

    const result = await provider.generate(renderRequest);

    // 6. Filter Out Failed Candidates (TB-CALLI-003)
    const approvedCandidates = result.candidates.filter(
      (c) => c.validationStatus === "PASS" || c.validationStatus === "REVIEW"
    );

    // 7. Store Approved Variations in Cache
    if (approvedCandidates.length > 0) {
      await DesignCacheService.storeRenderedDesign({
        phraseKnowledgeId,
        stylePackId: effectiveStylePackId,
        rendererVersion: "V1",
        variations: approvedCandidates.map((c, idx) => ({
          variationIndex: idx + 1,
          variationNote: `${c.variationType}: ${c.variationName}`,
          renderedText: authoritativeText,
          assetId: c.previewAssetUrl,
          provider: c.provider,
          status: "READY",
        })),
      }).catch((err) => {
        console.warn("[CalligraphyService] Cache store warning:", err.message);
      });
    }

    return {
      phraseKnowledgeId,
      stylePackId: effectiveStylePackId,
      rendererVersion: provider.version,
      candidates: approvedCandidates,
      durationMs: Date.now() - startTime,
      cacheHit: false,
    };
  }

  public static getRegisteredProviders(): { id: string; name: string; version: string }[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
    }));
  }
}
