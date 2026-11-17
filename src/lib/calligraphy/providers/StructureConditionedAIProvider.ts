import { deterministicUid } from "@/lib/security/xml";
import { CalligraphyValidationService } from "../CalligraphyValidationService";
import { ScriptDetector, UnsupportedScriptError } from "../ScriptDetector";
import { StructureGuideGenerator } from "../StructureGuideGenerator";
import type {
  BrushVariationType,
  CalligraphyCandidate,
  CalligraphyRenderRequest,
  CalligraphyRenderResult,
  CalligraphyRendererProvider,
  CommercialLicensingStatus,
  RendererCapabilities,
} from "../types";

export class StructureConditionedAIProvider implements CalligraphyRendererProvider {
  public readonly id = "structure-guided-ai-v1";
  public readonly name = "Structure-Conditioned AI Brush Engine";
  public readonly version = "0.2.0-poc";
  public readonly commercialLicensingStatus: CommercialLicensingStatus =
    "PROPRIETARY_VERIFIED";

  public async getCapabilities(): Promise<RendererCapabilities> {
    return {
      supportedScripts: [
        "HAN",
        "JAPANESE_MIXED",
        "KOREAN_HANGUL",
        "VIETNAMESE_LATIN",
        "LATIN",
      ],
      supportsVectorSvg: false,
      supportsTransparentPng: true,
      supportsRealTimeStrokeSynthesis: false,
      maxBatchSize: 6,
      requiresGpu: true,
      commercialLicensingStatus: this.commercialLicensingStatus,
    };
  }

  public async validateAvailability(): Promise<boolean> {
    return Boolean(
      process.env.OPENAI_API_KEY ||
        process.env.FAL_KEY ||
        process.env.GEMINI_API_KEY
    );
  }

  public async generate(
    request: CalligraphyRenderRequest
  ): Promise<CalligraphyRenderResult> {
    const startTime = Date.now();
    const normalizedText = request.authoritativeText.normalize("NFC").trim();
    const detectedScript =
      request.script === "UNKNOWN"
        ? "UNKNOWN"
        : ScriptDetector.detect(normalizedText);

    if (detectedScript === "UNKNOWN") {
      throw new UnsupportedScriptError(normalizedText);
    }

    const isVertical = request.orientationPreference === "VERTICAL";
    const structureGuide = await StructureGuideGenerator.generate(
      normalizedText,
      detectedScript,
      isVertical
    );

    const variationTypes: ReadonlyArray<{
      type: BrushVariationType;
      name: string;
      note: string;
    }> = [
      {
        type: "01_CONTROLLED",
        name: "Controlled",
        note: "Balanced classical strokes, restrained sumi ink density.",
      },
      {
        type: "02_BOLD",
        name: "Bold",
        note: "Heavy pressure and strong ink mass with deep authoritative strokes.",
      },
      {
        type: "03_DRY_BRUSH",
        name: "Dry Brush",
        note: "Visible bristle texture and broken dry ink edges (Hihaku effect).",
      },
      {
        type: "04_EXPRESSIVE",
        name: "Expressive",
        note: "Dynamic gestural energy, fluid speed, and organic stroke movement.",
      },
      {
        type: "05_MINIMAL",
        name: "Minimal",
        note: "Light pressure, delicate touch, and generous negative space.",
      },
      {
        type: "06_SIGNATURE",
        name: "Signature",
        note: "Balanced master composition complete with authentic red vermilion seal stamp.",
      },
    ];

    const count = Math.min(Math.max(request.variationCount || 6, 1), 6);
    const candidates: CalligraphyCandidate[] = [];

    for (let i = 0; i < count; i++) {
      const itemStart = Date.now();
      const v = variationTypes[i];
      const seed = (request.seed ?? 2000) + i * 23;

      // Raster/AI image candidates lack vector glyph verification -> gated as REVIEW (TB-CALLI-003)
      const validation = await CalligraphyValidationService.validate({
        authoritativeText: normalizedText,
        detectedScript,
        stylePackId: request.stylePackId,
        renderedImageUrl: structureGuide.svgDataUri,
      });

      candidates.push({
        id: deterministicUid(
          `${request.phraseKnowledgeId || "ai"}|${v.type}|${seed}`,
          "ai-cand"
        ),
        variationType: v.type,
        variationName: v.name,
        variationNote: v.note,
        authoritativeText: normalizedText,
        previewAssetUrl: structureGuide.svgDataUri,
        structureGuideUrl: structureGuide.svgDataUri,
        provider: this.id,
        model: "Structure-Conditioned-Vision-v1",
        modelVersion: this.version,
        stylePackId: request.stylePackId,
        seed,
        validationStatus: validation.status,
        validationReasons: validation.reasons,
        generationDurationMs: Math.max(1, Date.now() - itemStart),
        createdAt: new Date(),
      });
    }

    return {
      phraseKnowledgeId: request.phraseKnowledgeId,
      stylePackId: request.stylePackId,
      rendererVersion: this.version,
      script: detectedScript,
      candidates,
      durationMs: Date.now() - startTime,
      cacheHit: false,
    };
  }
}
