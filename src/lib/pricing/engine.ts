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

/**
 * Rounds a cents value up to the nearest .99
 * @param cents The cost in cents
 */
export function roundUpTo99(cents: number): number {
  const dollars = Math.floor(cents / 100);
  return (dollars * 100) + 99;
}

/**
 * Authoritative pricing engine for Thi Bút.
 * The server must ALWAYS use this engine to calculate retail prices.
 */
export function calculatePricing(
  baseVariantCostMinor: number,
  printCostMinor: number = 0,
  additionalPlacementCostMinor: number = 0
): PricingBreakdown {
  const PERSONALIZATION_FEE = 700; // $7.00
  
  const fulfillmentCostMinor = baseVariantCostMinor + printCostMinor + additionalPlacementCostMinor;

  return {
    fulfillmentCostMinor,
    baseVariantCostMinor,
    printCostMinor,
    additionalPlacementCostMinor,
    galleryPriceMinor: roundUpTo99(fulfillmentCostMinor * 2),
    personalizationFeeMinor: PERSONALIZATION_FEE,
    personalizedPriceMinor: roundUpTo99((fulfillmentCostMinor * 2) + PERSONALIZATION_FEE),
    digitalGalleryPriceMinor: 999, // $9.99
    digitalPersonalizedPriceMinor: 1499, // $14.99
  };
}
