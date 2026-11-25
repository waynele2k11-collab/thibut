import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { studioBrushFontVariables } from "@/fonts/index";
import { getSessionUser } from "@/lib/auth/session";
import {
  DEVICE_TRUST_COOKIE,
  verifyDeviceTrustToken,
} from "@/lib/security/tokens";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The Creator Studio is paused (next.config.ts redirects /studio to /custom) and there are
  // no creator accounts: getSessionUser() answers "guest", so this layout never renders.
  const user = await getSessionUser();

  if (!user) {
    redirect("/custom");
  }

  const cookieStore = await cookies();
  const rawDeviceToken = cookieStore.get(DEVICE_TRUST_COOKIE)?.value;
  const trustedDevice = await verifyDeviceTrustToken(rawDeviceToken, user.id);

  if (!trustedDevice) {
    redirect("/custom");
  }

  return <div className={studioBrushFontVariables}>{children}</div>;
}
