import test from "node:test";
import assert from "node:assert/strict";
import {
  PricingValidationError,
  calculateItemQuote,
  resolveSideSurchargeMinor,
  type QuoteCatalogVariantInput,
} from "@/lib/pricing/quote";

function keepsakeVariant(
  baseRetailMinor: bigint,
  doubleSidedMultiplierBps: number | null = 16000
): QuoteCatalogVariantInput {
  return {
    id: "variant-keepsake",
    active: true,
    baseRetailMinor,
    product: {
      status: "ACTIVE",
      sidePricing: "MULTIPLIER",
      doubleSidedMultiplierBps,
    },
    providerVariants: [],
  };
}

const ZERO_LICENCE = { priceMinor: 0n, currency: "USD", active: true };

// Business Requirements v1.0 §09 price table.
const BRD_PRICE_TABLE: ReadonlyArray<[string, bigint, bigint]> = [
  ["Small", 4900n, 7840n],
  ["Medium", 9900n, 15840n],
  ["Large", 14900n, 23840n],
  ["Extra large", 24900n, 39840n],
];

test("BRD §09: single-sided keepsake totals equal the listed variant price", () => {
  for (const [label, single] of BRD_PRICE_TABLE) {
    const quote = calculateItemQuote({
      variant: keepsakeVariant(single),
      placement: "front",
      isPersonalized: false,
      licenseOffer: ZERO_LICENCE,
    });
    assert.equal(quote.subtotalMinor, single, label);
    assert.equal(quote.artworkMinor, 0n, `${label} carries no artwork royalty`);
    assert.equal(quote.personalizationMinor, 0n, `${label} carries no personalization fee`);
    assert.equal(quote.placementFeeMinor, 0n);
  }
});

test("BRD §09: double-sided keepsake is 1.6x single-sided for every size", () => {
  for (const [label, single, double] of BRD_PRICE_TABLE) {
    const quote = calculateItemQuote({
      variant: keepsakeVariant(single),
      placement: "both",
      isPersonalized: false,
      licenseOffer: ZERO_LICENCE,
    });
    assert.equal(quote.subtotalMinor, double, label);
    assert.equal(quote.productMinor, double, label);
  }
});

test("BRD §09: the double-sided multiplier is configurable per product", () => {
  const quote = calculateItemQuote({
    variant: keepsakeVariant(4900n, 18000),
    placement: "both",
    isPersonalized: false,
    licenseOffer: ZERO_LICENCE,
  });
  assert.equal(quote.subtotalMinor, 8820n);
});

test("double-sided price rounds half-up to the cent", () => {
  // 4999 x 1.25 = 6248.75 -> 6249
  assert.equal(
    resolveSideSurchargeMinor(keepsakeVariant(4999n, 12500), "both", 4999n),
    6249n - 4999n
  );
});

test("quantity multiplies the double-sided unit price exactly", () => {
  const quote = calculateItemQuote({
    variant: keepsakeVariant(14900n),
    placement: "both",
    quantity: 3,
    isPersonalized: false,
    licenseOffer: ZERO_LICENCE,
  });
  assert.equal(quote.subtotalMinor, 23840n * 3n);
  assert.equal(quote.subtotalMinor % BigInt(quote.quantity), 0n);
});

test("a multiplier product with a missing or out-of-range multiplier is rejected for double-sided", () => {
  for (const bps of [null, 9999, 30001, 16000.5]) {
    assert.throws(
      () =>
        calculateItemQuote({
          variant: keepsakeVariant(4900n, bps),
          placement: "both",
          isPersonalized: false,
          licenseOffer: ZERO_LICENCE,
        }),
      (error: unknown) =>
        error instanceof PricingValidationError &&
        error.code === "INVALID_SIDE_MULTIPLIER",
      `bps=${bps}`
    );
  }
});

test("a multiplier product treats non-double placements as a single side", () => {
  const quote = calculateItemQuote({
    variant: keepsakeVariant(9900n),
    placement: "back",
    isPersonalized: false,
    licenseOffer: ZERO_LICENCE,
  });
  assert.equal(quote.subtotalMinor, 9900n);
});

test("print-on-demand products keep the flat placement fee", () => {
  const apparel: QuoteCatalogVariantInput = {
    id: "variant-tee",
    active: true,
    baseRetailMinor: 2000n,
    product: { status: "ACTIVE" },
    providerVariants: [{ costMinor: 900n, currency: "USD", active: true }],
  };
  const quote = calculateItemQuote({
    variant: apparel,
    placement: "both",
    isPersonalized: false,
    licenseOffer: ZERO_LICENCE,
  });
  assert.equal(quote.placementFeeMinor, 900n);
  assert.equal(quote.productMinor, 2900n);
});

test("DRAFT and QUOTE_ONLY products cannot be quoted for purchase", () => {
  for (const status of ["DRAFT", "QUOTE_ONLY"]) {
    const variant = keepsakeVariant(4900n);
    variant.product = { ...variant.product, status };
    assert.throws(
      () =>
        calculateItemQuote({
          variant,
          placement: "front",
          isPersonalized: false,
          licenseOffer: ZERO_LICENCE,
        }),
      (error: unknown) =>
        error instanceof PricingValidationError && error.code === "PRODUCT_INACTIVE",
      status
    );
  }
});
