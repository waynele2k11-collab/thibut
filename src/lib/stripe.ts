import "server-only";
/**
 * STRIPE SINGLETON
 * Centralised Stripe client — server-side only.
 * Separate Charges and Transfers pattern per SYSTEM_ARCHITECTURE §8-9.
 */
import Stripe from "stripe";

// The key is required when the live site runs. It is not required while the site is being
// built (no payment happens then) or on a Vercel preview deployment, where checkout reports
// "not configured" instead (see CheckoutService) so the rest of the store can be tested.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const isPreviewDeployment = process.env.VERCEL_ENV === "preview";
if (
  !process.env.STRIPE_SECRET_KEY &&
  process.env.NODE_ENV === "production" &&
  !isBuildPhase &&
  !isPreviewDeployment
) {
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
