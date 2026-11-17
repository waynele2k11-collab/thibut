"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error("[RouteError]", error.digest ?? "unhandled_route_error");
  }, [error]);

  const handleRecover = () => {
    if (retry) {
      retry();
      return;
    }
    reset();
  };

  return (
    <main className="flex-1 flex items-center justify-center bg-background text-on-background px-margin-mobile md:px-margin-desktop py-24">
      <div className="w-full max-w-lg bg-surface-container-lowest border border-surface-variant rounded-lg p-8 md:p-12 text-center">
        <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <p className="font-label-caps text-label-caps uppercase text-secondary mb-3">
          Studio Notice
        </p>
        <h1 className="font-headline-md text-headline-md text-primary mb-4">
          We couldn&apos;t load this page.
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          A temporary issue prevented this view from rendering. Your artwork and cart remain preserved.
        </p>
        {error.digest && (
          <p className="font-label-caps text-label-caps text-on-surface-variant mb-6">
            Digest: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRecover}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded bg-primary text-on-primary font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 rounded border border-outline text-primary font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
