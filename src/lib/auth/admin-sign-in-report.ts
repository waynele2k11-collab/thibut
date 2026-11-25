import "server-only";
/**
 * Reads the sign-in activity shown to the admin on the admin landing page
 * (see sign-in-report.ts for what is shown and why). Read-only.
 *
 * Delegates are typed by hand, like src/lib/auth/admin-store.ts; the columns are pinned
 * against prisma/schema.prisma by tests/admin-sign-in-wiring.test.ts.
 */
import prisma from "@/lib/prisma";
import { getAdminIdentity } from "./admin-identity";
import {
  describeSignInReport,
  type AdminSignInNotice,
  type AdminSignInReport,
} from "./sign-in-report";

interface ReportDb {
  adminSession: {
    findUnique(args: {
      where: { id: string };
      select: { userId: true; createdAt: true };
    }): Promise<{ userId: string; createdAt: Date } | null>;
    findFirst(args: {
      where: { userId: string; createdAt: { lt: Date } };
      orderBy: { createdAt: "desc" };
      select: { createdAt: true };
    }): Promise<{ createdAt: Date } | null>;
  };
  adminLoginAttempt: {
    count(args: {
      where: {
        succeeded: false;
        kind: { in: string[] };
        createdAt: { gte: Date; lt: Date };
      };
    }): Promise<number>;
  };
  adminRecoveryCode: {
    count(args: { where: { userId: string; usedAt: null } }): Promise<number>;
    findFirst(args: {
      where: { userId: string; usedAt: { not: null } };
      orderBy: { usedAt: "desc" };
      select: { usedAt: true };
    }): Promise<{ usedAt: Date | null } | null>;
  };
}

function db(): ReportDb {
  return prisma as unknown as ReportDb;
}

/** Null when the session is not on record (it cannot be, for a caller that passed the guard). */
export async function loadAdminSignInReport(input: {
  userId: string;
  sessionId: string;
}): Promise<AdminSignInReport | null> {
  const current = await db().adminSession.findUnique({
    where: { id: input.sessionId },
    select: { userId: true, createdAt: true },
  });
  if (!current || current.userId !== input.userId) return null;

  const previous = await db().adminSession.findFirst({
    where: { userId: input.userId, createdAt: { lt: current.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = previous?.createdAt ?? new Date(0);

  const [failedCodeTries, recoveryCodesLeft, lastUsed] = await Promise.all([
    // Refused tries are included on purpose: they are tries all the same.
    db().adminLoginAttempt.count({
      where: {
        succeeded: false,
        kind: { in: ["CODE", "RECOVERY"] },
        createdAt: { gte: since, lt: current.createdAt },
      },
    }),
    db().adminRecoveryCode.count({ where: { userId: input.userId, usedAt: null } }),
    db().adminRecoveryCode.findFirst({
      where: { userId: input.userId, usedAt: { not: null } },
      orderBy: { usedAt: "desc" },
      select: { usedAt: true },
    }),
  ]);
  const lastRecoveryCodeUsedAt = lastUsed?.usedAt ?? null;

  return {
    previousSignInAt: previous?.createdAt ?? null,
    failedCodeTries,
    recoveryCodesLeft,
    lastRecoveryCodeUsedAt,
    recoveryCodeUsedSinceLastSignIn:
      lastRecoveryCodeUsedAt !== null && lastRecoveryCodeUsedAt.getTime() > since.getTime(),
  };
}

/**
 * The notices for the admin who is signed in on this request. Call it only after
 * `requireAdmin()`. It never throws: a problem reading the record must not take the admin
 * landing page down, so it then shows nothing.
 */
export async function loadSignInNoticesForCurrentAdmin(): Promise<AdminSignInNotice[]> {
  try {
    const identity = await getAdminIdentity();
    if (identity.status !== "signed-in") return [];
    const report = await loadAdminSignInReport({
      userId: identity.userId,
      sessionId: identity.sessionId,
    });
    return report ? describeSignInReport(report) : [];
  } catch (error: unknown) {
    console.error(
      "[AdminSignIn] Sign-in report could not be read:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return [];
  }
}
