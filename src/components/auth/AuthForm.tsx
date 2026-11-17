"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { safeRedirectPath } from "@/lib/security/redirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthForm() {
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "error" | "info"; text: string } | null>(null);

  const emailId = useId();
  const passwordId = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"), "/studio");
  const supabase = createClient();
  const isSignUp = mode === "signup";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: contact,
          password,
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice({
            type: "info",
            text: "Please check your email for a confirmation link. If you already had an account, click 'Forgot?' to reset your password.",
          });
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: contact,
          password,
        });
        if (signInError) throw signInError;
      }

      const res = await fetch("/api/auth/device-check", { method: "POST" });
      const data: { status?: string; error?: string } = await res.json();

      if (!res.ok) throw new Error(data.error || "Device check failed");

      if (data.status === "requires_pin") {
        router.push(`/auth/verify-device?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      } else {
        router.push(callbackUrl);
      }
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to log in. Please try again.",
      });
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!contact) {
      setNotice({
        type: "error",
        text: "Please enter your email address first to reset your password.",
      });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(contact, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setNotice({
        type: "info",
        text: "Password reset email sent. Please check your inbox.",
      });
    } catch (err: unknown) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send reset email.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Creator Studio
        </CardTitle>
        <CardDescription>
          Enter your credentials to access your studio dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(next) => {
            setMode(next === "signup" ? "signup" : "signin");
            setNotice(null);
          }}
          className="mb-6"
        >
          <TabsList aria-label="Account access mode" className="w-full grid grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="sr-only">
            Sign in with your existing studio email and password.
          </TabsContent>
          <TabsContent value="signup" className="sr-only">
            Register a new creator studio account.
          </TabsContent>
        </Tabs>

        {notice && (
          <div
            role={notice.type === "error" ? "alert" : "status"}
            className={`mb-6 p-3.5 rounded border font-body-md text-body-md text-center ${
              notice.type === "error"
                ? "border-error/30 bg-error-container text-on-error-container"
                : "border-surface-variant bg-surface-container text-on-surface"
            }`}
          >
            {notice.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor={emailId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
              </div>
              <Input
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="creator@example.com"
                className="pl-10"
                aria-invalid={notice?.type === "error" ? true : undefined}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor={passwordId}
                className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
              >
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-secondary transition-colors motion-reduce:transition-none"
                >
                  Forgot?
                </button>
              )}
            </div>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              aria-invalid={notice?.type === "error" ? true : undefined}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading || !contact || !password}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
