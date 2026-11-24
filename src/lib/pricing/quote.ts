import { z } from "zod";
import { PlacementSchema, type PlacementValue } from "@/lib/print/types";

export class PricingValidationError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PricingValidationError";
    this.code = code;
  }
}

export const CURRENCY_USD = "USD" as const;

/**
 * Authoritative placement fee schedule in USD minor units (cents).
 */
export const PLACEMENT_FEE_MINOR: Record<PlacementValue, bigint> = {
  front: 0n,
  FRONT_CENTER: 0n,
  left_chest: 0n,
  LEFT_CHEST: 0n,
  back: 500n,
  BACK_CENTER: 500n,
  both: 900n,
  FRONT_AND_BACK: 900n,
};

/**
 * Authoritative Digital Download Pricing Constants (INV-006).
 * Single source of truth for both checkout display and Stripe charge ($14.99 = 1499n).
 */
export const DEFAULT_LICENSE_ROYALTY_MINOR = 499n;
export const DEFAULT_PERSONALIZATION_FEE_MINOR = 300n;
export const DEFAULT_DIGITAL_PRODUCT_MINOR = 700n;
export const DIGITAL_TOTAL_MINOR =
  DEFAULT_LICENSE_ROYALTY_MINOR +
  DEFAULT_PERSONALIZATION_FEE_MINOR +
  DEFAULT_DIGITAL_PRODUCT_MINOR; // 1499n

/**
 * Authoritative Flat-Rate Shipping Schedule in USD minor units (R-202).
 */
export const US_FLAT_SHIPPING_MINOR = 599n;
export const INTL_FLAT_SHIPPING_MINOR = 1199n;
export const EXTRA_ITEM_SHIPPING_MINOR = 200n;

export function calculateFlatShippingMinor(params: {
  countryCode?: string | null;
  physicalQuantity: number;
}): bigint {
  if (!Number.isInteger(params.physicalQuantity) || params.physicalQuantity <= 0) {
    return 0n;
  }
  const normalizedCountry = (params.countryCode ?? "US").trim().toUpperCase();
  const baseMinor =
    normalizedCountry === "US" ? US_FLAT_SHIPPING_MINOR : INTL_FLAT_SHIPPING_MINOR;
  const extraUnits = BigInt(params.physicalQuantity - 1);
  return baseMinor + extraUnits * EXTRA_ITEM_SHIPPING_MINOR;
}

export interface QuoteProviderVariantInput {
  costMinor: bigint;
  currency?: string;
  active?: boolean;
}

export interface QuoteCatalogVariantInput {
  id: string;
  active: boolean;
  baseRetailMinor?: bigint;
  product?: {
    status?: string;
    defaultMarkupMinor?: bigint;
    /** "PLACEMENT_FEE" (default) or "MULTIPLIER" for made-to-order keepsakes. */
    sidePricing?: string | null;
    /** Basis points: 16000 means double-sided costs 1.6x single-sided. */
    doubleSidedMultiplierBps?: number | null;
  } | null;
  providerVariants?: QuoteProviderVariantInput[];
}

export interface QuoteLicenseOfferInput {
  id?: string;
  priceMinor: bigint;
  currency?: string;
  active?: boolean;
}

export interface QuoteGalleryItemInput {
  id: string;
  listedPriceMinor: bigint;
  currency?: string;
  published?: boolean;
  purchasable?: boolean;
}

export interface ItemQuoteInput {
  isDigital?: boolean;
  variant?: QuoteCatalogVariantInput | null;
  placement?: string;
  quantity?: number;
  isPersonalized?: boolean;
  licenseOffer?: QuoteLicenseOfferInput | null;
  shippingMinor?: bigint;
  shippingCountry?: string | null;
  taxMinor?: bigint;
}

export interface GalleryQuoteOptions {
  placement?: string;
  quantity?: number;
  isDigital?: boolean;
  personalizationMinor?: bigint;
  licenseOffer?: QuoteLicenseOfferInput | null;
  shippingMinor?: bigint;
  shippingCountry?: string | null;
  taxMinor?: bigint;
}

export interface ItemQuote {
  artworkMinor: bigint;
  personalizationMinor: bigint;
  productMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformMinor: bigint;
  subtotalMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  currency: "USD";
  isDigital: boolean;
  placement: PlacementValue;
  placementFeeMinor: bigint;
  quantity: number;
}

const QuantitySchema = z.number().int().min(1).max(1000);

/**
 * Pure BigInt rounding up to .99 in minor units (e.g. 2500n -> 2599n).
 * Zero IEEE-754 float operations.
 */
export function roundUpTo99Minor(minor: bigint): bigint {
  if (minor <= 0n) {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      "Minor unit amount to round must be positive"
    );
  }
  const wholeDollars = minor / 100n;
  return wholeDollars * 100n + 99n;
}

/**
 * Parses a decimal string (e.g. "12.95") or integer/bigint into exact USD minor units
 * using pure string + BigInt math with half-up rounding and zero float multiplication.
 */
export function parseUsdDecimalToMinor(raw: string | number | bigint): bigint {
  if (typeof raw === "bigint") {
    return raw;
  }
  const str = String(raw).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) {
    throw new PricingValidationError(
      "INVALID_DECIMAL_AMOUNT",
      `Invalid decimal USD amount: "${str}"`
    );
  }
  const sign = match[1] === "-" ? -1n : 1n;
  const dollars = BigInt(match[2]);
  const fraction = match[3] ?? "";
  const centsTwoDigits = fraction.slice(0, 2).padEnd(2, "0");
  const roundUpHalf = fraction.length >= 3 && (fraction[2] ?? "0") >= "5";
  const cents = BigInt(centsTwoDigits) + (roundUpHalf ? 1n : 0n);
  return sign * (dollars * 100n + cents);
}

/**
 * Formats BigInt USD minor units to a "$X.XX" string with zero float division.
 */
export function formatUsdMinor(amountMinor: bigint): string {
  const isNegative = amountMinor < 0n;
  const abs = isNegative ? -amountMinor : amountMinor;
  const dollars = abs / 100n;
  const cents = (abs % 100n).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}$${dollars.toString()}.${cents}`;
}

export function parsePlacement(placement: string = "front"): PlacementValue {
  const parsed = PlacementSchema.safeParse(placement);
  if (!parsed.success) {
    throw new PricingValidationError(
      "INVALID_PLACEMENT",
      `Unsupported print placement: "${placement}"`
    );
  }
  return parsed.data;
}

export function getPlacementFeeMinor(placement: string = "front"): bigint {
  return PLACEMENT_FEE_MINOR[parsePlacement(placement)];
}

function validateQuantity(quantity: number = 1): number {
  const parsed = QuantitySchema.safeParse(quantity);
  if (!parsed.success) {
    throw new PricingValidationError(
      "INVALID_QUANTITY",
      `Invalid item quantity: ${String(quantity)}`
    );
  }
  return parsed.data;
}

function validateNonNegativeFee(value: bigint, code: string, label: string): bigint {
  if (value < 0n) {
    throw new PricingValidationError(code, `${label} cannot be negative`);
  }
  return value;
}

function resolveLicensePriceMinor(
  licenseOffer: QuoteLicenseOfferInput | null | undefined,
  defaultPriceMinor: bigint
): bigint {
  if (!licenseOffer) {
    return defaultPriceMinor;
  }
  if (licenseOffer.active === false) {
    throw new PricingValidationError(
      "INACTIVE_LICENSE_OFFER",
      "Selected license offer is inactive"
    );
  }
  if (licenseOffer.currency && licenseOffer.currency.toUpperCase() !== CURRENCY_USD) {
    throw new PricingValidationError(
      "CURRENCY_MISMATCH",
      `Unsupported license offer currency: ${licenseOffer.currency}`
    );
  }
  if (licenseOffer.priceMinor < 0n) {
    throw new PricingValidationError(
      "INVALID_LICENSE_PRICE",
      "License offer priceMinor cannot be negative"
    );
  }
  return licenseOffer.priceMinor;
}

function assertQuoteInvariants(quote: ItemQuote): ItemQuote {
  if (quote.subtotalMinor <= 0n || quote.totalMinor <= 0n) {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      "Computed quote subtotal and total must be strictly positive"
    );
  }
  if (
    quote.artworkMinor + quote.personalizationMinor + quote.productMinor !==
    quote.subtotalMinor
  ) {
    throw new PricingValidationError(
      "QUOTE_INVARIANT_VIOLATION",
      "Component sum must equal subtotalMinor"
    );
  }
  if (quote.creatorRoyaltyMinor !== quote.artworkMinor) {
    throw new PricingValidationError(
      "QUOTE_INVARIANT_VIOLATION",
      "creatorRoyaltyMinor must equal frozen artworkMinor (INV-005)"
    );
  }
  if (
    quote.platformMinor !==
    quote.subtotalMinor - quote.creatorRoyaltyMinor - quote.fulfillmentCostMinor
  ) {
    throw new PricingValidationError(
      "QUOTE_INVARIANT_VIOLATION",
      "platformMinor must equal subtotalMinor - creatorRoyaltyMinor - fulfillmentCostMinor"
    );
  }
  if (quote.platformMinor < 0n) {
    throw new PricingValidationError(
      "NEGATIVE_MARGIN",
      "Platform margin cannot be negative"
    );
  }
  if (quote.subtotalMinor + quote.shippingMinor + quote.taxMinor !== quote.totalMinor) {
    throw new PricingValidationError(
      "QUOTE_INVARIANT_VIOLATION",
      "subtotalMinor + shippingMinor + taxMinor must equal totalMinor"
    );
  }
  return quote;
}

/**
 * Authoritative Digital Download Quote ($14.99 = 1499n default).
 */
export function calculateDigitalQuote(options?: {
  licenseOffer?: QuoteLicenseOfferInput | null;
  quantity?: number;
  taxMinor?: bigint;
}): ItemQuote {
  const quantity = validateQuantity(options?.quantity ?? 1);
  const qty = BigInt(quantity);
  const taxMinor = validateNonNegativeFee(options?.taxMinor ?? 0n, "INVALID_TAX", "Tax");

  const unitArtworkMinor = resolveLicensePriceMinor(
    options?.licenseOffer,
    DEFAULT_LICENSE_ROYALTY_MINOR
  );
  const unitPersonalizationMinor = DEFAULT_PERSONALIZATION_FEE_MINOR;
  const unitProductMinor = DEFAULT_DIGITAL_PRODUCT_MINOR;

  const artworkMinor = unitArtworkMinor * qty;
  const personalizationMinor = unitPersonalizationMinor * qty;
  const productMinor = unitProductMinor * qty;
  const fulfillmentCostMinor = 0n;
  const subtotalMinor = artworkMinor + personalizationMinor + productMinor;
  const creatorRoyaltyMinor = artworkMinor;
  const platformMinor = subtotalMinor - creatorRoyaltyMinor - fulfillmentCostMinor;
  const shippingMinor = 0n;
  const totalMinor = subtotalMinor + shippingMinor + taxMinor;

  return assertQuoteInvariants({
    artworkMinor,
    personalizationMinor,
    productMinor,
    fulfillmentCostMinor,
    creatorRoyaltyMinor,
    platformMinor,
    subtotalMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    currency: CURRENCY_USD,
    isDigital: true,
    placement: "front",
    placementFeeMinor: 0n,
    quantity,
  });
}

function resolveVariantPricing(variant: QuoteCatalogVariantInput | null | undefined): {
  unitFulfillmentCostMinor: bigint;
  unitBaseRetailMinor: bigint;
} {
  if (!variant || !variant.id || variant.id.trim().length === 0) {
    throw new PricingValidationError(
      "VARIANT_MISSING",
      "A valid CatalogVariant is required for physical item quotes"
    );
  }
  if (!variant.active) {
    throw new PricingValidationError(
      "VARIANT_INACTIVE",
      `CatalogVariant "${variant.id}" is inactive`
    );
  }
  if (variant.product?.status && variant.product.status !== "ACTIVE") {
    throw new PricingValidationError(
      "PRODUCT_INACTIVE",
      `CatalogProduct for variant "${variant.id}" is inactive`
    );
  }
  if (variant.baseRetailMinor !== undefined && variant.baseRetailMinor <= 0n) {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      `CatalogVariant "${variant.id}" has zero or negative baseRetailMinor`
    );
  }

  const activeProviderVariants = (variant.providerVariants ?? []).filter(
    (pv) => pv.active !== false
  );

  for (const pv of activeProviderVariants) {
    if (pv.currency && pv.currency.toUpperCase() !== CURRENCY_USD) {
      throw new PricingValidationError(
        "CURRENCY_MISMATCH",
        `Unsupported provider variant currency: ${pv.currency}`
      );
    }
    if (pv.costMinor <= 0n) {
      throw new PricingValidationError(
        "INVALID_COST",
        `ProviderVariant for "${variant.id}" has zero or negative costMinor`
      );
    }
  }

  const unitFulfillmentCostMinor =
    activeProviderVariants.length > 0 ? activeProviderVariants[0].costMinor : 0n;

  let unitBaseRetailMinor: bigint;
  if (variant.baseRetailMinor !== undefined) {
    unitBaseRetailMinor = variant.baseRetailMinor;
  } else if (unitFulfillmentCostMinor > 0n) {
    const markup = variant.product?.defaultMarkupMinor ?? 0n;
    const rawTarget = unitFulfillmentCostMinor * 2n + (markup > 0n ? markup : 0n);
    unitBaseRetailMinor = roundUpTo99Minor(rawTarget);
  } else {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      `CatalogVariant "${variant.id}" has neither baseRetailMinor nor active provider cost`
    );
  }

  if (unitBaseRetailMinor <= 0n) {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      `CatalogVariant "${variant.id}" resolved to non-positive retail price`
    );
  }

  return { unitFulfillmentCostMinor, unitBaseRetailMinor };
}

export const SIDE_PRICING_MULTIPLIER = "MULTIPLIER" as const;
const BPS_DENOMINATOR = 10000n;
const DOUBLE_SIDED_PLACEMENTS: ReadonlySet<PlacementValue> = new Set<PlacementValue>([
  "both",
  "FRONT_AND_BACK",
]);

/**
 * Surcharge added to the single-sided unit price for the chosen placement.
 *
 * Products with sidePricing "MULTIPLIER" (BRD v1.0 §09) price a double-sided piece as
 * base x multiplier, so the surcharge is base x (multiplier - 1), rounded half-up to the
 * cent. Any other placement on such a product is a single side and carries no surcharge.
 * All other products keep the flat PLACEMENT_FEE_MINOR table.
 */
export function resolveSideSurchargeMinor(
  variant: QuoteCatalogVariantInput | null | undefined,
  placement: PlacementValue,
  unitBaseRetailMinor: bigint
): bigint {
  if (variant?.product?.sidePricing !== SIDE_PRICING_MULTIPLIER) {
    return PLACEMENT_FEE_MINOR[placement];
  }
  if (!DOUBLE_SIDED_PLACEMENTS.has(placement)) {
    return 0n;
  }
  const bps = variant.product.doubleSidedMultiplierBps;
  if (bps == null || !Number.isInteger(bps) || bps < 10000 || bps > 30000) {
    throw new PricingValidationError(
      "INVALID_SIDE_MULTIPLIER",
      `CatalogVariant "${variant.id}" needs a double-sided multiplier between 1.0x and 3.0x`
    );
  }
  const doubleSidedMinor =
    (unitBaseRetailMinor * BigInt(bps) + BPS_DENOMINATOR / 2n) / BPS_DENOMINATOR;
  return doubleSidedMinor - unitBaseRetailMinor;
}

/**
 * Authoritative Item Quote (physical CatalogVariant or digital download) (T-200, INV-005, INV-006).
 */
export function calculateItemQuote(input: ItemQuoteInput): ItemQuote {
  if (input.isDigital) {
    return calculateDigitalQuote({
      licenseOffer: input.licenseOffer,
      quantity: input.quantity,
      taxMinor: input.taxMinor,
    });
  }

  const quantity = validateQuantity(input.quantity ?? 1);
  const qty = BigInt(quantity);
  const placement = parsePlacement(input.placement ?? "front");
  const resolvedShippingMinor =
    input.shippingMinor !== undefined
      ? input.shippingMinor
      : input.shippingCountry
        ? calculateFlatShippingMinor({
            countryCode: input.shippingCountry,
            physicalQuantity: quantity,
          })
        : 0n;
  const shippingMinor = validateNonNegativeFee(
    resolvedShippingMinor,
    "INVALID_SHIPPING",
    "Shipping"
  );
  const taxMinor = validateNonNegativeFee(input.taxMinor ?? 0n, "INVALID_TAX", "Tax");

  const { unitFulfillmentCostMinor, unitBaseRetailMinor } = resolveVariantPricing(
    input.variant
  );
  const placementFeeMinor = resolveSideSurchargeMinor(
    input.variant,
    placement,
    unitBaseRetailMinor
  );

  const unitArtworkMinor = resolveLicensePriceMinor(
    input.licenseOffer,
    DEFAULT_LICENSE_ROYALTY_MINOR
  );
  const unitPersonalizationMinor =
    input.isPersonalized === false ? 0n : DEFAULT_PERSONALIZATION_FEE_MINOR;
  const unitProductMinor = unitBaseRetailMinor + placementFeeMinor;

  const artworkMinor = unitArtworkMinor * qty;
  const personalizationMinor = unitPersonalizationMinor * qty;
  const productMinor = unitProductMinor * qty;
  const fulfillmentCostMinor = unitFulfillmentCostMinor * qty;
  const subtotalMinor = artworkMinor + personalizationMinor + productMinor;
  const creatorRoyaltyMinor = artworkMinor;
  const platformMinor = subtotalMinor - creatorRoyaltyMinor - fulfillmentCostMinor;
  const totalMinor = subtotalMinor + shippingMinor + taxMinor;

  return assertQuoteInvariants({
    artworkMinor,
    personalizationMinor,
    productMinor,
    fulfillmentCostMinor,
    creatorRoyaltyMinor,
    platformMinor,
    subtotalMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    currency: CURRENCY_USD,
    isDigital: false,
    placement,
    placementFeeMinor,
    quantity,
  });
}

/**
 * Authoritative GalleryItem Quote using GalleryItem.listedPriceMinor (BigInt).
 */
export function calculateGalleryItemQuote(
  galleryItem: QuoteGalleryItemInput | null | undefined,
  variant?: QuoteCatalogVariantInput | null,
  options?: GalleryQuoteOptions
): ItemQuote {
  if (!galleryItem || !galleryItem.id) {
    throw new PricingValidationError("GALLERY_ITEM_MISSING", "GalleryItem is required");
  }
  if (galleryItem.purchasable === false) {
    throw new PricingValidationError(
      "GALLERY_ITEM_NOT_PURCHASABLE",
      `GalleryItem "${galleryItem.id}" is not purchasable`
    );
  }
  if (galleryItem.published === false) {
    throw new PricingValidationError(
      "GALLERY_ITEM_UNPUBLISHED",
      `GalleryItem "${galleryItem.id}" is not published`
    );
  }
  if (
    galleryItem.currency &&
    galleryItem.currency.toUpperCase() !== CURRENCY_USD
  ) {
    throw new PricingValidationError(
      "CURRENCY_MISMATCH",
      `Unsupported GalleryItem currency: ${galleryItem.currency}`
    );
  }
  if (galleryItem.listedPriceMinor <= 0n) {
    throw new PricingValidationError(
      "INVALID_RETAIL",
      `GalleryItem "${galleryItem.id}" has zero or negative listedPriceMinor`
    );
  }

  const quantity = validateQuantity(options?.quantity ?? 1);
  const qty = BigInt(quantity);
  const isDigital = Boolean(options?.isDigital);
  const placement = isDigital ? "front" : parsePlacement(options?.placement ?? "front");
  const placementFeeMinor = isDigital ? 0n : PLACEMENT_FEE_MINOR[placement];

  let unitFulfillmentCostMinor = 0n;
  if (!isDigital && variant) {
    const resolved = resolveVariantPricing(variant);
    unitFulfillmentCostMinor = resolved.unitFulfillmentCostMinor;
  }

  const unitArtworkMinor = resolveLicensePriceMinor(options?.licenseOffer, 0n);
  const unitPersonalizationMinor = validateNonNegativeFee(
    options?.personalizationMinor ?? 0n,
    "INVALID_PERSONALIZATION",
    "Personalization fee"
  );
  const unitListedWithPlacement = galleryItem.listedPriceMinor + placementFeeMinor;

  if (unitArtworkMinor + unitPersonalizationMinor > unitListedWithPlacement) {
    throw new PricingValidationError(
      "NEGATIVE_MARGIN",
      "Gallery item listedPriceMinor cannot be less than license + personalization fees"
    );
  }

  const unitProductMinor =
    unitListedWithPlacement - unitArtworkMinor - unitPersonalizationMinor;

  const artworkMinor = unitArtworkMinor * qty;
  const personalizationMinor = unitPersonalizationMinor * qty;
  const productMinor = unitProductMinor * qty;
  const fulfillmentCostMinor = unitFulfillmentCostMinor * qty;
  const subtotalMinor = artworkMinor + personalizationMinor + productMinor;
  const creatorRoyaltyMinor = artworkMinor;
  const platformMinor = subtotalMinor - creatorRoyaltyMinor - fulfillmentCostMinor;
  const resolvedGalleryShippingMinor =
    options?.shippingMinor !== undefined
      ? options.shippingMinor
      : options?.shippingCountry
        ? calculateFlatShippingMinor({
            countryCode: options.shippingCountry,
            physicalQuantity: quantity,
          })
        : 0n;
  const shippingMinor = isDigital
    ? 0n
    : validateNonNegativeFee(resolvedGalleryShippingMinor, "INVALID_SHIPPING", "Shipping");
  const taxMinor = validateNonNegativeFee(options?.taxMinor ?? 0n, "INVALID_TAX", "Tax");
  const totalMinor = subtotalMinor + shippingMinor + taxMinor;

  return assertQuoteInvariants({
    artworkMinor,
    personalizationMinor,
    productMinor,
    fulfillmentCostMinor,
    creatorRoyaltyMinor,
    platformMinor,
    subtotalMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    currency: CURRENCY_USD,
    isDigital,
    placement,
    placementFeeMinor,
    quantity,
  });
}
