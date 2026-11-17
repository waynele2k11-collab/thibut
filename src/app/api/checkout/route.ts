import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PricingValidationError } from "@/lib/pricing/quote";
import {
  RateLimitError,
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
} from "@/lib/security/rate-limit";
import {
  CheckoutHttpError,
  CheckoutRequestSchema,
  assertStripeConfigured,
  createCheckoutSession,
  resolveCallerIdentity,
} from "@/lib/services/CheckoutService";

export async function POST(req: Request) {
  try {
    assertStripeConfigured();
  } catch (err: unknown) {
    if (err instanceof CheckoutHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Payment service is not configured" },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = CheckoutRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout request payload" },
      { status: 400 }
    );
  }

  try {
    const caller = await resolveCallerIdentity();
    const rateKey = getClientIpFromHeaders(
      req.headers,
      caller.userId ?? caller.anonId
    );
    await enforceDistributedRateLimit({
      bucket: "api:checkout",
      key: rateKey,
      limit: 30,
      windowMs: 60_000,
    });

    const result = await createCheckoutSession(parsed.data, caller);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }
    if (err instanceof CheckoutHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof PricingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid checkout request payload" },
        { status: 400 }
      );
    }
    console.error("[Checkout API] Failed to create session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
