import {
  DEFAULT_LICENSE_ROYALTY_MINOR,
  DEFAULT_PERSONALIZATION_FEE_MINOR,
  DIGITAL_TOTAL_MINOR,
  roundUpTo99Minor,
} from "./quote";

export * from "./quote";

export interface PricingBreakdown {
  fulfillmentCostMinor: number;
  baseVariantCostMinor: number;
  printCostMinor: number;
  additionalPlacementCostMinor: number;
  galleryPriceMinor: number;
  personalizationFeeMinor: number;
  personalizedPriceMinor: number;
  digitalGalleryPriceMinor: number;
  digitalPersonalizedPriceMinor: number;
}

function toMinorBigInt(value: number | bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isFinite(value)) {
    return 0n;
  }
  return BigInt(Math.trunc(value));
}

/**
 * Facade helper over authoritative BigInt roundUpTo99Minor.
 */
export function roundUpTo99(cents: number | bigint): number {
  const minor = toMinorBigInt(cents);
  if (minor <= 0n) {
    return 99;
  }
  return Number(roundUpTo99Minor(minor));
}

/**
 * Clean compatibility facade over src/lib/pricing/quote.ts (BigInt math only).
 */
export function calculatePricing(
  baseVariantCostMinor: number | bigint,
  printCostMinor: number | bigint = 0,
  additionalPlacementCostMinor: number | bigint = 0
): PricingBreakdown {
  const baseMinor = toMinorBigInt(baseVariantCostMinor);
  const printMinor = toMinorBigInt(printCostMinor);
  const placementMinor = toMinorBigInt(additionalPlacementCostMinor);

  const fulfillmentMinor = baseMinor + printMinor + placementMinor;
  const personalizationAdderMinor =
    DEFAULT_LICENSE_ROYALTY_MINOR + DEFAULT_PERSONALIZATION_FEE_MINOR; // 499n + 300n = 799n

  const galleryMinor =
    fulfillmentMinor > 0n ? roundUpTo99Minor(fulfillmentMinor * 2n) : 0n;
  const personalizedMinor =
    galleryMinor > 0n ? galleryMinor + personalizationAdderMinor : personalizationAdderMinor;

  return {
    fulfillmentCostMinor: Number(fulfillmentMinor),
    baseVariantCostMinor: Number(baseMinor),
    printCostMinor: Number(printMinor),
    additionalPlacementCostMinor: Number(placementMinor),
    galleryPriceMinor: Number(galleryMinor),
    personalizationFeeMinor: Number(DEFAULT_PERSONALIZATION_FEE_MINOR),
    personalizedPriceMinor: Number(personalizedMinor),
    digitalGalleryPriceMinor: Number(DIGITAL_TOTAL_MINOR),
    digitalPersonalizedPriceMinor: Number(DIGITAL_TOTAL_MINOR),
  };
}
