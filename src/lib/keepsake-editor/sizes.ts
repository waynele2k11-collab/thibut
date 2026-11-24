// Piece sizes offered in the keepsake editor.
// PLACEHOLDERS: not validated against real molds or acrylic sheets. Replace when the founder
// confirms the real sizes; custom millimetres are always available in the editor.

export type KeepsakeSize = { id: string; label: string; wMm: number; hMm: number };

export const KEEPSAKE_SIZES: readonly KeepsakeSize[] = [
  { id: "small-square", label: "Small square, 100 × 100 mm", wMm: 100, hMm: 100 },
  { id: "medium-portrait", label: "Medium portrait, 100 × 150 mm", wMm: 100, hMm: 150 },
  { id: "medium-landscape", label: "Medium landscape, 150 × 100 mm", wMm: 150, hMm: 100 },
  { id: "large-portrait", label: "Large portrait, 150 × 200 mm", wMm: 150, hMm: 200 },
  { id: "large-landscape", label: "Large landscape, 200 × 150 mm", wMm: 200, hMm: 150 },
];

export const KEEPSAKE_SIZES_NOTE =
  "These sizes are placeholders and have not been validated against a real mold or sheet.";

export const DEFAULT_MARGIN_MM = 3;
