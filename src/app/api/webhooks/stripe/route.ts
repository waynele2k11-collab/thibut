import "server-only";
import type Stripe from "stripe";
import {
  StripeWebhookValidationError,
  processVerifiedStripeWebhook,
} from "@/lib/services/stripe/StripeWebhookService";
import { isPrismaUniqueConstraintError } from "@/lib/services/stripe/webhookLease";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return Response.json(
      { error: "Webhook configuration error" },
      { status: 500 }
    );
  }

  let constructedEvent: Stripe.Event;
  try {
    constructedEvent = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch {
    return Response.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  try {
    const result = await processVerifiedStripeWebhook(constructedEvent, body);
    return Response.json(result.body, { status: result.httpStatus });
  } catch (err: unknown) {
    if (err instanceof StripeWebhookValidationError) {
      return Response.json({ error: err.publicMessage }, { status: 400 });
    }
    if (isPrismaUniqueConstraintError(err)) {
      return Response.json(
        { received: true, inProgress: true },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
