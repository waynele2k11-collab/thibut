// Keepsake editor: crop marks, registration dots and the border label. Pure.
// All coordinates are sheet pixels (origin at the sheet's top-left corner).
import { LAYER_LABELS, type LayerId, type Scene } from "./scene";
import { mmToPxExact, type SheetSpec } from "./units";

export type Segment = { x1: number; y1: number; x2: number; y2: number };

const MARK_GAP_MM = 1;
const MARK_END_MM = 4.5;
const DOT_INSET_MM = 2;
const DOT_RADIUS_MM = 0.15;

/**
 * Eight segments, two at each film corner, drawn in the border only. They depend on the sheet
 * alone, so every layer of a project carries identical marks. Empty when there is no border.
 */
export function cropMarks(sheet: SheetSpec): Segment[] {
  if (sheet.borderPx <= 0) return [];
  // Whole pixels, so a mark drawn with an even line width lands on the pixel grid at full strength.
  const gap = Math.min(Math.round(mmToPxExact(MARK_GAP_MM, sheet.dpi)), sheet.borderPx);
  const end = Math.min(Math.round(mmToPxExact(MARK_END_MM, sheet.dpi)), sheet.borderPx);
  const left = sheet.borderPx;
  const top = sheet.borderPx;
  const right = sheet.borderPx + sheet.filmWpx;
  const bottom = sheet.borderPx + sheet.filmHpx;
  const segments: Segment[] = [];
  for (const [cx, sx] of [
    [left, -1],
    [right, 1],
  ] as const) {
    for (const [cy, sy] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      // Horizontal mark, level with the film edge, out in the side border.
      segments.push({ x1: cx + sx * gap, y1: cy, x2: cx + sx * end, y2: cy });
      // Vertical mark, in line with the film edge, out in the top or bottom border.
      segments.push({ x1: cx, y1: cy + sy * gap, x2: cx, y2: cy + sy * end });
    }
  }
  return segments;
}

/** A small dot 2 mm inside each film corner, for casting where the film's edges cannot be used. */
export function innerDots(sheet: SheetSpec): { x: number; y: number; r: number }[] {
  const inset = mmToPxExact(DOT_INSET_MM, sheet.dpi);
  const r = Math.max(1, mmToPxExact(DOT_RADIUS_MM, sheet.dpi));
  const left = sheet.borderPx + inset;
  const top = sheet.borderPx + inset;
  const right = sheet.borderPx + sheet.filmWpx - inset;
  const bottom = sheet.borderPx + sheet.filmHpx - inset;
  return [
    { x: left, y: top, r },
    { x: right, y: top, r },
    { x: left, y: bottom, r },
    { x: right, y: bottom, r },
  ];
}

/** ASCII only, so the label prints the same from any system font. */
export function asciiLabelText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/ +/g, " ")
    .trim();
}

function trimNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Width in pixels of crop-mark lines: at least 2, and even, so a line centred on a whole-pixel
 * coordinate covers whole pixels and prints at full strength.
 */
export function markLineWidth(sheet: SheetSpec): number {
  return Math.max(2, 2 * Math.round(mmToPxExact(0.15, sheet.dpi) / 2));
}

/**
 * The border label. `index` and `total` count the films of this set (layers that have artwork),
 * so "FRONT 2 of 2" means two films exist. `jobCode` is the same on every film made from one
 * state of the project: films whose codes differ do not belong together.
 */
export function sheetLabel(
  scene: Scene,
  layer: LayerId,
  index: number,
  total: number,
  sheet: SheetSpec,
  jobCode: string
): string {
  const name = asciiLabelText(scene.name).slice(0, 40) || "Untitled";
  const parts = [
    name,
    `${LAYER_LABELS[layer].toUpperCase()} ${index} of ${total}`,
    `film ${trimNumber(sheet.filmWmm)} x ${trimNumber(sheet.filmHmm)} mm`,
    `${sheet.dpi} ppi`,
  ];
  if (scene.mirror) parts.push("MIRRORED");
  parts.push(`job ${asciiLabelText(jobCode).slice(0, 24)}`);
  return parts.join(" | ");
}

export const CONCEPT_BAND_LINES = ["Concept preview.", "Not a photograph of the finished piece."] as const;

/**
 * The band under a preview (BRD APR-009), sized for a picture `width` pixels wide. One line when
 * it fits; two lines on a narrow picture, so the words are never squeezed to fit.
 */
export function conceptBandSpec(width: number): { height: number; fontPx: number; lines: string[] } {
  const w = Math.max(1, width);
  const usable = w * 0.94;
  // Arial averages about half its size per character.
  const widthAt = (chars: number, fontPx: number) => chars * fontPx * 0.5;
  const oneLine = CONCEPT_BAND_LINES.join(" ");
  const fontPx = Math.max(11, Math.round(w * 0.021));
  if (widthAt(oneLine.length, fontPx) <= usable) {
    return { height: Math.max(28, Math.round(fontPx * 2.4)), fontPx, lines: [oneLine] };
  }
  const longest = Math.max(...CONCEPT_BAND_LINES.map((line) => line.length));
  const twoLineFont = Math.max(7, Math.min(fontPx, Math.floor(usable / (longest * 0.5))));
  return { height: Math.round(twoLineFont * 3.4), fontPx: twoLineFont, lines: [...CONCEPT_BAND_LINES] };
}
