import "server-only";
import type { Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_STEPUP_COOKIE,
  verifyAdminStepUpToken,
} from "@/lib/security/tokens";

export class AdminAuthError extends Error {
  public readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export type AuthenticatedAdminUser = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

async function resolveAdminUser(options: {
  requireStepUpCookie: boolean;
}): Promise<
  | { ok: true; user: AuthenticatedAdminUser }
  | { ok: false; status: 401 | 403; reason: "unauthenticated" | "forbidden" | "stepup_required" }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return { ok: false, status: 401, reason: "unauthenticated" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
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

  if (
    options.requireStepUpCookie &&
    Boolean(process.env.ADMIN_MASTER_PASSWORD && process.env.ADMIN_SESSION_SECRET)
  ) {
    const cookieStore = await cookies();
    const stepUpToken = cookieStore.get(ADMIN_STEPUP_COOKIE)?.value;
    const verified = await verifyAdminStepUpToken(stepUpToken, dbUser.id);
    if (!verified) {
      return { ok: false, status: 403, reason: "stepup_required" };
    }
  }

  return { ok: true, user: dbUser };
}

/**
 * Page/Server-Action guard for admin flows.
 * Strictly requires an authenticated user with the DB ADMIN role.
 */
export async function requireAdmin(options?: {
  allowBeforeStepUp?: boolean;
}): Promise<AuthenticatedAdminUser> {
  const result = await resolveAdminUser({
    requireStepUpCookie: !options?.allowBeforeStepUp,
  });

  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    if (result.reason === "stepup_required") {
      redirect("/admin-verify");
    }
    redirect("/");
  }

  return result.user;
}

/**
 * API-route & non-redirecting Server Action guard.
 * Throws AdminAuthError(401 | 403) instead of calling redirect().
 */
export async function assertAdminApi(options?: {
  allowBeforeStepUp?: boolean;
}): Promise<AuthenticatedAdminUser> {
  const result = await resolveAdminUser({
    requireStepUpCookie: !options?.allowBeforeStepUp,
  });

  if (!result.ok) {
    const msg =
      result.reason === "unauthenticated"
        ? "Authentication required"
        : result.reason === "stepup_required"
          ? "Admin step-up verification required"
          : "Admin role required";
    throw new AdminAuthError(result.status, msg);
  }

  return result.user;
}
