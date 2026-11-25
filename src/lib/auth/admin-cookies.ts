/**
 * Names and options of the two admin sign-in cookies. Pure.
 *
 * On the live site (HTTPS) the names carry the `__Host-` prefix: the browser then refuses the
 * cookie unless it is Secure, has Path=/ and no Domain, so no other host or sub-path can set or
 * shadow it. Browsers do not accept `__Host-` or Secure cookies over plain http://localhost, so
 * local development uses the plain names without Secure.
 */
import {
  ADMIN_PENDING_TTL_SECONDS,
  ADMIN_SESSION_TTL_SECONDS,
} from "@/lib/security/tokens";

export interface AdminCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: "/";
  maxAge: number;
  expires?: Date;
}

/** What to hand to `cookies().set(name, value, options)` to remove a cookie. */
export interface AdminCookieClearing {
  name: string;
  value: "";
  options: AdminCookieOptions;
}

function isSecureDeployment(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "production";
}

export function adminSessionCookieName(
  env: Record<string, string | undefined> = process.env
): string {
  return isSecureDeployment(env) ? "__Host-tb_admin" : "tb_admin";
}

export function adminPendingCookieName(
  env: Record<string, string | undefined> = process.env
): string {
  return isSecureDeployment(env) ? "__Host-tb_admin_pending" : "tb_admin_pending";
}

export function adminSessionCookieOptions(
  env: Record<string, string | undefined> = process.env
): AdminCookieOptions {
  return {
    httpOnly: true,
    secure: isSecureDeployment(env),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

export function adminPendingCookieOptions(
  env: Record<string, string | undefined> = process.env
): AdminCookieOptions {
  return {
    httpOnly: true,
    secure: isSecureDeployment(env),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_PENDING_TTL_SECONDS,
  };
}

/**
 * Removing a cookie means setting it again, empty and already expired, with the SAME
 * attributes it was set with. A browser ignores any Set-Cookie for a `__Host-` name that lacks
 * Secure or Path=/, a removal included, so `cookies().delete(name)` (which sends neither
 * Secure nor HttpOnly) does not remove these cookies on the live site.
 */
function clearing(name: string, options: AdminCookieOptions): AdminCookieClearing {
  return { name, value: "", options: { ...options, maxAge: 0, expires: new Date(0) } };
}

export function adminSessionCookieClearing(
  env: Record<string, string | undefined> = process.env
): AdminCookieClearing {
  return clearing(adminSessionCookieName(env), adminSessionCookieOptions(env));
}

export function adminPendingCookieClearing(
  env: Record<string, string | undefined> = process.env
): AdminCookieClearing {
  return clearing(adminPendingCookieName(env), adminPendingCookieOptions(env));
}
