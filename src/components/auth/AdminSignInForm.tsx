"use client";

import { useActionState, useId } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  INITIAL_SIGN_IN_FORM_STATE,
  type SignInFormState,
} from "@/lib/auth/sign-in-form";

type SignInAction = (
  previous: SignInFormState,
  formData: FormData
) => Promise<SignInFormState>;

export default function AdminSignInForm({
  action,
  next,
  notice,
}: {
  /** The password-step server action, passed in by the page. */
  action: SignInAction;
  next: string;
  notice?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_SIGN_IN_FORM_STATE);
  const emailId = useId();
  const passwordId = useId();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Admin sign-in
        </CardTitle>
        <CardDescription>Step 1 of 2: your email and password.</CardDescription>
      </CardHeader>

      <CardContent>
        {notice && !state.error && (
          <div
            role="status"
            className="mb-6 p-3.5 rounded border border-surface-variant bg-surface-container font-body-md text-body-md text-center text-on-surface"
          >
            {notice}
          </div>
        )}
        {state.error && (
          <div
            role="alert"
            className="mb-6 p-3.5 rounded border border-error/30 bg-error-container font-body-md text-body-md text-center text-on-error-container"
          >
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <label
              htmlFor={emailId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Email address
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
                autoComplete="username"
                className="pl-10"
                maxLength={254}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor={passwordId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Password
            </label>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              required
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
