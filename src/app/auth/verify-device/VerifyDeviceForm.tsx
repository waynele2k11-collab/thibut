"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { safeRedirectPath } from "@/lib/security/redirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyDevicePin } from "./actions";

export function VerifyDeviceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"), "/studio");
  const pinInputId = useId();

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await verifyDevicePin(pin);
    if (res.success) {
      router.push(callbackUrl);
    } else {
      setError(res.error || "Invalid PIN");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center items-center">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-2">
          <ShieldCheck className="w-6 h-6 text-secondary" aria-hidden="true" />
        </div>
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Device Verification
        </CardTitle>
        <CardDescription>
          We&apos;ve sent a 6-digit PIN to your email. Enter it below to trust this device.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded border border-error/30 bg-error-container text-on-error-container font-body-md text-body-md text-center"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor={pinInputId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              6-Digit Security PIN
            </label>
            <Input
              id={pinInputId}
              name="pin"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-xl tracking-[0.4em] font-mono h-12"
              required
              maxLength={6}
              aria-invalid={error ? true : undefined}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || pin.length !== 6}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              "Verify Device"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
