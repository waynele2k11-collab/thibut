import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import { adaptLegacyComposition } from "@/lib/print-generator";
import {
  PricingValidationError,
  calculateItemQuote,
  type ItemQuote,
} from "@/lib/pricing/quote";
import {
  CompositionSchema,
  PlacementSchema,
  type DesignComposition,
  type PlacementValue,
} from "@/lib/print/types";
import { getAppBaseUrl } from "@/lib/security/redirect";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { STRIPE_CURRENCY, stripe } from "@/lib/stripe";
import { createClient } from "@/utils/supabase/server";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const PLATFORM_STUDIO_USER_EMAIL = "studio-platform@thibut.internal";
const PLATFORM_STUDIO_CREATOR_SLUG = "thibut-studio";
const PLATFORM_STUDIO_DESIGN_SLUG = "thibut-studio-custom-calligraphy";

const ALLOWED_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "AU", "VN", "JP", "KR", "SG", "DE", "FR"];

const CartCheckoutSchema = z
  .object({
    cartId: z.string().uuid(),
  })
  .strict();

const DirectCheckoutSchema = z
  .object({
    personalizationVersionId: z.string().uuid().optional(),
    sessionId: z
      .string()
      .uuid()
      .refine((id) => id !== NIL_UUID, "Nil sessionId is not allowed")
      .optional(),
    catalogVariantId: z.string().trim().min(1).max(128).optional(),
    isDigital: z.boolean().default(false),
    placement: PlacementSchema.default("front"),
    licenseOfferId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(1000).default(1),
  })
  .strict()
  .refine(
    (val) => Boolean(val.personalizationVersionId || val.sessionId),
    "Either personalizationVersionId or sessionId is required"
  )
  .refine(
    (val) => val.isDigital || Boolean(val.catalogVariantId),
    "catalogVariantId is required for physical items"
  );

const CheckoutRequestSchema = z.union([
  CartCheckoutSchema,
  DirectCheckoutSchema,
]);

class CheckoutHttpError extends Error {
  public readonly status: 400 | 401 | 403 | 404 | 409 | 503;

  constructor(
    status: 400 | 401 | 403 | 404 | 409 | 503,
    message: string
  ) {
    super(message);
    this.name = "CheckoutHttpError";
    this.status = status;
  }
}

function generateOrderNumber(): string {
  return `TB-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function resolveCallerIdentity(): Promise<{
  userId: string | null;
  anonId: string | null;
  cookieCartId: string | undefined;
}> {
  let cookieCartId: string | undefined;
  let anonId: string | null = null;
  try {
    const cookieStore = await cookies();
    cookieCartId = cookieStore.get("tb_cart_id")?.value;
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

  return { userId, anonId, cookieCartId };
}

function buildFallbackComposition(
  inputText: string,
  placement: PlacementValue,
  productVariantId?: string
): DesignComposition {
  return CompositionSchema.parse({
    version: 1,
    productVariantId,
    placement,
    color: "#121212",
    transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    layers: [
      {
        id: "layer-calligraphy-main",
        type: "calligraphy",
        text: inputText.trim().slice(0, 200) || "Thi Bút",
        fontFamily: DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        layout: "VERTICAL",
        colorHex: "#121212",
        zIndex: 10,
        opacity: 1,
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      },
    ],
  });
}

function resolveValidatedStyleSnapshot(
  rawStyleSnapshot: unknown,
  fallbackText: string,
  placement: PlacementValue,
  productVariantId?: string
): DesignComposition {
  if (rawStyleSnapshot !== null && rawStyleSnapshot !== undefined) {
    try {
      return adaptLegacyComposition(rawStyleSnapshot);
    } catch {
      // Fall back below only if session had no valid CompositionSchema yet
    }
  }
  return buildFallbackComposition(fallbackText, placement, productVariantId);
}

async function ensureDesignAndVersion(
  tx: Prisma.TransactionClient,
  existingDesignId?: string | null,
  existingDesignVersionId?: string | null
): Promise<{
  designId: string;
  designTitle: string;
  designVersionId: string;
  creatorId: string;
  creatorDisplayName: string;
  latestPolicy: {
    allowName: boolean;
    allowQuote: boolean;
    allowTranslation: boolean;
    allowCalligraphy: boolean;
    allowAIRestyle: boolean;
    allowCommercialUse: boolean;
  } | null;
}> {
  if (existingDesignId) {
    const found = await tx.design.findUnique({
      where: { id: existingDesignId },
      include: {
        creator: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        policyVersions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (found) {
      const pinnedVersion =
        (existingDesignVersionId
          ? found.versions.find((v) => v.id === existingDesignVersionId)
          : undefined) ?? found.versions[0];

      const resolvedVersion =
        pinnedVersion ??
        (await tx.designVersion.create({
          data: {
            designId: found.id,
            versionNumber: 1,
          },
        }));

      return {
        designId: found.id,
        designTitle: found.title,
        designVersionId: resolvedVersion.id,
        creatorId: found.creatorId,
        creatorDisplayName: found.creator.displayName,
        latestPolicy: found.policyVersions[0] ?? null,
      };
    }
  }

  const existingPlatform = await tx.design.findUnique({
    where: { slug: PLATFORM_STUDIO_DESIGN_SLUG },
    include: {
      creator: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
      policyVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (existingPlatform) {
    const resolvedVersion =
      existingPlatform.versions[0] ??
      (await tx.designVersion.create({
        data: {
          designId: existingPlatform.id,
          versionNumber: 1,
        },
      }));

    return {
      designId: existingPlatform.id,
      designTitle: existingPlatform.title,
      designVersionId: resolvedVersion.id,
      creatorId: existingPlatform.creatorId,
      creatorDisplayName: existingPlatform.creator.displayName,
      latestPolicy: existingPlatform.policyVersions[0] ?? null,
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
      slug: PLATFORM_STUDIO_DESIGN_SLUG,
      title: "Thi Bút Studio Calligraphy",
      status: "PUBLISHED",
      visibility: "UNLISTED",
    },
  });

  const createdVersion = await tx.designVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
    },
  });

  const createdPolicy = await tx.designPolicyVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
      allowName: true,
      allowQuote: true,
      allowTranslation: true,
      allowCalligraphy: true,
      allowAIRestyle: false,
      allowCommercialUse: false,
      allowModelTraining: false,
    },
  });

  return {
    designId: createdDesign.id,
    designTitle: createdDesign.title,
    designVersionId: createdVersion.id,
    creatorId: creator.id,
    creatorDisplayName: creator.displayName,
    latestPolicy: createdPolicy,
  };
}

interface PreparedStripeLineItem {
  name: string;
  description: string;
  unitAmountMinor: number;
  quantity: number;
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

  const parsed = CheckoutRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout request payload" },
      { status: 400 }
    );
  }

  try {
    const appBaseUrl = getAppBaseUrl();
    const { userId, anonId, cookieCartId } = await resolveCallerIdentity();
    const input = parsed.data;

    // ───────────────────────────────────────────────────────────────────────
    // MODE A: CART CHECKOUT ({ cartId })
    // ───────────────────────────────────────────────────────────────────────
    if ("cartId" in input) {
      const cart = await prisma.cart.findUnique({
        where: { id: input.cartId },
        include: {
          items: {
            include: {
              design: {
                include: {
                  creator: true,
                  policyVersions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                  },
                },
              },
              designVersion: true,
              catalogVariant: {
                include: {
                  product: true,
                  providerVariants: true,
                },
              },
              licenseOffer: true,
              personalizationVersion: {
                include: {
                  session: {
                    include: { interpretations: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new CheckoutHttpError(404, "Cart is empty or was not found");
      }

      if (cart.status === "CONVERTED") {
        throw new CheckoutHttpError(409, "Cart has already been checked out");
      }

      if (cart.userId || cart.anonymousSessionId) {
        const ownsByUser = Boolean(userId && cart.userId === userId);
        const ownsByAnon = Boolean(
          anonId && cart.anonymousSessionId === anonId
        );
        const ownsByCookie = Boolean(cookieCartId && cookieCartId === cart.id && ownsByAnon);
        if (!ownsByUser && !ownsByAnon && !ownsByCookie) {
          throw new CheckoutHttpError(403, "Forbidden: cart does not belong to caller");
        }
      }

      const itemQuotes: Array<{
        cartItem: (typeof cart.items)[number];
        quote: ItemQuote;
      }> = [];

      for (const ci of cart.items) {
        const quote = calculateItemQuote({
          isDigital: false,
          variant: ci.catalogVariant,
          placement: ci.placement,
          quantity: ci.quantity,
          isPersonalized: Boolean(ci.personalizationVersionId),
          licenseOffer: ci.licenseOffer,
        });
        itemQuotes.push({ cartItem: ci, quote });
      }

      const created = await prisma.$transaction(async (tx) => {
        const orderNumber = generateOrderNumber();

        let subtotalMinor = 0n;
        let artworkMinor = 0n;
        let personalizationMinor = 0n;
        let productMinor = 0n;
        let fulfillmentCostMinor = 0n;
        let creatorRoyaltyMinor = 0n;
        let platformMinor = 0n;
        let shippingMinor = 0n;
        let taxMinor = 0n;
        let totalMinor = 0n;

        for (const { quote } of itemQuotes) {
          subtotalMinor += quote.subtotalMinor;
          artworkMinor += quote.artworkMinor;
          personalizationMinor += quote.personalizationMinor;
          productMinor += quote.productMinor;
          fulfillmentCostMinor += quote.fulfillmentCostMinor;
          creatorRoyaltyMinor += quote.creatorRoyaltyMinor;
          platformMinor += quote.platformMinor;
          shippingMinor += quote.shippingMinor;
          taxMinor += quote.taxMinor;
          totalMinor += quote.totalMinor;
        }

        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId: userId ?? cart.userId ?? null,
            anonymousSessionId: userId
              ? null
              : (anonId ?? cart.anonymousSessionId ?? null),
            currency: "USD",
            status: "PENDING_PAYMENT",
            paymentStatus: "PENDING",
            fulfillmentStatus: "PENDING",
            subtotalMinor,
            discountMinor: 0n,
            shippingMinor,
            taxMinor,
            totalMinor,
          },
        });

        const stripeLines: PreparedStripeLineItem[] = [];
        let primarySessionId: string | undefined;

        for (const { cartItem, quote } of itemQuotes) {
          let frozenPvId = cartItem.personalizationVersionId;
          let frozenPvSnapshot: Prisma.InputJsonValue | undefined;

          if (cartItem.personalizationVersion) {
            const pv = cartItem.personalizationVersion;
            const validatedComp = resolveValidatedStyleSnapshot(
              pv.styleSnapshot,
              cartItem.design.title,
              quote.placement,
              cartItem.catalogVariantId
            );
            frozenPvId = pv.id;
            frozenPvSnapshot = toJsonValue({
              personalizationVersionId: pv.id,
              inputSnapshot: pv.inputSnapshot,
              interpretationSnapshot: pv.interpretationSnapshot,
              styleSnapshot: validatedComp,
            });
            primarySessionId = primarySessionId ?? pv.sessionId;

            await tx.personalizationSession.update({
              where: { id: pv.sessionId },
              data: { status: "CHECKED_OUT" },
            });
          }

          const latestPolicy = cartItem.design.policyVersions[0] ?? null;
          const allowCommercial = Boolean(
            (cartItem.licenseOffer?.allowCommercialUse ?? false) &&
              (latestPolicy?.allowCommercialUse ?? false)
          );

          const frozenLicenseTerms = {
            licenseOfferId: cartItem.licenseOfferId ?? null,
            licenseType: cartItem.licenseOffer?.type ?? "PERSONAL_PRODUCT",
            termsVersion: cartItem.licenseOffer?.termsVersion ?? 1,
            allowDigitalDownload:
              cartItem.licenseOffer?.allowDigitalDownload ?? false,
            allowResale: cartItem.licenseOffer?.allowResale ?? false,
            allowCommercialUse: allowCommercial,
            allowModelTraining: false,
            priceMinor: quote.creatorRoyaltyMinor.toString(),
            currency: "USD",
          };

          const createdItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              creatorId: cartItem.creatorId,
              designId: cartItem.designId,
              designVersionId: cartItem.designVersionId,
              licenseOfferId: cartItem.licenseOfferId ?? null,
              personalizationVersionId: frozenPvId ?? null,
              catalogProductId: cartItem.catalogVariant.productId,
              catalogVariantId: cartItem.catalogVariant.id,
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

          const variantLabel = [
            cartItem.catalogVariant.color,
            cartItem.catalogVariant.size,
          ]
            .filter((v): v is string => Boolean(v))
            .join(" / ");

          await tx.orderItemSnapshot.create({
            data: {
              orderItemId: createdItem.id,
              designTitle: cartItem.design.title,
              creatorName: cartItem.design.creator.displayName,
              productName: cartItem.catalogVariant.product.name,
              variantName: variantLabel || null,
              color: cartItem.catalogVariant.color ?? null,
              size: cartItem.catalogVariant.size ?? null,
              licenseTermsJson: frozenLicenseTerms,
              ...(frozenPvSnapshot
                ? { personalizationJson: frozenPvSnapshot }
                : {}),
              printPlacementJson: { placement: quote.placement },
              pricingJson: {
                quantity: quote.quantity,
                artworkRevenueMinor: quote.artworkMinor.toString(),
                personalizationRevenueMinor:
                  quote.personalizationMinor.toString(),
                productRevenueMinor: quote.productMinor.toString(),
                fulfillmentCostMinor: quote.fulfillmentCostMinor.toString(),
                creatorRoyaltyMinor: quote.creatorRoyaltyMinor.toString(),
                platformRevenueMinor: quote.platformMinor.toString(),
                totalMinor: quote.totalMinor.toString(),
                currency: "USD",
              },
            },
          });

          const unitAmountMinor = Number(
            quote.subtotalMinor / BigInt(quote.quantity)
          );
          stripeLines.push({
            name: `${cartItem.design.title} — ${cartItem.catalogVariant.product.name}`,
            description: variantLabel
              ? `${variantLabel} · Placement: ${quote.placement}`
              : `Placement: ${quote.placement}`,
            unitAmountMinor,
            quantity: quote.quantity,
          });
        }

        await tx.priceQuote.create({
          data: {
            cartId: cart.id,
            orderId: order.id,
            currency: "USD",
            subtotalMinor,
            artworkMinor,
            personalizationMinor,
            productMinor,
            fulfillmentCostMinor,
            creatorRoyaltyMinor,
            platformMinor,
            shippingMinor,
            taxMinor,
            discountMinor: 0n,
            totalMinor,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });

        await tx.cart.update({
          where: { id: cart.id },
          data: { status: "CHECKOUT" },
        });

        return { order, stripeLines, primarySessionId };
      });

      const successUrl = `${appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${encodeURIComponent(
        created.order.orderNumber
      )}`;
      const cancelUrl = `${appBaseUrl}/cart`;

      const stripeSession = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: created.stripeLines.map((line) => ({
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: line.name,
              description: line.description,
            },
            unit_amount: line.unitAmountMinor,
          },
          quantity: line.quantity,
        })),
        shipping_address_collection: {
          allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
        },
        payment_intent_data: {
          transfer_group: created.order.orderNumber,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId: created.order.id,
          orderNumber: created.order.orderNumber,
          purchaseType: "CART_CHECKOUT",
          isDigital: "false",
          ...(created.primarySessionId
            ? { personalizationSessionId: created.primarySessionId }
            : {}),
        },
      });

      await prisma.order.update({
        where: { id: created.order.id },
        data: { stripeCheckoutSessionId: stripeSession.id },
      });

      return NextResponse.json({
        url: stripeSession.url,
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // MODE B: DIRECT ITEM CHECKOUT ({ personalizationVersionId | sessionId, ... })
    // ───────────────────────────────────────────────────────────────────────
    let existingVersion = null;
    if (input.personalizationVersionId) {
      existingVersion = await prisma.personalizationVersion.findUnique({
        where: { id: input.personalizationVersionId },
        include: {
          session: {
            include: { interpretations: true },
          },
        },
      });
      if (!existingVersion) {
        throw new CheckoutHttpError(
          400,
          "Referenced personalizationVersionId was not found"
        );
      }
    }

    const resolvedSession =
      existingVersion?.session ??
      (input.sessionId
        ? await prisma.personalizationSession.findUnique({
            where: { id: input.sessionId },
            include: { interpretations: true },
          })
        : null);

    if (!resolvedSession) {
      throw new CheckoutHttpError(400, "Personalization session not found");
    }

    if (resolvedSession.userId || resolvedSession.anonymousSessionId) {
      const ownsByUser = Boolean(
        userId && resolvedSession.userId === userId
      );
      const ownsByAnon = Boolean(
        anonId && resolvedSession.anonymousSessionId === anonId
      );
      if (!ownsByUser && !ownsByAnon) {
        throw new CheckoutHttpError(
          403,
          "Forbidden: personalization session does not belong to caller"
        );
      }
    }

    if (resolvedSession.status === "CHECKED_OUT" && !existingVersion) {
      throw new CheckoutHttpError(
        409,
        "Personalization session has already been checked out"
      );
    }

    const variant = input.isDigital
      ? null
      : await prisma.catalogVariant.findUnique({
          where: { id: input.catalogVariantId! },
          include: {
            product: true,
            providerVariants: true,
          },
        });

    if (!input.isDigital && !variant) {
      throw new CheckoutHttpError(400, "Unknown catalog variant");
    }

    const licenseOffer = input.licenseOfferId
      ? await prisma.licenseOffer.findUnique({
          where: { id: input.licenseOfferId },
        })
      : null;

    if (input.licenseOfferId && (!licenseOffer || !licenseOffer.active)) {
      throw new CheckoutHttpError(400, "Selected license offer is unavailable");
    }

    const quote = calculateItemQuote({
      isDigital: input.isDigital,
      variant,
      placement: input.placement,
      quantity: input.quantity,
      isPersonalized: true,
      licenseOffer,
    });

    const created = await prisma.$transaction(async (tx) => {
      const designMeta = await ensureDesignAndVersion(
        tx,
        resolvedSession.designId,
        existingVersion?.designVersionId ?? resolvedSession.designVersionId
      );

      let frozenPv = existingVersion;
      const validatedStyleSnapshot = resolveValidatedStyleSnapshot(
        existingVersion?.styleSnapshot ?? resolvedSession.compositionJson,
        resolvedSession.inputText,
        quote.placement,
        variant?.id
      );

      if (!frozenPv) {
        const latestPv = await tx.personalizationVersion.findFirst({
          where: { sessionId: resolvedSession.id },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });
        const nextVersionNumber = (latestPv?.versionNumber ?? 0) + 1;

        const preferredInterpretation =
          resolvedSession.interpretations.find(
            (i) => i.id === resolvedSession.selectedInterpretationId
          ) ??
          resolvedSession.interpretations.find((i) => i.recommended) ??
          resolvedSession.interpretations[0] ??
          null;

        const createdPv = await tx.personalizationVersion.create({
          data: {
            sessionId: resolvedSession.id,
            designVersionId: designMeta.designVersionId,
            versionNumber: nextVersionNumber,
            inputSnapshot: {
              inputText: resolvedSession.inputText,
              mode: resolvedSession.mode,
              inputLanguage: resolvedSession.inputLanguage,
              targetLanguage: resolvedSession.targetLanguage,
            },
            interpretationSnapshot: preferredInterpretation
              ? {
                  id: preferredInterpretation.id,
                  type: preferredInterpretation.type,
                  language: preferredInterpretation.language,
                  text: preferredInterpretation.text,
                  romanization: preferredInterpretation.romanization,
                  meaning: preferredInterpretation.meaning,
                }
              : {
                  type: "ORIGINAL",
                  text: resolvedSession.inputText,
                },
            styleSnapshot: toJsonValue(validatedStyleSnapshot),
          },
          include: {
            session: {
              include: { interpretations: true },
            },
          },
        });
        frozenPv = createdPv;
      }

      // Lock PersonalizationSession so post-checkout mutations are rejected (T-102, INV-003)
      await tx.personalizationSession.update({
        where: { id: resolvedSession.id },
        data: {
          status: "CHECKED_OUT",
          designId: designMeta.designId,
          designVersionId: designMeta.designVersionId,
        },
      });

      const orderNumber = generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          buyerId: userId ?? resolvedSession.userId ?? null,
          anonymousSessionId: userId
            ? null
            : (anonId ?? resolvedSession.anonymousSessionId ?? null),
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

      const allowCommercial = Boolean(
        (licenseOffer?.allowCommercialUse ?? false) &&
          (designMeta.latestPolicy?.allowCommercialUse ?? false)
      );

      const frozenLicenseTerms = {
        licenseOfferId: licenseOffer?.id ?? null,
        licenseType:
          licenseOffer?.type ??
          (quote.isDigital ? "PERSONAL_DIGITAL" : "PERSONAL_PRODUCT"),
        termsVersion: licenseOffer?.termsVersion ?? 1,
        allowDigitalDownload:
          licenseOffer?.allowDigitalDownload ?? quote.isDigital,
        allowResale: licenseOffer?.allowResale ?? false,
        allowCommercialUse: allowCommercial,
        allowModelTraining: false,
        priceMinor: quote.creatorRoyaltyMinor.toString(),
        currency: "USD",
      };

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: order.id,
          creatorId: designMeta.creatorId,
          designId: designMeta.designId,
          designVersionId: designMeta.designVersionId,
          licenseOfferId: licenseOffer?.id ?? null,
          personalizationVersionId: frozenPv.id,
          catalogProductId: quote.isDigital ? null : (variant?.productId ?? null),
          catalogVariantId: quote.isDigital ? null : (variant?.id ?? null),
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

      const variantLabel = variant
        ? [variant.color, variant.size]
            .filter((v): v is string => Boolean(v))
            .join(" / ")
        : "";

      await tx.orderItemSnapshot.create({
        data: {
          orderItemId: orderItem.id,
          designTitle: designMeta.designTitle,
          creatorName: designMeta.creatorDisplayName,
          productName: quote.isDigital
            ? "Digital Master Download (4500x5400 @ 300 DPI)"
            : (variant?.product.name ?? null),
          variantName: variantLabel || null,
          color: variant?.color ?? null,
          size: variant?.size ?? null,
          licenseTermsJson: frozenLicenseTerms,
          personalizationJson: toJsonValue({
            personalizationVersionId: frozenPv.id,
            inputSnapshot: frozenPv.inputSnapshot,
            interpretationSnapshot: frozenPv.interpretationSnapshot,
            styleSnapshot: validatedStyleSnapshot,
          }),
          printPlacementJson: { placement: quote.placement },
          pricingJson: {
            quantity: quote.quantity,
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

      return {
        order,
        frozenPv,
        designTitle: designMeta.designTitle,
        productLabel: quote.isDigital
          ? "Digital Master Download"
          : (variant?.product.name ?? "Personalized Merchandise"),
        variantLabel,
      };
    });

    const successUrl = `${appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${encodeURIComponent(
      created.order.orderNumber
    )}`;
    const cancelParams = new URLSearchParams({
      sessionId: resolvedSession.id,
      ...(quote.isDigital
        ? { digital: "true" }
        : variant
          ? { variantId: variant.id, placement: quote.placement }
          : {}),
    });
    const cancelUrl = `${appBaseUrl}/checkout?${cancelParams.toString()}`;

    const unitAmountMinor = Number(
      quote.subtotalMinor / BigInt(quote.quantity)
    );

    const stripeSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: STRIPE_CURRENCY,
            product_data: {
              name: `${created.designTitle} — ${created.productLabel}`,
              description: quote.isDigital
                ? "4500x5400 px @ 300 DPI Archival Print Master"
                : created.variantLabel || `Placement: ${quote.placement}`,
            },
            unit_amount: unitAmountMinor,
          },
          quantity: quote.quantity,
        },
      ],
      ...(!quote.isDigital
        ? {
            shipping_address_collection: {
              allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
            },
          }
        : {}),
      payment_intent_data: {
        transfer_group: created.order.orderNumber,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: created.order.id,
        orderNumber: created.order.orderNumber,
        purchaseType: quote.isDigital
          ? "PERSONALIZED_DIGITAL"
          : "PERSONALIZED_PHYSICAL",
        isDigital: quote.isDigital ? "true" : "false",
        personalizationSessionId: resolvedSession.id,
        personalizationVersionId: created.frozenPv.id,
        productName: created.productLabel,
      },
    });

    await prisma.order.update({
      where: { id: created.order.id },
      data: { stripeCheckoutSessionId: stripeSession.id },
    });

    return NextResponse.json({
      url: stripeSession.url,
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      personalizationVersionId: created.frozenPv.id,
    });
  } catch (err: unknown) {
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
