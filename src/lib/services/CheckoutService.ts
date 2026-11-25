import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { z } from "zod";
import {
  ITEM_UNAVAILABLE_MESSAGE,
  hasPhysicalItemNotMadeInHouse,
} from "@/lib/catalog/fulfilmentMode";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import {
  calculateFlatShippingMinor,
  calculateGalleryItemQuote,
  calculateItemQuote,
  type ItemQuote,
} from "@/lib/pricing/quote";
import {
  CompositionSchema,
  PlacementSchema,
  adaptLegacyComposition,
  type DesignComposition,
  type PlacementValue,
} from "@/lib/print/types";
import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/security/redirect";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { STRIPE_CURRENCY, stripe } from "@/lib/stripe";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const PLATFORM_STUDIO_USER_EMAIL = "studio-platform@thibut.internal";
const PLATFORM_STUDIO_CREATOR_SLUG = "thibut-studio";
const PLATFORM_STUDIO_DESIGN_SLUG = "thibut-studio-custom-calligraphy";
const PLATFORM_GALLERY_DESIGN_SLUG = "thibut-gallery-curated";

export const CHECKOUT_QUOTE_WINDOW_MS = 30 * 60 * 1000;

const ALLOWED_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  ["US", "CA", "GB", "AU", "VN", "JP", "KR", "SG", "DE", "FR"];

export const CartCheckoutSchema = z
  .object({
    cartId: z.string().uuid(),
    shippingCountry: z.string().trim().min(2).max(4).optional(),
  })
  .strict();

export const DirectCheckoutSchema = z
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
    shippingCountry: z.string().trim().min(2).max(4).optional(),
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

export const CheckoutRequestSchema = z.union([
  CartCheckoutSchema,
  DirectCheckoutSchema,
]);

export const GalleryCheckoutSchema = z
  .object({
    galleryItemId: z.string().trim().min(1).max(128),
    catalogVariantId: z.string().trim().min(1).max(128).optional(),
    variantId: z.string().trim().min(1).max(128).optional(),
    quantity: z.number().int().min(1).max(1000).default(1),
    shippingCountry: z.string().trim().min(2).max(4).optional(),
  })
  .strict();

export type CheckoutRequestInput = z.infer<typeof CheckoutRequestSchema>;
export type GalleryCheckoutInput = z.infer<typeof GalleryCheckoutSchema>;

export interface CheckoutSessionResult {
  url: string | null;
  orderId: string;
  orderNumber: string;
  personalizationVersionId?: string;
}

export class CheckoutHttpError extends Error {
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

export interface CallerIdentity {
  userId: string | null;
  anonId: string | null;
  cookieCartId: string | undefined;
}

interface PreparedStripeLineItem {
  name: string;
  description: string;
  unitAmountMinor: number;
  quantity: number;
  images?: string[];
}

const inFlightCheckouts = new Map<string, Promise<CheckoutSessionResult>>();
const recentStripeUrlByOrderId = new Map<string, string>();

function rememberStripeUrl(orderId: string, url: string | null | undefined): void {
  if (!url) return;
  recentStripeUrlByOrderId.set(orderId, url);
  if (recentStripeUrlByOrderId.size > 2_000) {
    const firstKey = recentStripeUrlByOrderId.keys().next().value;
    if (firstKey) {
      recentStripeUrlByOrderId.delete(firstKey);
    }
  }
}

async function resolveStripeUrlForPendingOrder(order: {
  id: string;
  stripeCheckoutSessionId: string | null;
}): Promise<string | null> {
  const cached = recentStripeUrlByOrderId.get(order.id);
  if (cached) {
    return cached;
  }
  if (!order.stripeCheckoutSessionId) {
    return null;
  }
  const sessionsApi = stripe.checkout.sessions as unknown as {
    retrieve?: (id: string) => Promise<{ url?: string | null; status?: string }>;
  };
  if (typeof sessionsApi.retrieve === "function") {
    try {
      const retrieved = await sessionsApi.retrieve(order.stripeCheckoutSessionId);
      if (retrieved?.status === "expired") {
        return null;
      }
      if (retrieved?.url) {
        rememberStripeUrl(order.id, retrieved.url);
        return retrieved.url;
      }
    } catch {
      // Fall back to deterministic hosted checkout URL format below
    }
  }
  return `https://checkout.stripe.com/c/pay/${order.stripeCheckoutSessionId}`;
}

function withInFlightDedup(
  dedupKey: string,
  work: () => Promise<CheckoutSessionResult>
): Promise<CheckoutSessionResult> {
  const existing = inFlightCheckouts.get(dedupKey);
  if (existing) {
    return existing;
  }
  const promise = work().finally(() => {
    inFlightCheckouts.delete(dedupKey);
  });
  inFlightCheckouts.set(dedupKey, promise);
  return promise;
}

/**
 * A physical item whose product is not made in-house cannot be bought: after payment the
 * fulfilment job could only fail the order. Validation only; it changes no price or total.
 */
export function assertPhysicalItemsMadeInHouse(
  variants: Parameters<typeof hasPhysicalItemNotMadeInHouse>[0]
): void {
  if (hasPhysicalItemNotMadeInHouse(variants)) {
    throw new CheckoutHttpError(409, ITEM_UNAVAILABLE_MESSAGE);
  }
}

export function assertStripeConfigured(): void {
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret || stripeSecret === "sk_test_placeholder") {
    throw new CheckoutHttpError(503, "Payment service is not configured");
  }
}

export async function resolveCallerIdentity(): Promise<CallerIdentity> {
  let cookieCartId: string | undefined;
  let anonId: string | null = null;
  try {
    const { cookies } = await import("next/headers");
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
    const { getSessionUser } = await import("@/lib/auth/session");
    const sessionUser = await getSessionUser();
    if (sessionUser?.id) {
      userId = sessionUser.id;
    }
  } catch {
    userId = null;
  }

  return { userId, anonId, cookieCartId };
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

function resolveRequestedShippingCountry(explicitCountry?: string): string {
  if (explicitCountry && explicitCountry.trim().length > 0) {
    return explicitCountry.trim().toUpperCase();
  }
  return "US";
}

function isStripeTaxEnabled(): boolean {
  return process.env.STRIPE_TAX_ENABLED === "true";
}

const MAX_STRIPE_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function minorToStripeAmount(minor: bigint): number {
  if (minor < 0n || minor > MAX_STRIPE_SAFE_MINOR) {
    throw new CheckoutHttpError(
      400,
      "Checkout amount is out of supported Stripe bounds"
    );
  }
  return Number.parseInt(minor.toString(), 10);
}

function buildStripeShippingOptions(
  shippingMinor: bigint,
  shippingCountry?: string
): Stripe.Checkout.SessionCreateParams.ShippingOption[] | undefined {
  if (shippingMinor <= 0n) {
    return undefined;
  }
  const isUs = (shippingCountry ?? "US").toUpperCase() === "US";
  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: minorToStripeAmount(shippingMinor),
          currency: STRIPE_CURRENCY,
        },
        display_name: isUs
          ? "Standard US Flat-Rate Shipping"
          : "International Flat-Rate Shipping",
      },
    },
  ];
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

async function ensurePlatformCreator(tx: Prisma.TransactionClient) {
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

  return creator;
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

  const creator = await ensurePlatformCreator(tx);

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

  const creator = await ensurePlatformCreator(tx);

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

function canQueryReusableOrders(): boolean {
  const orderDelegate = prisma.order as unknown as { findFirst?: unknown };
  return typeof orderDelegate.findFirst === "function";
}

async function tryFindReusableCartOrder(params: {
  cartId: string;
  userId: string | null;
  anonId: string | null;
}): Promise<CheckoutSessionResult | null> {
  if (!canQueryReusableOrders()) {
    return null;
  }
  const quoteDelegate = prisma.priceQuote as unknown as { findFirst?: unknown };
  if (typeof quoteDelegate.findFirst !== "function") {
    return null;
  }

  const now = new Date();
  const recentQuote = await prisma.priceQuote.findFirst({
    where: {
      cartId: params.cartId,
      expiresAt: { gt: now },
      orderId: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!recentQuote?.orderId) {
    return null;
  }

  const cutoff = new Date(now.getTime() - CHECKOUT_QUOTE_WINDOW_MS);
  const existingOrder = await prisma.order.findFirst({
    where: {
      id: recentQuote.orderId,
      status: "PENDING_PAYMENT",
      stripeCheckoutSessionId: { not: null },
      createdAt: { gte: cutoff },
      ...(params.userId
        ? { buyerId: params.userId }
        : params.anonId
          ? { anonymousSessionId: params.anonId }
          : {}),
    },
  });

  if (!existingOrder || !existingOrder.stripeCheckoutSessionId) {
    return null;
  }

  const url = await resolveStripeUrlForPendingOrder(existingOrder);
  if (!url) {
    return null;
  }

  return {
    url,
    orderId: existingOrder.id,
    orderNumber: existingOrder.orderNumber,
  };
}

async function tryFindReusableDirectOrder(params: {
  sessionId: string;
  userId: string | null;
  anonId: string | null;
  expectedTotalMinor: bigint;
  catalogVariantId: string | null;
  placement: string;
  quantity: number;
}): Promise<CheckoutSessionResult | null> {
  if (!canQueryReusableOrders()) {
    return null;
  }
  const cutoff = new Date(Date.now() - CHECKOUT_QUOTE_WINDOW_MS);
  const existingOrder = await prisma.order.findFirst({
    where: {
      status: "PENDING_PAYMENT",
      stripeCheckoutSessionId: { not: null },
      createdAt: { gte: cutoff },
      totalMinor: params.expectedTotalMinor,
      ...(params.userId
        ? { buyerId: params.userId }
        : params.anonId
          ? { anonymousSessionId: params.anonId }
          : {}),
      items: {
        some: {
          catalogVariantId: params.catalogVariantId,
          placement: params.placement,
          quantity: params.quantity,
          personalizationVersion: {
            sessionId: params.sessionId,
          },
        },
      },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existingOrder || !existingOrder.stripeCheckoutSessionId) {
    return null;
  }

  const url = await resolveStripeUrlForPendingOrder(existingOrder);
  if (!url) {
    return null;
  }

  return {
    url,
    orderId: existingOrder.id,
    orderNumber: existingOrder.orderNumber,
    personalizationVersionId:
      existingOrder.items[0]?.personalizationVersionId ?? undefined,
  };
}

async function tryFindReusableGalleryOrder(params: {
  galleryItemId: string;
  userId: string | null;
  anonId: string | null;
  expectedTotalMinor: bigint;
  catalogVariantId: string | null;
  quantity: number;
}): Promise<CheckoutSessionResult | null> {
  if (!canQueryReusableOrders() || (!params.userId && !params.anonId)) {
    return null;
  }
  const cutoff = new Date(Date.now() - CHECKOUT_QUOTE_WINDOW_MS);
  const existingOrder = await prisma.order.findFirst({
    where: {
      status: "PENDING_PAYMENT",
      stripeCheckoutSessionId: { not: null },
      createdAt: { gte: cutoff },
      totalMinor: params.expectedTotalMinor,
      ...(params.userId
        ? { buyerId: params.userId }
        : { anonymousSessionId: params.anonId }),
      items: {
        some: {
          galleryItemId: params.galleryItemId,
          catalogVariantId: params.catalogVariantId,
          quantity: params.quantity,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!existingOrder || !existingOrder.stripeCheckoutSessionId) {
    return null;
  }

  const url = await resolveStripeUrlForPendingOrder(existingOrder);
  if (!url) {
    return null;
  }

  return {
    url,
    orderId: existingOrder.id,
    orderNumber: existingOrder.orderNumber,
  };
}

async function createStripeCheckoutSessionWithIdempotency(params: {
  orderId: string;
  orderNumber: string;
  quoteExpiresAt: Date;
  lines: PreparedStripeLineItem[];
  isDigital: boolean;
  shippingMinor: bigint;
  shippingCountry?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}) {
  const shippingOptions = !params.isDigital
    ? buildStripeShippingOptions(params.shippingMinor, params.shippingCountry)
    : undefined;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    expires_at: Math.floor(params.quoteExpiresAt.getTime() / 1000),
    line_items: params.lines.map((line) => ({
      price_data: {
        currency: STRIPE_CURRENCY,
        product_data: {
          name: line.name,
          description: line.description,
          ...(line.images ? { images: line.images } : {}),
        },
        unit_amount: line.unitAmountMinor,
      },
      quantity: line.quantity,
    })),
    ...(!params.isDigital
      ? {
          shipping_address_collection: {
            allowed_countries: ALLOWED_SHIPPING_COUNTRIES,
          },
        }
      : {}),
    ...(shippingOptions ? { shipping_options: shippingOptions } : {}),
    ...(isStripeTaxEnabled() ? { automatic_tax: { enabled: true } } : {}),
    payment_intent_data: {
      transfer_group: params.orderNumber,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  };

  const stripeSession = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `checkout:${params.orderId}`,
  });

  rememberStripeUrl(params.orderId, stripeSession.url);
  return stripeSession;
}

export async function createCheckoutSession(
  input: CheckoutRequestInput,
  caller: CallerIdentity
): Promise<CheckoutSessionResult> {
  assertStripeConfigured();
  const appBaseUrl = getAppBaseUrl();
  const { userId, anonId, cookieCartId } = caller;
  const callerTag = userId ?? anonId ?? cookieCartId ?? "guest";

  if ("cartId" in input) {
    const dedupKey = `cart:${callerTag}:${input.cartId}:${input.shippingCountry ?? ""}`;
    return withInFlightDedup(dedupKey, () =>
      executeCartCheckout(input, caller, appBaseUrl)
    );
  }

  const targetRef = input.personalizationVersionId ?? input.sessionId ?? "unknown";
  const dedupKey = `direct:${callerTag}:${targetRef}:${input.catalogVariantId ?? "digital"}:${input.placement}:${input.quantity}:${String(input.isDigital)}:${input.shippingCountry ?? ""}`;
  return withInFlightDedup(dedupKey, () =>
    executeDirectCheckout(input, caller, appBaseUrl)
  );
}

async function executeCartCheckout(
  input: z.infer<typeof CartCheckoutSchema>,
  caller: CallerIdentity,
  appBaseUrl: string
): Promise<CheckoutSessionResult> {
  const { userId, anonId, cookieCartId } = caller;

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
    const ownsByAnon = Boolean(anonId && cart.anonymousSessionId === anonId);
    const ownsByCookie = Boolean(
      cookieCartId && cookieCartId === cart.id && ownsByAnon
    );
    if (!ownsByUser && !ownsByAnon && !ownsByCookie) {
      throw new CheckoutHttpError(
        403,
        "Forbidden: cart does not belong to caller"
      );
    }
  }

  // Refuse before any money moves: a physical item must be made in-house (BRD v1.0 §10).
  assertPhysicalItemsMadeInHouse(cart.items.map((item) => item.catalogVariant));

  const reusable = await tryFindReusableCartOrder({
    cartId: cart.id,
    userId: userId ?? cart.userId ?? null,
    anonId: userId ? null : (anonId ?? cart.anonymousSessionId ?? null),
  });
  if (reusable) {
    return reusable;
  }

  const shippingCountry = resolveRequestedShippingCountry(input.shippingCountry);
  const itemQuotes: Array<{
    cartItem: (typeof cart.items)[number];
    quote: ItemQuote;
  }> = [];

  let totalPhysicalQty = 0;
  for (const ci of cart.items) {
    const quote = calculateItemQuote({
      isDigital: false,
      variant: ci.catalogVariant,
      placement: ci.placement,
      quantity: ci.quantity,
      isPersonalized: Boolean(ci.personalizationVersionId),
      licenseOffer: ci.licenseOffer,
    });
    totalPhysicalQty += ci.quantity;
    itemQuotes.push({ cartItem: ci, quote });
  }

  const orderShippingMinor = shippingCountry
    ? calculateFlatShippingMinor({
        countryCode: shippingCountry,
        physicalQuantity: totalPhysicalQty,
      })
    : 0n;

  const quoteExpiresAt = new Date(Date.now() + CHECKOUT_QUOTE_WINDOW_MS);

  const created = await prisma.$transaction(async (tx) => {
    const orderNumber = generateOrderNumber();

    let subtotalMinor = 0n;
    let artworkMinor = 0n;
    let personalizationMinor = 0n;
    let productMinor = 0n;
    let fulfillmentCostMinor = 0n;
    let creatorRoyaltyMinor = 0n;
    let platformMinor = 0n;
    const taxMinor = 0n;

    for (const { quote } of itemQuotes) {
      subtotalMinor += quote.subtotalMinor;
      artworkMinor += quote.artworkMinor;
      personalizationMinor += quote.personalizationMinor;
      productMinor += quote.productMinor;
      fulfillmentCostMinor += quote.fulfillmentCostMinor;
      creatorRoyaltyMinor += quote.creatorRoyaltyMinor;
      platformMinor += quote.platformMinor;
    }

    const totalMinor = subtotalMinor + orderShippingMinor + taxMinor;

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
        shippingMinor: orderShippingMinor,
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

      const optionLabel =
        cartItem.catalogVariant.product.sidePricing === "MULTIPLIER"
          ? quote.placement === "both" || quote.placement === "FRONT_AND_BACK"
            ? "Double-sided"
            : "Single-sided"
          : `Placement: ${quote.placement}`;
      const unitAmountMinor = minorToStripeAmount(
        quote.subtotalMinor / BigInt(quote.quantity)
      );
      stripeLines.push({
        name: `${cartItem.design.title} — ${cartItem.catalogVariant.product.name}`,
        description: [variantLabel, optionLabel]
          .filter((part): part is string => Boolean(part))
          .join(" · "),
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
        shippingMinor: orderShippingMinor,
        taxMinor,
        discountMinor: 0n,
        totalMinor,
        expiresAt: quoteExpiresAt,
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

  const stripeSession = await createStripeCheckoutSessionWithIdempotency({
    orderId: created.order.id,
    orderNumber: created.order.orderNumber,
    quoteExpiresAt,
    lines: created.stripeLines,
    isDigital: false,
    shippingMinor: orderShippingMinor,
    shippingCountry,
    successUrl,
    cancelUrl,
    metadata: {
      orderId: created.order.id,
      orderNumber: created.order.orderNumber,
      cartId: cart.id,
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

  return {
    url: stripeSession.url,
    orderId: created.order.id,
    orderNumber: created.order.orderNumber,
  };
}

async function executeDirectCheckout(
  input: z.infer<typeof DirectCheckoutSchema>,
  caller: CallerIdentity,
  appBaseUrl: string
): Promise<CheckoutSessionResult> {
  const { userId, anonId } = caller;

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
    const ownsByUser = Boolean(userId && resolvedSession.userId === userId);
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
  // Refuse before any money moves. A digital purchase has no variant and is not affected.
  assertPhysicalItemsMadeInHouse([variant]);

  const licenseOffer = input.licenseOfferId
    ? await prisma.licenseOffer.findUnique({
        where: { id: input.licenseOfferId },
      })
    : null;

  if (input.licenseOfferId && (!licenseOffer || !licenseOffer.active)) {
    throw new CheckoutHttpError(400, "Selected license offer is unavailable");
  }

  const shippingCountry = input.isDigital
    ? undefined
    : resolveRequestedShippingCountry(input.shippingCountry);

  const quote = calculateItemQuote({
    isDigital: input.isDigital,
    variant,
    placement: input.placement,
    quantity: input.quantity,
    isPersonalized: true,
    licenseOffer,
    shippingCountry,
  });

  // R-200: Reuse unexpired (<30 min) PENDING_PAYMENT order if buyer double-clicked or refreshed
  const reusable = await tryFindReusableDirectOrder({
    sessionId: resolvedSession.id,
    userId: userId ?? resolvedSession.userId ?? null,
    anonId: userId ? null : (anonId ?? resolvedSession.anonymousSessionId ?? null),
    expectedTotalMinor: quote.totalMinor,
    catalogVariantId: quote.isDigital ? null : (variant?.id ?? null),
    placement: quote.placement,
    quantity: quote.quantity,
  });
  if (reusable) {
    return reusable;
  }

  if (resolvedSession.status === "CHECKED_OUT" && !existingVersion) {
    throw new CheckoutHttpError(
      409,
      "Personalization session has already been checked out"
    );
  }

  const quoteExpiresAt = new Date(Date.now() + CHECKOUT_QUOTE_WINDOW_MS);

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
        totalMinor: quote.subtotalMinor,
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
        expiresAt: quoteExpiresAt,
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

  const unitAmountMinor = minorToStripeAmount(
    quote.subtotalMinor / BigInt(quote.quantity)
  );

  const stripeSession = await createStripeCheckoutSessionWithIdempotency({
    orderId: created.order.id,
    orderNumber: created.order.orderNumber,
    quoteExpiresAt,
    lines: [
      {
        name: `${created.designTitle} — ${created.productLabel}`,
        description: quote.isDigital
          ? "4500x5400 px @ 300 DPI Archival Print Master"
          : created.variantLabel || `Placement: ${quote.placement}`,
        unitAmountMinor,
        quantity: quote.quantity,
      },
    ],
    isDigital: quote.isDigital,
    shippingMinor: quote.shippingMinor,
    shippingCountry,
    successUrl,
    cancelUrl,
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

  return {
    url: stripeSession.url,
    orderId: created.order.id,
    orderNumber: created.order.orderNumber,
    personalizationVersionId: created.frozenPv.id,
  };
}

export async function createGalleryCheckoutSession(
  input: GalleryCheckoutInput,
  caller: Pick<CallerIdentity, "userId" | "anonId">
): Promise<CheckoutSessionResult> {
  assertStripeConfigured();
  const appBaseUrl = getAppBaseUrl();
  const callerTag = caller.userId ?? caller.anonId ?? "guest";
  const variantRef = input.catalogVariantId ?? input.variantId ?? "default";
  const dedupKey = `gallery:${callerTag}:${input.galleryItemId}:${variantRef}:${input.quantity}:${input.shippingCountry ?? ""}`;

  return withInFlightDedup(dedupKey, () =>
    executeGalleryCheckout(input, caller, appBaseUrl)
  );
}

async function executeGalleryCheckout(
  input: GalleryCheckoutInput,
  caller: Pick<CallerIdentity, "userId" | "anonId">,
  appBaseUrl: string
): Promise<CheckoutSessionResult> {
  const { userId, anonId } = caller;

  const galleryItem = await prisma.galleryItem.findUnique({
    where: { id: input.galleryItemId },
  });

  if (!galleryItem) {
    throw new CheckoutHttpError(404, "Gallery item not found");
  }

  if (!galleryItem.published || !galleryItem.purchasable) {
    throw new CheckoutHttpError(
      400,
      "This gallery item is currently unavailable for purchase"
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
      throw new CheckoutHttpError(
        400,
        "Selected catalog variant is invalid or inactive"
      );
    }
  } else if (galleryItem.requiresSize) {
    throw new CheckoutHttpError(400, "Size/Variant selection is required");
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

  // Refuse before any money moves. An item with no catalog variant is not a physical product.
  assertPhysicalItemsMadeInHouse([resolvedVariant]);

  const shippingCountry = resolveRequestedShippingCountry(input.shippingCountry);
  const quote = calculateGalleryItemQuote(galleryItem, resolvedVariant, {
    quantity: input.quantity,
    shippingCountry,
  });

  const reusable = await tryFindReusableGalleryOrder({
    galleryItemId: galleryItem.id,
    userId,
    anonId: userId ? null : anonId,
    expectedTotalMinor: quote.totalMinor,
    catalogVariantId: resolvedVariant?.id ?? null,
    quantity: quote.quantity,
  });
  if (reusable) {
    return reusable;
  }

  const quoteExpiresAt = new Date(Date.now() + CHECKOUT_QUOTE_WINDOW_MS);

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
        totalMinor: quote.subtotalMinor,
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
        expiresAt: quoteExpiresAt,
      },
    });

    return { order, variantLabel };
  });

  const unitAmountMinor = minorToStripeAmount(
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

  const stripeSession = await createStripeCheckoutSessionWithIdempotency({
    orderId: createdOrder.order.id,
    orderNumber: createdOrder.order.orderNumber,
    quoteExpiresAt,
    lines: [
      {
        name: galleryItem.title,
        description: createdOrder.variantLabel
          ? `${galleryItem.productName} (${createdOrder.variantLabel})`
          : galleryItem.productName,
        unitAmountMinor,
        quantity: quote.quantity,
        images: stripeImages,
      },
    ],
    isDigital: false,
    shippingMinor: quote.shippingMinor,
    shippingCountry,
    successUrl,
    cancelUrl,
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

  return {
    url: stripeSession.url,
    orderId: createdOrder.order.id,
    orderNumber: createdOrder.order.orderNumber,
  };
}
