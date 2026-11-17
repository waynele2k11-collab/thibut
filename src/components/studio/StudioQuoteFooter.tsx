"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Save,
  ShoppingCart,
} from "lucide-react";
import type { StudioLiveQuote } from "@/lib/studio/studioQuote";
import type {
  CartConfirmationBanner,
  FulfillmentFormat,
  StudioStep,
} from "@/lib/studio/studioStore";

export interface StudioQuoteFooterProps {
  isAdmin: boolean;
  isLocked: boolean;
  activeStep: StudioStep;
  onChangeStep: (step: StudioStep) => void;
  fulfillmentFormat: FulfillmentFormat;
  quote: StudioLiveQuote;
  isSaving: boolean;
  onSave: () => void;
  isAddingToCart: boolean;
  onPrimaryPurchaseAction: () => void;
  cartConfirmation: CartConfirmationBanner | null;
  onDismissCartConfirmation: () => void;
}

export function StudioQuoteFooter({
  isAdmin,
  isLocked,
  activeStep,
  onChangeStep,
  fulfillmentFormat,
  quote,
  isSaving,
  onSave,
  isAddingToCart,
  onPrimaryPurchaseAction,
  cartConfirmation,
  onDismissCartConfirmation,
}: StudioQuoteFooterProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  if (isAdmin) {
    return (
      <div className="p-4 bg-surface-container-lowest border-t border-surface-variant shrink-0 flex items-center justify-between gap-3">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Admin Calligraphy Studio
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLocked}
          className="min-h-11 px-5 py-2.5 rounded bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary font-label-caps text-label-caps uppercase inline-flex items-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2
              className="w-4 h-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Save className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{isSaving ? "Saving..." : "Save Master Session"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border-t border-surface-variant px-4 sm:px-6 py-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] lg:pb-4 shrink-0 z-30 space-y-3">
      {cartConfirmation && (
        <div
          role="status"
          className="p-3 rounded-lg bg-surface-container-low border border-primary flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2
                className="w-4 h-4 text-primary shrink-0"
                aria-hidden="true"
              />
              <span className="font-body-md text-xs font-semibold text-on-background truncate">
                Added to Cart ({cartConfirmation.count}{" "}
                {cartConfirmation.count === 1 ? "item" : "items"})
              </span>
            </div>
            <button
              type="button"
              onClick={onDismissCartConfirmation}
              className="font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-primary underline cursor-pointer shrink-0"
            >
              Keep Designing
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/cart"
              className="min-h-10 px-3 py-2 rounded border border-outline-variant bg-surface-container-lowest text-on-background hover:border-primary font-label-caps text-[11px] uppercase flex items-center justify-center transition-colors motion-reduce:transition-none"
            >
              View Cart
            </Link>
            <Link
              href={
                cartConfirmation.cartId
                  ? `/checkout?cartId=${encodeURIComponent(cartConfirmation.cartId)}`
                  : "/cart"
              }
              className="min-h-10 px-3 py-2 rounded bg-secondary text-on-secondary hover:opacity-95 font-label-caps text-[11px] uppercase flex items-center justify-center gap-1.5 transition-opacity motion-reduce:transition-none"
            >
              <span>Checkout Now</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {breakdownOpen && !quote.unavailableReason && (
        <div className="p-3 rounded-lg bg-surface-container-low border border-surface-variant space-y-1.5 text-xs">
          <div className="flex justify-between text-on-surface-variant">
            <span>
              {fulfillmentFormat === "DIGITAL"
                ? "300 DPI Archival Render"
                : "Product Blank & Placement"}
            </span>
            <span className="font-medium text-on-background">
              {quote.productFormatted}
            </span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Calligraphy Personalization</span>
            <span className="font-medium text-on-background">
              {quote.personalizationFormatted}
            </span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Artist &amp; Font License</span>
            <span className="font-medium text-on-background">
              {quote.artworkFormatted}
            </span>
          </div>
          <div className="pt-1.5 border-t border-surface-variant flex justify-between font-semibold text-on-background">
            <span>Item Subtotal</span>
            <span>{quote.subtotalFormatted}</span>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="font-label-caps text-[10px] uppercase text-on-surface-variant block">
            {fulfillmentFormat === "DIGITAL"
              ? "Digital Master Total"
              : "Estimated Total"}
          </span>
          {quote.unavailableReason ? (
            <span className="font-body-md text-xs text-on-surface-variant">
              Digital Master available · {quote.totalFormatted}
            </span>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-headline-sm text-xl text-on-background leading-none">
                {quote.totalFormatted}
              </span>
              <button
                type="button"
                aria-expanded={breakdownOpen}
                onClick={() => setBreakdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-0.5 font-label-caps text-[10px] uppercase text-on-surface-variant hover:text-primary cursor-pointer"
              >
                <span>Inc. License</span>
                {breakdownOpen ? (
                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <ChevronUp className="w-3 h-3" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>

        {activeStep !== "PRODUCT" && (
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onChangeStep("PRODUCT")}
            className="font-label-caps text-[11px] uppercase text-secondary hover:underline cursor-pointer disabled:opacity-50"
          >
            Skip to Buy →
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {activeStep !== "MEANING" && (
          <button
            type="button"
            onClick={() =>
              onChangeStep(activeStep === "PRODUCT" ? "BRUSH" : "MEANING")
            }
            aria-label="Previous step"
            className="min-h-11 px-3.5 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-background hover:bg-surface-container-low inline-flex items-center justify-center gap-1.5 font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        {activeStep === "MEANING" && (
          <button
            type="button"
            onClick={() => onChangeStep("BRUSH")}
            className="flex-1 min-h-11 px-5 py-3 rounded-lg bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary font-label-caps text-label-caps uppercase inline-flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <span>Continue to Brush &amp; Style</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {activeStep === "BRUSH" && (
          <button
            type="button"
            onClick={() => onChangeStep("PRODUCT")}
            className="flex-1 min-h-11 px-5 py-3 rounded-lg bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary font-label-caps text-label-caps uppercase inline-flex items-center justify-center gap-2 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <span>Continue to Product &amp; Preview</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {activeStep === "PRODUCT" && (
          <button
            type="button"
            onClick={onPrimaryPurchaseAction}
            disabled={
              isAddingToCart ||
              isLocked ||
              (fulfillmentFormat === "PHYSICAL" && Boolean(quote.unavailableReason))
            }
            className="flex-1 min-h-11 px-5 py-3 rounded-lg bg-secondary text-on-secondary hover:opacity-95 font-label-caps text-label-caps uppercase inline-flex items-center justify-center gap-2 transition-opacity motion-reduce:transition-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isAddingToCart ? (
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : fulfillmentFormat === "DIGITAL" ? (
              <Download className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isAddingToCart
                ? fulfillmentFormat === "DIGITAL"
                  ? "Preparing Master..."
                  : "Adding..."
                : fulfillmentFormat === "DIGITAL"
                  ? `Checkout Digital — ${quote.totalFormatted}`
                  : `Add to Cart — ${quote.totalFormatted}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
