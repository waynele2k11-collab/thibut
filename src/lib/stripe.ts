import "server-only";
/**
 * STRIPE SINGLETON
 * Centralised Stripe client — server-side only.
 * Separate Charges and Transfers pattern per SYSTEM_ARCHITECTURE §8-9.
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder",
  {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  }
);

export const STRIPE_CURRENCY = "usd" as const;
