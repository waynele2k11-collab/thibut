import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { deterministicUid, escapeXml } from "@/lib/security/xml";
import { ScriptDetector, UnsupportedScriptError } from "./ScriptDetector";
import type { ScriptType } from "./types";

export interface StructureGuide {
  text: string;
  script: ScriptType;
  svgDataUri: string;
  svg: string;
  fontFile: string;
  charCount: number;
  isVertical: boolean;
  boundingBox: { width: number; height: number };
}

async function resolveStructureGuideFontFile(
  text: string,
  script: ScriptType
): Promise<string> {
  switch (script) {
    case "HAN": {
      const hasLongCang = await FontRegistryService.hasGlyphCoverage(
        "LongCang-Regular.ttf",
        text
      );
      if (hasLongCang) {
        return "LongCang-Regular.ttf";
      }
      return "YujiBoku-Regular.ttf";
    }
    case "JAPANESE_MIXED":
      return "YujiBoku-Regular.ttf";
    case "KOREAN_HANGUL":
      return "NanumBrushScript-Regular.ttf";
    case "VIETNAMESE_LATIN":
    case "LATIN":
      return "UtmThuphapThienAn.ttf";
    default:
      throw new UnsupportedScriptError(text);
  }
}

/**
 * Deterministic Glyph & Structure Guide Generator (T-405, T-411, TB-CALLI-006).
 * Produces crisp, outlined `<path d="...">` glyph foundations using server-local
 * licensed fonts via `FontRegistryService.parseOpenTypeFont`, with zero external
 * Google Fonts `@import` network calls.
 */
export class StructureGuideGenerator {
  public static async generate(
    text: string,
    script: ScriptType,
    isVertical: boolean = false
  ): Promise<StructureGuide> {
    const trimmed = text.normalize("NFC").trim();
    const detected = script === "UNKNOWN" ? "UNKNOWN" : ScriptDetector.detect(trimmed);
    if (detected === "UNKNOWN") {
      throw new UnsupportedScriptError(trimmed);
    }

    const chars = Array.from(trimmed);
    const charCount = chars.length;

    const fontFile = await resolveStructureGuideFontFile(trimmed, detected);
    const font = await FontRegistryService.parseOpenTypeFont(fontFile);

    const width = isVertical ? 320 : Math.max(600, charCount * 120 + 120);
    const height = isVertical ? Math.max(600, charCount * 180 + 120) : 400;

    const pathElements: string[] = [];

    if (isVertical) {
      const tokens =
        detected === "VIETNAMESE_LATIN" || detected === "LATIN"
          ? trimmed.split(/\s+/).filter(Boolean)
          : chars.filter((c) => !/\s/.test(c));
      const stepY = (height - 120) / Math.max(tokens.length, 1);
      const fontSize = 112;

      tokens.forEach((tok, i) => {
        const y = 80 + i * stepY;
        const adv = font.getAdvanceWidth(tok, fontSize);
        const d = font
          .getPath(tok, width / 2 - adv / 2, y + fontSize * 0.34, fontSize)
          .toPathData(2);
        if (d) {
          pathElements.push(`<path d="${d}" fill="#000000" />`);
        }
      });
    } else {
      const fontSize = 96;
      const adv = font.getAdvanceWidth(trimmed, fontSize);
      const d = font
        .getPath(trimmed, width / 2 - adv / 2, height / 2 + fontSize * 0.34, fontSize)
        .toPathData(2);
      if (d) {
        pathElements.push(`<path d="${d}" fill="#000000" />`);
      }
    }

    const escaped = escapeXml(trimmed);
    const groupUid = deterministicUid(
      `${trimmed}|${detected}|${isVertical ? "V" : "H"}`,
      "guide"
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escaped}">
      <desc>${escaped}</desc>
      <rect width="100%" height="100%" fill="#ffffff" />
      <g id="${groupUid}">
        ${pathElements.join("\n        ")}
      </g>
    </svg>`;

    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return {
      text: trimmed,
      script: detected,
      svgDataUri,
      svg,
      fontFile,
      charCount,
      isVertical,
      boundingBox: { width, height },
    };
  }
}
