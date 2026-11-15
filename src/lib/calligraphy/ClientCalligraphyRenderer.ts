/**
 * Client-Side Instant Calligraphy Vector Synthesizer
 * 
 * Provides 0ms instant vector rendering on both SSR and client
 * with full visual fidelity reflecting EVERY selected studio option
 * (Font, Stroke, Layout, Seal, Variations, Ink Color).
 */

export interface ClientRenderOptions {
  text: string;
  tradition?: "VIETNAMESE_THU_PHAP";
  strokePreset: "BOLD_BRUSH" | "FLOWING_INK" | "DRY_BRUSH" | "CLASSICAL" | "FREE_SPIRIT";
  variationType: "01_CONTROLLED" | "02_BOLD" | "03_DRY_BRUSH" | "04_EXPRESSIVE" | "05_MINIMAL" | "06_SIGNATURE";
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
    sealFontFamily,
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
    "kokuryu": "kokuryu, sans-serif",
  };

  let fontFamily = overrideFontFamily
    ? `"${overrideFontFamily}", cursive`
    : (customFontFamily && customFontUrl) 
    ? customFontFamily 
    : (fontId && FONT_MAP[fontId] ? FONT_MAP[fontId] : "");

  if (!fontFamily) {
    // Vietnamese Thư Pháp
    fontFamily = strokePreset === "BOLD_BRUSH" ? "'UTM ThuPhap Thien An', 'Caveat Brush', cursive"
      : strokePreset === "FLOWING_INK" ? "'Arizonia', 'Great Vibes', cursive"
      : strokePreset === "DRY_BRUSH" ? "'Kaushan Script', 'Caveat Brush', cursive"
      : strokePreset === "FREE_SPIRIT" ? "'Great Vibes', cursive"
      : "'UTM ThuPhap Thien An', cursive";
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

  // If the text contains CJK characters, vertical layout splits by character. Otherwise, splits by spaces.
  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(trimmed);
  const words = isCJK ? Array.from(trimmed) : trimmed.split(/\s+/);
  
  const width = isVertical ? 1000 : isEmblem ? 1000 : Math.max(1600, trimmed.length * 200 + 600);
  const centerX = width / 2;

  const wordSpacing = 400;
  
  // Pre-calculate horizontal height so centerY is available
  let height = isEmblem ? 1000 : 800;
  let centerY = height / 2;

  // First word Y offset to avoid clipping tall ascenders
  const startY = isVertical ? 400 : centerY;
  
  // Calculate dynamic vertical height based on exact word count and seal
  const lastWordY = isVertical ? startY + (words.length > 0 ? words.length - 1 : 0) * wordSpacing : centerY;

  if (isVertical) {
    height = Math.max(1200, lastWordY + 500);
    centerY = height / 2;
  }

  // Swash path calculation
  const swashStartY = centerY + (isVertical ? 0 : 180);
  const swashStartX = isVertical ? centerX - 150 : 120;
  const swashEndX = isVertical ? centerX + 150 : width - 120;
  const swashMidX = (swashStartX + swashEndX) / 2;
  const swashCurveY = swashStartY + (variationType === "04_EXPRESSIVE" ? 60 : 40);

  // Exact Seal Position (placed right after the last word vertically)
  const shouldRenderSeal = Boolean(hasSeal);
  const sealX = isVertical ? centerX + 180 : isEmblem ? centerX + 220 : width - 90;
  const sealY = isVertical ? lastWordY + 280 : isEmblem ? centerY + 180 : centerY - 60;

  // Generate a unique ID to scope CSS classes
  const uid = Math.random().toString(36).substring(2, 9);

  // Resolve Seal Font URL
  let sealFontUrl = "";
  if (sealFontFamily === "VNI Ong do") sealFontUrl = "/fonts/VNI-Ong_do.ttf";
  else if (sealFontFamily === "UTM Thư Pháp Thiên Ân") sealFontUrl = "/fonts/UtmThuphapThienAn.ttf";
  else if (sealFontFamily === "VNI Netbut") sealFontUrl = "/fonts/VNI-Netbut.ttf";

  // Convert relative to absolute for SVG exports (if running in browser)
  if (sealFontUrl && typeof window !== "undefined") {
    sealFontUrl = window.location.origin + sealFontUrl;
  }
  let absCustomFontUrl = customFontUrl;
  if (absCustomFontUrl && absCustomFontUrl.startsWith("/") && typeof window !== "undefined") {
    absCustomFontUrl = window.location.origin + absCustomFontUrl;
  }

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&amp;family=Caveat+Brush&amp;family=Arizonia&amp;family=Alex+Brush&amp;family=Kaushan+Script&amp;family=Yuji+Boku&amp;family=Yuji+Mai&amp;family=Yuji+Syuku&amp;family=Long+Cang&amp;family=Ma+Shan+Zheng&amp;family=Liu+Jian+Mao+Cao&amp;family=Nanum+Brush+Script&amp;family=East+Sea+Dokdo&amp;display=swap');
          ${absCustomFontUrl ? `
            @font-face {
              font-family: ${customFontFamily?.split(',')[0] || "'CustomFont'"};
              src: url('${absCustomFontUrl}') format('truetype');
            }
          ` : ""}
          ${sealFontUrl ? `
            @font-face {
              font-family: '${sealFontFamily}';
              src: url('${sealFontUrl}') format('truetype');
            }
          ` : ""}
          .calligraphy-text-${uid} {
            font-family: ${fontFamily};
            font-size: ${isVertical ? "280px" : isEmblem ? "240px" : isFullBack ? "350px" : "320px"};
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
          .swash-line-${uid} {
            fill: none;
            stroke: ${inkColor};
            stroke-width: ${variationType === "02_BOLD" ? "9px" : "5px"};
            stroke-linecap: round;
            opacity: ${variationType === "05_MINIMAL" ? "0" : "0.95"};
          }
          .splatter-dot-${uid} {
            fill: ${inkColor};
            opacity: 0.85;
          }
          .emblem-ring-${uid} {
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
        <circle 
          cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 45}" 
          stroke-dasharray="380, 25" 
          fill="none" stroke="${inkColor}" stroke-width="3.5" stroke-linecap="round" opacity="0.75" 
        />
        <circle 
          cx="${centerX}" cy="${centerY}" r="${Math.min(centerX, centerY) - 60}" 
          stroke-dasharray="10, 8" 
          fill="none" stroke="${inkColor}" stroke-width="3.5" stroke-linecap="round" opacity="0.4" 
        />
      ` : ""}

      <!-- Sweeping Underline Swash (Nét Liệng Rồng Bay) for Horizontal Layouts -->
      ${!isVertical && !isEmblem && variationType !== "05_MINIMAL" ? `
        <path 
          d="M ${swashStartX} ${swashStartY} Q ${swashMidX} ${swashCurveY}, ${swashEndX} ${swashStartY - 10}" 
          fill="none" stroke="${inkColor}" stroke-width="${variationType === "02_BOLD" ? "9" : "5"}" stroke-linecap="round" opacity="${variationType === "05_MINIMAL" ? "0" : "0.95"}"
        />
        <circle cx="${swashEndX + 15}" cy="${swashStartY - 18}" r="4.5" fill="${inkColor}" opacity="0.85" />
        <circle cx="${swashEndX + 30}" cy="${swashStartY - 24}" r="2.5" fill="${inkColor}" opacity="0.85" />
      ` : ""}

      <!-- Main Calligraphy Glyph Flow -->
      ${isVertical ? words.map((w, idx) => {
        const wordY = startY + idx * wordSpacing;
        return `
        <!-- Stroke (Background) -->
        <text 
          x="${centerX}" 
          y="${wordY}"
          font-family="${fontFamily.replace(/"/g, "'")}"
          font-size="${isVertical ? 280 : isEmblem ? 240 : isFullBack ? 350 : 320}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="none"
          stroke="${inkColor}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"
          text-anchor="middle"
          dominant-baseline="central"
        >${w}</text>
        <!-- Fill (Foreground) -->
        <text 
          x="${centerX}" 
          y="${wordY}"
          font-family="${fontFamily.replace(/"/g, "'")}"
          font-size="${isVertical ? 280 : isEmblem ? 240 : isFullBack ? 350 : 320}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="${inkColor}"
          stroke="none"
          text-anchor="middle"
          dominant-baseline="central"
        >${w}</text>`;
      }).join("") : `
        <!-- Stroke (Background) -->
        <text 
          x="${centerX}" 
          y="${centerY - (isEmblem ? 0 : 10)}"
          font-family="${fontFamily.replace(/"/g, "'")}"
          font-size="${isVertical ? 280 : isEmblem ? 240 : isFullBack ? 350 : 320}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="none"
          stroke="${inkColor}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          stroke-linejoin="round"
          text-anchor="middle"
          dominant-baseline="central"
        >${trimmed}</text>
        <!-- Fill (Foreground) -->
        <text 
          x="${centerX}" 
          y="${centerY - (isEmblem ? 0 : 10)}"
          font-family="${fontFamily.replace(/"/g, "'")}"
          font-size="${isVertical ? 280 : isEmblem ? 240 : isFullBack ? 350 : 320}"
          font-style="${fontStyle}"
          letter-spacing="${letterSpacing}"
          fill="${inkColor}"
          stroke="none"
          text-anchor="middle"
          dominant-baseline="central"
        >${trimmed}</text>
      `}

      <!-- Imperial Cinnabar Red Seal Stamp (Ấn Triện Son) -->
      ${shouldRenderSeal ? `
        <g transform="translate(${sealX}, ${sealY})">
          <rect x="-40" y="-40" width="80" height="80" fill="#B3261E" stroke="none" />
          <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#FFFFFF" stroke-width="2" />
          <text x="0" y="5" font-family="${sealFontFamily ? `'${sealFontFamily}', serif` : 'serif'}" font-size="${(sealText || '印').length > 2 ? 28 : 42}" font-weight="bold" fill="#FFFFFF" text-anchor="middle" dominant-baseline="central">${sealText || '印'}</text>
        </g>
      ` : ""}
    </svg>
  `.trim();

  return svgContent;
}

export function generateInstantSvgUri(options: ClientRenderOptions): string {
  const svgContent = generateInstantSvgString(options);
  const encoded = safeBase64Encode(svgContent);
  return `data:image/svg+xml;base64,${encoded}`;
}
