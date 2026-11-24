// Keepsake editor: millimetres to print pixels. Pure: no React, no DOM, no server imports.

export const PRINT_DPI = 300;
export const MIN_DPI = 150;
export const MAX_SIDE_PX = 6000;
export const BORDER_MM = 5;
export const MIN_PIECE_MM = 20;
export const MAX_PIECE_MM = 600;
export const MIN_FILM_MM = 10;
export const MM_PER_INCH = 25.4;

/** Exact (unrounded) pixels for a length in millimetres. */
export function mmToPxExact(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** Whole pixels for a length in millimetres. */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round(mmToPxExact(mm, dpi));
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

export type SheetSpec = {
  pieceWmm: number;
  pieceHmm: number;
  marginMm: number;
  filmWmm: number;
  filmHmm: number;
  /** Pixels per inch of every exported layer. */
  dpi: number;
  /** True when the resolution was lowered so the longer side fits MAX_SIDE_PX. */
  reduced: boolean;
  filmWpx: number;
  filmHpx: number;
  /** Width of the crop-mark border in pixels; 0 when the border is switched off. */
  borderPx: number;
  sheetWpx: number;
  sheetHpx: number;
};

function assertFiniteNumber(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a number.`);
  }
}

/**
 * The export sheet for a piece: the film is the piece minus the safe margin on each side, and the
 * sheet is the film plus a border that holds the crop marks. Every layer of a project uses the
 * same sheet, so films cut on the marks stack by their edges.
 */
export function resolveSheet(
  pieceWmm: number,
  pieceHmm: number,
  marginMm: number,
  withBorder = true
): SheetSpec {
  assertFiniteNumber(pieceWmm, "Width");
  assertFiniteNumber(pieceHmm, "Height");
  assertFiniteNumber(marginMm, "Margin");
  if (
    pieceWmm < MIN_PIECE_MM ||
    pieceWmm > MAX_PIECE_MM ||
    pieceHmm < MIN_PIECE_MM ||
    pieceHmm > MAX_PIECE_MM
  ) {
    throw new RangeError(
      `The piece must be between ${MIN_PIECE_MM} and ${MAX_PIECE_MM} mm on each side.`
    );
  }
  if (marginMm < 0) {
    throw new RangeError("The safe margin cannot be negative.");
  }
  const filmWmm = pieceWmm - 2 * marginMm;
  const filmHmm = pieceHmm - 2 * marginMm;
  if (filmWmm < MIN_FILM_MM || filmHmm < MIN_FILM_MM) {
    throw new RangeError(
      `The safe margin leaves a film smaller than ${MIN_FILM_MM} mm. Use a smaller margin.`
    );
  }

  const borderMm = withBorder ? BORDER_MM : 0;
  const longerSheetMm = Math.max(filmWmm, filmHmm) + 2 * borderMm;
  let dpi = PRINT_DPI;
  let reduced = false;
  if (mmToPx(longerSheetMm, dpi) > MAX_SIDE_PX) {
    dpi = Math.max(MIN_DPI, Math.floor((MAX_SIDE_PX * MM_PER_INCH) / longerSheetMm));
    reduced = true;
  }

  const filmWpx = mmToPx(filmWmm, dpi);
  const filmHpx = mmToPx(filmHmm, dpi);
  const borderPx = mmToPx(borderMm, dpi);
  return {
    pieceWmm,
    pieceHmm,
    marginMm,
    filmWmm,
    filmHmm,
    dpi,
    reduced,
    filmWpx,
    filmHpx,
    borderPx,
    sheetWpx: filmWpx + 2 * borderPx,
    sheetHpx: filmHpx + 2 * borderPx,
  };
}
