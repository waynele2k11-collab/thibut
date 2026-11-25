"use client";

import { ADMIN_SIGN_IN_PATH } from "@/lib/admin-path";
import { useActionState, useId } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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

export default function AdminCodeForm({
  action,
  next,
}: {
  /** The code-step server action, passed in by the page. */
  action: SignInAction;
  next: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_SIGN_IN_FORM_STATE);
  const codeId = useId();
  const hintId = useId();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="font-headline-md text-headline-md text-primary">
          Admin sign-in
        </CardTitle>
        <CardDescription>Step 2 of 2: the code from your authenticator app.</CardDescription>
      </CardHeader>

      <CardContent>
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
              htmlFor={codeId}
              className="block font-label-caps text-label-caps uppercase text-on-surface-variant"
            >
              Six-digit code
            </label>
            <Input
              id={codeId}
              name="code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              aria-describedby={hintId}
              autoFocus
              required
            />
            <p id={hintId} className="font-body-md text-body-md text-on-surface-variant">
              Lost your phone? Type one of your recovery codes instead. Each works once.
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center font-body-md text-body-md text-on-surface-variant">
          This step expires after five minutes.{" "}
          <Link href={ADMIN_SIGN_IN_PATH} className="underline hover:text-secondary">
            Start again
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
