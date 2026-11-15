import { NextResponse } from "next/server";
import { z } from "zod";
import { stripe, STRIPE_CURRENCY } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { calculatePricing } from "@/lib/pricing/engine";

const CheckoutRequestSchema = z.object({
  sessionId: z.string().optional(),
  designId: z.string().optional(),
  galleryProductId: z.string().optional(),
  title: z.string().optional(),
  productId: z.string().optional(), // Expected base product name (e.g. "Premium Hoodie")
  priceMinor: z.number().optional(), // Ignored for security, kept for backward compatibility
  imageUrl: z.string().optional(),
  placement: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CheckoutRequestSchema.parse(body);

    const productName = input.title || "Thi Bút Personalized Artwork";
    const productDescription = input.galleryProductId
      ? `Curated Gallery Artwork (${input.title})`
      : "Custom Calligraphy Artwork";

    // --- SECURE PRICING ENGINE CALCULATION ---
    let authoritativePriceMinor = 3199; // Fallback

    if (input.productId === "Digital Download (All 6)") {
      authoritativePriceMinor = 1499; // Digital Personalized ($14.99)
    } else if (input.productId) {
      // Fetch authoritative cost from DB
      const dbProd = await prisma.catalogProduct.findFirst({
        where: { name: input.productId },
        include: { 
          variants: { 
            take: 1,
            include: { providerVariants: true }
          } 
        }
      });

      let baseCostMinor = 0;
      if (dbProd && dbProd.variants.length > 0 && dbProd.variants[0].providerVariants.length > 0) {
        baseCostMinor = Number(dbProd.variants[0].providerVariants[0].costMinor);
      }

      // Dynamic Placement Cost (MVP: flat $5.95 for back prints)
      const placementCostMinor = input.placement === "back" ? 595 : 0;
      
      const pricing = calculatePricing(baseCostMinor, 0, placementCostMinor);
      authoritativePriceMinor = pricing.personalizedPriceMinor;
    }

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
            unit_amount: authoritativePriceMinor,
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
        placement: input.placement || "front",
        isDigital: productName === "Digital Download (All 6)" ? "true" : "false",
        productName: productName,
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
