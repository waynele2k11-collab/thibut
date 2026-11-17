import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp, { type OverlayOptions } from "sharp";
import { generateInstantSvgString } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import {
  CompositionSchema,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_WIDTH,
  type CompositionLayer,
} from "@/lib/print/types";
import { generatePrintMasterPng } from "@/lib/print-generator";
import { escapeXml } from "@/lib/security/xml";

const NORM_W = 450; // 1/10 of 4500
const NORM_H = 540; // 1/10 of 5400
const NORM_SAFE_PAD_X = Math.round(NORM_W * 0.06); // 27
const NORM_SAFE_PAD_Y = Math.round(NORM_H * 0.06); // 32
const NORM_SAFE_W = NORM_W - NORM_SAFE_PAD_X * 2; // 396
const NORM_SAFE_H = NORM_H - NORM_SAFE_PAD_Y * 2; // 476

interface WysiwygFixture {
  name: string;
  text: string;
  tradition: ScriptCategory;
  fontFamily: string;
  layout: "VERTICAL" | "HORIZONTAL";
  hasSeal: boolean;
  artworkTransform: { x: number; y: number; scale: number; rotation: number };
  sealTransform?: { x: number; y: number; scale: number; rotation: number };
}

interface InkBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  inkPixels: number;
  redSealPixels: number;
}

const FIXTURES: readonly WysiwygFixture[] = [
  {
    name: "01-vi-vertical-seal-phuc-loc-tho",
    text: "Phúc Lộc Thọ",
    tradition: "VIETNAMESE_THU_PHAP",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    layout: "VERTICAL",
    hasSeal: true,
    artworkTransform: { x: 0.48, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.72, y: 0.84, scale: 0.9, rotation: 0 },
  },
  {
    name: "02-vi-horizontal-seal-co-chi-thi-nen",
    text: "Có Chí Thì Nên",
    tradition: "VIETNAMESE_THU_PHAP",
    fontFamily: "UTM ThuPhap Thien An",
    layout: "HORIZONTAL",
    hasSeal: true,
    artworkTransform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.82, y: 0.66, scale: 0.85, rotation: 0 },
  },
  {
    name: "03-vi-horizontal-no-seal-binh-an",
    text: "Bình An",
    tradition: "VIETNAMESE_THU_PHAP",
    fontFamily: "Arizonia",
    layout: "HORIZONTAL",
    hasSeal: false,
    artworkTransform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  },
  {
    name: "04-vi-vertical-stacked-diacritics-uoc-mo-dep",
    text: "Ước Mơ Đẹp",
    tradition: "VIETNAMESE_THU_PHAP",
    fontFamily: "Great Vibes",
    layout: "VERTICAL",
    hasSeal: true,
    artworkTransform: { x: 0.48, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.74, y: 0.84, scale: 0.85, rotation: 0 },
  },
  {
    name: "05-jp-vertical-seal-ichigo-ichie",
    text: "一期一会",
    tradition: "JAPANESE_SHODO",
    fontFamily: "Yuji Boku",
    layout: "VERTICAL",
    hasSeal: true,
    artworkTransform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.72, y: 0.84, scale: 0.9, rotation: 0 },
  },
  {
    name: "06-jp-horizontal-no-seal-akiramenai",
    text: "諦めない",
    tradition: "JAPANESE_SHODO",
    fontFamily: "Yuji Mai",
    layout: "HORIZONTAL",
    hasSeal: false,
    artworkTransform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  },
  {
    name: "07-zh-traditional-vertical-seal-long-ma-jing-shen",
    text: "龍馬精神",
    tradition: "CHINESE_CALLIGRAPHY",
    fontFamily: "Yuji Boku",
    layout: "VERTICAL",
    hasSeal: true,
    artworkTransform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.72, y: 0.84, scale: 0.9, rotation: 0 },
  },
  {
    name: "08-zh-simplified-horizontal-seal-shang-shan-ruo-shui",
    text: "上善若水",
    tradition: "CHINESE_CALLIGRAPHY",
    fontFamily: "Ma Shan Zheng",
    layout: "HORIZONTAL",
    hasSeal: true,
    artworkTransform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.82, y: 0.68, scale: 0.85, rotation: 0 },
  },
  {
    name: "09-ko-horizontal-no-seal-hwaiting",
    text: "화이팅",
    tradition: "KOREAN_BRUSH",
    fontFamily: "Nanum Brush Script",
    layout: "HORIZONTAL",
    hasSeal: false,
    artworkTransform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
  },
  {
    name: "10-en-horizontal-seal-serenity",
    text: "Serenity",
    tradition: "VIETNAMESE_THU_PHAP",
    fontFamily: "Alex Brush",
    layout: "HORIZONTAL",
    hasSeal: true,
    artworkTransform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
    sealTransform: { x: 0.82, y: 0.66, scale: 0.85, rotation: 0 },
  },
];

function listAssetFontFiles(): string[] {
  const dir = path.join(process.cwd(), "assets", "fonts");
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(ttf|otf)$/i.test(f))
    .map((f) => path.join(dir, f));
}

function measureRgbaInkBounds(
  rgba: Buffer,
  width: number,
  height: number,
  alphaThreshold = 24
): InkBoundingBox {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;
  let redSealPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx] ?? 0;
      const g = rgba[idx + 1] ?? 0;
      const b = rgba[idx + 2] ?? 0;
      const a = rgba[idx + 3] ?? 0;

      if (a >= alphaThreshold) {
        inkPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (r > 135 && g < 80 && b < 95) {
          redSealPixels++;
        }
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: width / 2,
      centerY: height / 2,
      inkPixels: 0,
      redSealPixels: 0,
    };
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: w,
    height: h,
    centerX: minX + w / 2,
    centerY: minY + h / 2,
    inkPixels,
    redSealPixels,
  };
}

function computeBoundingBoxIoU(a: InkBoundingBox, b: InkBoundingBox): number {
  const interMinX = Math.max(a.minX, b.minX);
  const interMinY = Math.max(a.minY, b.minY);
  const interMaxX = Math.min(a.maxX, b.maxX);
  const interMaxY = Math.min(a.maxY, b.maxY);

  if (interMaxX < interMinX || interMaxY < interMinY) {
    return 0;
  }

  const interArea = (interMaxX - interMinX + 1) * (interMaxY - interMinY + 1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const unionArea = areaA + areaB - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Rasterizes the Studio Client Preview (`generateInstantSvgString` `<text>` + CSS fonts)
 * using `@resvg/resvg-js` loaded strictly with `assets/fonts/*.ttf` (zero OS fonts),
 * and places the fitted calligraphy + optional chop seal onto the normalized `450x540` canvas.
 */
async function renderNormalizedClientPreview(
  fixture: WysiwygFixture,
  fontFiles: string[]
): Promise<Buffer> {
  const clientSvg = generateInstantSvgString({
    text: fixture.text,
    tradition: fixture.tradition,
    fontFamily: fixture.fontFamily,
    layout: fixture.layout,
    strokePreset: "CLASSICAL",
    variationType: "05_MINIMAL",
    inkColor: "#121212",
    hasSeal: false,
  });

  const resvg = new Resvg(clientSvg, {
    background: "rgba(0, 0, 0, 0)",
    font: {
      loadSystemFonts: false,
      fontFiles,
    },
  });
  const rendered = resvg.render();
  const rawSvgPng = Buffer.from(rendered.asPng());
  const rawMeta = await sharp(rawSvgPng).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const bounds = measureRgbaInkBounds(
    rawMeta.data,
    rawMeta.info.width,
    rawMeta.info.height,
    8
  );
  assert.ok(
    bounds.inkPixels > 0,
    `Client preview produced zero ink pixels for "${fixture.name}"`
  );

  const croppedCalligraphyPng = await sharp(rawSvgPng)
    .extract({
      left: bounds.minX,
      top: bounds.minY,
      width: bounds.width,
      height: bounds.height,
    })
    .png()
    .toBuffer();

  const isVertical = fixture.layout === "VERTICAL";
  const targetMaxW = isVertical ? NORM_SAFE_W * 0.68 : NORM_SAFE_W * 0.78;
  const targetMaxH = isVertical ? NORM_SAFE_H * 0.72 : NORM_SAFE_H * 0.58;
  const fitScale = Math.min(targetMaxW / bounds.width, targetMaxH / bounds.height);
  const scaledW = Math.max(
    1,
    Math.round(bounds.width * fitScale * fixture.artworkTransform.scale)
  );
  const scaledH = Math.max(
    1,
    Math.round(bounds.height * fitScale * fixture.artworkTransform.scale)
  );

  const resizedCalligraphy = await sharp(croppedCalligraphyPng)
    .resize(scaledW, scaledH, { fit: "fill" })
    .png()
    .toBuffer();

  const anchorX = NORM_SAFE_PAD_X + fixture.artworkTransform.x * NORM_SAFE_W;
  const anchorY = NORM_SAFE_PAD_Y + fixture.artworkTransform.y * NORM_SAFE_H;

  const composites: OverlayOptions[] = [
    {
      input: resizedCalligraphy,
      left: Math.round(anchorX - scaledW / 2),
      top: Math.round(anchorY - scaledH / 2),
    },
  ];

  if (fixture.hasSeal && fixture.sealTransform) {
    const safeFont = escapeXml(`'${DEFAULT_SEAL_FONT_FAMILY}', serif`);
    const clientSealSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
      <rect x="0" y="0" width="420" height="420" rx="20" ry="20" fill="#B71032" />
      <rect x="22" y="22" width="376" height="376" rx="10" ry="10" fill="none" stroke="#FBF9F4" stroke-width="10" />
      <text x="210" y="218" font-family="${safeFont}" font-size="230" font-weight="bold" fill="#FBF9F4" text-anchor="middle" dominant-baseline="central">印</text>
    </svg>`;

    const sealPng = Buffer.from(
      new Resvg(clientSealSvg, {
        background: "rgba(0, 0, 0, 0)",
        font: {
          loadSystemFonts: false,
          fontFiles,
        },
      })
        .render()
        .asPng()
    );

    const sealTargetSize = Math.max(
      1,
      Math.round(42 * fixture.sealTransform.scale)
    );
    const resizedSeal = await sharp(sealPng)
      .resize(sealTargetSize, sealTargetSize, { fit: "fill" })
      .png()
      .toBuffer();

    const sealAnchorX = NORM_SAFE_PAD_X + fixture.sealTransform.x * NORM_SAFE_W;
    const sealAnchorY = NORM_SAFE_PAD_Y + fixture.sealTransform.y * NORM_SAFE_H;

    composites.push({
      input: resizedSeal,
      left: Math.round(sealAnchorX - sealTargetSize / 2),
      top: Math.round(sealAnchorY - sealTargetSize / 2),
    });
  }

  return sharp({
    create: {
      width: NORM_W,
      height: NORM_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .raw()
    .toBuffer();
}

async function renderDownscaledServerMaster(
  fixture: WysiwygFixture
): Promise<Buffer> {
  const layers: CompositionLayer[] = [
    {
      id: `cal-${fixture.name}`,
      type: "calligraphy",
      text: fixture.text,
      fontFamily: fixture.fontFamily,
      layout: fixture.layout,
      colorHex: "#121212",
      zIndex: 10,
      opacity: 1,
      transform: fixture.artworkTransform,
    },
  ];

  if (fixture.hasSeal && fixture.sealTransform) {
    layers.push({
      id: `seal-${fixture.name}`,
      type: "seal",
      sealText: "印",
      fontFamily: DEFAULT_SEAL_FONT_FAMILY,
      colorHex: "#B71032",
      zIndex: 20,
      opacity: 0.95,
      transform: fixture.sealTransform,
    });
  }

  const composition = CompositionSchema.parse({
    version: 1,
    placement: "front",
    color: "#121212",
    transform: fixture.artworkTransform,
    layers,
  });

  const masterPng = await generatePrintMasterPng(composition);
  assert.equal(masterPng.readUInt32BE(16), PRINT_MASTER_WIDTH);
  assert.equal(masterPng.readUInt32BE(20), PRINT_MASTER_HEIGHT);

  return sharp(masterPng)
    .resize(NORM_W, NORM_H, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

/**
 * Computes pixel diff fraction across `width x height` RGBA buffers, ignoring
 * 1px anti-aliasing edge halo differences while flagging any missing/misplaced stroke,
 * diacritic, character, or seal stamp.
 */
function computePixelDiffRatio(
  clientRgba: Buffer,
  serverRgba: Buffer,
  width: number,
  height: number
): number {
  const totalPixels = width * height;
  const hasInk = (buf: Buffer, x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return (buf[(y * width + x) * 4 + 3] ?? 0) >= 36;
  };

  const hasInkWithinRadius = (
    buf: Buffer,
    cx: number,
    cy: number,
    radius: number
  ): boolean => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (hasInk(buf, cx + dx, cy + dy)) return true;
      }
    }
    return false;
  };

  let mismatchedPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cInk = hasInk(clientRgba, x, y);
      const sInk = hasInk(serverRgba, x, y);

      if (cInk === sInk) {
        if (cInk) {
          // Verify ink color family matches (dark sumi ink vs vermilion red seal)
          const idx = (y * width + x) * 4;
          const cRed = (clientRgba[idx] ?? 0) > 120 && (clientRgba[idx + 1] ?? 0) < 90;
          const sRed = (serverRgba[idx] ?? 0) > 120 && (serverRgba[idx + 1] ?? 0) < 90;
          if (cRed !== sRed) {
            mismatchedPixels++;
          }
        }
        continue;
      }

      // Allow minor 2px sub-pixel/stroke-weight anti-aliasing tolerance between <text> HarfBuzz and opentype.js <path>
      const matchedNearby = cInk
        ? hasInkWithinRadius(serverRgba, x, y, 2)
        : hasInkWithinRadius(clientRgba, x, y, 2);

      if (!matchedNearby) {
        mismatchedPixels++;
      }
    }
  }

  return mismatchedPixels / totalPixels;
}

test("R-602: WYSIWYG Visual Regression Suite — ClientCalligraphyRenderer (<text> + CSS fonts) vs Server Print Master (outlined <path> @ 4500x5400) across 10 multicultural fixtures", async () => {
  const savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const fontFiles = listAssetFontFiles();
    assert.ok(
      fontFiles.length >= 14,
      `Expected >= 14 approved font files in assets/fonts, found ${fontFiles.length}`
    );
    assert.equal(FIXTURES.length, 10);

    for (const fixture of FIXTURES) {
      const [clientRgba, serverRgba] = await Promise.all([
        renderNormalizedClientPreview(fixture, fontFiles),
        renderDownscaledServerMaster(fixture),
      ]);

      const clientBox = measureRgbaInkBounds(clientRgba, NORM_W, NORM_H);
      const serverBox = measureRgbaInkBounds(serverRgba, NORM_W, NORM_H);

      assert.ok(
        clientBox.inkPixels > 200,
        `[${fixture.name}] Client ink pixels too low (${clientBox.inkPixels})`
      );
      assert.ok(
        serverBox.inkPixels > 200,
        `[${fixture.name}] Server ink pixels too low (${serverBox.inkPixels})`
      );

      // 1. Seal presence / absence parity
      if (fixture.hasSeal) {
        assert.ok(
          clientBox.redSealPixels >= 40,
          `[${fixture.name}] Client preview missing cinnabar red seal pixels (${clientBox.redSealPixels})`
        );
        assert.ok(
          serverBox.redSealPixels >= 40,
          `[${fixture.name}] Server master missing cinnabar red seal pixels (${serverBox.redSealPixels})`
        );
      } else {
        assert.equal(clientBox.redSealPixels, 0);
        assert.equal(serverBox.redSealPixels, 0);
      }

      // 2. Bounding-box center & span alignment + IoU
      const centerDxRatio = Math.abs(clientBox.centerX - serverBox.centerX) / NORM_W;
      const centerDyRatio = Math.abs(clientBox.centerY - serverBox.centerY) / NORM_H;
      const iou = computeBoundingBoxIoU(clientBox, serverBox);

      assert.ok(
        centerDxRatio < 0.04,
        `[${fixture.name}] Horizontal center drift ${(centerDxRatio * 100).toFixed(2)}% exceeds 4%`
      );
      assert.ok(
        centerDyRatio < 0.04,
        `[${fixture.name}] Vertical center drift ${(centerDyRatio * 100).toFixed(2)}% exceeds 4%`
      );
      assert.ok(
        iou > 0.8,
        `[${fixture.name}] Bounding-box IoU ${iou.toFixed(3)} below 0.80`
      );

      // 3. Ink coverage ratio sanity
      const coverageRatio = clientBox.inkPixels / serverBox.inkPixels;
      assert.ok(
        coverageRatio > 0.55 && coverageRatio < 1.85,
        `[${fixture.name}] Ink coverage ratio ${coverageRatio.toFixed(3)} out of bounds`
      );

      // 4. Normalized pixel-diff threshold < 3% (R-602 AC)
      const pixelDiffRatio = computePixelDiffRatio(
        clientRgba,
        serverRgba,
        NORM_W,
        NORM_H
      );
      assert.ok(
        pixelDiffRatio < 0.03,
        `[${fixture.name}] WYSIWYG pixel diff ${(pixelDiffRatio * 100).toFixed(2)}% exceeded 3.00% threshold`
      );
    }

    // Negative control: prove the comparator catches a layout/text regression (> 3% diff or IoU failure)
    const verticalClient = await renderNormalizedClientPreview(
      FIXTURES[0],
      fontFiles
    );
    const horizontalServer = await renderDownscaledServerMaster({
      ...FIXTURES[0],
      layout: "HORIZONTAL",
    });
    const mismatchDiff = computePixelDiffRatio(
      verticalClient,
      horizontalServer,
      NORM_W,
      NORM_H
    );
    const mismatchIou = computeBoundingBoxIoU(
      measureRgbaInkBounds(verticalClient, NORM_W, NORM_H),
      measureRgbaInkBounds(horizontalServer, NORM_W, NORM_H)
    );
    assert.ok(
      mismatchDiff >= 0.03 || mismatchIou < 0.5,
      `Expected negative control layout mismatch to fail WYSIWYG gate (diff=${mismatchDiff.toFixed(4)}, iou=${mismatchIou.toFixed(3)})`
    );
  } finally {
    if (savedDbUrl !== undefined) {
      process.env.DATABASE_URL = savedDbUrl;
    }
  }
});
