"use client";

import { useEffect } from "react";
import Link from "next/link";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error.digest ?? "unhandled_root_error");
  }, [error]);

  const handleRecover = () => {
    if (retry) {
      retry();
      return;
    }
    reset();
  };

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-on-background">
        <title>Unexpected Error | Thi Bút</title>
        <main className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop py-24">
          <div className="w-full max-w-lg bg-surface-container-lowest border border-surface-variant rounded-lg p-8 md:p-12 text-center">
            <span className="inline-block px-3 py-1 mb-6 rounded border border-secondary/30 bg-secondary/10 text-secondary font-label-caps text-label-caps uppercase">
              System Interruption
            </span>
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-headline-md md:text-headline-md text-primary mb-4">
              Something interrupted the studio.
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mb-8">
              Your saved designs and orders remain intact. Please retry loading this view or return to the gallery.
            </p>
            {error.digest && (
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-6">
                Reference: {error.digest}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRecover}
                className="w-full sm:w-auto px-8 py-3.5 rounded bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="w-full sm:w-auto px-8 py-3.5 rounded border border-outline text-primary font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                Return Home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
