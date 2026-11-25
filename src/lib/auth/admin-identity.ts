import "server-only";
/**
 * Who, if anyone, is signed in as admin on this request.
 *
 * The cookie is a signed token naming a database session row. The token alone is never enough:
 * the row must exist, belong to the same user, be unexpired and not revoked. That is what makes
 * "sign out" and "sign out everywhere" real.
 *
 * This answers identity only. Whether that user is an ACTIVE admin is decided by
 * src/utils/admin/auth.ts on every call.
 */
import { cookies } from "next/headers";
import { verifyAdminSessionToken } from "@/lib/security/tokens";
import { adminSessionCookieName } from "./admin-cookies";
import { resolveAdminSession } from "./admin-sign-in";
import { prismaAdminSignInStore } from "./admin-store";
import { isPlaceholderSecret } from "@/lib/security/placeholder";
import { ADMIN_SECRET_MIN_LENGTH } from "./secret-box";

export type AdminIdentity =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; sessionId: string };

/**
 * Admin sign-in exists only when the signing secret is set, long enough, and not the
 * placeholder from `.env.example` (which is public).
 */
export function isAdminSignInConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const secret = env.ADMIN_SESSION_SECRET;
  return (
    typeof secret === "string" &&
    secret.trim().length >= ADMIN_SECRET_MIN_LENGTH &&
    !isPlaceholderSecret(secret)
  );
}

export async function getAdminIdentity(): Promise<AdminIdentity> {
  if (!isAdminSignInConfigured()) {
    return { status: "unconfigured" };
  }
  const cookieStore = await cookies();
  const claims = await verifyAdminSessionToken(
    cookieStore.get(adminSessionCookieName())?.value
  );
  if (!claims) {
    return { status: "signed-out" };
  }
  const userId = await resolveAdminSession(
    { store: prismaAdminSignInStore, now: () => new Date() },
    claims
  );
  if (!userId) {
    return { status: "signed-out" };
  }
  return { status: "signed-in", userId, sessionId: claims.sessionId };
}
