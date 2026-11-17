import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import { adaptLegacyComposition } from "@/lib/print-generator";
import {
  PricingValidationError,
  calculateItemQuote,
  formatUsdMinor,
  type ItemQuote,
} from "@/lib/pricing/quote";
import {
  PlacementSchema,
  type DesignComposition,
  type PlacementValue,
} from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { createClient } from "@/utils/supabase/server";
import {
  CheckoutButton,
  type CheckoutRequestPayload,
} from "./CheckoutButton";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const ValidUuidSchema = z
  .string()
  .uuid()
  .refine((val) => val !== NIL_UUID, "Nil UUID is not allowed");

interface CheckoutSearchParams {
  cartId?: string;
  personalizationVersionId?: string;
  sessionId?: string;
  variantId?: string;
  catalogVariantId?: string;
  product?: string;
  placement?: string;
  digital?: string;
  licenseOfferId?: string;
  quantity?: string;
}

interface FrozenLicenseDisplay {
  licenseLabel: string;
  versionLabel: string;
  permissions: Array<{ label: string; allowed: boolean }>;
}

interface CheckoutLineDisplay {
  id: string;
  designTitle: string;
  productTitle: string;
  variantBadge: string;
  placementLabel: string;
  quantity: number;
  isDigital: boolean;
  previewSvgUri: string | null;
  mockupUrl: string | null;
  inputPhrase: string;
  renderedPhrase: string;
  interpretationType: string;
  romanization: string | null;
  meaning: string | null;
  quote: ItemQuote;
}

async function resolveCaller(): Promise<{
  userId: string | null;
  anonId: string | null;
  cookieCartId: string | undefined;
}> {
  const cookieStore = await cookies();
  const cookieCartId = cookieStore.get("tb_cart_id")?.value;
  const anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );

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

function buildPreviewSvgFromSnapshot(
  rawSnapshot: unknown,
  fallbackText: string
): {
  svgUri: string;
  renderedText: string;
} {
  let parsedComp: DesignComposition | null = null;
  if (rawSnapshot !== null && rawSnapshot !== undefined) {
    try {
      parsedComp = adaptLegacyComposition(rawSnapshot);
    } catch {
      parsedComp = null;
    }
  }

  const calLayer = parsedComp?.layers.find((l) => l.type === "calligraphy");
  const sealLayer = parsedComp?.layers.find((l) => l.type === "seal");
  const renderedText = calLayer?.text || fallbackText || "Thi Bút";
  const fontFamily = calLayer?.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY;
  const layout = calLayer?.layout || "VERTICAL";
  const inkColor = calLayer?.colorHex || parsedComp?.color || "#121212";

  const svgUri = generateInstantSvgUri({
    text: renderedText,
    fontFamily,
    layout,
    inkColor,
    hasSeal: Boolean(sealLayer),
    sealText: sealLayer?.sealText,
    sealFontFamily: sealLayer?.fontFamily,
  });

  return { svgUri, renderedText };
}

function extractStringField(
  record: unknown,
  key: string
): string | null {
  if (typeof record !== "object" || record === null) {
    return null;
  }
  const val = (record as Record<string, unknown>)[key];
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
}

function formatPlacementBadge(placement: PlacementValue): string {
  switch (placement) {
    case "back":
    case "BACK_CENTER":
      return "Back Center";
    case "both":
    case "FRONT_AND_BACK":
      return "Front & Back";
    case "left_chest":
    case "LEFT_CHEST":
      return "Left Chest";
    default:
      return "Front Center";
  }
}

function buildLicenseDisplay(options: {
  isDigital: boolean;
  designVersionNumber?: number;
  licenseOffer?: {
    type: string;
    termsVersion: number;
    allowCommercialUse: boolean;
    allowDigitalDownload: boolean;
    allowResale: boolean;
  } | null;
  policy?: {
    allowName: boolean;
    allowQuote: boolean;
    allowTranslation: boolean;
    allowCalligraphy: boolean;
    allowAIRestyle: boolean;
    allowCommercialUse: boolean;
  } | null;
}): FrozenLicenseDisplay {
  const { isDigital, designVersionNumber = 1, licenseOffer, policy } = options;

  const allowCommercial = Boolean(
    (licenseOffer?.allowCommercialUse ?? false) &&
      (policy?.allowCommercialUse ?? false)
  );
  const allowDigital =
    isDigital || Boolean(licenseOffer?.allowDigitalDownload ?? false);

  const licenseTypeLabel = licenseOffer
    ? licenseOffer.type.replace(/_/g, " ")
    : isDigital
      ? "PERSONAL DIGITAL LICENSE"
      : "PERSONAL PRODUCT LICENSE";

  return {
    licenseLabel: licenseTypeLabel,
    versionLabel: `Design v${designVersionNumber}.0 · Terms v${licenseOffer?.termsVersion ?? 1}`,
    permissions: [
      { label: "Name Personalization", allowed: policy?.allowName ?? true },
      { label: "Quote Personalization", allowed: policy?.allowQuote ?? true },
      {
        label: "Cultural Translation",
        allowed: policy?.allowTranslation ?? true,
      },
      {
        label: "Controlled Brush Vector",
        allowed: policy?.allowCalligraphy ?? true,
      },
      { label: "300 DPI Digital Download", allowed: allowDigital },
      { label: "Commercial Reproduction", allowed: allowCommercial },
      { label: "Marketplace Resale", allowed: licenseOffer?.allowResale ?? false },
      { label: "AI Model Training (INV-010)", allowed: false },
    ],
  };
}

function EmptyCheckoutView({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased">
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-16 h-16 bg-surface-container-low border border-surface-variant flex items-center justify-center">
          <ShoppingBag className="w-7 h-7 text-on-surface-variant" />
        </div>
        <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background">
          {title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/create"
            className="bg-primary text-on-primary px-8 py-4 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors"
          >
            Open Calligraphy Studio
          </Link>
          <Link
            href="/cart"
            className="border border-outline-variant text-on-background px-8 py-4 font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors"
          >
            View Cart
          </Link>
        </div>
      </main>
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<CheckoutSearchParams>;
}) {
  const params = await searchParams;
  const { userId, anonId, cookieCartId } = await resolveCaller();

  let lines: CheckoutLineDisplay[] = [];
  let licenseDisplay: FrozenLicenseDisplay | null = null;
  let checkoutPayload: CheckoutRequestPayload | null = null;
  let backHref = "/cart";
  let backLabel = "Back to Cart";

  // ─────────────────────────────────────────────────────────────────────────
  // PATH 1: Cart Checkout (?cartId=<uuid>)
  // ─────────────────────────────────────────────────────────────────────────
  const parsedCartId = params.cartId
    ? ValidUuidSchema.safeParse(params.cartId)
    : null;

  if (parsedCartId?.success) {
    const cart = await prisma.cart.findUnique({
      where: { id: parsedCartId.data },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            design: {
              include: {
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
                mockups: {
                  include: { asset: true },
                  take: 1,
                },
              },
            },
            licenseOffer: true,
            personalizationVersion: {
              include: {
                session: {
                  include: {
                    interpretations: {
                      orderBy: { createdAt: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0 || cart.status === "CONVERTED") {
      return (
        <EmptyCheckoutView
          title="Your Cart Is Empty"
          message="There are no active items ready for checkout in this cart. Create a custom calligraphy piece in the Studio to begin."
        />
      );
    }

    if (cart.userId || cart.anonymousSessionId) {
      const ownsByUser = Boolean(userId && cart.userId === userId);
      const ownsByAnon = Boolean(
        anonId && cart.anonymousSessionId === anonId
      );
      const ownsByCookie = Boolean(
        cookieCartId && cookieCartId === cart.id && ownsByAnon
      );
      if (!ownsByUser && !ownsByAnon && !ownsByCookie) {
        return (
          <EmptyCheckoutView
            title="Session Unavailable"
            message="This cart belongs to a different browser session. Please return to your active cart."
          />
        );
      }
    }

    try {
      for (const ci of cart.items) {
        const quote = calculateItemQuote({
          isDigital: false,
          variant: ci.catalogVariant,
          placement: ci.placement,
          quantity: ci.quantity,
          isPersonalized: Boolean(ci.personalizationVersionId),
          licenseOffer: ci.licenseOffer,
        });

        const pv = ci.personalizationVersion;
        const latestInterp = pv?.session?.interpretations[0] ?? null;
        const inputText =
          extractStringField(pv?.inputSnapshot, "text") ??
          pv?.session?.inputText ??
          ci.design.title;

        const { svgUri, renderedText } = buildPreviewSvgFromSnapshot(
          pv?.styleSnapshot,
          inputText
        );

        const variantParts = [ci.catalogVariant.color, ci.catalogVariant.size]
          .filter((v): v is string => Boolean(v))
          .join(" · ");

        const mockupUrl =
          ci.catalogVariant.mockups[0]?.asset?.objectKey ?? null;

        lines.push({
          id: ci.id,
          designTitle: `“${inputText}” — ${ci.design.title}`,
          productTitle: ci.catalogVariant.product.name,
          variantBadge: variantParts || ci.catalogVariant.sku,
          placementLabel: formatPlacementBadge(quote.placement),
          quantity: quote.quantity,
          isDigital: false,
          previewSvgUri: svgUri,
          mockupUrl,
          inputPhrase: inputText,
          renderedPhrase:
            extractStringField(pv?.interpretationSnapshot, "text") ??
            latestInterp?.text ??
            renderedText,
          interpretationType:
            extractStringField(pv?.interpretationSnapshot, "tradition") ??
            latestInterp?.type ??
            "Controlled Brush Calligraphy",
          romanization:
            extractStringField(pv?.interpretationSnapshot, "romanization") ??
            latestInterp?.romanization ??
            null,
          meaning:
            extractStringField(pv?.interpretationSnapshot, "meaning") ??
            latestInterp?.meaning ??
            null,
          quote,
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof PricingValidationError
          ? err.message
          : "One or more cart items are no longer available for fulfillment.";
      return (
        <EmptyCheckoutView title="Item Unavailable" message={msg} />
      );
    }

    const primaryItem = cart.items[0];
    licenseDisplay = buildLicenseDisplay({
      isDigital: false,
      designVersionNumber: primaryItem.designVersion.versionNumber,
      licenseOffer: primaryItem.licenseOffer,
      policy: primaryItem.design.policyVersions[0] ?? null,
    });
    checkoutPayload = { cartId: cart.id };
  } else {
    // ───────────────────────────────────────────────────────────────────────
    // PATH 2: Direct Personalization Checkout (?sessionId= | ?personalizationVersionId=)
    // ───────────────────────────────────────────────────────────────────────
    const parsedPvId = params.personalizationVersionId
      ? ValidUuidSchema.safeParse(params.personalizationVersionId)
      : null;
    const parsedSessionId = params.sessionId
      ? ValidUuidSchema.safeParse(params.sessionId)
      : null;

    if (!parsedPvId?.success && !parsedSessionId?.success) {
      return (
        <EmptyCheckoutView
          title="No Active Checkout Session"
          message="Select a personalized calligraphy piece in the Studio or review your cart before proceeding to payment."
        />
      );
    }

    const existingPv = parsedPvId?.success
      ? await prisma.personalizationVersion.findUnique({
          where: { id: parsedPvId.data },
          include: {
            designVersion: {
              include: {
                design: {
                  include: {
                    policyVersions: {
                      orderBy: { versionNumber: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
            session: {
              include: {
                design: {
                  include: {
                    versions: {
                      orderBy: { versionNumber: "desc" },
                      take: 1,
                    },
                    policyVersions: {
                      orderBy: { versionNumber: "desc" },
                      take: 1,
                    },
                  },
                },
                interpretations: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        })
      : null;

    const resolvedSession =
      existingPv?.session ??
      (parsedSessionId?.success
        ? await prisma.personalizationSession.findUnique({
            where: { id: parsedSessionId.data },
            include: {
              design: {
                include: {
                  versions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                  },
                  policyVersions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                  },
                },
              },
              interpretations: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          })
        : null);

    if (!resolvedSession) {
      return (
        <EmptyCheckoutView
          title="Personalization Session Not Found"
          message="We could not locate this calligraphy session. Please start a fresh session in the Studio."
        />
      );
    }

    if (resolvedSession.userId || resolvedSession.anonymousSessionId) {
      const ownsByUser = Boolean(
        userId && resolvedSession.userId === userId
      );
      const ownsByAnon = Boolean(
        anonId && resolvedSession.anonymousSessionId === anonId
      );
      if (!ownsByUser && !ownsByAnon) {
        return (
          <EmptyCheckoutView
            title="Unauthorized Session"
            message="This personalization session belongs to a different visitor."
          />
        );
      }
    }

    const isDigital =
      params.digital === "true" ||
      params.digital === "1" ||
      Boolean(params.product?.toLowerCase().includes("digital"));

    const parsedPlacement = PlacementSchema.safeParse(
      params.placement ?? "front"
    );
    const placement: PlacementValue = parsedPlacement.success
      ? parsedPlacement.data
      : "front";

    const parsedQuantity = Number.parseInt(params.quantity ?? "1", 10);
    const quantity =
      Number.isInteger(parsedQuantity) &&
      parsedQuantity >= 1 &&
      parsedQuantity <= 100
        ? parsedQuantity
        : 1;

    const requestedVariantId =
      params.catalogVariantId?.trim() || params.variantId?.trim();

    let resolvedVariant = null;
    if (!isDigital) {
      if (requestedVariantId) {
        resolvedVariant = await prisma.catalogVariant.findUnique({
          where: { id: requestedVariantId },
          include: {
            product: true,
            providerVariants: true,
            mockups: {
              include: { asset: true },
              take: 1,
            },
          },
        });
      } else if (params.product) {
        const matchedProduct = await prisma.catalogProduct.findFirst({
          where: {
            status: "ACTIVE",
            OR: [{ id: params.product }, { name: params.product }],
          },
          include: {
            variants: {
              where: { active: true },
              take: 1,
              include: {
                product: true,
                providerVariants: true,
                mockups: {
                  include: { asset: true },
                  take: 1,
                },
              },
            },
          },
        });
        resolvedVariant = matchedProduct?.variants[0] ?? null;
      }

      if (!resolvedVariant || !resolvedVariant.active) {
        return (
          <EmptyCheckoutView
            title="Product Variant Required"
            message="Please choose an active product size and color in the Studio before proceeding to physical merchandise checkout."
          />
        );
      }
    }

    const parsedLicenseId = params.licenseOfferId
      ? ValidUuidSchema.safeParse(params.licenseOfferId)
      : null;
    const licenseOffer = parsedLicenseId?.success
      ? await prisma.licenseOffer.findUnique({
          where: { id: parsedLicenseId.data },
        })
      : null;

    let quote: ItemQuote;
    try {
      quote = calculateItemQuote({
        isDigital,
        variant: resolvedVariant,
        placement,
        quantity,
        isPersonalized: true,
        licenseOffer,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof PricingValidationError
          ? err.message
          : "Unable to compute authoritative pricing for the selected item.";
      return <EmptyCheckoutView title="Pricing Unavailable" message={msg} />;
    }

    const rawSnapshot =
      existingPv?.styleSnapshot ?? resolvedSession.compositionJson;
    const inputPhrase =
      extractStringField(existingPv?.inputSnapshot, "text") ??
      resolvedSession.inputText;
    const latestInterp = resolvedSession.interpretations[0] ?? null;
    const { svgUri, renderedText } = buildPreviewSvgFromSnapshot(
      rawSnapshot,
      inputPhrase
    );

    const variantBadge = isDigital
      ? "4500×5400 px · 300 DPI PNG"
      : [resolvedVariant?.color, resolvedVariant?.size]
          .filter((v): v is string => Boolean(v))
          .join(" · ") || resolvedVariant?.sku || "Standard";

    const resolvedDesign =
      existingPv?.designVersion?.design ?? resolvedSession.design ?? null;
    const resolvedDesignVersionNumber =
      existingPv?.designVersion?.versionNumber ??
      resolvedSession.design?.versions[0]?.versionNumber ??
      1;

    lines = [
      {
        id: existingPv?.id ?? resolvedSession.id,
        designTitle: `“${inputPhrase}” Calligraphy`,
        productTitle: isDigital
          ? "High-Res Digital Master (300 DPI)"
          : (resolvedVariant?.product.name ?? "Custom Merchandise"),
        variantBadge,
        placementLabel: isDigital
          ? "Digital Master"
          : formatPlacementBadge(quote.placement),
        quantity: quote.quantity,
        isDigital,
        previewSvgUri: svgUri,
        mockupUrl: isDigital
          ? null
          : (resolvedVariant?.mockups[0]?.asset?.objectKey ?? null),
        inputPhrase,
        renderedPhrase:
          extractStringField(existingPv?.interpretationSnapshot, "text") ??
          latestInterp?.text ??
          renderedText,
        interpretationType:
          extractStringField(existingPv?.interpretationSnapshot, "tradition") ??
          latestInterp?.type ??
          (resolvedSession.culturalStyle ?? "VIETNAMESE_THU_PHAP").replace(
            /_/g,
            " "
          ),
        romanization:
          extractStringField(
            existingPv?.interpretationSnapshot,
            "romanization"
          ) ??
          latestInterp?.romanization ??
          null,
        meaning:
          extractStringField(existingPv?.interpretationSnapshot, "meaning") ??
          latestInterp?.meaning ??
          null,
        quote,
      },
    ];

    licenseDisplay = buildLicenseDisplay({
      isDigital,
      designVersionNumber: resolvedDesignVersionNumber,
      licenseOffer,
      policy: resolvedDesign?.policyVersions[0] ?? null,
    });

    checkoutPayload = {
      ...(existingPv
        ? { personalizationVersionId: existingPv.id }
        : { sessionId: resolvedSession.id }),
      ...(isDigital
        ? { isDigital: true }
        : {
            isDigital: false,
            catalogVariantId: resolvedVariant!.id,
            placement: quote.placement,
          }),
      ...(licenseOffer ? { licenseOfferId: licenseOffer.id } : {}),
      quantity: quote.quantity,
    };

    backHref = `/create/${resolvedSession.id}`;
    backLabel = "Return to Studio";
  }

  // Aggregate authoritative BigInt totals across lines (INV-006)
  let artworkTotalMinor = 0n;
  let personalizationTotalMinor = 0n;
  let productTotalMinor = 0n;
  let shippingTotalMinor = 0n;
  let taxTotalMinor = 0n;
  let grandTotalMinor = 0n;

  for (const line of lines) {
    artworkTotalMinor += line.quote.artworkMinor;
    personalizationTotalMinor += line.quote.personalizationMinor;
    productTotalMinor += line.quote.productMinor;
    shippingTotalMinor += line.quote.shippingMinor;
    taxTotalMinor += line.quote.taxMinor;
    grandTotalMinor += line.quote.totalMinor;
  }

  const allDigital = lines.every((l) => l.isDigital);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased">
      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-10">
        {/* Header */}
        <header className="border-b border-surface-variant pb-6 flex flex-col gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-on-background transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
            Secure Checkout
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Review your frozen calligraphy composition, license terms, and
            server-verified pricing before payment.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* LEFT — Line Items + Cultural Meaning (INV-011) + Frozen License (INV-003/004) */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            {lines.map((line) => (
              <section
                key={line.id}
                className="border border-surface-variant bg-surface-container-lowest p-6 md:p-8 flex flex-col gap-6"
              >
                {/* Product & Artwork Preview */}
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-32 h-32 bg-surface-container-low border border-surface-variant overflow-hidden shrink-0 relative flex items-center justify-center">
                    {line.mockupUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.mockupUrl}
                        alt={line.productTitle}
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                    )}
                    {line.previewSvgUri && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={line.previewSvgUri}
                        alt={line.renderedPhrase}
                        className={
                          line.mockupUrl
                            ? "absolute inset-0 m-auto w-3/5 h-3/5 object-contain pointer-events-none select-none"
                            : "w-4/5 h-4/5 object-contain pointer-events-none select-none"
                        }
                      />
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-headline-sm text-headline-sm text-on-background">
                          {line.designTitle}
                        </h2>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                          {line.productTitle}
                        </p>
                      </div>
                      <span className="font-headline-sm text-headline-sm text-on-background shrink-0">
                        {formatUsdMinor(line.quote.subtotalMinor)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-2.5 py-1 bg-surface-container-low border border-surface-variant font-label-caps text-[11px] uppercase text-on-background">
                        {line.variantBadge}
                      </span>
                      <span className="px-2.5 py-1 bg-surface-container-low border border-surface-variant font-label-caps text-[11px] uppercase text-on-background">
                        {line.placementLabel}
                      </span>
                      <span className="px-2.5 py-1 bg-surface-container-low border border-surface-variant font-label-caps text-[11px] uppercase text-on-background">
                        Qty: {line.quantity}
                      </span>
                    </div>

                    <p className="font-label-caps text-[11px] uppercase text-on-surface-variant pt-1 flex items-center gap-1.5">
                      {line.isDigital ? (
                        <>
                          <Download className="w-3.5 h-3.5 text-secondary" />
                          <span>Instant 4500×5400 px @ 300 DPI Master</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          <span>Print-Ready 4500×5400 px @ 300 DPI Master</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Separate Cultural Meaning & Romanization Panel (INV-011) */}
                <div className="border-t border-surface-variant pt-5 flex flex-col gap-2">
                  <span className="font-label-caps text-[11px] uppercase text-on-surface-variant tracking-wider">
                    Cultural Meaning &amp; Romanization
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container-low border border-surface-variant p-4">
                    <div>
                      <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                        Input Phrase
                      </p>
                      <p className="font-body-md text-body-md text-on-background">
                        &ldquo;{line.inputPhrase}&rdquo;
                      </p>
                    </div>
                    <div>
                      <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                        Calligraphy Script ({line.interpretationType})
                      </p>
                      <p className="font-body-md text-body-md text-on-background">
                        {line.renderedPhrase}
                      </p>
                    </div>
                    {line.romanization && (
                      <div>
                        <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                          Romanization
                        </p>
                        <p className="font-body-md text-body-md text-on-background">
                          {line.romanization}
                        </p>
                      </div>
                    )}
                    {line.meaning && (
                      <div className="sm:col-span-2">
                        <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                          Cultural Meaning
                        </p>
                        <p className="font-body-md text-body-md text-on-surface-variant italic">
                          &ldquo;{line.meaning}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}

            {/* Frozen License Terms Card (INV-003 + INV-004 + INV-010) */}
            {licenseDisplay && (
              <section className="border border-surface-variant bg-surface-container-lowest p-6 md:p-8 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4 border-b border-surface-variant pb-4">
                  <div>
                    <h2 className="font-headline-sm text-headline-sm text-on-background">
                      {licenseDisplay.licenseLabel}
                    </h2>
                    <p className="font-label-caps text-[11px] uppercase text-on-surface-variant mt-1">
                      {licenseDisplay.versionLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant shrink-0">
                    <Lock className="w-4 h-4" />
                    <span className="font-label-caps text-[10px] uppercase">
                      Immutable Snapshot
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {licenseDisplay.permissions.map((perm) => (
                    <div key={perm.label} className="flex items-center gap-2.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          perm.allowed
                            ? "bg-primary"
                            : "bg-surface-container-highest"
                        }`}
                      />
                      <span
                        className={`font-label-caps text-[11px] uppercase ${
                          perm.allowed ? "text-on-background" : "text-outline"
                        }`}
                      >
                        {perm.label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT — Authoritative Server Price Quote + Stripe Action */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-8">
            <section className="border border-surface-variant bg-surface-container-lowest p-6 md:p-8 flex flex-col gap-5">
              <h2 className="font-headline-sm text-headline-sm text-on-background">
                Order Summary
              </h2>

              <div className="flex flex-col gap-3 border-b border-surface-variant pb-5">
                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    Artwork License Royalty
                  </span>
                  <span className="font-body-md text-body-md text-on-background">
                    {formatUsdMinor(artworkTotalMinor)}
                  </span>
                </div>

                {personalizationTotalMinor > 0n && (
                  <div className="flex justify-between items-center">
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      AI &amp; Brush Personalization
                    </span>
                    <span className="font-body-md text-body-md text-on-background">
                      {formatUsdMinor(personalizationTotalMinor)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="font-body-md text-body-md text-on-surface-variant">
                    {allDigital
                      ? "High-Res Digital Master (300 DPI)"
                      : "Merchandise & Print Production"}
                  </span>
                  <span className="font-body-md text-body-md text-on-background">
                    {formatUsdMinor(productTotalMinor)}
                  </span>
                </div>

                {shippingTotalMinor > 0n && (
                  <div className="flex justify-between items-center">
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      Shipping
                    </span>
                    <span className="font-body-md text-body-md text-on-background">
                      {formatUsdMinor(shippingTotalMinor)}
                    </span>
                  </div>
                )}

                {taxTotalMinor > 0n && (
                  <div className="flex justify-between items-center">
                    <span className="font-body-md text-body-md text-on-surface-variant">
                      Estimated Tax
                    </span>
                    <span className="font-body-md text-body-md text-on-background">
                      {formatUsdMinor(taxTotalMinor)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline">
                <span className="font-headline-sm text-headline-sm text-on-background">
                  Total (USD)
                </span>
                <span className="font-headline-md text-headline-md text-secondary">
                  {formatUsdMinor(grandTotalMinor)}
                </span>
              </div>

              {checkoutPayload && <CheckoutButton payload={checkoutPayload} />}

              <div className="flex items-center justify-center gap-2 text-on-surface-variant pt-1">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="font-label-caps text-[11px] uppercase">
                  Stripe Encrypted · Server-Verified Quote
                </span>
              </div>

              <p className="font-label-caps text-[11px] text-on-surface-variant text-center leading-relaxed">
                By completing this purchase, your personalization version and
                license terms are permanently frozen on your order record and
                cannot be altered after checkout.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
