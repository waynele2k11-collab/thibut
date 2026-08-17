import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, buildPriceBreakdown, STRIPE_CURRENCY } from "@/lib/stripe";
import prisma from "@/lib/prisma";

const CheckoutRequestSchema = z.object({
  sessionId: z.string().optional(),
  designId: z.string().optional(),
  galleryProductId: z.string().optional(),
  title: z.string().optional(),
  priceMinor: z.number().optional(),
  imageUrl: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CheckoutRequestSchema.parse(body);

    const totalAmount = input.priceMinor || 3199;
    const productName = input.title || "Thi Bút Personalized Artwork";
    const productDescription = input.galleryProductId
      ? `Curated Gallery Artwork (${input.title})`
      : "Custom Calligraphy Artwork";

    // Generate a unique order number
    const orderNumber = `TB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn("[Checkout] STRIPE_SECRET_KEY is missing. Simulating checkout URL.");
      return NextResponse.json({ 
        url: `${input.successUrl}?session_id=mock_stripe_session&order=${orderNumber}` 
      });
    }

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: productName,
              description: productDescription,
              images: input.imageUrl && input.imageUrl.startsWith("http") ? [input.imageUrl] : undefined,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${input.successUrl}?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
      cancel_url: input.cancelUrl,
      payment_intent_data: {
        transfer_group: orderNumber,
      },
      metadata: {
        orderNumber,
        galleryProductId: input.galleryProductId || "",
        personalizationSessionId: input.sessionId || "",
        designId: input.designId || "",
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
