import type { ProductMock, ProductVariantMock } from "@/components/studio/ProductSelectionModal";
import {
  DEFAULT_INK_HEX,
  IMPERIAL_GOLD_HEX,
  PURE_WHITE_HEX,
  RICE_PAPER_IVORY_HEX,
} from "./inkPalette";

export interface GarmentColorOption {
  key: string;
  label: string;
  swatchClass: string;
  checkClass: string;
  isDark: boolean;
  firstVariantId: string;
}

export interface GarmentInkContrastAdvice {
  message: string;
  suggestedInkHex: string;
  suggestedInkName: string;
  secondaryInkHex?: string;
  secondaryInkName?: string;
}

function classifyGarmentColor(rawColor: string | null | undefined): {
  label: string;
  swatchClass: string;
  checkClass: string;
  isDark: boolean;
} {
  const clean = (rawColor ?? "").trim();
  const lower = clean.toLowerCase();

  if (
    !clean ||
    lower.includes("white") ||
    lower.includes("ivory") ||
    lower.includes("cream") ||
    lower.includes("natural") ||
    lower.includes("ecru")
  ) {
    return {
      label: clean || "Paper White",
      swatchClass: "bg-surface-container-lowest border border-outline-variant",
      checkClass: "text-on-background",
      isDark: false,
    };
  }

  if (
    lower.includes("black") ||
    lower.includes("coal") ||
    lower.includes("onyx") ||
    lower.includes("obsidian")
  ) {
    return {
      label: clean,
      swatchClass: "bg-primary border border-primary",
      checkClass: "text-on-primary",
      isDark: true,
    };
  }

  if (lower.includes("navy") || lower.includes("indigo") || lower.includes("midnight")) {
    return {
      label: clean,
      swatchClass: "bg-slate-900 border border-outline-variant",
      checkClass: "text-on-primary",
      isDark: true,
    };
  }

  if (lower.includes("charcoal") || lower.includes("graphite") || lower.includes("dark")) {
    return {
      label: clean,
      swatchClass: "bg-neutral-800 border border-outline-variant",
      checkClass: "text-on-primary",
      isDark: true,
    };
  }

  if (lower.includes("grey") || lower.includes("gray") || lower.includes("heather") || lower.includes("ash")) {
    return {
      label: clean,
      swatchClass: "bg-neutral-400 border border-outline-variant",
      checkClass: "text-on-primary",
      isDark: false,
    };
  }

  if (lower.includes("sand") || lower.includes("beige") || lower.includes("oat") || lower.includes("khaki") || lower.includes("stone")) {
    return {
      label: clean,
      swatchClass: "bg-surface-container-highest border border-outline-variant",
      checkClass: "text-on-background",
      isDark: false,
    };
  }

  if (lower.includes("red") || lower.includes("crimson") || lower.includes("maroon") || lower.includes("burgundy")) {
    return {
      label: clean,
      swatchClass: "bg-secondary border border-secondary",
      checkClass: "text-on-secondary",
      isDark: true,
    };
  }

  if (lower.includes("green") || lower.includes("forest") || lower.includes("sage") || lower.includes("olive")) {
    return {
      label: clean,
      swatchClass: "bg-emerald-900 border border-outline-variant",
      checkClass: "text-on-primary",
      isDark: true,
    };
  }

  return {
    label: clean,
    swatchClass: "bg-surface-container-high border border-outline-variant",
    checkClass: "text-on-background",
    isDark: false,
  };
}

export function extractProductColorOptions(
  product?: ProductMock
): GarmentColorOption[] {
  const variants = product?.variants ?? [];
  if (variants.length === 0) return [];

  const seen = new Map<string, GarmentColorOption>();
  for (const variant of variants) {
    const rawLabel = (variant.color ?? "").trim() || "Paper White";
    const key = rawLabel.toLowerCase();
    if (!seen.has(key)) {
      const classified = classifyGarmentColor(rawLabel);
      seen.set(key, {
        key,
        label: classified.label,
        swatchClass: classified.swatchClass,
        checkClass: classified.checkClass,
        isDark: classified.isDark,
        firstVariantId: variant.id,
      });
    }
  }

  return Array.from(seen.values());
}

export function extractSizesForSelectedColor(
  product: ProductMock | undefined,
  activeColorKey: string
): ProductVariantMock[] {
  const variants = product?.variants ?? [];
  if (variants.length === 0) return [];

  const matchingColor = variants.filter((v) => {
    const key = ((v.color ?? "").trim() || "Paper White").toLowerCase();
    return key === activeColorKey;
  });

  return matchingColor.length > 0 ? matchingColor : variants;
}

export function findVariantForColorSwitch(
  product: ProductMock | undefined,
  nextColorKey: string,
  currentSize: string | null | undefined
): string | undefined {
  const candidates = extractSizesForSelectedColor(product, nextColorKey);
  if (candidates.length === 0) return undefined;
  if (currentSize) {
    const sameSize = candidates.find(
      (c) => (c.size ?? "").toLowerCase() === currentSize.toLowerCase()
    );
    if (sameSize) return sameSize.id;
  }
  return candidates[0]?.id;
}

export function detectGarmentInkContrastIssue(
  garmentColor: string | null | undefined,
  inkHex: string
): GarmentInkContrastAdvice | null {
  const classified = classifyGarmentColor(garmentColor);
  const upperInk = inkHex.trim().toUpperCase();

  if (
    classified.isDark &&
    (upperInk === DEFAULT_INK_HEX.toUpperCase() || upperInk === "#000000" || upperInk === "#0B0B0B")
  ) {
    return {
      message: `Dark material (${classified.label}) selected with Sumi Black ink.`,
      suggestedInkHex: PURE_WHITE_HEX,
      suggestedInkName: "Pure White",
      secondaryInkHex: IMPERIAL_GOLD_HEX,
      secondaryInkName: "Imperial Gold",
    };
  }

  if (
    !classified.isDark &&
    (classified.label.toLowerCase().includes("white") ||
      classified.label.toLowerCase().includes("ivory") ||
      classified.label.toLowerCase().includes("cream")) &&
    (upperInk === PURE_WHITE_HEX.toUpperCase() ||
      upperInk === RICE_PAPER_IVORY_HEX.toUpperCase())
  ) {
    return {
      message: `Light material (${classified.label}) selected with light ink.`,
      suggestedInkHex: DEFAULT_INK_HEX,
      suggestedInkName: "Sumi Black",
    };
  }

  return null;
}
