// Keepsake editor: drawing. One function, `drawLayer`, draws a layer at any scale, so the screen
// preview and the print export come from the same code and the same fonts.
// Browser only (Canvas 2D). Nothing here talks to the network.
import {
  blockBox,
  layoutImage,
  layoutText,
  type Box,
  type Measure,
} from "@/lib/keepsake-editor/layout";
import { conceptBandSpec, cropMarks, innerDots, markLineWidth } from "@/lib/keepsake-editor/marks";
import {
  BACKDROP_DARK,
  BACKDROP_LIGHT,
  BAND_FILL,
  BAND_TEXT,
  CHECK_DARK,
  CHECK_LIGHT,
  MARK_COLOR,
  PLACEHOLDER_STROKE,
  SELECTION_STROKE,
} from "@/lib/keepsake-editor/palette";
import {
  LAYER_IDS,
  type Block,
  type ImageBlock,
  type LayerId,
  type Scene,
  type TextBlock,
} from "@/lib/keepsake-editor/scene";
import { mmToPxExact, type SheetSpec } from "@/lib/keepsake-editor/units";

export type LoadedImage = { bitmap: ImageBitmap; w: number; h: number };

export type DrawAssets = {
  images: ReadonlyMap<string, LoadedImage>;
  /** CSS font family the editor registered for a font id. */
  fontFamily: (fontId: string) => string;
};

export type Backdrop = "light" | "dark" | "checked";

export const CONCEPT_PREVIEW_BAND = "Concept preview. Not a photograph of the finished piece.";

type Ctx = CanvasRenderingContext2D;

function fontShorthand(family: string, sizePx: number): string {
  return `${sizePx}px "${family.replace(/["\\]/g, "")}"`;
}

/** A measurer backed by a canvas context. Values are in the same units as `sizePx`. */
export function makeMeasure(ctx: Ctx, assets: DrawAssets): Measure {
  return (text, fontId, sizePx) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = fontShorthand(assets.fontFamily(fontId), sizePx);
    // The same alignment and baseline `drawText` uses, so the ink box is measured from the
    // point each line is drawn at.
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText(text);
    ctx.restore();
    const ascent = Number.isFinite(m.fontBoundingBoxAscent) ? m.fontBoundingBoxAscent : sizePx * 0.9;
    const descent = Number.isFinite(m.fontBoundingBoxDescent) ? m.fontBoundingBoxDescent : sizePx * 0.3;
    return {
      width: m.width,
      ascent,
      descent,
      inkLeft: m.actualBoundingBoxLeft,
      inkRight: m.actualBoundingBoxRight,
      inkAscent: m.actualBoundingBoxAscent,
      inkDescent: m.actualBoundingBoxDescent,
    };
  };
}

export function imageSizes(assets: DrawAssets): Record<string, { w: number; h: number }> {
  const sizes: Record<string, { w: number; h: number }> = {};
  for (const [id, image] of assets.images) sizes[id] = { w: image.w, h: image.h };
  return sizes;
}

function rotateAbout(ctx: Ctx, box: Box, rotationDeg: number): void {
  if (rotationDeg === 0) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);
}

function drawText(ctx: Ctx, block: TextBlock, sheet: SheetSpec, assets: DrawAssets): void {
  const { lines, box, sizePx } = layoutText(block, sheet, makeMeasure(ctx, assets));
  ctx.save();
  rotateAbout(ctx, box, block.rotationDeg);
  ctx.font = fontShorthand(assets.fontFamily(block.fontId), sizePx);
  ctx.fillStyle = block.colorHex;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const line of lines) {
    if (line.text.length > 0) ctx.fillText(line.text, line.x, line.baselineY);
  }
  ctx.restore();
}

function drawImage(
  ctx: Ctx,
  block: ImageBlock,
  sheet: SheetSpec,
  assets: DrawAssets,
  placeholder: boolean
): void {
  const image = assets.images.get(block.id);
  if (!image) {
    if (!placeholder) return;
    const box = layoutImage(block, sheet, { w: 1, h: 1 });
    ctx.save();
    rotateAbout(ctx, box, block.rotationDeg);
    ctx.setLineDash([mmToPxExact(1.5, sheet.dpi), mmToPxExact(1, sheet.dpi)]);
    ctx.lineWidth = mmToPxExact(0.3, sheet.dpi);
    ctx.strokeStyle = PLACEHOLDER_STROKE;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    return;
  }
  const box = layoutImage(block, sheet, image);
  ctx.save();
  rotateAbout(ctx, box, block.rotationDeg);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image.bitmap,
    block.crop.x * image.w,
    block.crop.y * image.h,
    Math.max(1, block.crop.w * image.w),
    Math.max(1, block.crop.h * image.h),
    box.x,
    box.y,
    box.w,
    box.h
  );
  ctx.restore();
}

/**
 * Draws one layer. The context's origin must be the film's top-left corner. `scale` is 1 for
 * print export and smaller for the screen. Nothing is filled behind the blocks, so the canvas
 * stays transparent wherever the layer is empty.
 */
export function drawLayer(
  ctx: Ctx,
  scene: Scene,
  layer: LayerId,
  sheet: SheetSpec,
  scale: number,
  assets: DrawAssets,
  options?: { placeholders?: boolean }
): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, sheet.filmWpx, sheet.filmHpx);
  ctx.clip();
  for (const block of scene.blocks) {
    if (block.layer !== layer) continue;
    if (block.kind === "text") drawText(ctx, block, sheet, assets);
    else drawImage(ctx, block, sheet, assets, options?.placeholders === true);
  }
  ctx.restore();
}

/**
 * Draws one export sheet onto a clear canvas of `sheet.sheetWpx × sheet.sheetHpx`: the layer,
 * mirrored when the scene says so, then the marks and the label, which are never mirrored.
 */
export function drawSheet(
  ctx: Ctx,
  scene: Scene,
  layer: LayerId,
  sheet: SheetSpec,
  assets: DrawAssets,
  label: string
): void {
  ctx.clearRect(0, 0, sheet.sheetWpx, sheet.sheetHpx);

  ctx.save();
  ctx.translate(sheet.borderPx, sheet.borderPx);
  if (scene.mirror) {
    ctx.translate(sheet.filmWpx, 0);
    ctx.scale(-1, 1);
  }
  drawLayer(ctx, scene, layer, sheet, 1, assets);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = MARK_COLOR;
  ctx.strokeStyle = MARK_COLOR;
  if (scene.innerMarks) {
    for (const dot of innerDots(sheet)) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (sheet.borderPx > 0) {
    // An even width on whole-pixel coordinates: full-strength lines, not two half-strength rows.
    ctx.lineWidth = markLineWidth(sheet);
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const s of cropMarks(sheet)) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
    // The label sits in the bottom border, between the two bottom corner marks. It is plain
    // system type: it is cut off with the border and is not part of the artwork.
    const sizePx = mmToPxExact(2.2, sheet.dpi);
    ctx.font = `${sizePx}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      label,
      sheet.sheetWpx / 2,
      sheet.borderPx + sheet.filmHpx + sheet.borderPx / 2,
      Math.max(1, sheet.filmWpx - mmToPxExact(2, sheet.dpi))
    );
  }
  ctx.restore();
}

function fillBackdrop(ctx: Ctx, backdrop: Backdrop, w: number, h: number): void {
  if (backdrop === "light") {
    ctx.fillStyle = BACKDROP_LIGHT;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (backdrop === "dark") {
    ctx.fillStyle = BACKDROP_DARK;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const cell = Math.max(6, Math.round(Math.min(w, h) / 32));
  ctx.fillStyle = CHECK_LIGHT;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = CHECK_DARK;
  for (let y = 0; y * cell < h; y += 1) {
    for (let x = y % 2; x * cell < w; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
  }
}

export type PreviewOptions = {
  backdrop: Backdrop;
  visible: Record<LayerId, boolean>;
  /** Screen only: the film edge and placeholders for images that are not attached. */
  guides: boolean;
};

/**
 * Draws the combined preview of the whole piece (film plus safe margin) with its top-left corner
 * at the context's origin. `scale` converts sheet pixels to canvas pixels. Never mirrored: the
 * preview shows the piece as it is viewed.
 */
export function drawPreview(
  ctx: Ctx,
  scene: Scene,
  sheet: SheetSpec,
  scale: number,
  assets: DrawAssets,
  options: PreviewOptions
): { width: number; height: number } {
  const width = mmToPxExact(sheet.pieceWmm, sheet.dpi) * scale;
  const height = mmToPxExact(sheet.pieceHmm, sheet.dpi) * scale;
  const margin = mmToPxExact(sheet.marginMm, sheet.dpi) * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  fillBackdrop(ctx, options.backdrop, width, height);
  ctx.translate(margin, margin);
  for (const layer of LAYER_IDS) {
    if (!options.visible[layer]) continue;
    drawLayer(ctx, scene, layer, sheet, scale, assets, { placeholders: options.guides });
  }
  if (options.guides) {
    const filmW = sheet.filmWpx * scale;
    const filmH = sheet.filmHpx * scale;
    ctx.lineWidth = 1;
    ctx.strokeStyle = options.backdrop === "dark" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(0.5, 0.5, filmW - 1, filmH - 1);
    // The safe zone: artwork between this line and the film edge may be trimmed by the cut.
    // Screen only; `guides` is never set for a downloaded file.
    const safe = mmToPxExact(Math.max(0, scene.safeZoneMm), sheet.dpi) * scale;
    if (safe > 0 && filmW - 2 * safe > 2 && filmH - 2 * safe > 2) {
      ctx.setLineDash([1, 3]);
      ctx.strokeRect(safe + 0.5, safe + 0.5, filmW - 2 * safe - 1, filmH - 2 * safe - 1);
    }
  }
  ctx.restore();
  return { width, height };
}

/** Height in pixels of the concept band for a picture `width` pixels wide. */
export function conceptBandHeight(width: number): number {
  return conceptBandSpec(width).height;
}

/**
 * The fixed band under every combined preview, on screen and downloaded (BRD APR-009). Pass the
 * height from `conceptBandHeight(width)`. On a narrow picture the words go on two lines.
 */
export function drawConceptBand(ctx: Ctx, y: number, width: number, height: number): void {
  const spec = conceptBandSpec(width);
  ctx.save();
  ctx.fillStyle = BAND_FILL;
  ctx.fillRect(0, y, width, height);
  ctx.fillStyle = BAND_TEXT;
  ctx.font = `${spec.fontPx}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  spec.lines.forEach((line, i) => {
    const lineY = y + (height * (i + 0.5)) / spec.lines.length;
    ctx.fillText(line, width / 2, lineY, width * 0.94);
  });
  ctx.restore();
}

/** The selected block's outline, in the same coordinates as `drawPreview`. Screen only. */
export function drawSelection(
  ctx: Ctx,
  block: Block,
  sheet: SheetSpec,
  scale: number,
  assets: DrawAssets
): void {
  const box = blockBox(block, sheet, makeMeasure(ctx, assets), imageSizes(assets));
  if (!box) return;
  const margin = mmToPxExact(sheet.marginMm, sheet.dpi) * scale;
  ctx.save();
  ctx.translate(margin, margin);
  ctx.scale(scale, scale);
  rotateAbout(ctx, box, block.rotationDeg);
  ctx.setLineDash([6 / scale, 4 / scale]);
  ctx.lineWidth = 1.5 / scale;
  ctx.strokeStyle = SELECTION_STROKE;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}
