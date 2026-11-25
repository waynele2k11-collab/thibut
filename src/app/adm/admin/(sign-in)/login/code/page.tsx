import { ADMIN_SIGN_IN_PATH, adminPath } from "@/lib/admin-path";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AdminCodeForm from "@/components/auth/AdminCodeForm";
import { adminPendingCookieName } from "@/lib/auth/admin-cookies";
import { isAdminSignInConfigured } from "@/lib/auth/admin-identity";
import { safeRedirectPath } from "@/lib/security/redirect";
import { verifyAdminPendingToken } from "@/lib/security/tokens";
import { verifySignInCodeAction } from "../actions";

export const metadata: Metadata = {
  title: "Admin sign-in: code",
  description: "Enter the code from your authenticator app.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginCodePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isAdminSignInConfigured()) {
    notFound();
  }
  // This page only makes sense straight after the password step.
  const cookieStore = await cookies();
  const pending = await verifyAdminPendingToken(
    cookieStore.get(adminPendingCookieName())?.value
  );
  if (!pending) {
    redirect(ADMIN_SIGN_IN_PATH);
  }
  const params = await searchParams;
  const next = safeRedirectPath(params.next, adminPath());

  return (
    <main className="flex-1 bg-background flex flex-col justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <div className="w-full max-w-md mx-auto">
        <AdminCodeForm action={verifySignInCodeAction} next={next} />
      </div>
    </main>
  );
}
