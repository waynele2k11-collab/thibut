import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ADMIN_SIGN_IN_PATH } from "@/lib/admin-path";
import { getAdminIdentity } from "@/lib/auth/admin-identity";

export class AdminAuthError extends Error {
  public readonly status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export type AuthenticatedAdminUser = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

type AdminResolution =
  | { ok: true; user: AuthenticatedAdminUser }
  | {
      ok: false;
      status: 401 | 403 | 404;
      reason: "unconfigured" | "unauthenticated" | "forbidden";
    };

/**
 * The one place that decides admin access. Identity comes from the admin session cookie and
 * its database row (src/lib/auth/admin-identity.ts); the role is re-read from the database on
 * every call, so removing the ADMIN role or deactivating the user takes effect at once.
 */
async function resolveAdminUser(): Promise<AdminResolution> {
  const identity = await getAdminIdentity();
  if (identity.status === "unconfigured") {
    // Admin does not exist on a deployment without its signing secret: pages and API alike.
    return { ok: false, status: 404, reason: "unconfigured" };
  }
  if (identity.status !== "signed-in") {
    return { ok: false, status: 401, reason: "unauthenticated" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: identity.userId },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!dbUser || dbUser.status !== "ACTIVE") {
    return { ok: false, status: 401, reason: "unauthenticated" };
  }

  const isAdmin = dbUser.roles.some((r) => r.role.code === "ADMIN");
  if (!isAdmin) {
    return { ok: false, status: 403, reason: "forbidden" };
  }

  return { ok: true, user: dbUser };
}

/**
 * Page/Server-Action guard for admin flows.
 * Strictly requires an authenticated user with the DB ADMIN role.
 */
export async function requireAdmin(options?: {
  /** Kept so existing callers compile. The separate step-up no longer exists. */
  allowBeforeStepUp?: boolean;
}): Promise<AuthenticatedAdminUser> {
  void options;
  const result = await resolveAdminUser();

  if (!result.ok) {
    if (result.reason === "unconfigured") {
      // Admin does not exist on a deployment without its signing secret.
      notFound();
    }
    if (result.reason === "unauthenticated") {
      redirect(ADMIN_SIGN_IN_PATH);
    }
    redirect("/");
  }

  return result.user;
}

/**
 * API-route & non-redirecting Server Action guard.
 * Throws AdminAuthError(401 | 403, or 404 when admin sign-in is not configured) instead of
 * calling redirect().
 */
export async function assertAdminApi(options?: {
  /** Kept so existing callers compile. The separate step-up no longer exists. */
  allowBeforeStepUp?: boolean;
}): Promise<AuthenticatedAdminUser> {
  void options;
  const result = await resolveAdminUser();

  if (!result.ok) {
    const msg =
      result.status === 404
        ? "Not found"
        : result.status === 401
          ? "Authentication required"
          : "Admin role required";
    throw new AdminAuthError(result.status, msg);
  }

  return result.user;
}
