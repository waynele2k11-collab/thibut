/**
 * Canonical Calligraphy Ink, Seal & Canvas Color Constants.
 *
 * Used strictly for SVG/Canvas vector fills, Fabric handle strokes, and
 * composition JSON serialization (never for UI Tailwind styling).
 */

export const DEFAULT_INK_HEX = "#121212";
export const PURE_WHITE_HEX = "#FFFFFF";
export const SEAL_VERMILION_HEX = "#B71032";
export const IMPERIAL_GOLD_HEX = "#C5A059";
export const RICE_PAPER_IVORY_HEX = "#F6F1E7";
export const STAGE_PAPER_HEX = "#FAF7F2";

export interface InkSwatchDefinition {
  name: string;
  hex: string;
  swatchClass: string;
  checkClass: string;
}

export const INK_SWATCHES: ReadonlyArray<InkSwatchDefinition> = [
  {
    name: "Sumi Black",
    hex: DEFAULT_INK_HEX,
    swatchClass: "bg-primary",
    checkClass: "text-on-primary",
  },
  {
    name: "Pure White",
    hex: PURE_WHITE_HEX,
    swatchClass: "bg-surface-container-lowest border border-outline-variant",
    checkClass: "text-on-background",
  },
  {
    name: "Cinnabar Red",
    hex: SEAL_VERMILION_HEX,
    swatchClass: "bg-secondary",
    checkClass: "text-on-secondary",
  },
  {
    name: "Imperial Gold",
    hex: IMPERIAL_GOLD_HEX,
    swatchClass: "bg-amber-600/85 border border-outline-variant",
    checkClass: "text-on-primary",
  },
  {
    name: "Rice Paper Ivory",
    hex: RICE_PAPER_IVORY_HEX,
    swatchClass: "bg-surface-container border border-outline-variant",
    checkClass: "text-on-background",
  },
];
