"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GalleryDetailActionsProps {
  product: { id: string };
}

export function GalleryDetailActions({ product }: GalleryDetailActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeItYoursLink = `/create?galleryId=${product.id}`;

  const handleBuyNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryItemId: product.id,
          variantId: "default",
        }),
      });

      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start checkout");
      }
    } catch (err: unknown) {
      console.error("[GalleryDetailActions] Checkout error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start checkout. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {error && (
        <div
          role="alert"
          className="p-3 rounded border border-error/30 bg-error-container text-on-error-container font-label-caps text-label-caps uppercase text-center"
        >
          {error}
        </div>
      )}

      <Button
        onClick={handleBuyNow}
        disabled={loading}
        size="lg"
        className="w-full sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2
              className="w-4 h-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Preparing Secure Checkout...
          </>
        ) : (
          "Buy As Shown"
        )}
      </Button>

      <Link
        href={makeItYoursLink}
        className="w-full sm:w-auto inline-flex items-center justify-center text-on-surface-variant hover:text-primary py-3 font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none"
      >
        Personalize this product{" "}
        <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
      </Link>

      <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 text-on-surface-variant font-label-caps text-label-caps uppercase">
        <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
        <span>Encrypted Stripe Checkout · 300 DPI Museum Fulfillment</span>
      </div>
    </div>
  );
}
