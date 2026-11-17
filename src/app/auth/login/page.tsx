import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign In — Creator Studio",
  description: "Sign in to your Thi Bút Creator Studio dashboard.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex-1 bg-background flex flex-col justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <div className="w-full max-w-md mx-auto">
        <Suspense
          fallback={
            <div className="h-96 rounded-lg bg-surface-container border border-surface-variant animate-pulse motion-reduce:animate-none" />
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
