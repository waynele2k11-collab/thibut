import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyDeviceForm } from "./VerifyDeviceForm";

export const metadata: Metadata = {
  title: "Verify Device",
  description: "Enter your 6-digit device verification PIN.",
  robots: { index: false, follow: false },
};

export default function VerifyDevicePage() {
  return (
    <main className="flex-1 bg-background flex flex-col justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <Suspense
        fallback={
          <div className="w-full max-w-md mx-auto h-80 rounded-lg bg-surface-container border border-surface-variant animate-pulse motion-reduce:animate-none" />
        }
      >
        <VerifyDeviceForm />
      </Suspense>
    </main>
  );
}
