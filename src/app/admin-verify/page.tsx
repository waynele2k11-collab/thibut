import type { Metadata } from "next";
import { AdminVerifyForm } from "./AdminVerifyForm";

export const metadata: Metadata = {
  title: "Admin Verification",
  description: "Verify administrative access.",
  robots: { index: false, follow: false },
};

export default function AdminVerifyPage() {
  return (
    <main className="flex-1 bg-background flex items-center justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <AdminVerifyForm />
    </main>
  );
}
