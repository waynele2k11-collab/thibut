import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  PricingValidationError,
  calculateGalleryItemQuote,
} from "@/lib/pricing/quote";
import { getAppBaseUrl } from "@/lib/security/redirect";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { STRIPE_CURRENCY, stripe } from "@/lib/stripe";
import { createClient } from "@/utils/supabase/server";

const PLATFORM_STUDIO_USER_EMAIL = "studio-platform@thibut.internal";
const PLATFORM_STUDIO_CREATOR_SLUG = "thibut-studio";
const PLATFORM_GALLERY_DESIGN_SLUG = "thibut-gallery-curated";

const ALLOWED_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "AU", "VN", "JP", "KR", "SG", "DE", "FR"];

const GalleryCheckoutSchema = z
  .object({
    galleryItemId: z.string().trim().min(1).max(128),
    catalogVariantId: z.string().trim().min(1).max(128).optional(),
    variantId: z.string().trim().min(1).max(128).optional(),
    quantity: z.number().int().min(1).max(1000).default(1),
  })
  .strict();

function generateOrderNumber(): string {
  return `TB-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

async function resolveCallerIdentity(): Promise<{
  userId: string | null;
  anonId: string | null;
}> {
  let anonId: string | null = null;
  try {
    const cookieStore = await cookies();
    anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );
  } catch {
    anonId = null;
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) {
      userId = data.user.id;
    }
  } catch {
    userId = null;
  }

  return { userId, anonId };
}

async function ensureGalleryDesign(tx: Prisma.TransactionClient): Promise<{
  designId: string;
  designVersionId: string;
  creatorId: string;
  creatorDisplayName: string;
}> {
  const existing = await tx.design.findUnique({
    where: { slug: PLATFORM_GALLERY_DESIGN_SLUG },
    include: {
      creator: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (existing) {
    const version =
      existing.versions[0] ??
      (await tx.designVersion.create({
        data: {
          designId: existing.id,
          versionNumber: 1,
        },
      }));
    return {
      designId: existing.id,
      designVersionId: version.id,
      creatorId: existing.creatorId,
      creatorDisplayName: existing.creator.displayName,
    };
  }

  let creator = await tx.creatorProfile.findUnique({
    where: { slug: PLATFORM_STUDIO_CREATOR_SLUG },
  });

  if (!creator) {
    let platformUser = await tx.user.findUnique({
      where: { email: PLATFORM_STUDIO_USER_EMAIL },
    });
    if (!platformUser) {
      platformUser = await tx.user.create({
        data: {
          email: PLATFORM_STUDIO_USER_EMAIL,
          name: "Thi Bút Studio",
          status: "ACTIVE",
        },
      });
    }
    creator = await tx.creatorProfile.create({
      data: {
        userId: platformUser.id,
        slug: PLATFORM_STUDIO_CREATOR_SLUG,
        displayName: "Thi Bút Studio",
        status: "ACTIVE",
      },
    });
  }

  const createdDesign = await tx.design.create({
    data: {
      creatorId: creator.id,
      slug: PLATFORM_GALLERY_DESIGN_SLUG,
      title: "Thi Bút Curated Gallery Edition",
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });

  const createdVersion = await tx.designVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
    },
  });

  await tx.designPolicyVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
      allowName: false,
      allowQuote: false,
      allowTranslation: false,
      allowCalligraphy: true,
      allowAIRestyle: false,
      allowCommercialUse: false,
      allowModelTraining: false,
    },
  });

  return {
    designId: createdDesign.id,
    designVersionId: createdVersion.id,
    creatorId: creator.id,
    creatorDisplayName: creator.displayName,
  };
}

export async function POST(req: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret || stripeSecret === "sk_test_placeholder") {
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

  const parsed = GalleryCheckoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid gallery checkout payload" },
      { status: 400 }
    );
  }

  try {
    const input = parsed.data;
    const appBaseUrl = getAppBaseUrl();
    const { userId, anonId } = await resolveCallerIdentity();

    const galleryItem = await prisma.galleryItem.findUnique({
      where: { id: input.galleryItemId },
    });

    if (!galleryItem) {
      return NextResponse.json(
        { error: "Gallery item not found" },
        { status: 404 }
      );
    }

    if (!galleryItem.published || !galleryItem.purchasable) {
      return NextResponse.json(
        { error: "This gallery item is currently unavailable for purchase" },
        { status: 400 }
      );
    }

    const explicitVariantRef =
      input.catalogVariantId ??
      (input.variantId && input.variantId !== "default"
        ? input.variantId
        : undefined);

    let resolvedVariant = null;
    if (explicitVariantRef) {
      resolvedVariant = await prisma.catalogVariant.findUnique({
        where: { id: explicitVariantRef },
        include: {
          product: true,
          providerVariants: true,
        },
      });

      if (!resolvedVariant && galleryItem.requiresSize) {
        resolvedVariant = await prisma.catalogVariant.findFirst({
          where: {
            active: true,
            size: explicitVariantRef,
            product: {
              name: galleryItem.productName,
              status: "ACTIVE",
            },
          },
          include: {
            product: true,
            providerVariants: true,
          },
        });
      }

      if (
        !resolvedVariant ||
        !resolvedVariant.active ||
        resolvedVariant.product.status !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "Selected catalog variant is invalid or inactive" },
          { status: 400 }
        );
      }
    } else if (galleryItem.requiresSize) {
      return NextResponse.json(
        { error: "Size/Variant selection is required" },
        { status: 400 }
      );
    } else {
      resolvedVariant = await prisma.catalogVariant.findFirst({
        where: {
          active: true,
          product: {
            name: galleryItem.productName,
            status: "ACTIVE",
          },
        },
        include: {
          product: true,
          providerVariants: true,
        },
      });
    }

    const quote = calculateGalleryItemQuote(galleryItem, resolvedVariant, {
      quantity: input.quantity,
    });

    const createdOrder = await prisma.$transaction(async (tx) => {
      const designMeta = await ensureGalleryDesign(tx);
      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: userId ?? null,
          anonymousSessionId: userId ? null : (anonId ?? null),
          currency: "USD",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          fulfillmentStatus: "PENDING",
          subtotalMinor: quote.subtotalMinor,
          discountMinor: 0n,
          shippingMinor: quote.shippingMinor,
          taxMinor: quote.taxMinor,
          totalMinor: quote.totalMinor,
        },
      });

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          creatorId: designMeta.creatorId,
          designId: designMeta.designId,
          designVersionId: designMeta.designVersionId,
          galleryItemId: galleryItem.id,
          catalogProductId: resolvedVariant?.productId ?? null,
          catalogVariantId: resolvedVariant?.id ?? null,
          quantity: quote.quantity,
          placement: quote.placement,
          artworkRevenueMinor: quote.artworkMinor,
          personalizationRevenueMinor: quote.personalizationMinor,
          productRevenueMinor: quote.productMinor,
          fulfillmentCostMinor: quote.fulfillmentCostMinor,
          creatorRoyaltyMinor: quote.creatorRoyaltyMinor,
          platformRevenueMinor: quote.platformMinor,
          totalMinor: quote.totalMinor,
        },
      });

      const variantLabel = resolvedVariant
        ? [resolvedVariant.color, resolvedVariant.size]
            .filter((v): v is string => Boolean(v))
            .join(" / ")
        : "";

      await tx.orderItemSnapshot.create({
        data: {
          orderItemId: orderItem.id,
          designTitle: galleryItem.title,
          creatorName: designMeta.creatorDisplayName,
          productName: galleryItem.productName,
          variantName: variantLabel || null,
          color: resolvedVariant?.color ?? galleryItem.defaultColor ?? null,
          size: resolvedVariant?.size ?? null,
          licenseTermsJson: {
            licenseType: "PERSONAL_PRODUCT",
            termsVersion: 1,
            allowDigitalDownload: false,
            allowResale: false,
            allowCommercialUse: false,
            allowModelTraining: false,
            priceMinor: quote.creatorRoyaltyMinor.toString(),
            currency: "USD",
          },
          printPlacementJson: { placement: quote.placement },
          pricingJson: {
            quantity: quote.quantity,
            listedPriceMinor: galleryItem.listedPriceMinor.toString(),
            artworkRevenueMinor: quote.artworkMinor.toString(),
            personalizationRevenueMinor: quote.personalizationMinor.toString(),
            productRevenueMinor: quote.productMinor.toString(),
            fulfillmentCostMinor: quote.fulfillmentCostMinor.toString(),
            creatorRoyaltyMinor: quote.creatorRoyaltyMinor.toString(),
            platformRevenueMinor: quote.platformMinor.toString(),
            totalMinor: quote.totalMinor.toString(),
            currency: "USD",
          },
        },
      });

      await tx.priceQuote.create({
        data: {
          orderId: order.id,
          currency: "USD",
          subtotalMinor: quote.subtotalMinor,
          artworkMinor: quote.artworkMinor,
          personalizationMinor: quote.personalizationMinor,
          productMinor: quote.productMinor,
          fulfillmentCostMinor: quote.fulfillmentCostMinor,
          creatorRoyaltyMinor: quote.creatorRoyaltyMinor,
          platformMinor: quote.platformMinor,
          shippingMinor: quote.shippingMinor,
          taxMinor: quote.taxMinor,
          discountMinor: 0n,
          totalMinor: quote.totalMinor,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      return { order, variantLabel };
    });

    const unitAmountMinor = Number(
      quote.subtotalMinor / BigInt(quote.quantity)
    );
    const successUrl = `${appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${encodeURIComponent(
      createdOrder.order.orderNumber
    )}`;
    const cancelUrl = `${appBaseUrl}/gallery/${encodeURIComponent(
      galleryItem.slug
    )}`;

    const stripeImages =
      galleryItem.productImageUrl &&
      galleryItem.productImageUrl.startsWith("https://")
        ? [galleryItem.productImageUrl]
        : undefined;

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: galleryItem.title,
              description: createdOrder.variantLabel
                ? `${galleryItem.productName} (${createdOrder.variantLabel})`
                : galleryItem.productName,
              ...(stripeImages ? { images: stripeImages } : {}),
            },
            unit_amount: unitAmountMinor,
          },
          quantity: quote.quantity,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
      },
      payment_intent_data: {
        transfer_group: createdOrder.order.orderNumber,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: createdOrder.order.id,
        orderNumber: createdOrder.order.orderNumber,
        purchaseType: "GALLERY_AS_SHOWN",
        isDigital: "false",
        galleryItemId: galleryItem.id,
        selectedVariantId: resolvedVariant?.id ?? "default",
      },
    });

    await prisma.order.update({
      where: { id: createdOrder.order.id },
      data: { stripeCheckoutSessionId: stripeSession.id },
    });

    return NextResponse.json({
      url: stripeSession.url,
      orderId: createdOrder.order.id,
      orderNumber: createdOrder.order.orderNumber,
    });
  } catch (err: unknown) {
    if (err instanceof PricingValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[Checkout Gallery API] Error:", err);
    return NextResponse.json(
      { error: "Failed to initiate gallery checkout" },
      { status: 500 }
    );
  }
}
