/**
 * Vietnamese Thu Phap Master Calligraphy Synthesizer
 * 
 * Synthesizes authentic Vietnamese Thư Pháp brush artwork with:
 * - Sweeping Dragon Capitals (Nét Rồng Lượn)
 * - Variable-pressure horsehair brush stroke dynamics (Bút Lông)
 * - Calligraphic flying-white bristle texture (Phi Bạch)
 * - Dynamic sweeping underline swash (Nét Liệng Thư Pháp)
 * - Dancing diacritics (Dấu Thư Pháp)
 * - Cinnabar vermilion seal stamp (Ấn Triện Son)
 * - Fine ink splatter accents (Hạt Mực Nho)
 */

export interface ThuPhapRenderOptions {
  text: string;
  variationType: "01_CONTROLLED" | "02_BOLD" | "03_DRY_BRUSH" | "04_EXPRESSIVE" | "05_MINIMAL" | "06_SIGNATURE";
  seed: number;
  isVertical?: boolean;
  stylePackId?: string;
}

import fs from "fs";
import path from "path";

const FONT_CACHE: Record<string, string> = {};

function getBase64Font(fileName: string): string {
  if (FONT_CACHE[fileName]) return FONT_CACHE[fileName];
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
    if (fs.existsSync(fontPath)) {
      FONT_CACHE[fileName] = fs.readFileSync(fontPath).toString("base64");
    }
  } catch (e) {
    console.warn(`Could not read font ${fileName}:`, e);
  }
  return FONT_CACHE[fileName] || "";
}

export class VietnameseThuPhapSynthesizer {
  public static generate(options: ThuPhapRenderOptions): string {
    const { text, variationType, seed, isVertical = false, stylePackId = "Thi Bút 1" } = options;
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);

    // Font mapping per Thư Pháp style
    let fontFile = "UtmThuphapThienAn.ttf";
    let fontName = "UTM ThuPhap Thien An";

    if (stylePackId === "Thi Bút 2") {
      fontFile = "GreatVibes-Regular.ttf";
      fontName = "Great Vibes";
    } else if (stylePackId === "Thi Bút 3") {
      fontFile = "KaushanScript-Regular.ttf";
      fontName = "Kaushan Script";
    } else if (stylePackId === "Thi Bút 4") {
      fontFile = "CaveatBrush-Regular.ttf";
      fontName = "Caveat Brush";
    } else if (stylePackId === "Thi Bút 5") {
      fontFile = "Arizonia-Regular.ttf";
      fontName = "Arizonia";
    } else if (stylePackId === "Thi Bút 6" || stylePackId === "Seal") {
      fontFile = "UtmThuphapThienAn.ttf";
      fontName = "UTM ThuPhap Thien An";
    }

    const base64Data = getBase64Font(fontFile);
    const fontFaceBlock = base64Data
      ? `@font-face {
          font-family: '${fontName}';
          src: url('data:font/ttf;charset=utf-8;base64,${base64Data}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }`
      : `@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&amp;family=Kaushan+Script&amp;family=Caveat+Brush&amp;family=Arizonia&amp;family=Alex+Brush&amp;family=Allura&amp;display=swap');`;

    // Variation strategy parameters
    const pressure = variationType === "02_BOLD" ? 1.45 : variationType === "05_MINIMAL" ? 0.85 : 1.15;
    const energy = variationType === "04_EXPRESSIVE" ? 1.5 : variationType === "03_DRY_BRUSH" ? 1.25 : 1.0;
    const dryBrush = variationType === "03_DRY_BRUSH" ? 0.65 : 0.2;
    const hasSeal = variationType === "06_SIGNATURE" || variationType === "01_CONTROLLED" || variationType === "04_EXPRESSIVE" || stylePackId === "Thi Bút 6";

    const width = isVertical ? 800 : Math.max(1200, trimmed.length * 180 + 360);
    const height = isVertical ? Math.max(1200, words.length * 450 + 300) : 720;

    // Filters for sumi ink and dry brush bristles
    const filterId = `thuphap_filter_${seed}`;
    const swashFilterId = `swash_filter_${seed}`;

    const filterDef = `
      <defs>
        <style>
          ${fontFaceBlock}
          .thu-phap-master {
            font-family: '${fontName}', 'Great Vibes', 'Alex Brush', cursive;
            font-weight: 700;
          }
        </style>
        <!-- Sumi ink texture with dry-brush bristle displacement -->
        <filter id="${filterId}" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="${(0.038 + dryBrush * 0.06).toFixed(3)}" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${(dryBrush * 18).toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          ${variationType === "02_BOLD" ? `<feGaussianBlur in="displaced" stdDeviation="0.8" result="bleed" /><feMerge><feMergeNode in="bleed" /><feMergeNode in="displaced" /></feMerge>` : `<feMerge><feMergeNode in="displaced" /></feMerge>`}
        </filter>
        <!-- Sweeping brush tail filter -->
        <filter id="${swashFilterId}" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" result="swashNoise" />
          <feDisplacementMap in="SourceGraphic" in2="swashNoise" scale="9" xChannelSelector="R" yChannelSelector="G" result="roughSwash" />
        </filter>
      </defs>
    `;

    // Render word elements
    let textElements = "";
    let swashElements = "";

    if (isVertical) {
      const stepY = 280;
      const totalContentHeight = words.length * stepY;
      const startY = (height - totalContentHeight) / 2 + 100;
      const wordFontSize = Math.floor(160 * pressure);

      words.forEach((word, i) => {
        const y = startY + i * stepY;
        textElements += `
          <g transform="translate(${width / 2}, ${y})">
            <!-- Shadow/Bleed layer for ink richness -->
            <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="thu-phap-master" font-size="${wordFontSize}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${(6 * pressure).toFixed(1)}" filter="url(#${filterId})">${word}</text>
            <!-- Core brush layer -->
            <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="thu-phap-master" font-size="${wordFontSize}" fill="#0B0B0B" filter="url(#${filterId})">${word}</text>
          </g>
        `;
      });
    } else {
      const textY = height / 2 - 30;
      const fontSize = Math.floor(180 * pressure);
      textElements = `
        <g transform="translate(${width / 2}, ${textY})">
          <!-- Heavy ink core -->
          <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="thu-phap-master" font-size="${fontSize}" fill="#0B0B0B" stroke="#0B0B0B" stroke-width="${(7 * pressure).toFixed(1)}" stroke-linejoin="round" filter="url(#${filterId})">${trimmed}</text>
          <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="thu-phap-master" font-size="${fontSize}" fill="#0B0B0B" filter="url(#${filterId})">${trimmed}</text>
        </g>
      `;

      // Master Thư Pháp Sweeping Dragon Tail Swash (Nét Liệng Rồng Bay)
      if (variationType !== "05_MINIMAL") {
        const startX = width * 0.12;
        const endX = width * 0.88;
        const swashBaseY = textY + fontSize * 0.48;
        
        const c1X = width * 0.32;
        const c1Y = swashBaseY + 45 * energy;
        const c2X = width * 0.68;
        const c2Y = swashBaseY - 22 * energy;

        swashElements = `
          <g id="thu-phap-master-swash" filter="url(#${swashFilterId})">
            <!-- Main sweeping brush stroke -->
            <path d="M ${startX} ${swashBaseY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${swashBaseY + 16}" 
                  fill="none" 
                  stroke="#0B0B0B" 
                  stroke-width="${Math.max(6, 12 * pressure)}" 
                  stroke-linecap="round" />
            <!-- Upper feathering trail (Nét tơ phi bạch) -->
            <path d="M ${startX + 40} ${swashBaseY + 6} C ${c1X + 25} ${c1Y + 8}, ${c2X - 20} ${c2Y + 5}, ${endX - 50} ${swashBaseY + 12}" 
                  fill="none" 
                  stroke="#0B0B0B" 
                  stroke-width="${Math.max(2.5, 5 * pressure)}" 
                  stroke-linecap="round" 
                  opacity="0.8" />
            <!-- Whispering trail -->
            <path d="M ${startX + 80} ${swashBaseY + 12} C ${c1X + 40} ${c1Y + 14}, ${c2X} ${c2Y + 10}, ${endX - 90} ${swashBaseY + 8}" 
                  fill="none" 
                  stroke="#0B0B0B" 
                  stroke-width="2" 
                  stroke-linecap="round" 
                  opacity="0.5" />
            
            <!-- Fine Ink Splatters (Hạt mực nho) -->
            <circle cx="${endX - 22}" cy="${swashBaseY - 14}" r="3.5" fill="#0B0B0B" />
            <circle cx="${endX + 12}" cy="${swashBaseY + 24}" r="2.2" fill="#0B0B0B" />
            <circle cx="${endX + 26}" cy="${swashBaseY + 12}" r="1.5" fill="#0B0B0B" />
            <circle cx="${startX - 12}" cy="${swashBaseY - 8}" r="2.8" fill="#0B0B0B" />
            <circle cx="${startX + 18}" cy="${swashBaseY + 22}" r="1.8" fill="#0B0B0B" />
            <circle cx="${width * 0.48}" cy="${swashBaseY + 48}" r="2.0" fill="#0B0B0B" />
          </g>
        `;
      }
    }

    // Imperial Red Cinnabar Seal (Ấn Triện Son 詩筆)
    let sealSvg = "";
    if (hasSeal) {
      const sealX = isVertical ? width - 160 : width - 160;
      const sealY = isVertical ? height - 180 : height - 160;
      sealSvg = `
        <g id="cinnabar-seal-stamp" transform="translate(${sealX}, ${sealY})">
          <rect width="68" height="68" rx="8" fill="#B3261E" />
          <rect x="5" y="5" width="58" height="58" rx="4" fill="none" stroke="#F6F1E7" stroke-width="2.5" />
          <text x="34" y="41" text-anchor="middle" dominant-baseline="central" font-family="serif" font-size="28" font-weight="bold" fill="#F6F1E7">詩筆</text>
        </g>
      `;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      ${filterDef}
      <g id="calligraphy-art" class="protected-media">
        ${textElements}
        ${swashElements}
        ${sealSvg}
      </g>
    </svg>`;
  }
}
