import {
  DEFAULT_SEAL_FONT_FAMILY,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import { deterministicUid, escapeXml } from "@/lib/security/xml";
import { CalligraphyValidationService } from "../CalligraphyValidationService";
import { ScriptDetector, UnsupportedScriptError } from "../ScriptDetector";
import { StructureGuideGenerator } from "../StructureGuideGenerator";
import {
  type CalligraphyCandidate,
  type CalligraphyRenderRequest,
  type CalligraphyRenderResult,
  type CalligraphyRendererProvider,
  type CommercialLicensingStatus,
  type RendererCapabilities,
  type ScriptType,
  type VariationStrategyConfig,
} from "../types";
import { VietnameseThuPhapSynthesizer } from "../VietnameseThuPhapSynthesizer";

interface ResolvedProviderFont {
  fontFile: string;
  fontName: string;
  useThuPhapSynthesizer: boolean;
}

export class DeterministicBrushProvider implements CalligraphyRendererProvider {
  public readonly id = "deterministic-brush-v1";
  public readonly name = "Thi Bút Deterministic Brush Engine";
  public readonly version = "2.0.0-outlined-master";
  public readonly commercialLicensingStatus: CommercialLicensingStatus = "APPROVED";

  private readonly variationConfigs: VariationStrategyConfig[] = [
    {
      type: "01_CONTROLLED",
      name: "Controlled",
      description:
        "Balanced strokes and restrained ink with clean classical precision.",
      pressureMultiplier: 1.0,
      dryBrushIntensity: 0.1,
      energyFactor: 0.8,
      inkBleed: 0.1,
      includeSeal: false,
    },
    {
      type: "02_BOLD",
      name: "Bold",
      description:
        "Heavy pressure and strong ink mass with deep authoritative strokes.",
      pressureMultiplier: 1.38,
      dryBrushIntensity: 0.05,
      energyFactor: 1.1,
      inkBleed: 0.28,
      includeSeal: false,
    },
    {
      type: "03_DRY_BRUSH",
      name: "Dry Brush",
      description:
        "Visible bristle texture and broken dry ink edges (Hihaku effect).",
      pressureMultiplier: 0.92,
      dryBrushIntensity: 0.65,
      energyFactor: 1.2,
      inkBleed: 0.0,
      includeSeal: false,
    },
    {
      type: "04_EXPRESSIVE",
      name: "Expressive",
      description:
        "Dynamic gestural energy, fluid speed, and organic stroke movement.",
      pressureMultiplier: 1.15,
      dryBrushIntensity: 0.3,
      energyFactor: 1.48,
      inkBleed: 0.22,
      includeSeal: false,
    },
    {
      type: "05_MINIMAL",
      name: "Minimal",
      description:
        "Light pressure, delicate touch, and generous negative space.",
      pressureMultiplier: 0.78,
      dryBrushIntensity: 0.15,
      energyFactor: 0.6,
      inkBleed: 0.05,
      includeSeal: false,
    },
    {
      type: "06_SIGNATURE",
      name: "Signature",
      description:
        "Balanced master composition complete with authentic red vermilion seal stamp.",
      pressureMultiplier: 1.05,
      dryBrushIntensity: 0.2,
      energyFactor: 0.9,
      inkBleed: 0.15,
      includeSeal: true,
    },
  ];

  public async getCapabilities(): Promise<RendererCapabilities> {
    return {
      supportedScripts: [
        "HAN",
        "JAPANESE_MIXED",
        "KOREAN_HANGUL",
        "VIETNAMESE_LATIN",
        "LATIN",
      ],
      supportsVectorSvg: true,
      supportsTransparentPng: true,
      supportsRealTimeStrokeSynthesis: true,
      maxBatchSize: 6,
      requiresGpu: false,
      commercialLicensingStatus: this.commercialLicensingStatus,
    };
  }

  public async validateAvailability(): Promise<boolean> {
    return true;
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

    const count = Math.min(Math.max(request.variationCount || 6, 1), 6);
    const selectedConfigs = this.variationConfigs.slice(0, count);
    const isVertical = request.orientationPreference === "VERTICAL";

    const structureGuide = await StructureGuideGenerator.generate(
      normalizedText,
      detectedScript,
      isVertical
    );

    const resolvedFont = await this.resolveFontForRequest(
      normalizedText,
      detectedScript,
      request.stylePackId
    );

    const candidates: CalligraphyCandidate[] = [];

    for (let i = 0; i < selectedConfigs.length; i++) {
      const candidateStart = Date.now();
      const config = selectedConfigs[i];
      const variationSeed = (request.seed ?? 1000) + i * 17;

      const svgOutput = await this.renderBrushSvg({
        text: normalizedText,
        script: detectedScript,
        config,
        isVertical,
        seed: variationSeed,
        stylePackId: request.stylePackId,
        resolvedFont,
      });

      const validation = await CalligraphyValidationService.validate({
        authoritativeText: normalizedText,
        detectedScript,
        stylePackId: request.stylePackId,
        fontFamily: resolvedFont.fontFile,
        renderedSvg: svgOutput,
      });

      const candidateId = deterministicUid(
        `${request.phraseKnowledgeId || "cand"}|${request.stylePackId}|${config.type}|${variationSeed}`,
        "cand"
      );
      const previewDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgOutput)}`;

      candidates.push({
        id: candidateId,
        variationType: config.type,
        variationName: config.name,
        variationNote: config.description,
        authoritativeText: normalizedText,
        fontFamily: resolvedFont.fontName,
        previewAssetUrl: previewDataUri,
        productionSvg: svgOutput,
        productionAssetUrl: previewDataUri,
        structureGuideUrl: structureGuide.svgDataUri,
        provider: this.id,
        model: "Deterministic-Brush-Synthesizer",
        modelVersion: this.version,
        stylePackId: request.stylePackId,
        seed: variationSeed,
        validationStatus: validation.status,
        validationReasons: validation.reasons,
        generationDurationMs: Math.max(1, Date.now() - candidateStart),
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

  private async resolveFontForRequest(
    text: string,
    script: ScriptType,
    stylePackId: string
  ): Promise<ResolvedProviderFont> {
    if (script === "UNKNOWN") {
      throw new UnsupportedScriptError(text);
    }

    // Explicit Japanese Shodō style packs / font selections
    if (
      stylePackId === "Japanese 1" ||
      stylePackId === "Shodō" ||
      stylePackId.includes("Boku")
    ) {
      return {
        fontFile: "YujiBoku-Regular.ttf",
        fontName: "Yuji Boku",
        useThuPhapSynthesizer: false,
      };
    }
    if (stylePackId === "Japanese 2" || stylePackId.includes("Syuku")) {
      // T-402 / TB-CALLI-006: Must map to YujiSyuku-Regular.ttf (NEVER silently alias YujiBoku!)
      return {
        fontFile: "YujiSyuku-Regular.ttf",
        fontName: "Yuji Syuku",
        useThuPhapSynthesizer: false,
      };
    }
    if (stylePackId === "Japanese 3" || stylePackId.includes("Mai")) {
      return {
        fontFile: "YujiMai-Regular.ttf",
        fontName: "Yuji Mai",
        useThuPhapSynthesizer: false,
      };
    }

    // Explicit Chinese Shūfǎ style packs / font selections
    if (stylePackId === "Chinese 1" || stylePackId.includes("Liu Jian")) {
      return {
        fontFile: "LiuJianMaoCao-Regular.ttf",
        fontName: "Liu Jian Mao Cao",
        useThuPhapSynthesizer: false,
      };
    }
    if (stylePackId === "Chinese 2" || stylePackId.includes("Long Cang")) {
      return {
        fontFile: "LongCang-Regular.ttf",
        fontName: "Long Cang",
        useThuPhapSynthesizer: false,
      };
    }
    if (stylePackId === "Chinese 3" || stylePackId.includes("Ma Shan")) {
      return {
        fontFile: "MaShanZheng-Regular.ttf",
        fontName: "Ma Shan Zheng",
        useThuPhapSynthesizer: false,
      };
    }
    if (stylePackId === "Chinese 4" || stylePackId.includes("Zhi Mang")) {
      return {
        fontFile: "ZhiMangXing-Regular.ttf",
        fontName: "Zhi Mang Xing",
        useThuPhapSynthesizer: false,
      };
    }

    // Explicit Korean Seoye style packs / font selections
    if (stylePackId === "Korean 1" || stylePackId.includes("Nanum")) {
      return {
        fontFile: "NanumBrushScript-Regular.ttf",
        fontName: "Nanum Brush Script",
        useThuPhapSynthesizer: false,
      };
    }
    if (
      stylePackId === "Korean 2" ||
      stylePackId.includes("Dokdo") ||
      stylePackId.includes("East Sea")
    ) {
      return {
        fontFile: "EastSeaDokdo-Regular.ttf",
        fontName: "East Sea Dokdo",
        useThuPhapSynthesizer: false,
      };
    }

    // Explicit Vietnamese Thư Pháp style packs
    if (
      stylePackId.startsWith("Thi Bút") ||
      stylePackId.toLowerCase().includes("utm") ||
      stylePackId.toLowerCase().includes("great vibes") ||
      stylePackId.toLowerCase().includes("long vũ") ||
      stylePackId.toLowerCase().includes("allura") ||
      stylePackId.toLowerCase().includes("lưu thủy") ||
      stylePackId.toLowerCase().includes("kaushan") ||
      stylePackId.toLowerCase().includes("phi bạch") ||
      stylePackId.toLowerCase().includes("caveat") ||
      stylePackId.toLowerCase().includes("mực nho") ||
      stylePackId.toLowerCase().includes("arizonia") ||
      stylePackId.toLowerCase().includes("phượng vũ") ||
      stylePackId.toLowerCase().includes("alex brush") ||
      stylePackId.toLowerCase().includes("khí phách")
    ) {
      const cfg = VietnameseThuPhapSynthesizer.resolveFontConfig(stylePackId);
      return {
        fontFile: cfg.fontFile,
        fontName: cfg.fontName,
        useThuPhapSynthesizer: true,
      };
    }

    // Generic Pan-Asian style packs (Classic, Ink, Zen, Seal, Modern, Luxury, Street, Minimal)
    switch (script) {
      case "VIETNAMESE_LATIN":
      case "LATIN": {
        const cfg = VietnameseThuPhapSynthesizer.resolveFontConfig(stylePackId);
        return {
          fontFile: cfg.fontFile,
          fontName: cfg.fontName,
          useThuPhapSynthesizer: true,
        };
      }
      case "JAPANESE_MIXED":
        return {
          fontFile: "YujiBoku-Regular.ttf",
          fontName: "Yuji Boku",
          useThuPhapSynthesizer: false,
        };
      case "KOREAN_HANGUL":
        return {
          fontFile: "NanumBrushScript-Regular.ttf",
          fontName: "Nanum Brush Script",
          useThuPhapSynthesizer: false,
        };
      case "HAN": {
        const hasLongCang = await FontRegistryService.hasGlyphCoverage(
          "LongCang-Regular.ttf",
          text
        );
        if (hasLongCang) {
          return {
            fontFile: "LongCang-Regular.ttf",
            fontName: "Long Cang",
            useThuPhapSynthesizer: false,
          };
        }
        return {
          fontFile: "YujiBoku-Regular.ttf",
          fontName: "Yuji Boku",
          useThuPhapSynthesizer: false,
        };
      }
      default:
        throw new UnsupportedScriptError(text);
    }
  }

  private async renderBrushSvg(params: {
    text: string;
    script: ScriptType;
    config: VariationStrategyConfig;
    isVertical: boolean;
    seed: number;
    stylePackId: string;
    resolvedFont: ResolvedProviderFont;
  }): Promise<string> {
    const {
      text,
      script,
      config,
      isVertical,
      seed,
      stylePackId,
      resolvedFont,
    } = params;

    if (script === "UNKNOWN") {
      throw new UnsupportedScriptError(text);
    }

    if (resolvedFont.useThuPhapSynthesizer) {
      return VietnameseThuPhapSynthesizer.generate({
        text,
        variationType: config.type,
        seed,
        isVertical,
        stylePackId,
      });
    }

    // Parse licensed font server-side via FontRegistryService (throws FontNotFoundError / FontLicenseError if missing/unlicensed)
    const font = await FontRegistryService.parseOpenTypeFont(
      resolvedFont.fontFile
    );

    const chars = Array.from(text.trim());
    const charCount = chars.length;

    const width = isVertical ? 520 : Math.max(820, charCount * 145 + 240);
    const height = isVertical ? Math.max(820, charCount * 215 + 220) : 560;

    const fontSize = Math.floor(
      (isVertical ? 148 : 158) * config.pressureMultiplier
    );
    const strokeWidth = (3.2 * config.pressureMultiplier).toFixed(1);
    const turbulenceFreq = (0.035 + config.dryBrushIntensity * 0.085).toFixed(3);
    const displacementScale = (config.dryBrushIntensity * 14).toFixed(1);

    const uidSeed = `${text}|${stylePackId}|${config.type}|${seed}|${isVertical ? "V" : "H"}`;
    const brushFilterId = deterministicUid(uidSeed, "brush-flt");

    const filterDef = `<defs>
      <filter id="${brushFilterId}" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="${turbulenceFreq}" numOctaves="3" seed="${seed}" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="${displacementScale}" xChannelSelector="R" yChannelSelector="G" result="rough" />
        ${
          config.inkBleed > 0.1
            ? `<feGaussianBlur in="rough" stdDeviation="${(config.inkBleed * 1.6).toFixed(1)}" result="bleed" /><feMerge><feMergeNode in="bleed" /><feMergeNode in="rough" /></feMerge>`
            : `<feMerge><feMergeNode in="rough" /></feMerge>`
        }
      </filter>
    </defs>`;

    const pathElements: string[] = [];

    if (isVertical) {
      const nonSpaceChars = chars.filter((c) => !/\s/.test(c));
      const stepY = (height - 220) / Math.max(nonSpaceChars.length, 1);
      nonSpaceChars.forEach((char, i) => {
        const y = 130 + i * stepY;
        const adv = font.getAdvanceWidth(char, fontSize);
        const d = font
          .getPath(char, width / 2 - adv / 2, y + fontSize * 0.35, fontSize)
          .toPathData(2);
        if (d) {
          pathElements.push(
            `<path d="${d}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" filter="url(#${brushFilterId})" />`
          );
        }
      });
    } else {
      const textY = height / 2;
      const adv = font.getAdvanceWidth(text, fontSize);
      const d = font
        .getPath(text, width / 2 - adv / 2, textY + fontSize * 0.35, fontSize)
        .toPathData(2);
      if (d) {
        pathElements.push(
          `<path d="${d}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" filter="url(#${brushFilterId})" />`
        );
      }
    }

    let sealSvg = "";
    if (
      config.includeSeal ||
      stylePackId === "Seal" ||
      config.type === "06_SIGNATURE"
    ) {
      const sealFont = await FontRegistryService.parseOpenTypeFont(
        DEFAULT_SEAL_FONT_FAMILY
      );
      const sealGlyphSize = 32;
      const sealAdv = sealFont.getAdvanceWidth("印", sealGlyphSize);
      const sealPath = sealFont
        .getPath("印", 30 - sealAdv / 2, 30 + sealGlyphSize * 0.35, sealGlyphSize)
        .toPathData(2);
      const sealX = width - 110;
      const sealY = height - 110;

      sealSvg = `<g id="${deterministicUid(uidSeed, "seal")}" transform="translate(${sealX}, ${sealY})">
        <rect width="60" height="60" rx="6" fill="#B71032" />
        <rect x="4" y="4" width="52" height="52" rx="3" fill="none" stroke="#FBF9F4" stroke-width="2" />
        <path d="${sealPath}" fill="#FBF9F4" />
      </g>`;
    }

    const escapedText = escapeXml(text);
    const escapedFont = escapeXml(resolvedFont.fontName);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapedText}" data-font="${escapedFont}">
      <desc>${escapedText}</desc>
      ${filterDef}
      <g id="${deterministicUid(uidSeed, "art")}" class="protected-media">
        ${pathElements.join("\n        ")}
        ${sealSvg}
      </g>
    </svg>`;
  }
}
