// Keepsake editor: where text and images land on the film, in film pixels at the sheet's
// resolution (origin at the film's top-left corner). Pure: the caller supplies the measurer.
import { LAYER_IDS, type Block, type ImageBlock, type Scene, type TextBlock } from "./scene";
import { mmToPxExact, pxToMm, type SheetSpec } from "./units";

export type Measured = {
  width: number;
  ascent: number;
  descent: number;
  /**
   * Where the ink of this text really is, measured from its left end on the baseline. A canvas
   * supplies these; script and brush fonts draw well outside their nominal box. Optional: without
   * them the nominal box is used.
   */
  inkLeft?: number;
  inkRight?: number;
  inkAscent?: number;
  inkDescent?: number;
};

export type Measure = (text: string, fontId: string, sizePx: number) => Measured;

export type Box = { x: number; y: number; w: number; h: number };
export type LaidOutLine = { text: string; x: number; baselineY: number };

/** Lines exactly as typed: no wrapping, empty lines kept. */
export function splitLines(text: string): string[] {
  return text.split("\n");
}

export function layoutText(
  block: TextBlock,
  sheet: SheetSpec,
  measure: Measure
): { lines: LaidOutLine[]; box: Box; sizePx: number } {
  const sizePx = mmToPxExact(block.sizeMm, sheet.dpi);
  const anchorX = mmToPxExact(block.xMm, sheet.dpi);
  const top = mmToPxExact(block.yMm, sheet.dpi);
  const rawLines = splitLines(block.text);
  const measured = rawLines.map((line) => measure(line, block.fontId, sizePx));
  // Font-wide ascent and descent, so the block does not jump as letters change.
  const reference = measure("Ắg", block.fontId, sizePx);
  const ascent = reference.ascent;
  const descent = reference.descent;
  const lineAdvance = sizePx * block.lineHeight;
  const maxWidth = measured.reduce((max, m) => Math.max(max, m.width), 0);

  const boxX =
    block.align === "left" ? anchorX : block.align === "center" ? anchorX - maxWidth / 2 : anchorX - maxWidth;
  const lines: LaidOutLine[] = rawLines.map((text, i) => {
    const width = measured[i].width;
    const x =
      block.align === "left" ? boxX : block.align === "center" ? boxX + (maxWidth - width) / 2 : boxX + maxWidth - width;
    return { text, x, baselineY: top + ascent + i * lineAdvance };
  });
  const height = ascent + descent + (rawLines.length - 1) * lineAdvance;
  return { lines, box: { x: boxX, y: top, w: maxWidth, h: height }, sizePx };
}

/** The image's rectangle on the film before rotation. `size` is the source image in pixels. */
export function layoutImage(block: ImageBlock, sheet: SheetSpec, size: { w: number; h: number }): Box {
  const w = mmToPxExact(block.widthMm, sheet.dpi);
  const sourceW = Math.max(1, size.w * block.crop.w);
  const sourceH = Math.max(1, size.h * block.crop.h);
  return {
    x: mmToPxExact(block.xMm, sheet.dpi),
    y: mmToPxExact(block.yMm, sheet.dpi),
    w,
    h: (w * sourceH) / sourceW,
  };
}

/** Source pixels per inch of an image at its printed size. */
export function imagePixelsPerInch(block: ImageBlock, size: { w: number; h: number }): number {
  return (size.w * block.crop.w) / (block.widthMm / 25.4);
}

export function blockBox(
  block: Block,
  sheet: SheetSpec,
  measure: Measure,
  imageSizes: Record<string, { w: number; h: number }>
): Box | null {
  if (block.kind === "text") return layoutText(block, sheet, measure).box;
  const size = Object.hasOwn(imageSizes, block.id) ? imageSizes[block.id] : undefined;
  // An image that is not attached still has a square placeholder so it can be selected.
  return layoutImage(block, sheet, size ?? { w: 1, h: 1 });
}

function insideRotatedBox(box: Box, rotationDeg: number, px: number, py: number, pad: number): boolean {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const angle = (-rotationDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(rx) <= box.w / 2 + pad && Math.abs(ry) <= box.h / 2 + pad;
}

/**
 * The id of the top-most block under a point given in film millimetres, or null. Front is above
 * middle, middle above back; within a layer, later blocks are above earlier ones.
 */
export function hitTest(
  scene: Scene,
  sheet: SheetSpec,
  measure: Measure,
  imageSizes: Record<string, { w: number; h: number }>,
  xMm: number,
  yMm: number
): string | null {
  const px = mmToPxExact(xMm, sheet.dpi);
  const py = mmToPxExact(yMm, sheet.dpi);
  const pad = mmToPxExact(1, sheet.dpi);
  for (let l = LAYER_IDS.length - 1; l >= 0; l -= 1) {
    for (let i = scene.blocks.length - 1; i >= 0; i -= 1) {
      const block = scene.blocks[i];
      if (block.layer !== LAYER_IDS[l]) continue;
      const box = blockBox(block, sheet, measure, imageSizes);
      if (box && insideRotatedBox(box, block.rotationDeg, px, py, pad)) return block.id;
    }
  }
  return null;
}

export function boxToMm(box: Box, sheet: SheetSpec): Box {
  return {
    x: pxToMm(box.x, sheet.dpi),
    y: pxToMm(box.y, sheet.dpi),
    w: pxToMm(box.w, sheet.dpi),
    h: pxToMm(box.h, sheet.dpi),
  };
}

/** The axis-aligned box around `rect` after it is turned by `rotationDeg` about `pivot`. */
export function rotatedBounds(rect: Box, pivot: { x: number; y: number }, rotationDeg: number): Box {
  if (rotationDeg % 360 === 0) return rect;
  const angle = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ]) {
    const dx = px - pivot.x;
    const dy = py - pivot.y;
    const x = pivot.x + dx * cos - dy * sin;
    const y = pivot.y + dx * sin + dy * cos;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function finite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * The box around what a text block really draws, before rotation, from the same layout
 * `drawText` uses. Null when every line is blank. With ink measurements it follows the ink;
 * without them it is the nominal box of the lines that have text.
 */
export function textInkBox(block: TextBlock, sheet: SheetSpec, measure: Measure): Box | null {
  const { lines, box, sizePx } = layoutText(block, sheet, measure);
  if (lines.length === 0) return null;
  const nominalAscent = lines[0].baselineY - box.y;
  const nominalDescent = box.h - nominalAscent - (lines.length - 1) * sizePx * block.lineHeight;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    if (line.text.trim() === "") continue;
    const m = measure(line.text, block.fontId, sizePx);
    const hasInk = finite(m.inkLeft) && finite(m.inkRight) && finite(m.inkAscent) && finite(m.inkDescent);
    const left = hasInk ? line.x - (m.inkLeft as number) : line.x;
    const right = hasInk ? line.x + (m.inkRight as number) : line.x + m.width;
    const top = hasInk ? line.baselineY - (m.inkAscent as number) : line.baselineY - nominalAscent;
    const bottom = hasInk ? line.baselineY + (m.inkDescent as number) : line.baselineY + nominalDescent;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, right);
    maxY = Math.max(maxY, bottom);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * The upright box, in film pixels, around everything a block draws, rotation included. Text and
 * images turn about the centre of their layout box, exactly as the draw function turns them.
 * Null for a block that draws nothing (blank text, or an image that is not attached).
 */
export function blockBounds(
  block: Block,
  sheet: SheetSpec,
  measure: Measure,
  imageSizes: Readonly<Record<string, { w: number; h: number }>>
): Box | null {
  if (block.kind === "text") {
    const ink = textInkBox(block, sheet, measure);
    if (!ink) return null;
    const box = layoutText(block, sheet, measure).box;
    return rotatedBounds(ink, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, block.rotationDeg);
  }
  const size = Object.hasOwn(imageSizes, block.id) ? imageSizes[block.id] : undefined;
  if (!size) return null;
  const box = layoutImage(block, sheet, size);
  return rotatedBounds(box, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, block.rotationDeg);
}
