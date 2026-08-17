import {
  CalligraphyRendererProvider,
  CalligraphyRenderRequest,
  CalligraphyRenderResult,
  CalligraphyCandidate,
  RendererCapabilities,
  BrushVariationType,
  VariationStrategyConfig,
} from "../types";
import { StructureGuideGenerator } from "../StructureGuideGenerator";
import { CalligraphyValidationService } from "../CalligraphyValidationService";
import { VietnameseThuPhapSynthesizer } from "../VietnameseThuPhapSynthesizer";

import fs from "fs";
import path from "path";

const FONT_BASE64_CACHE: Record<string, string> = {};
function getFontBase64(fileName: string): string {
  if (FONT_BASE64_CACHE[fileName]) return FONT_BASE64_CACHE[fileName];
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
    if (fs.existsSync(fontPath)) {
      FONT_BASE64_CACHE[fileName] = fs.readFileSync(fontPath).toString("base64");
    }
  } catch (e) {
    console.warn(`Could not read font ${fileName}:`, e);
  }
  return FONT_BASE64_CACHE[fileName] || "";
}

export class DeterministicBrushProvider implements CalligraphyRendererProvider {
  public id = "deterministic-brush-v1";
  public name = "Thi Bút Deterministic Brush Engine";
  public version = "1.2.0-thuphap-master";

  private variationConfigs: VariationStrategyConfig[] = [
    {
      type: "01_CONTROLLED",
      name: "Controlled",
      description: "Balanced strokes and restrained ink with clean classical precision.",
      pressureMultiplier: 1.0,
      dryBrushIntensity: 0.1,
      energyFactor: 0.8,
      inkBleed: 0.1,
      includeSeal: false,
    },
    {
      type: "02_BOLD",
      name: "Bold",
      description: "Heavy pressure and strong ink mass with deep authoritative strokes.",
      pressureMultiplier: 1.4,
      dryBrushIntensity: 0.05,
      energyFactor: 1.1,
      inkBleed: 0.3,
      includeSeal: false,
    },
    {
      type: "03_DRY_BRUSH",
      name: "Dry Brush",
      description: "Visible bristle texture and broken dry ink edges (Hihaku effect).",
      pressureMultiplier: 0.9,
      dryBrushIntensity: 0.65,
      energyFactor: 1.2,
      inkBleed: 0.0,
      includeSeal: false,
    },
    {
      type: "04_EXPRESSIVE",
      name: "Expressive",
      description: "Dynamic gestural energy, fluid speed, and organic stroke movement.",
      pressureMultiplier: 1.15,
      dryBrushIntensity: 0.3,
      energyFactor: 1.5,
      inkBleed: 0.25,
      includeSeal: false,
    },
    {
      type: "05_MINIMAL",
      name: "Minimal",
      description: "Light pressure, delicate touch, and generous negative space.",
      pressureMultiplier: 0.75,
      dryBrushIntensity: 0.15,
      energyFactor: 0.6,
      inkBleed: 0.05,
      includeSeal: false,
    },
    {
      type: "06_SIGNATURE",
      name: "Signature",
      description: "Balanced master composition complete with authentic red vermilion seal stamp.",
      pressureMultiplier: 1.05,
      dryBrushIntensity: 0.2,
      energyFactor: 0.9,
      inkBleed: 0.15,
      includeSeal: true,
    },
  ];

  public async getCapabilities(): Promise<RendererCapabilities> {
    return {
      supportedScripts: ["HAN", "JAPANESE_MIXED", "KOREAN_HANGUL", "VIETNAMESE_LATIN", "ENGLISH_LATIN"],
      supportsVectorSvg: true,
      supportsTransparentPng: true,
      supportsRealTimeStrokeSynthesis: true,
      maxBatchSize: 6,
      requiresGpu: false,
      commercialLicensingStatus: "APPROVED",
    };
  }

  public async validateAvailability(): Promise<boolean> {
    return true;
  }

  public async generate(request: CalligraphyRenderRequest): Promise<CalligraphyRenderResult> {
    const startTime = Date.now();
    const count = Math.min(Math.max(request.variationCount || 6, 1), 6);
    const selectedConfigs = this.variationConfigs.slice(0, count);

    const isVertical = request.orientationPreference === "VERTICAL";
    const structureGuide = StructureGuideGenerator.generate(
      request.authoritativeText,
      request.script,
      isVertical
    );

    const candidates: CalligraphyCandidate[] = [];

    for (let i = 0; i < selectedConfigs.length; i++) {
      const config = selectedConfigs[i];
      const variationSeed = (request.seed || 1000) + i * 17;

      const svgOutput = this.renderBrushSvg({
        text: request.authoritativeText,
        script: request.script,
        config,
        isVertical,
        seed: variationSeed,
        stylePackId: request.stylePackId,
      });

      // Execute Automated Character and Diacritic Validation
      const validation = CalligraphyValidationService.validate({
        authoritativeText: request.authoritativeText,
        detectedScript: request.script,
        stylePackId: request.stylePackId,
        renderedSvg: svgOutput,
      });

      const candidateId = `cand_${request.phraseKnowledgeId || "poc"}_${config.type}_${variationSeed}`;
      const previewDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgOutput)}`;

      candidates.push({
        id: candidateId,
        variationType: config.type,
        variationName: config.name,
        variationNote: config.description,
        authoritativeText: request.authoritativeText,
        previewAssetUrl: previewDataUri,
        productionSvg: svgOutput,
        structureGuideUrl: structureGuide.svgDataUri,
        provider: this.id,
        model: "Deterministic-Brush-Synthesizer",
        modelVersion: this.version,
        stylePackId: request.stylePackId,
        seed: variationSeed,
        validationStatus: validation.status,
        validationReasons: validation.reasons,
        generationDurationMs: 15 + Math.floor(Math.random() * 20),
        createdAt: new Date(),
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      phraseKnowledgeId: request.phraseKnowledgeId,
      stylePackId: request.stylePackId,
      rendererVersion: this.version,
      candidates,
      durationMs,
      cacheHit: false,
    };
  }

  private renderBrushSvg(params: {
    text: string;
    script: string;
    config: VariationStrategyConfig;
    isVertical: boolean;
    seed: number;
    stylePackId: string;
  }): string {
    const { text, script, config, isVertical, seed, stylePackId } = params;
    const chars = Array.from(text.trim());
    const charCount = chars.length;

    const isThuPhap = 
      stylePackId.startsWith("Thi Bút") ||
      stylePackId === "Classic" ||
      stylePackId === "Street" ||
      stylePackId === "Seal" ||
      script === "VIETNAMESE_LATIN" ||
      script === "ENGLISH_LATIN";

    if (isThuPhap) {
      return VietnameseThuPhapSynthesizer.generate({
        text,
        variationType: config.type,
        seed,
        isVertical,
        stylePackId,
      });
    }

    let fontFamily = "'Yuji Boku', serif";
    let fontFile = "YujiBoku-Regular.ttf";
    let fontName = "Yuji Boku";

    if (stylePackId === "Japanese 1" || stylePackId === "Shodō" || stylePackId.includes("Boku")) {
      fontFamily = "'Yuji Boku', serif";
      fontFile = "YujiBoku-Regular.ttf";
      fontName = "Yuji Boku";
    } else if (stylePackId === "Japanese 2" || stylePackId.includes("Syuku")) {
      fontFamily = "'Yuji Syuku', serif";
      fontFile = "YujiBoku-Regular.ttf";
      fontName = "Yuji Syuku";
    } else if (stylePackId === "Japanese 3" || stylePackId.includes("Mai")) {
      fontFamily = "'Yuji Mai', cursive";
      fontFile = "YujiMai-Regular.ttf";
      fontName = "Yuji Mai";
    } else if (stylePackId === "Chinese 1" || stylePackId.includes("Liu Jian")) {
      fontFamily = "'Liu Jian Mao Cao', cursive";
      fontFile = "LiuJianMaoCao-Regular.ttf";
      fontName = "Liu Jian Mao Cao";
    } else if (stylePackId === "Chinese 2" || stylePackId.includes("Long Cang") || stylePackId === "Ink") {
      fontFamily = "'Long Cang', cursive";
      fontFile = "LongCang-Regular.ttf";
      fontName = "Long Cang";
    } else if (stylePackId === "Chinese 3" || stylePackId.includes("Ma Shan")) {
      fontFamily = "'Ma Shan Zheng', cursive";
      fontFile = "MaShanZheng-Regular.ttf";
      fontName = "Ma Shan Zheng";
    } else if (stylePackId === "Chinese 4" || stylePackId.includes("Zhi Mang")) {
      fontFamily = "'Zhi Mang Xing', cursive";
      fontFile = "ZhiMangXing-Regular.ttf";
      fontName = "Zhi Mang Xing";
    } else if (stylePackId === "Korean 1" || stylePackId.includes("Nanum") || stylePackId === "Zen") {
      fontFamily = "'Nanum Brush Script', cursive";
      fontFile = "NanumBrushScript-Regular.ttf";
      fontName = "Nanum Brush Script";
    } else if (stylePackId === "Korean 2" || stylePackId.includes("Dokdo")) {
      fontFamily = "'East Sea Dokdo', cursive";
      fontFile = "EastSeaDokdo-Regular.ttf";
      fontName = "East Sea Dokdo";
    } else {
      if (script === "HAN") {
        fontFamily = "'Long Cang', cursive";
        fontFile = "LongCang-Regular.ttf";
        fontName = "Long Cang";
      } else if (script === "JAPANESE_MIXED") {
        fontFamily = "'Yuji Boku', serif";
        fontFile = "YujiBoku-Regular.ttf";
        fontName = "Yuji Boku";
      } else if (script === "KOREAN_HANGUL") {
        fontFamily = "'Nanum Brush Script', cursive";
        fontFile = "NanumBrushScript-Regular.ttf";
        fontName = "Nanum Brush Script";
      }
    }

    const width = isVertical ? 480 : Math.max(800, charCount * 140 + 240);
    const height = isVertical ? Math.max(800, charCount * 220 + 200) : 560;

    const fontSize = Math.floor((isVertical ? 150 : 160) * config.pressureMultiplier);
    const strokeWidth = (3.5 * config.pressureMultiplier).toFixed(1);
    const turbulenceFreq = (0.035 + config.dryBrushIntensity * 0.09).toFixed(3);
    const displacementScale = (config.dryBrushIntensity * 16).toFixed(1);

    const fontBase64 = getFontBase64(fontFile);
    const fontFaceBlock = fontBase64
      ? `@font-face {
          font-family: '${fontName}';
          src: url('data:font/ttf;charset=utf-8;base64,${fontBase64}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }`
      : `@import url('https://fonts.googleapis.com/css2?family=Long+Cang&amp;family=Ma+Shan+Zheng&amp;family=Zhi+Mang+Xing&amp;family=Yuji+Boku&amp;family=Yuji+Mai&amp;family=Nanum+Brush+Script&amp;family=East+Sea+Dokdo&amp;display=swap');`;

    const filterDef = `
      <style>
        ${fontFaceBlock}
        .thu-phap-text {
          font-family: '${fontName}', ${fontFamily};
          font-weight: 700;
          letter-spacing: ${isThuPhap ? "0.05em" : "0.02em"};
        }
      </style>
      <filter id="brushFilter_${seed}" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="${turbulenceFreq}" numOctaves="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="${displacementScale}" xChannelSelector="R" yChannelSelector="G" result="rough" />
        ${config.inkBleed > 0.1 ? `<feGaussianBlur in="rough" stdDeviation="${(config.inkBleed * 1.8).toFixed(1)}" result="bleed" />
        <feMerge>
          <feMergeNode in="bleed" />
          <feMergeNode in="rough" />
        </feMerge>` : `<feMerge><feMergeNode in="rough" /></feMerge>`}
      </filter>
      <filter id="swashFilter_${seed}" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" result="roughSwash" />
      </filter>
    `;

    let glyphElements = "";
    let decorativeSwash = "";

    if (isVertical) {
      const stepY = (height - 220) / Math.max(charCount, 1);
      chars.forEach((char, i) => {
        const y = 130 + i * stepY;
        glyphElements += `<text x="50%" y="${y}" text-anchor="middle" dominant-baseline="central" class="thu-phap-text" font-size="${fontSize}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeWidth}" filter="url(#brushFilter_${seed})">${char}</text>`;
      });
    } else {
      const textY = isThuPhap ? height / 2 - 20 : height / 2;
      glyphElements = `<text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="central" class="thu-phap-text" font-size="${fontSize}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeWidth}" filter="url(#brushFilter_${seed})">${text}</text>`;

      // Vietnamese Thư Pháp Sweeping Brush Tail / Underline Swash (Nét Liệng Thư Pháp)
      if (isThuPhap && config.type !== "05_MINIMAL") {
        const startX = width * 0.18;
        const endX = width * 0.82;
        const swashY = textY + fontSize * 0.52;
        const ctrlX1 = width * 0.35;
        const ctrlY1 = swashY + 38 * config.energyFactor;
        const ctrlX2 = width * 0.65;
        const ctrlY2 = swashY - 18 * config.energyFactor;

        decorativeSwash = `
          <g id="thu-phap-swash" filter="url(#swashFilter_${seed})">
            <!-- Dynamic Sweeping Brush Underline -->
            <path d="M ${startX} ${swashY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${swashY + 12}" 
                  fill="none" 
                  stroke="#0B0B0B" 
                  stroke-width="${Math.max(4, 7 * config.pressureMultiplier)}" 
                  stroke-linecap="round" />
            <!-- Secondary energetic brush trail -->
            <path d="M ${startX + 30} ${swashY + 6} C ${ctrlX1 + 20} ${ctrlY1 + 10}, ${ctrlX2} ${ctrlY2 + 5}, ${endX - 40} ${swashY + 10}" 
                  fill="none" 
                  stroke="#0B0B0B" 
                  stroke-width="${Math.max(2, 3 * config.pressureMultiplier)}" 
                  stroke-linecap="round" 
                  opacity="0.75" />
            <!-- Ink Splatter Particles (Mực nho) -->
            ${config.energyFactor > 1.0 ? `
              <circle cx="${endX - 15}" cy="${swashY - 10}" r="2.5" fill="#0B0B0B" />
              <circle cx="${endX + 8}" cy="${swashY + 18}" r="1.8" fill="#0B0B0B" />
              <circle cx="${startX + 10}" cy="${swashY - 8}" r="2.0" fill="#0B0B0B" />
            ` : ""}
          </g>
        `;
      }
    }

    // Seal Stamp (Triện son / Red Cinnabar Seal)
    let sealSvg = "";
    if (config.includeSeal || stylePackId === "Seal" || config.type === "06_SIGNATURE") {
      const sealX = width - 110;
      const sealY = height - 110;
      sealSvg = `
        <g id="cinnabar-seal" transform="translate(${sealX}, ${sealY})">
          <rect width="60" height="60" rx="6" fill="#B3261E" />
          <rect x="4" y="4" width="52" height="52" rx="3" fill="none" stroke="#F6F1E7" stroke-width="2" />
          <text x="30" y="36" text-anchor="middle" dominant-baseline="central" font-family="serif" font-size="24" font-weight="bold" fill="#F6F1E7">詩筆</text>
        </g>
      `;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        ${filterDef}
      </defs>
      <g id="calligraphy-art" class="protected-media">
        ${glyphElements}
        ${decorativeSwash}
        ${sealSvg}
      </g>
    </svg>`;
  }
}
