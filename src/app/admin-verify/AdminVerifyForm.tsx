"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { verifyMasterPassword } from "./actions";

export function AdminVerifyForm() {
  const router = useRouter();
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await verifyMasterPassword(password);
    if (res.success) {
      router.push("/admin");
    } else {
      setError(res.error || "Verification failed");
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md w-full overflow-hidden">
      <CardHeader className="text-center items-center border-b border-surface-variant bg-surface-container-low p-8">
        <div className="w-14 h-14 bg-error-container text-on-error-container rounded-full flex items-center justify-center mb-3">
          <ShieldAlert className="w-7 h-7" aria-hidden="true" />
        </div>
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Restricted Area
        </CardTitle>
        <CardDescription>
          Administrative access requires master password verification.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-error-container border border-error/30 rounded font-body-md text-body-md text-on-error-container text-center"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor={passwordId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Master Password
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              aria-invalid={error ? true : undefined}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || !password}
          >
            {isSubmitting ? "Verifying..." : "Verify Access"}
            {!isSubmitting && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
