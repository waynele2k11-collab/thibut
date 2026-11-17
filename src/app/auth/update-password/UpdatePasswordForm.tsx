"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordId = useId();
  const router = useRouter();
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      const res = await fetch("/api/auth/device-check", { method: "POST" });
      const data: { status?: string; error?: string } = await res.json();

      if (!res.ok) throw new Error(data.error || "Device check failed");

      if (data.status === "requires_pin") {
        router.push("/auth/verify-device?callbackUrl=/studio");
      } else {
        router.push("/studio");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update password. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center items-center">
        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-2">
          <KeyRound className="w-6 h-6 text-secondary" aria-hidden="true" />
        </div>
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Set New Password
        </CardTitle>
        <CardDescription>
          Enter a new password of at least 6 characters below.
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

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor={passwordId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              New Password
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              aria-invalid={error ? true : undefined}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || password.length < 6}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
