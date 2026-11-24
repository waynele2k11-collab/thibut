import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import {
  ArrowRight,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import {
  calculateFlatShippingMinor,
  formatUsdMinor,
} from "@/lib/pricing/quote";
import { adaptLegacyComposition } from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { DEFAULT_INK_HEX } from "@/lib/studio/inkPalette";
import { createClient } from "@/utils/supabase/server";
import {
  removeFromCartFormAction,
  updateCartItemQuantityFormAction,
} from "@/app/actions/cart";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review your personalized calligraphy art before checkout.",
  robots: { index: false, follow: false },
};

const CART_ID_COOKIE = "tb_cart_id";

function extractInputPhrase(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const rec = snapshot as Record<string, unknown>;
  if (typeof rec.text === "string" && rec.text.trim().length > 0) {
    return rec.text.trim();
  }
  if (typeof rec.inputText === "string" && rec.inputText.trim().length > 0) {
    return rec.inputText.trim();
  }
  return null;
}

function renderCartPreviewUri(
  styleSnapshot: unknown,
  fallbackPhrase: string
): string {
  try {
    if (styleSnapshot) {
      const comp = adaptLegacyComposition(styleSnapshot);
      const calLayer = comp.layers.find((l) => l.type === "calligraphy");
      const sealLayer = comp.layers.find((l) => l.type === "seal");
      return generateInstantSvgUri({
        text: calLayer?.text || fallbackPhrase || "Thi Bút",
        fontFamily: calLayer?.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        layout: calLayer?.layout || "VERTICAL",
        inkColor: calLayer?.colorHex || comp.color || DEFAULT_INK_HEX,
        hasSeal: Boolean(sealLayer),
        sealText: sealLayer?.sealText,
        sealFontFamily: sealLayer?.fontFamily,
      });
    }
  } catch {
    // Fallback to clean default calligraphy vector
  }
  return generateInstantSvgUri({
    text: fallbackPhrase || "Thi Bút",
    fontFamily: DEFAULT_CALLIGRAPHY_FONT_FAMILY,
    layout: "VERTICAL",
    inkColor: DEFAULT_INK_HEX,
    hasSeal: true,
  });
}

async function resolveCallerIds(): Promise<{
  userId: string | null;
  anonId: string | null;
  cookieCartId: string | undefined;
}> {
  const cookieStore = await cookies();
  const cookieCartId = cookieStore.get(CART_ID_COOKIE)?.value;
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

type ActiveCartWithItems = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        design: true;
        catalogVariant: {
          include: { product: true };
        };
        personalizationVersion: true;
      };
    };
  };
}>;

export default async function CartPage() {
  const { userId, anonId, cookieCartId } = await resolveCallerIds();

  let activeCart: ActiveCartWithItems | null = null;

  if (userId || anonId) {
    try {
      if (cookieCartId) {
        const candidate = await prisma.cart.findUnique({
          where: { id: cookieCartId },
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              include: {
                design: true,
                catalogVariant: {
                  include: { product: true },
                },
                personalizationVersion: true,
              },
            },
          },
        });
        if (candidate && candidate.status === "ACTIVE") {
          const matchesUser = Boolean(userId && candidate.userId === userId);
          const matchesAnon = Boolean(
            !userId && anonId && candidate.anonymousSessionId === anonId
          );
          if (matchesUser || matchesAnon) {
            activeCart = candidate;
          }
        }
      }

      if (!activeCart) {
        activeCart = await prisma.cart.findFirst({
          where: userId
            ? { userId, status: "ACTIVE" }
            : { anonymousSessionId: anonId, status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          include: {
            items: {
              orderBy: { createdAt: "asc" },
              include: {
                design: true,
                catalogVariant: {
                  include: { product: true },
                },
                personalizationVersion: true,
              },
            },
          },
        });
      }
    } catch {
      activeCart = null;
    }
  }

  const cartItems = activeCart?.items ?? [];

  if (!activeCart || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-16">
        <div className="w-20 h-20 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center mb-6">
          <ShoppingBag className="w-8 h-8 text-on-surface-variant" aria-hidden="true" />
        </div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Your cart is empty
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8 text-center max-w-md">
          Custom keepsakes are ordered by email, so nothing is added here.
          See how a custom order works or browse the sample designs.
        </p>
        <Link
          href="/custom"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors duration-300 motion-reduce:transition-none"
        >
          Start a Custom Order <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <div className="mt-5 flex items-center gap-6">
          <Link
            href="/gallery"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary underline underline-offset-4"
          >
            Browse Gallery
          </Link>
          <Link
            href="/orders"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary underline underline-offset-4"
          >
            View Past Orders
          </Link>
        </div>
      </div>
    );
  }

  let artworkTotalMinor = 0n;
  let personalizationTotalMinor = 0n;
  let productTotalMinor = 0n;
  let subtotalMinor = 0n;
  let totalUnits = 0;

  for (const item of cartItems) {
    const qty = BigInt(item.quantity);
    artworkTotalMinor += item.unitArtworkMinor * qty;
    personalizationTotalMinor += item.unitPersonalizationMinor * qty;
    productTotalMinor += item.unitProductMinor * qty;
    const unitMinor =
      item.unitArtworkMinor +
      item.unitPersonalizationMinor +
      item.unitProductMinor;
    subtotalMinor += unitMinor * qty;
    totalUnits += item.quantity;
  }

  const estimatedUsShippingMinor = calculateFlatShippingMinor({
    countryCode: "US",
    physicalQuantity: totalUnits,
  });
  const estimatedGrandTotalMinor = subtotalMinor + estimatedUsShippingMinor;

  return (
    <div className="min-h-screen bg-background text-on-background">
      <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop pt-14 pb-28">
        <header className="border-b border-surface-variant pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-primary">
              Your Cart
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {totalUnits} {totalUnits === 1 ? "item" : "items"} ready for 300 DPI archival production
            </p>
          </div>
          <Link
            href="/custom"
            className="font-label-caps text-label-caps uppercase text-secondary hover:underline"
          >
            + Order a Custom Keepsake
          </Link>
        </header>

        <div className="flex flex-col gap-4 mb-8">
          {cartItems.map((item) => {
            const unitMinor =
              item.unitArtworkMinor +
              item.unitPersonalizationMinor +
              item.unitProductMinor;
            const lineTotalMinor = unitMinor * BigInt(item.quantity);
            const customPhrase = extractInputPhrase(
              item.personalizationVersion?.inputSnapshot
            );
            const itemTitle = customPhrase
              ? `“${customPhrase}”`
              : item.design.title;
            const previewSvgUri = renderCartPreviewUri(
              item.personalizationVersion?.styleSnapshot,
              customPhrase || item.design.title
            );
            const studioSessionId = item.personalizationVersion?.sessionId;
            const variantParts = [
              item.catalogVariant.product.name,
              item.catalogVariant.color,
              item.catalogVariant.size
                ? `Size ${item.catalogVariant.size}`
                : null,
            ].filter((part): part is string => Boolean(part));

            return (
              <article
                key={item.id}
                className="flex flex-col sm:flex-row gap-4 p-5 bg-surface-container-lowest border border-surface-variant rounded-lg"
              >
                <div className="w-20 h-20 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center shrink-0 p-2 overflow-hidden">
                  <Image
                    src={previewSvgUri}
                    alt={itemTitle}
                    width={72}
                    height={72}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-headline-sm text-lg text-primary truncate">
                        {itemTitle}
                      </h2>
                      <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                        {variantParts.join(" · ")}
                      </p>
                      <p className="font-label-caps text-[11px] uppercase text-on-surface-variant mt-1.5">
                        Placement: {item.placement.replace(/_/g, " ")} · Unit:{" "}
                        {formatUsdMinor(unitMinor)}
                      </p>
                    </div>
                    <p className="font-headline-sm text-lg text-primary shrink-0">
                      {formatUsdMinor(lineTotalMinor)}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-surface-variant flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-outline-variant bg-surface-container-low">
                      <form action={updateCartItemQuantityFormAction}>
                        <input type="hidden" name="cartItemId" value={item.id} />
                        <input
                          type="hidden"
                          name="quantity"
                          value={String(Math.max(0, item.quantity - 1))}
                        />
                        <button
                          type="submit"
                          aria-label={`Decrease quantity of ${itemTitle}`}
                          className="min-h-9 min-w-9 flex items-center justify-center text-on-surface-variant hover:text-primary cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>

                      <span className="px-3 font-body-md text-sm font-medium text-on-background">
                        {item.quantity}
                      </span>

                      <form action={updateCartItemQuantityFormAction}>
                        <input type="hidden" name="cartItemId" value={item.id} />
                        <input
                          type="hidden"
                          name="quantity"
                          value={String(Math.min(100, item.quantity + 1))}
                        />
                        <button
                          type="submit"
                          aria-label={`Increase quantity of ${itemTitle}`}
                          className="min-h-9 min-w-9 flex items-center justify-center text-on-surface-variant hover:text-primary cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                    </div>

                    <div className="flex items-center gap-4">
                      {studioSessionId && (
                        <Link
                          href={`/create/${encodeURIComponent(studioSessionId)}`}
                          className="inline-flex items-center gap-1.5 font-label-caps text-[11px] uppercase text-on-surface-variant hover:text-primary"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Edit in Studio</span>
                        </Link>
                      )}

                      <form action={removeFromCartFormAction}>
                        <input type="hidden" name="cartItemId" value={item.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 font-label-caps text-[11px] uppercase text-on-surface-variant hover:text-secondary transition-colors cursor-pointer"
                          aria-label={`Remove ${itemTitle} from cart`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6 flex flex-col gap-3 mb-6">
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant">
              Product Blanks &amp; Placement
            </span>
            <span className="text-on-background">
              {formatUsdMinor(productTotalMinor)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant">
              Calligraphy Personalization
            </span>
            <span className="text-on-background">
              {formatUsdMinor(personalizationTotalMinor)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant">
              Artist &amp; Font License
            </span>
            <span className="text-on-background">
              {formatUsdMinor(artworkTotalMinor)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-surface-variant">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="font-medium text-primary">
              {formatUsdMinor(subtotalMinor)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant">
              Estimated US Flat Shipping
            </span>
            <span className="text-on-surface-variant">
              {formatUsdMinor(estimatedUsShippingMinor)}
            </span>
          </div>
          <div className="h-px bg-surface-variant my-1" />
          <div className="flex justify-between items-center">
            <span className="font-headline-sm text-headline-sm text-primary">
              Estimated Total
            </span>
            <span className="font-headline-sm text-headline-sm text-secondary">
              {formatUsdMinor(estimatedGrandTotalMinor)}
            </span>
          </div>
        </section>

        <Link
          href={`/checkout?cartId=${encodeURIComponent(activeCart.id)}`}
          className="w-full bg-secondary text-on-secondary py-4 rounded-lg font-label-caps text-label-caps uppercase hover:opacity-95 transition-opacity motion-reduce:transition-none flex items-center justify-center gap-2"
        >
          Proceed to Secure Checkout{" "}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant mt-4">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="font-label-caps text-label-caps uppercase">
            Encrypted Checkout · 300 DPI Archival Print Master
          </span>
        </div>
      </div>
    </div>
  );
}
