// Keepsake editor: how a colour prints on clear film. Pure.

export const FAINT_LUMINANCE = 0.6;

export const CLEAR_FILM_WARNING =
  "Light colours print faint or invisible on clear film without white ink.";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #rrggbb colour, 0 (black) to 1 (white). NaN for anything else. */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!match) return Number.NaN;
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => channel(parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when the colour is light enough to print faint on clear film (no white ink behind it). */
export function faintOnClearFilm(hex: string): boolean {
  const luminance = relativeLuminance(hex);
  return Number.isFinite(luminance) && luminance > FAINT_LUMINANCE;
}
