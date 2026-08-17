/**
 * Client-Side Instant Calligraphy Vector Synthesizer
 * 
 * Provides 0ms instant vector rendering on both SSR and client
 * with full visual fidelity reflecting EVERY selected studio option
 * (Font, Stroke, Layout, Seal, Variations, Ink Color).
 */

export interface ClientRenderOptions {
  text: string;
  tradition: "VIETNAMESE_THU_PHAP" | "JAPANESE_SHODO" | "CHINESE_CALLIGRAPHY" | "KOREAN_BRUSH";
  strokePreset: "BOLD_BRUSH" | "FLOWING_INK" | "DRY_BRUSH" | "CLASSICAL" | "FREE_SPIRIT";
  variationType: "01_CONTROLLED" | "02_BOLD" | "03_DRY_BRUSH" | "04_EXPRESSIVE" | "05_MINIMAL" | "06_SIGNATURE";
  fontId?: string;
  layout?: "HORIZONTAL" | "VERTICAL" | "EMBLEM" | "FULL_BACK";
  inkColor?: string;
  hasSeal?: boolean;
  scale?: number;
  rotation?: number;
}

export function safeBase64Encode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)));
  }
  return "";
}

export function safeBase64Decode(b64: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(b64)));
  }
  return "";
}

export function generateInstantSvgUri(options: ClientRenderOptions): string {
  const {
    text = "Thi Bút",
    tradition = "VIETNAMESE_THU_PHAP",
    strokePreset = "BOLD_BRUSH",
    variationType = "01_CONTROLLED",
    fontId,
    layout = "HORIZONTAL",
    inkColor = "#0B0B0B",
    hasSeal = true,
  } = options;

  const trimmed = text.trim() || "Thi Bút";
  const isVertical = layout === "VERTICAL";
  const isEmblem = layout === "EMBLEM";
  const isFullBack = layout === "FULL_BACK";

  // Exact Font Family Mapping if specific fontId chosen
  const FONT_MAP: Record<string, string> = {
    "utm-thuphap-thien-an": "'UTM ThuPhap Thien An', 'Caveat Brush', cursive",
    "great-vibes": "'Great Vibes', cursive",
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
  };

  let fontFamily = fontId && FONT_MAP[fontId] ? FONT_MAP[fontId] : "";

  if (!fontFamily) {
    if (tradition === "JAPANESE_SHODO") {
      fontFamily = strokePreset === "BOLD_BRUSH" ? "'Yuji Boku', serif" 
        : strokePreset === "FLOWING_INK" ? "'Yuji Mai', cursive" 
        : strokePreset === "CLASSICAL" ? "'Yuji Syuku', serif" : "'Yuji Boku', serif";
    } else if (tradition === "CHINESE_CALLIGRAPHY") {
      fontFamily = strokePreset === "BOLD_BRUSH" ? "'Ma Shan Zheng', cursive" 
        : strokePreset === "FREE_SPIRIT" ? "'Long Cang', cursive" 
        : strokePreset === "DRY_BRUSH" ? "'Liu Jian Mao Cao', cursive" : "'Ma Shan Zheng', cursive";
    } else if (tradition === "KOREAN_BRUSH") {
      fontFamily = strokePreset === "DRY_BRUSH" ? "'East Sea Dokdo', cursive" : "'Nanum Brush Script', cursive";
    } else {
      // Vietnamese Thư Pháp
      fontFamily = strokePreset === "BOLD_BRUSH" ? "'UTM ThuPhap Thien An', 'Caveat Brush', cursive"
        : strokePreset === "FLOWING_INK" ? "'Arizonia', 'Great Vibes', cursive"
        : strokePreset === "DRY_BRUSH" ? "'Kaushan Script', 'Caveat Brush', cursive"
        : strokePreset === "FREE_SPIRIT" ? "'Great Vibes', cursive"
        : "'UTM ThuPhap Thien An', cursive";
    }
  }

  // Stroke dynamic weight reflecting strokePreset and variation
  let strokeWidth = "5px";
  let fontStyle = "normal";
  let letterSpacing = "0.02em";

  if (strokePreset === "BOLD_BRUSH" || variationType === "02_BOLD") {
    strokeWidth = "9px";
  } else if (strokePreset === "FLOWING_INK" || variationType === "04_EXPRESSIVE") {
    strokeWidth = "4px";
    fontStyle = "italic";
  } else if (strokePreset === "DRY_BRUSH" || variationType === "03_DRY_BRUSH") {
    strokeWidth = "5px";
  } else if (strokePreset === "CLASSICAL" || variationType === "05_MINIMAL") {
    strokeWidth = variationType === "05_MINIMAL" ? "2px" : "3.5px";
    letterSpacing = "0.06em";
  } else if (strokePreset === "FREE_SPIRIT") {
    strokeWidth = "6px";
  }

  const words = trimmed.split(/\s+/);
  const width = isVertical ? 640 : isEmblem ? 800 : Math.max(1000, trimmed.length * 130 + 300);
  const height = isVertical ? Math.max(900, words.length * 280 + 220) : isEmblem ? 800 : 500;
  const centerX = width / 2;
  const centerY = height / 2;

  // Swash path calculation
  const swashStartY = centerY + (isVertical ? 0 : 75);
  const swashStartX = isVertical ? centerX - 60 : 120;
  const swashEndX = isVertical ? centerX + 60 : width - 120;
  const swashMidX = (swashStartX + swashEndX) / 2;
  const swashCurveY = swashStartY + (variationType === "04_EXPRESSIVE" ? 45 : 25);

  // Exact Seal Position
  const shouldRenderSeal = Boolean(hasSeal);
  const sealX = isVertical ? centerX + 80 : isEmblem ? centerX + 110 : width - 90;
  const sealY = isVertical ? height - 120 : isEmblem ? centerY + 90 : centerY - 30;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&amp;family=Caveat+Brush&amp;family=Arizonia&amp;family=Alex+Brush&amp;family=Kaushan+Script&amp;family=Yuji+Boku&amp;family=Yuji+Mai&amp;family=Yuji+Syuku&amp;family=Long+Cang&amp;family=Ma+Shan+Zheng&amp;family=Liu+Jian+Mao+Cao&amp;family=Nanum+Brush+Script&amp;family=East+Sea+Dokdo&amp;display=swap');
          .calligraphy-text {
            font-family: ${fontFamily};
            font-size: ${isVertical ? "110px" : isEmblem ? "95px" : isFullBack ? "135px" : "125px"};
            font-style: ${fontStyle};
            letter-spacing: ${letterSpacing};
            fill: ${inkColor};
            stroke: ${inkColor};
            stroke-width: ${strokeWidth};
            stroke-linecap: round;
            stroke-linejoin: round;
            paint-order: stroke fill;
            text-anchor: middle;
            dominant-baseline: central;
          }
          .swash-line {
            fill: none;
            stroke: ${inkColor};
            stroke-width: ${variationType === "02_BOLD" ? "9px" : "5px"};
            stroke-linecap: round;
            opacity: ${variationType === "05_MINIMAL" ? "0" : "0.95"};
          }
          .splatter-dot {
            fill: ${inkColor};
            opacity: 0.85;
          }
          .emblem-ring {
            fill: none;
            stroke: ${inkColor};
            stroke-width: 3.5px;
            stroke-linecap: round;
            opacity: 0.75;
          }
        </style>
      </defs>

      <!-- Emblem Circular Frame for EMBLEM Layout -->
      ${isEmblem ? `
        <circle class="emblem-ring" cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 45}" stroke-dasharray="380, 25" />
        <circle class="emblem-ring" cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 60}" stroke-dasharray="10, 8" opacity="0.4" />
      ` : ""}

      <!-- Sweeping Underline Swash (Nét Liệng Rồng Bay) for Horizontal Layouts -->
      ${!isVertical && !isEmblem && variationType !== "05_MINIMAL" ? `
        <path class="swash-line" d="M ${swashStartX} ${swashStartY} Q ${swashMidX} ${swashCurveY}, ${swashEndX} ${swashStartY - 10}" />
        <circle class="splatter-dot" cx="${swashEndX + 15}" cy="${swashStartY - 18}" r="4.5" />
        <circle class="splatter-dot" cx="${swashEndX + 30}" cy="${swashStartY - 24}" r="2.5" />
      ` : ""}

      <!-- Main Calligraphy Glyph Flow -->
      ${isVertical ? words.map((w, idx) => {
        const wordY = 160 + idx * 220;
        return `<text class="calligraphy-text" x="${centerX}" y="${wordY}">${w}</text>`;
      }).join("") : `
        <text class="calligraphy-text" x="${centerX}" y="${centerY - (isEmblem ? 0 : 10)}">${trimmed}</text>
      `}

      <!-- Imperial Cinnabar Red Seal Stamp (Ấn Triện Son) -->
      ${shouldRenderSeal ? `
        <g transform="translate(${sealX}, ${sealY})">
          <rect x="-24" y="-24" width="48" height="48" rx="6" fill="#B3261E" stroke="#931A12" stroke-width="2" opacity="0.95" />
          <text x="0" y="3" font-family="'SimSun', 'STSong', serif" font-size="20" font-weight="900" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central" letter-spacing="1">詩筆</text>
        </g>
      ` : ""}
    </svg>
  `.trim();

  const encoded = safeBase64Encode(svgContent);
  return `data:image/svg+xml;base64,${encoded}`;
}
