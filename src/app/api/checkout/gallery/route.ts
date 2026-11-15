import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export async function POST(req: Request) {
  try {
    const { galleryItemId, variantId } = await req.json();

    if (!galleryItemId) {
      return NextResponse.json({ error: "galleryItemId is required" }, { status: 400 });
    }

    // 1. Fetch Authoritative Gallery Item
    const galleryItem = await prisma.galleryItem.findUnique({
      where: { id: galleryItemId }
    });

    if (!galleryItem) {
      return NextResponse.json({ error: "Gallery item not found" }, { status: 404 });
    }

    if (!galleryItem.purchasable) {
      return NextResponse.json({ error: "This design is currently unavailable for direct purchase." }, { status: 400 });
    }

    // 2. Validate Variant (If required)
    // Note: In V1, we are mocking the variant selection validation. 
    // In production, this would strictly check against CatalogVariant.
    if (galleryItem.requiresSize && !variantId) {
       return NextResponse.json({ error: "Size/Variant selection is required." }, { status: 400 });
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: galleryItem.currency.toLowerCase(),
            product_data: {
              name: galleryItem.title,
              description: `${galleryItem.productType} ${galleryItem.requiresSize ? `(Variant: ${variantId})` : ""}`,
              // Provide the locked gallery image for Stripe Checkout
              images: galleryItem.productImageUrl ? [galleryItem.productImageUrl] : [], 
            },
            unit_amount: galleryItem.listedPriceCents, 
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/gallery`,
      // 4. Embed crucial reconstructive metadata for webhook processing
      metadata: {
        purchaseType: "GALLERY_AS_SHOWN",
        galleryItemId: galleryItem.id,
        artworkId: galleryItem.artworkId,
        productType: galleryItem.productType,
        selectedVariantId: variantId || "default",
        sourceText: galleryItem.sourceText,
        priceVersion: galleryItem.listedPriceCents.toString()
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Checkout Gallery Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
