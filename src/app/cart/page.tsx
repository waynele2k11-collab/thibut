import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { ArrowRight, ShoppingBag, Trash2, ShieldCheck } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatUsdMinor } from "@/lib/pricing/quote";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { createClient } from "@/utils/supabase/server";
import { removeFromCartFormAction } from "@/app/actions/cart";

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
          <ShoppingBag className="w-8 h-8 text-on-surface-variant" />
        </div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Your cart is empty
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8 text-center max-w-md">
          You have not added any personalized calligraphy pieces yet. Craft an
          original work in the Studio or explore curated editions.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors duration-300"
        >
          Start Creating <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/gallery"
          className="mt-5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary underline underline-offset-4"
        >
          Browse the Gallery instead
        </Link>
      </div>
    );
  }

  let subtotalMinor = 0n;
  let totalUnits = 0;
  for (const item of cartItems) {
    const unitMinor =
      item.unitArtworkMinor +
      item.unitPersonalizationMinor +
      item.unitProductMinor;
    subtotalMinor += unitMinor * BigInt(item.quantity);
    totalUnits += item.quantity;
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop pt-14 pb-28">
        <header className="border-b border-surface-variant pb-6 mb-8">
          <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-primary">
            Your Cart
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {totalUnits} {totalUnits === 1 ? "item" : "items"}
          </p>
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
            const variantParts = [
              item.catalogVariant.product.name,
              item.catalogVariant.color,
              item.catalogVariant.size
                ? `Size ${item.catalogVariant.size}`
                : null,
            ].filter((part): part is string => Boolean(part));

            return (
              <div
                key={item.id}
                className="flex gap-4 p-5 bg-surface-container-lowest border border-surface-variant rounded-lg"
              >
                <div className="w-16 h-16 rounded bg-surface-container-low border border-surface-variant flex items-center justify-center shrink-0">
                  <span className="font-headline-sm text-headline-sm text-primary">
                    書
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline-sm text-lg text-primary truncate">
                    {itemTitle}
                  </p>
                  <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
                    {variantParts.join(" · ")}
                  </p>
                  <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mt-2">
                    Qty: {item.quantity} · Placement: {item.placement}
                  </p>
                </div>
                <div className="flex flex-col items-end justify-between shrink-0">
                  <p className="font-headline-sm text-lg text-primary">
                    {formatUsdMinor(lineTotalMinor)}
                  </p>
                  <form action={removeFromCartFormAction}>
                    <input type="hidden" name="cartItemId" value={item.id} />
                    <button
                      type="submit"
                      className="text-on-surface-variant hover:text-secondary transition-colors p-1"
                      aria-label={`Remove ${itemTitle} from cart`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>

        <section className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6 flex flex-col gap-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Subtotal
            </span>
            <span className="font-body-md text-body-md text-primary">
              {formatUsdMinor(subtotalMinor)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Shipping
            </span>
            <span className="font-body-md text-sm text-on-surface-variant">
              Calculated at checkout
            </span>
          </div>
          <div className="h-px bg-surface-variant my-1" />
          <div className="flex justify-between items-center">
            <span className="font-headline-sm text-headline-sm text-primary">
              Estimated Total
            </span>
            <span className="font-headline-sm text-headline-sm text-secondary">
              {formatUsdMinor(subtotalMinor)}
            </span>
          </div>
        </section>

        <Link
          href={`/checkout?cartId=${encodeURIComponent(activeCart.id)}`}
          className="w-full bg-primary text-on-primary py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors duration-300 flex items-center justify-center gap-2"
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </Link>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant mt-4">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="font-label-caps text-label-caps uppercase">
            Encrypted Checkout · 300 DPI Archival Print Master
          </span>
        </div>
      </div>
    </div>
  );
}
