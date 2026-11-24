/**
 * Custom crystal keepsake catalogue for the MVP: sizes, formats, prices and
 * gallery samples. Money is held as integer cents.
 */

export type KeepsakeFormatId = "single" | "double";

export interface KeepsakeSize {
  id: string;
  label: string;
  singleCents: number;
}

export const KEEPSAKE_SIZES: readonly KeepsakeSize[] = [
  { id: "4x6", label: "4 × 6 in", singleCents: 8900 },
  { id: "5x7", label: "5 × 7 in", singleCents: 10900 },
  { id: "6x8", label: "6 × 8 in", singleCents: 14900 },
  { id: "8x10", label: "8 × 10 in", singleCents: 19900 },
];

export const KEEPSAKE_FORMATS: readonly {
  id: KeepsakeFormatId;
  label: string;
}[] = [
  { id: "single", label: "Single-Sided" },
  { id: "double", label: "Double-Sided" },
];

/** Double-sided is 1.8× the single-sided price for the same size. */
export function keepsakePriceCents(
  size: KeepsakeSize,
  format: KeepsakeFormatId
): number {
  return format === "double"
    ? Math.round((size.singleCents * 18) / 10)
    : size.singleCents;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Whole-dollar display price from integer cents. */
export function formatKeepsakePrice(cents: number): string {
  return usd.format(Math.round(cents / 100));
}

export const KEEPSAKE_FROM_PRICE = formatKeepsakePrice(
  KEEPSAKE_SIZES[0].singleCents
);

export const KEEPSAKE_ORDER_ADDRESS = "support@thibut.com";

/** Pre-filled order email. Carries only the chosen options, never customer data. */
export function keepsakeOrderMailto(subjectDetail?: string): string {
  const subject = subjectDetail
    ? `Custom Crystal Keepsake Order — ${subjectDetail}`
    : "Custom Crystal Keepsake Order";
  return `mailto:${KEEPSAKE_ORDER_ADDRESS}?subject=${encodeURIComponent(subject)}`;
}

export interface KeepsakeSample {
  id: string;
  title: string;
  occasion: string;
  /** Vietnamese wording shown on the piece. */
  wording: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  defaultFormat: KeepsakeFormatId;
  /** Shown under the price when the photo depicts more than one piece. */
  priceNote?: string;
}

export const KEEPSAKE_SAMPLES: readonly KeepsakeSample[] = [
  {
    id: "wedding-blessing",
    title: "Wedding Blessing",
    occasion: "Wedding",
    wording: "Trăm Năm Hạnh Phúc",
    description:
      "The couple in red áo dài with a blessing verse, apricot blossom, lotus and a double-happiness seal.",
    imageSrc: "/keepsakes/wedding-blessing.webp",
    imageAlt:
      "Crystal keepsake of a wedding couple in red áo dài beside the words Trăm Năm Hạnh Phúc and a blessing verse",
    defaultFormat: "single",
  },
  {
    id: "wedding-reverse",
    title: "Wedding Portrait, Reverse Side",
    occasion: "Wedding",
    wording: "Trăm Năm Hạnh Phúc",
    description:
      "A second composition for the back of a double-sided piece: the same couple from the other side, with the title only.",
    imageSrc: "/keepsakes/wedding-reverse.webp",
    imageAlt:
      "Crystal keepsake showing the reverse design of the wedding couple with the words Trăm Năm Hạnh Phúc",
    defaultFormat: "double",
  },
  {
    id: "parents-pair",
    title: "Mother & Father Pair",
    occasion: "Family",
    wording: "Nghĩa Mẹ · Công Cha",
    description:
      "Two matching portraits with the folk verse honouring a mother's devotion and a father's labour, framed in orchid and blossom.",
    imageSrc: "/keepsakes/parents-pair.webp",
    imageAlt:
      "Two crystal keepsakes side by side, one with a mother's portrait and one with a father's, each with a Vietnamese verse",
    defaultFormat: "single",
    priceNote: "Price is per piece. The photo shows two.",
  },
];
