import Link from "next/link";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Cart | Thi Bút",
  description: "Review your personalized calligraphy art before checkout.",
};

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get("cartId")?.value;

  let cartItems: any[] = [];
  let subtotal = 0;

  if (cartId) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              design: { select: { title: true, sourceText: true } },
            },
          },
        },
      });
      if (cart?.items) {
        cartItems = cart.items;
        subtotal = cartItems.reduce(
          (sum: number, item: any) =>
            sum + (item.unitArtworkMinor + item.unitPersonalizationMinor + item.unitProductMinor),
          0
        );
      }
    } catch {
      // cart not found or DB unavailable — show empty state
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] text-on-background flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-[#F4EFE6] border border-[#E5E0D8] flex items-center justify-center mb-6">
          <ShoppingBag className="w-8 h-8 text-on-surface-variant" />
        </div>
        <h1 className="font-bold text-2xl text-on-background mb-2">Your cart is empty</h1>
        <p className="text-on-surface-variant text-sm mb-8 text-center max-w-xs">
          You haven't added any personalized artwork yet. Create something that's uniquely yours.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider hover:bg-[#9b1e17] active:scale-[0.99] transition-all text-sm"
        >
          Start Creating <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/gallery" className="mt-4 text-sm text-on-surface-variant hover:text-on-background underline underline-offset-2">
          Browse the Gallery instead
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-16 pb-32">
        <h1 className="font-bold text-3xl text-on-background mb-2">Your Cart</h1>
        <p className="text-on-surface-variant text-sm mb-8">{cartItems.length} item{cartItems.length !== 1 ? "s" : ""}</p>

        {/* Items */}
        <div className="flex flex-col gap-4 mb-8">
          {cartItems.map((item: any) => {
            const total = item.unitArtworkMinor + item.unitPersonalizationMinor + item.unitProductMinor;
            return (
              <div key={item.id} className="flex gap-4 p-4 bg-white border border-[#E5E0D8] rounded-2xl shadow-sm">
                {/* Placeholder thumbnail */}
                <div className="w-16 h-16 rounded-xl bg-[#F4EFE6] border border-[#E5E0D8] flex items-center justify-center shrink-0">
                  <span className="font-vn-dancing text-2xl text-on-surface-variant">書</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-background truncate">
                    {item.design?.sourceText || item.design?.title || "Custom Calligraphy"}
                  </p>
                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                    {item.catalogVariantId || "Custom Product"}
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-1">Qty: {item.quantity ?? 1}</p>
                </div>
                <div className="flex flex-col items-end justify-between shrink-0">
                  <p className="font-bold text-sm text-on-background">${(total / 100).toFixed(2)}</p>
                  <button className="text-[#888580] hover:text-[#B3261E] transition-colors" aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="bg-white border border-[#E5E0D8] rounded-2xl p-5 flex flex-col gap-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="font-semibold text-on-background">${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Shipping</span>
            <span className="text-on-surface-variant">Calculated at checkout</span>
          </div>
          <div className="h-px bg-[#E5E0D8]" />
          <div className="flex justify-between text-base font-bold">
            <span className="text-on-background">Total</span>
            <span className="text-on-background">${(subtotal / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/checkout"
          className="w-full bg-[#B3261E] text-white py-4 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-[#9b1e17] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-center text-[11px] text-on-surface-variant mt-3">
          🔒 Secure checkout · Free shipping over $75 · Ships 5–7 days
        </p>
      </div>
    </div>
  );
}
