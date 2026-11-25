import { adminPath } from "@/lib/admin-path";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AdminSignInForm from "@/components/auth/AdminSignInForm";
import { getAdminIdentity } from "@/lib/auth/admin-identity";
import { safeRedirectPath } from "@/lib/security/redirect";
import { signInWithPasswordAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin sign-in",
  description: "Sign in to the Thi Bút admin.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "sign-out-incomplete":
    "You are signed out on this browser, but ending the session on the server failed. Sign in and choose “Sign out everywhere”.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string; notice?: string }>;
}) {
  const identity = await getAdminIdentity();
  if (identity.status === "unconfigured") {
    // No admin sign-in exists on a deployment without its signing secret.
    notFound();
  }
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? params.callbackUrl, adminPath());
  if (identity.status === "signed-in") {
    redirect(next);
  }
  const notice =
    params.notice && Object.hasOwn(NOTICES, params.notice) ? NOTICES[params.notice] : null;

  return (
    <main className="flex-1 bg-background flex flex-col justify-center py-16 px-margin-mobile md:px-margin-desktop">
      <div className="w-full max-w-md mx-auto">
        <AdminSignInForm action={signInWithPasswordAction} next={next} notice={notice} />
      </div>
    </main>
  );
}
