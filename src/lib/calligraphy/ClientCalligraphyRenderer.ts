/**
 * Client-Side Instant Calligraphy Vector Synthesizer
 *
 * Provides deterministic 0ms vector rendering on both SSR and client
 * with full visual fidelity reflecting selected studio options
 * (Font, Stroke, Layout, Seal, Variations, Ink Color).
 */

import {
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import { deterministicUid, escapeXml } from "@/lib/security/xml";

export type StrokePresetOption =
  | "BOLD_BRUSH"
  | "FLOWING_INK"
  | "DRY_BRUSH"
  | "CLASSICAL"
  | "FREE_SPIRIT";

export type VariationTypeOption =
  | "01_CONTROLLED"
  | "02_BOLD"
  | "03_DRY_BRUSH"
  | "04_EXPRESSIVE"
  | "05_MINIMAL"
  | "06_SIGNATURE";

export interface ClientRenderOptions {
  text: string;
  tradition?: ScriptCategory;
  strokePreset?: StrokePresetOption;
  variationType?: VariationTypeOption;
  fontId?: string;
  layout?: "HORIZONTAL" | "VERTICAL" | "EMBLEM" | "FULL_BACK";
  inkColor?: string;
  hasSeal?: boolean;
  scale?: number;
  rotation?: number;
  fontFamily?: string;
  customFontFamily?: string;
  customFontUrl?: string;
  sealText?: string;
  sealFontFamily?: string;
}

export function safeBase64Encode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  if (typeof btoa !== "undefined" && typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return "";
}

export function safeBase64Decode(b64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  if (typeof atob !== "undefined" && typeof TextDecoder !== "undefined") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return "";
}

const FONT_MAP: Record<string, string> = {
  "utm-thuphap-thien-an": "'UTM ThuPhap Thien An', 'Caveat Brush', cursive",
  "great-vibes": "'Great Vibes', cursive",
  "allura": "'Allura', cursive",
  "kaushan-script": "'Kaushan Script', cursive",
  "caveat-brush": "'Caveat Brush', cursive",
  "arizonia": "'Arizonia', cursive",
  "alex-brush": "'Alex Brush', cursive",
  "yuji-boku": "'Yuji Boku', serif",
  "yuji-syuku": "'Yuji Syuku', serif",
  "yuji-mai": "'Yuji Mai', cursive",
  "liu-jian-mao-cao": "'Liu Jian Mao Cao', cursive",
  "long-cang": "'Long Cang', cursive",
  "ma-shan-zheng": "'Ma Shan Zheng', cursive",
  "zhi-mang-xing": "'Zhi Mang Xing', cursive",
  "nanum-brush-script": "'Nanum Brush Script', cursive",
  "east-sea-dokdo": "'East Sea Dokdo', cursive",
  "kokuryu": "kokuryu, sans-serif",
};

function sanitizeCssIdentifier(raw: string): string {
  return raw.replace(/[^A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF _,-]/g, "").trim();
}

export function generateInstantSvgString(options: ClientRenderOptions): string {
  const {
    text = "Thi Bút",
    tradition = "VIETNAMESE_THU_PHAP",
    strokePreset = "BOLD_BRUSH",
    variationType = "01_CONTROLLED",
    fontId,
    fontFamily: overrideFontFamily,
    layout = "HORIZONTAL",
    inkColor = "#0B0B0B",
    hasSeal = true,
    customFontFamily,
    customFontUrl,
    sealText,
    sealFontFamily = DEFAULT_SEAL_FONT_FAMILY,
  } = options;

  const trimmed = text.trim() || "Thi Bút";
  const isVertical = layout === "VERTICAL";
  const isEmblem = layout === "EMBLEM";
  const isFullBack = layout === "FULL_BACK";

  const cleanOverrideFont = overrideFontFamily
    ? sanitizeCssIdentifier(overrideFontFamily)
    : "";
  const cleanCustomFont = customFontFamily
    ? sanitizeCssIdentifier(customFontFamily)
    : "";

  const isThienAnOverride =
    cleanOverrideFont === "UTM Thư Pháp Thiên Ân" ||
    cleanOverrideFont === "UTM ThuPhap Thien An" ||
    cleanOverrideFont === "UtmThuphapThienAn";

  let fontFamily = isThienAnOverride
    ? "'UTM ThuPhap Thien An', 'UTM Thư Pháp Thiên Ân', 'Caveat Brush', cursive"
    : cleanOverrideFont
      ? `'${cleanOverrideFont}', cursive`
      : cleanCustomFont && customFontUrl
        ? `'${cleanCustomFont}', cursive`
        : fontId && FONT_MAP[fontId]
          ? FONT_MAP[fontId]
          : "";

  if (!fontFamily) {
    if (tradition === "JAPANESE_SHODO") {
      fontFamily = "'Yuji Syuku', serif";
    } else if (tradition === "CHINESE_CALLIGRAPHY") {
      fontFamily = "'Ma Shan Zheng', cursive";
    } else if (tradition === "KOREAN_BRUSH") {
      fontFamily = "'Nanum Brush Script', cursive";
    } else {
      fontFamily =
        strokePreset === "BOLD_BRUSH"
          ? "'UTM ThuPhap Thien An', 'Caveat Brush', cursive"
          : strokePreset === "FLOWING_INK"
            ? "'Arizonia', 'Great Vibes', cursive"
            : strokePreset === "DRY_BRUSH"
              ? "'Kaushan Script', 'Caveat Brush', cursive"
              : strokePreset === "FREE_SPIRIT"
                ? "'Great Vibes', cursive"
                : "'UTM ThuPhap Thien An', cursive";
    }
  }

  let strokeWidth = "5px";
  let fontStyle = "normal";
  let letterSpacing = "0.02em";

  if (strokePreset === "BOLD_BRUSH" || variationType === "02_BOLD") {
    strokeWidth = "9px";
  } else if (
    strokePreset === "FLOWING_INK" ||
    variationType === "04_EXPRESSIVE"
  ) {
    strokeWidth = "4px";
    fontStyle = "italic";
  } else if (
    strokePreset === "DRY_BRUSH" ||
    variationType === "03_DRY_BRUSH"
  ) {
    strokeWidth = "5px";
  } else if (strokePreset === "CLASSICAL" || variationType === "05_MINIMAL") {
    strokeWidth = variationType === "05_MINIMAL" ? "2px" : "3.5px";
    letterSpacing = "0.06em";
  } else if (strokePreset === "FREE_SPIRIT") {
    strokeWidth = "6px";
  }

  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(
    trimmed
  );
  const words = isCJK
    ? Array.from(trimmed.replace(/\s+/g, ""))
    : trimmed.split(/\s+/).filter(Boolean);

  const width = isVertical
    ? 1000
    : isEmblem
      ? 1000
      : Math.max(1600, trimmed.length * 200 + 600);
  const centerX = width / 2;

  const wordSpacing = 400;

  let height = isEmblem ? 1000 : 800;
  let centerY = height / 2;

  const startY = isVertical ? 400 : centerY;
  const lastWordY = isVertical
    ? startY + (words.length > 0 ? words.length - 1 : 0) * wordSpacing
    : centerY;

  if (isVertical) {
    height = Math.max(1200, lastWordY + 500);
    centerY = height / 2;
  }

  const swashStartY = centerY + (isVertical ? 0 : 180);
  const swashStartX = isVertical ? centerX - 150 : 120;
  const swashEndX = isVertical ? centerX + 150 : width - 120;
  const swashMidX = (swashStartX + swashEndX) / 2;
  const swashCurveY =
    swashStartY + (variationType === "04_EXPRESSIVE" ? 60 : 40);

  const shouldRenderSeal = Boolean(hasSeal);
  const sealX = isVertical
    ? centerX + 180
    : isEmblem
      ? centerX + 220
      : width - 90;
  const sealY = isVertical
    ? lastWordY + 280
    : isEmblem
      ? centerY + 180
      : centerY - 60;

  const resolvedSealFont =
    sanitizeCssIdentifier(sealFontFamily || DEFAULT_SEAL_FONT_FAMILY) ||
    DEFAULT_SEAL_FONT_FAMILY;
  const rawSealGlyphs = (sealText || "印").trim() || "印";
  const safeSealText = escapeXml(rawSealGlyphs);
  const sealGlyphCount = Array.from(rawSealGlyphs).length;

  const safeTrimmed = escapeXml(trimmed);
  const safeInkColor = escapeXml(inkColor);
  const safeFontAttr = escapeXml(fontFamily.replace(/"/g, "'"));
  const safeSealFontAttr = escapeXml(`'${resolvedSealFont}', serif`);

  const uid = deterministicUid(
    [
      trimmed,
      tradition,
      fontFamily,
      layout,
      strokePreset,
      variationType,
      inkColor,
      shouldRenderSeal ? `${resolvedSealFont}:${rawSealGlyphs}` : "no-seal",
    ].join("|"),
    "tb"
  );

  let sealFontUrl = "";
  if (resolvedSealFont === "Ma Shan Zheng") {
    sealFontUrl = "/api/fonts/ma-shan-zheng";
  } else if (
    resolvedSealFont === "UTM Thư Pháp Thiên Ân" ||
    resolvedSealFont === "UTM ThuPhap Thien An"
  ) {
    sealFontUrl = "/api/fonts/utm-thuphap-thien-an";
  } else if (resolvedSealFont === "Zhi Mang Xing") {
    sealFontUrl = "/api/fonts/zhi-mang-xing";
  }

  if (sealFontUrl && typeof window !== "undefined") {
    sealFontUrl = window.location.origin + sealFontUrl;
  }
  let absCustomFontUrl = customFontUrl;
  if (
    absCustomFontUrl &&
    absCustomFontUrl.startsWith("/") &&
    typeof window !== "undefined"
  ) {
    absCustomFontUrl = window.location.origin + absCustomFontUrl;
  }

  const safeSealFontUrl = sealFontUrl ? escapeXml(sealFontUrl) : "";
  const safeCustomFontUrl = absCustomFontUrl ? escapeXml(absCustomFontUrl) : "";
  const glyphFontSize = isVertical
    ? 280
    : isEmblem
      ? 240
      : isFullBack
        ? 350
        : 320;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <style>
          ${
            safeCustomFontUrl
              ? `
            @font-face {
              font-family: '${escapeXml(cleanCustomFont || "CustomFont")}';
              src: url('${safeCustomFontUrl}') format('truetype');
            }
          `
              : ""
          }
          ${
            safeSealFontUrl
              ? `
            @font-face {
              font-family: '${escapeXml(resolvedSealFont)}';
              src: url('${safeSealFontUrl}') format('truetype');
            }
          `
              : ""
          }
          .calligraphy-text-${uid} {
            font-family: ${safeFontAttr};
            font-size: ${glyphFontSize}px;
            font-style: ${fontStyle};
            letter-spacing: ${letterSpacing};
            fill: ${safeInkColor};
            stroke: ${safeInkColor};
            stroke-width: ${strokeWidth};
            stroke-linecap: round;
            stroke-linejoin: round;
            paint-order: stroke fill;
            text-anchor: middle;
            dominant-baseline: central;
          }
          .swash-line-${uid} {
            fill: none;
            stroke: ${safeInkColor};
            stroke-width: ${variationType === "02_BOLD" ? "9px" : "5px"};
            stroke-linecap: round;
            opacity: ${variationType === "05_MINIMAL" ? "0" : "0.95"};
          }
          .splatter-dot-${uid} {
            fill: ${safeInkColor};
            opacity: 0.85;
          }
          .emblem-ring-${uid} {
            fill: none;
            stroke: ${safeInkColor};
            stroke-width: 3.5px;
            stroke-linecap: round;
            opacity: 0.75;
          }
        </style>
      </defs>

      <!-- Emblem Circular Frame for EMBLEM Layout -->
      ${
        isEmblem
          ? `
        <circle 
          cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 45}" 
          stroke-dasharray="380, 25" 
          fill="none" stroke="${safeInkColor}" stroke-width="3.5" stroke-linecap="round" opacity="0.75" 
        />
        <circle 
          cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 60}" 
          stroke-dasharray="10, 8" 
          fill="none" stroke="${safeInkColor}" stroke-width="3.5" stroke-linecap="round" opacity="0.4" 
        />
      `
          : ""
      }

      <!-- Sweeping Underline Swash (Nét Liệng Rồng Bay) for Horizontal Layouts -->
      ${
        !isVertical && !isEmblem && variationType !== "05_MINIMAL"
          ? `
        <path 
          d="M ${swashStartX} ${swashStartY} Q ${swashMidX} ${swashCurveY}, ${swashEndX} ${swashStartY - 10}" 
          fill="none" stroke="${safeInkColor}" stroke-width="${variationType === "02_BOLD" ? "9" : "5"}" stroke-linecap="round" opacity="0.95"
        />
        <circle cx="${swashEndX + 15}" cy="${swashStartY - 18}" r="4.5" fill="${safeInkColor}" opacity="0.85" />
        <circle cx="${swashEndX + 30}" cy="${swashStartY - 24}" r="2.5" fill="${safeInkColor}" opacity="0.85" />
      `
          : ""
      }

      <!-- Main Calligraphy Glyph Flow -->
      ${
        isVertical
          ? words
              .map((w, idx) => {
                const wordY = startY + idx * wordSpacing;
                const safeWord = escapeXml(w);
                return `
        <!-- Stroke (Background) -->
        <text 
          x="${centerX}" 
          y="${wordY}"
          font-family="${safeFontAttr}"
          font-size="${glyphFontSize}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="none"
          stroke="${safeInkColor}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"
          text-anchor="middle"
          dominant-baseline="central"
        >${safeWord}</text>
        <!-- Fill (Foreground) -->
        <text 
          x="${centerX}" 
          y="${wordY}"
          font-family="${safeFontAttr}"
          font-size="${glyphFontSize}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="${safeInkColor}"
          stroke="none"
          text-anchor="middle"
          dominant-baseline="central"
        >${safeWord}</text>`;
              })
              .join("")
          : `
        <!-- Stroke (Background) -->
        <text 
          x="${centerX}" 
          y="${centerY - (isEmblem ? 0 : 10)}"
          font-family="${safeFontAttr}"
          font-size="${glyphFontSize}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="none"
          stroke="${safeInkColor}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"
          text-anchor="middle"
          dominant-baseline="central"
        >${safeTrimmed}</text>
        <!-- Fill (Foreground) -->
        <text 
          x="${centerX}" 
          y="${centerY - (isEmblem ? 0 : 10)}"
          font-family="${safeFontAttr}"
          font-size="${glyphFontSize}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="${safeInkColor}"
          stroke="none"
          text-anchor="middle"
          dominant-baseline="central"
        >${safeTrimmed}</text>
      `
      }

      <!-- Imperial Cinnabar Red Seal Stamp (Ấn Triện Son) -->
      ${
        shouldRenderSeal
          ? `
        <g transform="translate(${sealX}, ${sealY})">
          <rect x="-40" y="-40" width="80" height="80" fill="#B71032" stroke="none" />
          <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#FFFFFF" stroke-width="2" />
          <text x="0" y="5" font-family="${safeSealFontAttr}" font-size="${sealGlyphCount > 2 ? 28 : 42}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central">${safeSealText}</text>
        </g>
      `
          : ""
      }
    </svg>
  `.trim();

  return svgContent;
}

export function generateInstantSvgUri(options: ClientRenderOptions): string {
  const svgContent = generateInstantSvgString(options);
  const encoded = safeBase64Encode(svgContent);
  return `data:image/svg+xml;base64,${encoded}`;
}
