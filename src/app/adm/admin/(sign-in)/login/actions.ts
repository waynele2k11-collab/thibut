"use server";

/**
 * Admin sign-in: password step, then authenticator (or recovery code) step; sign-out.
 *
 * Server actions are public POST endpoints. Nothing here trusts the page that called it:
 * each action reads and verifies its own cookies. Next.js rejects a server action whose Origin
 * does not match the host, and both cookies are SameSite=Strict.
 *
 * Logs carry fixed text and an error class only: never an email, password, code or cookie.
 */
import {
  ADMIN_SIGN_IN_CODE_PATH,
  ADMIN_SIGN_IN_PATH,
  adminPath,
} from "@/lib/admin-path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminPendingCookieClearing,
  adminPendingCookieName,
  adminPendingCookieOptions,
  adminSessionCookieClearing,
  adminSessionCookieName,
  adminSessionCookieOptions,
  type AdminCookieClearing,
} from "@/lib/auth/admin-cookies";
import { isAdminSignInConfigured } from "@/lib/auth/admin-identity";
import {
  beginAdminSignIn,
  completeAdminSignIn,
  hashClientAddress,
  type AdminSignInDeps,
} from "@/lib/auth/admin-sign-in";
import { prismaAdminSignInStore } from "@/lib/auth/admin-store";
import {
  SIGN_IN_FAILED_MESSAGE,
  type SignInFormState,
} from "@/lib/auth/sign-in-form";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
} from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/redirect";
import {
  signAdminPendingToken,
  signAdminSessionToken,
  verifyAdminPendingToken,
  verifyAdminSessionToken,
} from "@/lib/security/tokens";

const FAILED: SignInFormState = { error: SIGN_IN_FAILED_MESSAGE };
const MAX_FIELD_LENGTH = 512;

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" && value.length <= MAX_FIELD_LENGTH ? value : "";
}

function signInDeps(): AdminSignInDeps {
  return {
    store: prismaAdminSignInStore,
    now: () => new Date(),
    masterSecret: process.env.ADMIN_SESSION_SECRET ?? "",
  };
}

/** A cheap per-address brake in front of the password hash, which is costly by design. */
async function passesRequestBrake(bucket: string, clientAddress: string): Promise<boolean> {
  try {
    await enforceDistributedRateLimit({
      bucket,
      key: clientAddress,
      limit: 20,
      windowMs: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * The one way an admin cookie is removed: set again, empty and expired, with the attributes
 * it was set with. The cookie store's own delete method is not used: it leaves out Secure, and
 * a browser ignores that for a `__Host-` cookie (see src/lib/auth/admin-cookies.ts).
 */
function clearAdminCookie(cookieStore: CookieStore, clearing: AdminCookieClearing): void {
  cookieStore.set(clearing.name, clearing.value, clearing.options);
}

function logFailure(step: string, error: unknown): void {
  console.error(
    `[AdminSignIn] ${step} could not be completed:`,
    error instanceof Error ? error.name : "UnknownError"
  );
}

export async function signInWithPasswordAction(
  _previous: SignInFormState,
  formData: FormData
): Promise<SignInFormState> {
  if (!isAdminSignInConfigured()) return FAILED;

  const next = safeRedirectPath(readField(formData, "next"), adminPath());
  let pendingToken: string;
  try {
    const clientAddress = getClientIpFromHeaders(await headers());
    if (!(await passesRequestBrake("admin-sign-in-password", clientAddress))) return FAILED;

    const deps = signInDeps();
    const result = await beginAdminSignIn(deps, {
      email: readField(formData, "email"),
      password: readField(formData, "password"),
      addressHash: hashClientAddress(clientAddress, deps.masterSecret),
    });
    if (!result.ok) return FAILED;

    pendingToken = await signAdminPendingToken({
      userId: result.userId,
      challengeId: result.challengeId,
    });
  } catch (error: unknown) {
    logFailure("Password step", error);
    return FAILED;
  }

  const cookieStore = await cookies();
  cookieStore.set(adminPendingCookieName(), pendingToken, adminPendingCookieOptions());
  redirect(`${ADMIN_SIGN_IN_CODE_PATH}?next=${encodeURIComponent(next)}`);
}

export async function verifySignInCodeAction(
  _previous: SignInFormState,
  formData: FormData
): Promise<SignInFormState> {
  if (!isAdminSignInConfigured()) return FAILED;

  const next = safeRedirectPath(readField(formData, "next"), adminPath());
  const cookieStore = await cookies();
  // No valid pending token means the password step was not passed. Such a try is refused
  // here, before anything is counted, so it cannot be used to lock the admin out.
  const pendingCookie = cookieStore.get(adminPendingCookieName())?.value;
  const pending = await verifyAdminPendingToken(pendingCookie);
  if (!pending) {
    // An expired or forged pending cookie is of no further use: remove it.
    if (pendingCookie) clearAdminCookie(cookieStore, adminPendingCookieClearing());
    return FAILED;
  }

  let sessionToken: string;
  try {
    const clientAddress = getClientIpFromHeaders(await headers());
    if (!(await passesRequestBrake("admin-sign-in-code", clientAddress))) return FAILED;

    const deps = signInDeps();
    const result = await completeAdminSignIn(deps, {
      userId: pending.userId,
      challengeId: pending.challengeId,
      code: readField(formData, "code"),
      addressHash: hashClientAddress(clientAddress, deps.masterSecret),
    });
    if (!result.ok) return FAILED;

    sessionToken = await signAdminSessionToken({
      userId: result.userId,
      sessionId: result.sessionId,
    });
  } catch (error: unknown) {
    logFailure("Code step", error);
    return FAILED;
  }

  clearAdminCookie(cookieStore, adminPendingCookieClearing());
  cookieStore.set(adminSessionCookieName(), sessionToken, adminSessionCookieOptions());
  redirect(next);
}

async function endSession(everywhere: boolean): Promise<void> {
  const cookieStore = await cookies();
  const claims = await verifyAdminSessionToken(
    cookieStore.get(adminSessionCookieName())?.value
  );
  // The cookies go first: the browser is signed out even if the database is unreachable.
  clearAdminCookie(cookieStore, adminSessionCookieClearing());
  clearAdminCookie(cookieStore, adminPendingCookieClearing());
  if (!claims) return;
  try {
    const now = new Date();
    // Only a session the database still accepts may end the others.
    const session = await prismaAdminSignInStore.findSession(claims.sessionId);
    const isLive =
      session !== null &&
      session.userId === claims.userId &&
      session.revokedAt === null &&
      session.expiresAt.getTime() > now.getTime();
    if (everywhere && isLive) {
      await prismaAdminSignInStore.revokeAllSessions({ userId: claims.userId, now });
    } else {
      await prismaAdminSignInStore.revokeSession({ sessionId: claims.sessionId, now });
    }
  } catch (error: unknown) {
    logFailure("Sign-out", error);
    redirect(`${ADMIN_SIGN_IN_PATH}?notice=sign-out-incomplete`);
  }
}

/** Ends this browser's session. */
export async function signOutAction(): Promise<void> {
  await endSession(false);
  redirect(ADMIN_SIGN_IN_PATH);
}

/** Ends every admin session, on every device. */
export async function signOutEverywhereAction(): Promise<void> {
  await endSession(true);
  redirect(ADMIN_SIGN_IN_PATH);
}
