import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import { DEFAULT_INK_HEX } from "@/lib/studio/inkPalette";
import {
  PricingValidationError,
  calculateFlatShippingMinor,
  calculateItemQuote,
  type ItemQuote,
} from "@/lib/pricing/quote";
import {
  PlacementSchema,
  adaptLegacyComposition,
  type DesignComposition,
  type PlacementValue,
} from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { createClient } from "@/utils/supabase/server";
import type { CheckoutRequestPayload } from "./CheckoutButton";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const ValidUuidSchema = z
  .string()
  .uuid()
  .refine((val) => val !== NIL_UUID, "Nil UUID is not allowed");

export interface CheckoutSearchParams {
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

export interface FrozenLicenseDisplay {
  licenseLabel: string;
  versionLabel: string;
  permissions: Array<{ label: string; allowed: boolean }>;
}

export interface CheckoutLineDisplay {
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

export type CheckoutLoadResult =
  | {
      status: "empty";
      title: string;
      message: string;
    }
  | {
      status: "ready";
      lines: CheckoutLineDisplay[];
      shippingMinor: bigint;
      licenseDisplay: FrozenLicenseDisplay | null;
      checkoutPayload: CheckoutRequestPayload | null;
      backHref: string;
      backLabel: string;
    };

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
  const inkColor = calLayer?.colorHex || parsedComp?.color || DEFAULT_INK_HEX;

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

function extractStringField(record: unknown, key: string): string | null {
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

export async function loadCheckoutViewData(
  params: CheckoutSearchParams
): Promise<CheckoutLoadResult> {
  const { userId, anonId, cookieCartId } = await resolveCaller();

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
      return {
        status: "empty",
        title: "Your Cart Is Empty",
        message:
          "There are no active items ready for checkout in this cart. Create a custom calligraphy piece in the Studio to begin.",
      };
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
        return {
          status: "empty",
          title: "Session Unavailable",
          message:
            "This cart belongs to a different browser session. Please return to your active cart.",
        };
      }
    }

    const lines: CheckoutLineDisplay[] = [];
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

        lines.push({
          id: ci.id,
          designTitle: `“${inputText}” — ${ci.design.title}`,
          productTitle: ci.catalogVariant.product.name,
          variantBadge: variantParts || ci.catalogVariant.sku,
          placementLabel: formatPlacementBadge(quote.placement),
          quantity: quote.quantity,
          isDigital: false,
          previewSvgUri: svgUri,
          mockupUrl: ci.catalogVariant.mockups[0]?.asset?.objectKey ?? null,
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
      return {
        status: "empty",
        title: "Item Unavailable",
        message:
          err instanceof PricingValidationError
            ? err.message
            : "One or more cart items are no longer available for fulfillment.",
      };
    }

    const totalPhysicalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
    const cartShippingMinor = calculateFlatShippingMinor({
      countryCode: "US",
      physicalQuantity: totalPhysicalQty,
    });
    const primaryItem = cart.items[0]!;
    return {
      status: "ready",
      lines,
      shippingMinor: cartShippingMinor,
      licenseDisplay: buildLicenseDisplay({
        isDigital: false,
        designVersionNumber: primaryItem.designVersion.versionNumber,
        licenseOffer: primaryItem.licenseOffer,
        policy: primaryItem.design.policyVersions[0] ?? null,
      }),
      checkoutPayload: { cartId: cart.id },
      backHref: "/cart",
      backLabel: "Back to Cart",
    };
  }

  const parsedPvId = params.personalizationVersionId
    ? ValidUuidSchema.safeParse(params.personalizationVersionId)
    : null;
  const parsedSessionId = params.sessionId
    ? ValidUuidSchema.safeParse(params.sessionId)
    : null;

  if (!parsedPvId?.success && !parsedSessionId?.success) {
    return {
      status: "empty",
      title: "No Active Checkout Session",
      message:
        "Select a personalized calligraphy piece in the Studio or review your cart before proceeding to payment.",
    };
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
    return {
      status: "empty",
      title: "Personalization Session Not Found",
      message:
        "We could not locate this calligraphy session. Please start a fresh session in the Studio.",
    };
  }

  if (resolvedSession.userId || resolvedSession.anonymousSessionId) {
    const ownsByUser = Boolean(userId && resolvedSession.userId === userId);
    const ownsByAnon = Boolean(
      anonId && resolvedSession.anonymousSessionId === anonId
    );
    if (!ownsByUser && !ownsByAnon) {
      return {
        status: "empty",
        title: "Unauthorized Session",
        message: "This personalization session belongs to a different visitor.",
      };
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
      return {
        status: "empty",
        title: "Product Variant Required",
        message:
          "Please choose an active product size and color in the Studio before proceeding to physical merchandise checkout.",
      };
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
      ...(isDigital ? {} : { shippingCountry: "US" }),
    });
  } catch (err: unknown) {
    return {
      status: "empty",
      title: "Pricing Unavailable",
      message:
        err instanceof PricingValidationError
          ? err.message
          : "Unable to compute authoritative pricing for the selected item.",
    };
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
        .join(" · ") ||
      resolvedVariant?.sku ||
      "Standard";

  const resolvedDesign =
    existingPv?.designVersion?.design ?? resolvedSession.design ?? null;
  const resolvedDesignVersionNumber =
    existingPv?.designVersion?.versionNumber ??
    resolvedSession.design?.versions[0]?.versionNumber ??
    1;

  return {
    status: "ready",
    lines: [
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
    ],
    shippingMinor: quote.shippingMinor,
    licenseDisplay: buildLicenseDisplay({
      isDigital,
      designVersionNumber: resolvedDesignVersionNumber,
      licenseOffer,
      policy: resolvedDesign?.policyVersions[0] ?? null,
    }),
    checkoutPayload: {
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
    },
    backHref: `/create/${resolvedSession.id}`,
    backLabel: "Return to Studio",
  };
}
