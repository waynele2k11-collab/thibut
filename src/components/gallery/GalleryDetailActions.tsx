"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import type { GalleryProductFixture } from "@/data/gallery";

interface Props {
  product: GalleryProductFixture;
}

export function GalleryDetailActions({ product }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeItYoursLink = `/create?product=${product.productId}&color=${encodeURIComponent(product.color)}&placement=${product.placement}&source=gallery&template=${product.id}`;

  const handleBuyNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryProductId: product.id,
          title: `${product.title} (${product.productName})`,
          priceMinor: product.retailPriceMinor,
          imageUrl: `${window.location.origin}${product.mockups[0]?.asset}`,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {error && (
        <div className="p-3 border border-[#B3261E]/50 bg-[#B3261E]/10 text-[#B3261E] text-xs font-mono uppercase tracking-wide text-center">
          {error}
        </div>
      )}

      <button 
        onClick={handleBuyNow}
        disabled={loading}
        className="w-full sm:w-auto inline-flex items-center justify-center bg-on-background text-background px-8 py-4 font-label-caps text-label-caps uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing Secure Checkout...
          </>
        ) : (
          "Buy As Shown"
        )}
      </button>
      
      <Link 
        href={makeItYoursLink}
        className="w-full sm:w-auto inline-flex items-center justify-center text-on-surface-variant hover:text-on-surface py-4 font-label-caps text-label-caps uppercase transition-colors"
      >
        Personalize this product <ArrowRight className="w-4 h-4 ml-2" />
      </Link>

      <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 text-on-surface-variant/80 text-[11px] font-mono uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span>Encrypted Stripe Checkout · 300 DPI Museum Fulfillment</span>
      </div>
    </div>
  );
}
