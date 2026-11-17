"use client";

import { useState } from "react";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import type { PlacementValue } from "@/lib/print/types";

export type CheckoutRequestPayload =
  | { cartId: string }
  | {
      personalizationVersionId?: string;
      sessionId?: string;
      catalogVariantId?: string;
      isDigital?: boolean;
      placement?: PlacementValue;
      licenseOfferId?: string;
      quantity?: number;
    };

export interface CheckoutButtonProps {
  payload: CheckoutRequestPayload;
  disabled?: boolean;
  label?: string;
}

export function CheckoutButton({
  payload,
  disabled = false,
  label = "Pay with Card",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (loading || disabled) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => null);
      const parsedObj =
        typeof data === "object" && data !== null
          ? (data as Record<string, unknown>)
          : null;

      if (res.ok && parsedObj && typeof parsedObj.url === "string") {
        window.location.assign(parsedObj.url);
        return;
      }

      const apiError =
        parsedObj && typeof parsedObj.error === "string"
          ? parsedObj.error
          : "Unable to initiate checkout. Please try again.";
      setErrorMessage(apiError);
      setLoading(false);
    } catch {
      setErrorMessage("Network error while connecting to checkout.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading || disabled}
        className="w-full bg-primary text-on-primary py-4 px-6 font-label-caps text-label-caps uppercase flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors duration-300 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <CreditCard className="w-5 h-5" />
        )}
        <span>{loading ? "Preparing Secure Session..." : label}</span>
      </button>

      {errorMessage && (
        <div
          role="alert"
          className="bg-error-container text-on-error-container border border-error p-3 flex items-start gap-2 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-error" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
