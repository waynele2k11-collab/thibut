import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature found" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency Check (INV-007)
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider: "STRIPE",
        externalEventId: event.id,
      },
    },
  });

  if (existingEvent) {
    console.log(`[Webhook] Event ${event.id} already processed or pending. Skipping.`);
    return NextResponse.json({ received: true });
  }

  // Record the event as PENDING
  await prisma.webhookEvent.create({
    data: {
      provider: "STRIPE",
      externalEventId: event.id,
      eventType: event.type,
      payloadJson: JSON.parse(body),
      status: "PENDING",
    },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const orderNumber = session.metadata?.orderNumber;
      const personalizationSessionId = session.metadata?.personalizationSessionId;
      const designId = session.metadata?.designId;

      if (!orderNumber || !personalizationSessionId || !designId) {
        throw new Error("Missing metadata in checkout session");
      }

      // Upsert Buyer
      const customerEmail = session.customer_details?.email || "guest@thibut.com";
      const buyer = await prisma.user.upsert({
        where: { email: customerEmail },
        update: {},
        create: {
          email: customerEmail,
          name: session.customer_details?.name || "Guest Checkout",
        },
      });

      // Find the specific Design Version
      const designVersion = await prisma.designVersion.findFirst({
        where: { designId },
      });

      if (!designVersion) {
        throw new Error(`DesignVersion not found for designId: ${designId}`);
      }
      
      const design = await prisma.design.findUnique({
        where: { id: designId },
        include: { creator: true }
      });

      if (!design) {
        throw new Error(`Design not found: ${designId}`);
      }

      // Perform atomic creation of Order and OrderItem
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: buyer.id,
            currency: session.currency || "usd",
            status: "PROCESSING",
            paymentStatus: "SUCCEEDED",
            fulfillmentStatus: "PENDING",
            subtotalMinor: session.amount_subtotal || 0,
            totalMinor: session.amount_total || 0,
            taxMinor: 0,
            shippingMinor: 0,
            items: {
              create: {
                creatorId: design.creatorId,
                designId: design.id,
                designVersionId: designVersion.id,
                quantity: 1,
                // Hardcoding financial snapshot for Phase 3 (INV-008)
                artworkRevenueMinor: 499,
                personalizationRevenueMinor: 200,
                productRevenueMinor: 2000,
                fulfillmentCostMinor: 1500, // example cost
                creatorRoyaltyMinor: 499,
                platformRevenueMinor: 500,
                totalMinor: session.amount_total || 0,
              }
            }
          }
        });

        // Update the WebhookEvent status
        await tx.webhookEvent.update({
          where: {
            provider_externalEventId: {
              provider: "STRIPE",
              externalEventId: event.id,
            },
          },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

        // Mark PersonalizationSession as CHECKED_OUT
        await tx.personalizationSession.update({
          where: { id: personalizationSessionId },
          data: { status: "CHECKED_OUT" },
        }).catch(() => {
          // If the mock session id was passed, this might fail, ignore
          console.warn("[Webhook] Failed to update PersonalizationSession status (might be mock ID).");
        });

        console.log(`[Webhook] Order ${orderNumber} successfully created in database.`);
      });
    } else {
      // Just mark event as processed if we don't care about it
      await prisma.webhookEvent.update({
        where: {
          provider_externalEventId: {
            provider: "STRIPE",
            externalEventId: event.id,
          },
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error(`[Webhook] Error processing event ${event.id}:`, error);

    // Mark event as FAILED
    await prisma.webhookEvent.update({
      where: {
        provider_externalEventId: {
          provider: "STRIPE",
          externalEventId: event.id,
        },
      },
      data: {
        status: "FAILED",
      },
    });

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
