import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  DEVICE_TRUST_COOKIE,
  verifyDeviceTrustToken,
} from "@/lib/security/tokens";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login?next=/studio");
  }

  const cookieStore = await cookies();
  const rawDeviceToken = cookieStore.get(DEVICE_TRUST_COOKIE)?.value;
  const trustedDevice = await verifyDeviceTrustToken(rawDeviceToken, user.id);

  if (!trustedDevice) {
    redirect("/auth/verify-device?callbackUrl=/studio");
  }

  return <>{children}</>;
}
