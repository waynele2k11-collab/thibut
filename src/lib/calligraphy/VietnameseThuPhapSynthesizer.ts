import {
  DEFAULT_SEAL_FONT_FAMILY,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import { deterministicUid, escapeXml } from "@/lib/security/xml";
import { ScriptDetector, UnsupportedScriptError } from "./ScriptDetector";
import type { BrushVariationType } from "./types";

export interface ThuPhapRenderOptions {
  text: string;
  variationType: BrushVariationType;
  seed: number;
  isVertical?: boolean;
  stylePackId?: string;
}

export interface ResolvedThuPhapFont {
  fontFile: string;
  fontName: string;
  defaultHasSeal: boolean;
}

/**
 * Vietnamese Thư Pháp Master Calligraphy Synthesizer (T-405, T-411, TB-CALLI-006).
 *
 * Outlines glyphs deterministically into crisp `<path d="...">` geometry via
 * `FontRegistryService.parseOpenTypeFont(...)` with zero embedded multi-MB base64
 * `@font-face` payloads and zero external Google Fonts `@import` network dependencies.
 */
export class VietnameseThuPhapSynthesizer {
  public static resolveFontConfig(stylePackId = "Thi Bút 1"): ResolvedThuPhapFont {
    const lowerId = stylePackId.toLowerCase();

    if (
      lowerId.includes("arizonia") ||
      lowerId.includes("phượng vũ") ||
      lowerId.includes("phuong vu")
    ) {
      return {
        fontFile: "Arizonia-Regular.ttf",
        fontName: "Arizonia",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("great") ||
      lowerId.includes("vibes") ||
      lowerId.includes("long vũ") ||
      lowerId.includes("long vu")
    ) {
      return {
        fontFile: "GreatVibes-Regular.ttf",
        fontName: "Great Vibes",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("allura") ||
      lowerId.includes("lưu thủy") ||
      lowerId.includes("luu thuy")
    ) {
      return {
        fontFile: "Allura-Regular.ttf",
        fontName: "Allura",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("kaushan") ||
      lowerId.includes("phi bạch") ||
      lowerId.includes("phi bach")
    ) {
      return {
        fontFile: "KaushanScript-Regular.ttf",
        fontName: "Kaushan Script",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("caveat") ||
      lowerId.includes("mực nho") ||
      lowerId.includes("muc nho")
    ) {
      return {
        fontFile: "CaveatBrush-Regular.ttf",
        fontName: "Caveat Brush",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("alex") ||
      lowerId.includes("khí phách") ||
      lowerId.includes("khi phach")
    ) {
      return {
        fontFile: "AlexBrush-Regular.ttf",
        fontName: "Alex Brush",
        defaultHasSeal: false,
      };
    }
    if (
      lowerId.includes("thi bút 2") ||
      lowerId.includes("thi but 2") ||
      lowerId.includes("ấn triện") ||
      lowerId.includes("an trien") ||
      lowerId.includes("seal")
    ) {
      return {
        fontFile: "UtmThuphapThienAn.ttf",
        fontName: "UTM ThuPhap Thien An",
        defaultHasSeal: true,
      };
    }

    return {
      fontFile: "UtmThuphapThienAn.ttf",
      fontName: "UTM ThuPhap Thien An",
      defaultHasSeal: false,
    };
  }

  public static async generate(options: ThuPhapRenderOptions): Promise<string> {
    const {
      text,
      variationType,
      seed,
      isVertical = false,
      stylePackId = "Thi Bút 1",
    } = options;

    const trimmed = text.normalize("NFC").trim();
    const detectedScript = ScriptDetector.detect(trimmed);
    if (detectedScript === "UNKNOWN") {
      throw new UnsupportedScriptError(trimmed);
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    const { fontFile, fontName, defaultHasSeal } =
      this.resolveFontConfig(stylePackId);

    const font = await FontRegistryService.parseOpenTypeFont(fontFile);

    const pressure =
      variationType === "02_BOLD"
        ? 1.45
        : variationType === "05_MINIMAL"
          ? 0.82
          : 1.12;
    const energy =
      variationType === "04_EXPRESSIVE"
        ? 1.55
        : variationType === "03_DRY_BRUSH"
          ? 1.25
          : 1.0;
    const dryBrush = variationType === "03_DRY_BRUSH" ? 0.72 : 0.14;
    const hasSeal =
      defaultHasSeal ||
      variationType === "06_SIGNATURE" ||
      variationType === "01_CONTROLLED" ||
      variationType === "04_EXPRESSIVE";

    const width = isVertical
      ? 800
      : Math.max(1200, trimmed.length * 165 + 360);
    const height = isVertical
      ? Math.max(1200, words.length * 360 + 300)
      : 720;

    const uidSeed = `${trimmed}|${stylePackId}|${variationType}|${seed}|${isVertical ? "V" : "H"}`;
    const filterId = deterministicUid(uidSeed, "thuphap-flt");
    const swashFilterId = deterministicUid(uidSeed, "thuphap-swash");

    const filterDef = `<defs>
      <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="${(0.036 + dryBrush * 0.055).toFixed(3)}" numOctaves="3" seed="${seed}" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="${(dryBrush * 14).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="displaced" />
        ${
          variationType === "02_BOLD"
            ? `<feGaussianBlur in="displaced" stdDeviation="0.7" result="bleed" /><feMerge><feMergeNode in="bleed" /><feMergeNode in="displaced" /></feMerge>`
            : `<feMerge><feMergeNode in="displaced" /></feMerge>`
        }
      </filter>
      <filter id="${swashFilterId}" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${seed + 7}" result="swashNoise" />
        <feDisplacementMap in="SourceGraphic" in2="swashNoise" scale="7" xChannelSelector="R" yChannelSelector="G" result="roughSwash" />
      </filter>
    </defs>`;

    let glyphMarkup = "";
    let swashMarkup = "";

    if (isVertical) {
      const stepY = 260;
      const totalContentHeight = words.length * stepY;
      const startY = (height - totalContentHeight) / 2 + 100;
      const wordFontSize = Math.floor(155 * pressure);
      const strokeW = (4.5 * pressure).toFixed(1);

      const wordGroups: string[] = [];
      words.forEach((word, i) => {
        const y = startY + i * stepY;
        const adv = font.getAdvanceWidth(word, wordFontSize);
        const baselineY = y + wordFontSize * 0.34;
        const d = font
          .getPath(word, width / 2 - adv / 2, baselineY, wordFontSize)
          .toPathData(2);
        if (d) {
          wordGroups.push(
            `<path d="${d}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round" filter="url(#${filterId})" />`
          );
        }
      });
      glyphMarkup = wordGroups.join("\n        ");
    } else {
      const textY = height / 2 - 28;
      const fontSize = Math.floor(175 * pressure);
      const adv = font.getAdvanceWidth(trimmed, fontSize);
      const baselineY = textY + fontSize * 0.34;
      const d = font
        .getPath(trimmed, width / 2 - adv / 2, baselineY, fontSize)
        .toPathData(2);
      const strokeW = (5.0 * pressure).toFixed(1);

      if (d) {
        glyphMarkup = `<path d="${d}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round" filter="url(#${filterId})" />`;
      }

      if (variationType !== "05_MINIMAL") {
        const startX = width * 0.14;
        const endX = width * 0.86;
        const swashBaseY = textY + fontSize * 0.5;
        const c1X = width * 0.32;
        const c1Y = swashBaseY + 42 * energy;
        const c2X = width * 0.68;
        const c2Y = swashBaseY - 20 * energy;

        swashMarkup = `<g id="${deterministicUid(uidSeed, "swash-grp")}" filter="url(#${swashFilterId})">
          <path d="M ${startX.toFixed(1)} ${swashBaseY.toFixed(1)} C ${c1X.toFixed(1)} ${c1Y.toFixed(1)}, ${c2X.toFixed(1)} ${c2Y.toFixed(1)}, ${endX.toFixed(1)} ${(swashBaseY + 14).toFixed(1)}" fill="none" stroke="#0B0B0B" stroke-width="${Math.max(5, 10 * pressure).toFixed(1)}" stroke-linecap="round" />
          <path d="M ${(startX + 36).toFixed(1)} ${(swashBaseY + 6).toFixed(1)} C ${(c1X + 22).toFixed(1)} ${(c1Y + 8).toFixed(1)}, ${(c2X - 18).toFixed(1)} ${(c2Y + 5).toFixed(1)}, ${(endX - 48).toFixed(1)} ${(swashBaseY + 11).toFixed(1)}" fill="none" stroke="#0B0B0B" stroke-width="${Math.max(2, 4 * pressure).toFixed(1)}" stroke-linecap="round" opacity="0.78" />
          <circle cx="${(endX - 20).toFixed(1)}" cy="${(swashBaseY - 12).toFixed(1)}" r="3.2" fill="#0B0B0B" />
          <circle cx="${(endX + 10).toFixed(1)}" cy="${(swashBaseY + 22).toFixed(1)}" r="2.0" fill="#0B0B0B" />
          <circle cx="${(startX - 10).toFixed(1)}" cy="${(swashBaseY - 8).toFixed(1)}" r="2.4" fill="#0B0B0B" />
        </g>`;
      }
    }

    let sealMarkup = "";
    if (hasSeal) {
      const sealFont = await FontRegistryService.parseOpenTypeFont(
        DEFAULT_SEAL_FONT_FAMILY
      );
      const sealGlyphSize = 36;
      const sealAdv = sealFont.getAdvanceWidth("印", sealGlyphSize);
      const sealPath = sealFont
        .getPath("印", 34 - sealAdv / 2, 34 + sealGlyphSize * 0.35, sealGlyphSize)
        .toPathData(2);
      const sealX = width - 160;
      const sealY = isVertical ? height - 180 : height - 160;

      sealMarkup = `<g id="${deterministicUid(uidSeed, "seal")}" transform="translate(${sealX}, ${sealY})">
        <rect width="68" height="68" rx="8" fill="#B71032" />
        <rect x="5" y="5" width="58" height="58" rx="4" fill="none" stroke="#FBF9F4" stroke-width="2.5" />
        <path d="${sealPath}" fill="#FBF9F4" />
      </g>`;
    }

    const escapedText = escapeXml(trimmed);
    const escapedFont = escapeXml(fontName);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapedText}" data-font="${escapedFont}">
      <desc>${escapedText}</desc>
      ${filterDef}
      <g id="${deterministicUid(uidSeed, "art")}" class="protected-media">
        ${glyphMarkup}
        ${swashMarkup}
        ${sealMarkup}
      </g>
    </svg>`;
  }
}
