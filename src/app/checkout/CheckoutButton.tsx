"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export function CheckoutButton({ sessionId, candidateId, productId }: { sessionId: string; candidateId: string; productId: string }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          candidateId,
          productId,
          designId: "mock-design-123", // TODO: real design ID
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: window.location.href,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe
      } else {
        alert("Checkout failed: " + (data.error || "Unknown error"));
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Checkout failed.");
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout}
      disabled={loading}
      className="w-full bg-primary text-on-primary py-4 font-label-caps text-label-caps uppercase flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors duration-300 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
      {loading ? "Redirecting..." : "Pay with Card"}
    </button>
  );
}
