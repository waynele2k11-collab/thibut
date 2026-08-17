/**
 * STRIPE SINGLETON
 * Centralised Stripe client — server-side only.
 * Separate Charges and Transfers pattern per SYSTEM_ARCHITECTURE §9
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
});

export const STRIPE_CURRENCY = "usd";

/**
 * Price breakdown for a personalization order.
 * All amounts in cents (minor units).
 */
export interface PriceBreakdown {
  artworkMinor: number;        // Creator license fee
  personalizationMinor: number; // Thi Bút AI fee
  productMinor: number;         // Blank product cost
  platformMarginMinor: number;  // Thi Bút margin
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function buildPriceBreakdown(params: {
  artworkPriceMinor: number;
  personalizationFeeMinor: number;
  productCostMinor: number;
  platformMarginMinor: number;
  shippingMinor?: number;
  taxMinor?: number;
}): PriceBreakdown {
  const shipping = params.shippingMinor ?? 0;
  const tax = params.taxMinor ?? 0;
  const total =
    params.artworkPriceMinor +
    params.personalizationFeeMinor +
    params.productCostMinor +
    params.platformMarginMinor +
    shipping +
    tax;

  return {
    artworkMinor: params.artworkPriceMinor,
    personalizationMinor: params.personalizationFeeMinor,
    productMinor: params.productCostMinor,
    platformMarginMinor: params.platformMarginMinor,
    shippingMinor: shipping,
    taxMinor: tax,
    totalMinor: total,
  };
}
