"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { addCatalogItemToCartAction } from "@/app/actions/cart";
import type { CatalogProductOption } from "@/lib/catalog/keepsakeCatalog";

const OPTION_BASE =
  "min-h-11 px-3 py-2 rounded border font-label-caps text-label-caps uppercase leading-normal transition-colors motion-reduce:transition-none cursor-pointer flex flex-col items-center justify-center text-center gap-1 peer-focus-visible:ring-2 peer-focus-visible:ring-secondary";
const OPTION_ON = "border-primary bg-primary text-on-primary";
const OPTION_OFF =
  "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high";

type Sides = "single" | "double";

export function DesignPurchasePanel({
  designId,
  designTitle,
  product,
  customHref,
}: {
  designId: string;
  designTitle: string;
  product: CatalogProductOption;
  customHref: string;
}) {
  const groupId = useId();
  const router = useRouter();
  const [variantId, setVariantId] = useState(
    product.sizes[Math.min(1, product.sizes.length - 1)]?.variantId ?? ""
  );
  const [sides, setSides] = useState<Sides>("single");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const size =
    product.sizes.find((option) => option.variantId === variantId) ??
    product.sizes[0];
  if (!size) return null;
  const priceLabel = sides === "double" ? size.doubleLabel : size.singleLabel;

  const handleBuyNow = () => {
    setError(null);
    startTransition(async () => {
      const result = await addCatalogItemToCartAction({
        designId,
        variantId: size.variantId,
        sides,
        quantity: 1,
      });
      if (!result.success) {
        setError(result.error ?? "Unable to add this item to your cart.");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("thibut-cart-refresh", { detail: { count: result.count } })
      );
      router.push("/cart");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
          Size
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {product.sizes.map((option) => (
            <label key={option.variantId} className="relative">
              <input
                type="radio"
                name={`${groupId}-size`}
                value={option.variantId}
                checked={size.variantId === option.variantId}
                onChange={() => setVariantId(option.variantId)}
                className="peer sr-only"
              />
              <span
                className={`${OPTION_BASE} ${
                  size.variantId === option.variantId ? OPTION_ON : OPTION_OFF
                }`}
              >
                <span>{option.size}</span>
                <span className="normal-case tracking-normal font-body-md text-body-md">
                  {sides === "double" ? option.doubleLabel : option.singleLabel}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
          Artwork sides
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["single", "Single-Sided"],
              ["double", "Double-Sided"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="relative">
              <input
                type="radio"
                name={`${groupId}-sides`}
                value={value}
                checked={sides === value}
                onChange={() => setSides(value)}
                className="peer sr-only"
              />
              <span
                className={`${OPTION_BASE} ${sides === value ? OPTION_ON : OPTION_OFF}`}
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-t border-surface-variant pt-5">
        <div
          aria-live="polite"
          className="flex items-baseline justify-between gap-3"
        >
          <span className="font-body-md text-body-md text-on-surface-variant">
            {size.size} · {sides === "double" ? "Double-sided" : "Single-sided"}
          </span>
          <span className="font-headline-md text-headline-md text-primary">
            {priceLabel}
          </span>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Shipping and tax are calculated at checkout.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded border border-error bg-error-container text-on-error-container px-4 py-3 font-body-md text-body-md"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={isPending}
            aria-label={`Buy ${designTitle} now for ${priceLabel}`}
            className="inline-flex w-full items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary disabled:opacity-60 disabled:cursor-not-allowed transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {isPending ? (
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {isPending ? "Adding…" : "Buy Now"}
            {!isPending && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
          </button>
          <Link
            href={customHref}
            className="inline-flex w-full items-center justify-center min-h-12 border border-outline text-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Custom Design With Your Photos
          </Link>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant mt-4">
          Buy Now ships this artwork exactly as shown. Custom Design adds your own photos,
          names and wording, with a proof for your approval before production.
        </p>
      </div>
    </div>
  );
}
