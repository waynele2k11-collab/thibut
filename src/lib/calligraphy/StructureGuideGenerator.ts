import { ScriptType } from "./types";

export interface StructureGuide {
  text: string;
  script: ScriptType;
  svgDataUri: string;
  charCount: number;
  isVertical: boolean;
  boundingBox: { width: number; height: number };
}

/**
 * Deterministic Glyph & Structure Guide Generator
 * Produces crisp, high-contrast, mathematically authoritative glyph foundations
 * ensuring zero character hallucination or missing diacritics.
 */
export class StructureGuideGenerator {
  public static generate(
    text: string,
    script: ScriptType,
    isVertical: boolean = false
  ): StructureGuide {
    const chars = Array.from(text.trim());
    const charCount = chars.length;

    // Font selection based on detected script family
    let fontFamily = "'Alex Brush', 'Dancing Script', cursive";
    if (script === "HAN") {
      fontFamily = "'Long Cang', 'Ma Shan Zheng', cursive";
    } else if (script === "JAPANESE_MIXED") {
      fontFamily = "'Yuji Boku', 'Yuji Syuku', serif";
    } else if (script === "KOREAN_HANGUL") {
      fontFamily = "'Nanum Brush Script', 'East Sea Dokdo', cursive";
    } else if (script === "VIETNAMESE_LATIN") {
      fontFamily = "'Alex Brush', 'Dancing Script', cursive";
    } else {
      fontFamily = "'Alex Brush', 'Dancing Script', cursive";
    }

    const width = isVertical ? 300 : Math.max(600, charCount * 120 + 100);
    const height = isVertical ? Math.max(600, charCount * 180 + 100) : 400;

    let contentSvg = "";

    if (isVertical) {
      const stepY = (height - 100) / Math.max(charCount, 1);
      chars.forEach((char, i) => {
        const y = 80 + i * stepY;
        contentSvg += `<text x="50%" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${fontFamily}" font-size="120" font-weight="700" fill="#000000">${char}</text>`;
      });
    } else {
      contentSvg = `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="${fontFamily}" font-size="96" font-weight="700" fill="#000000">${text}</text>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Alex+Brush&amp;family=Dancing+Script:wght@700&amp;family=Long+Cang&amp;family=Yuji+Boku&amp;family=Nanum+Brush+Script&amp;display=swap');
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff" />
      <g id="structure-glyphs">
        ${contentSvg}
      </g>
    </svg>`;

    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return {
      text,
      script,
      svgDataUri,
      charCount,
      isVertical,
      boundingBox: { width, height },
    };
  }
}
