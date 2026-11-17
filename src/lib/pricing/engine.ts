import {
  DEFAULT_LICENSE_ROYALTY_MINOR,
  DEFAULT_PERSONALIZATION_FEE_MINOR,
  DIGITAL_TOTAL_MINOR,
  roundUpTo99Minor,
} from "./quote";

export * from "./quote";

export interface PricingBreakdown {
  fulfillmentCostMinor: bigint;
  baseVariantCostMinor: bigint;
  printCostMinor: bigint;
  additionalPlacementCostMinor: bigint;
  galleryPriceMinor: bigint;
  personalizationFeeMinor: bigint;
  personalizedPriceMinor: bigint;
  digitalGalleryPriceMinor: bigint;
  digitalPersonalizedPriceMinor: bigint;
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
 * Pure BigInt helper over authoritative roundUpTo99Minor (R-201, INV-006).
 */
export function roundUpTo99(cents: number | bigint): bigint {
  const minor = toMinorBigInt(cents);
  if (minor <= 0n) {
    return 99n;
  }
  return roundUpTo99Minor(minor);
}

/**
 * Pure BigInt pricing breakdown helper over src/lib/pricing/quote.ts (R-201).
 */
export function calculatePricing(
  baseVariantCostMinor: number | bigint,
  printCostMinor: number | bigint = 0n,
  additionalPlacementCostMinor: number | bigint = 0n
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
    galleryMinor > 0n
      ? galleryMinor + personalizationAdderMinor
      : personalizationAdderMinor;

  return {
    fulfillmentCostMinor: fulfillmentMinor,
    baseVariantCostMinor: baseMinor,
    printCostMinor: printMinor,
    additionalPlacementCostMinor: placementMinor,
    galleryPriceMinor: galleryMinor,
    personalizationFeeMinor: DEFAULT_PERSONALIZATION_FEE_MINOR,
    personalizedPriceMinor: personalizedMinor,
    digitalGalleryPriceMinor: DIGITAL_TOTAL_MINOR,
    digitalPersonalizedPriceMinor: DIGITAL_TOTAL_MINOR,
  };
}
