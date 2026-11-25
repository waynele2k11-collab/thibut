import "server-only";
/**
 * Database implementation of the admin sign-in storage port (see admin-sign-in.ts).
 *
 * Every method the port marks ATOMIC is one conditional `updateMany`: the database decides the
 * winner, so two requests racing can never both succeed.
 *
 * The delegates are typed by hand here rather than through the generated Prisma client, so the
 * exact columns this file relies on are visible in one place and are pinned against
 * prisma/schema.prisma by tests/admin-sign-in.test.ts.
 */
import prisma from "@/lib/prisma";
import type {
  AdminAttemptKind,
  AdminCredentialRecord,
  AdminSessionRecord,
  AdminSignInStore,
} from "./admin-sign-in";

interface CountResult {
  count: number;
}

interface CredentialRow {
  userId: string;
  passwordHash: string;
  totpSecretSealed: string;
  user: {
    email: string | null;
    status: string;
    roles: Array<{ role: { code: string } }>;
  };
}

const CREDENTIAL_INCLUDE = {
  user: {
    select: {
      email: true,
      status: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  },
} as const;

interface AdminSignInDb {
  adminCredential: {
    findUnique(args: {
      where: { userId: string };
      include: typeof CREDENTIAL_INCLUDE;
    }): Promise<CredentialRow | null>;
    findFirst(args: {
      where: { user: { email: string } };
      include: typeof CREDENTIAL_INCLUDE;
    }): Promise<CredentialRow | null>;
    updateMany(args: {
      where: {
        userId: string;
        OR: Array<{ totpLastStep: null } | { totpLastStep: { lt: number } }>;
      };
      data: { totpLastStep: number };
    }): Promise<CountResult>;
  };
  adminRecoveryCode: {
    updateMany(args: {
      where: { userId: string; codeHash: string; usedAt: null };
      data: { usedAt: Date };
    }): Promise<CountResult>;
  };
  adminSession: {
    create(args: {
      data: { userId: string; expiresAt: Date; createdAt: Date };
      select: { id: true };
    }): Promise<{ id: string }>;
    findUnique(args: {
      where: { id: string };
      select: { id: true; userId: true; expiresAt: true; revokedAt: true };
    }): Promise<AdminSessionRecord | null>;
    updateMany(args: {
      where: { id?: string; userId?: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<CountResult>;
    deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<CountResult>;
  };
  adminSignInChallenge: {
    create(args: {
      data: { userId: string; expiresAt: Date; createdAt: Date };
      select: { id: true };
    }): Promise<{ id: string }>;
    updateMany(args: {
      where: {
        id: string;
        userId?: string;
        consumedAt: null;
        expiresAt?: { gt: Date };
        tries?: { lt: number };
      };
      data: { tries: { increment: number } } | { consumedAt: Date };
    }): Promise<CountResult>;
    deleteMany(args: { where: { createdAt: { lt: Date } } }): Promise<CountResult>;
  };
  adminLoginAttempt: {
    create(args: {
      data: { kind: string; addressHash: string; createdAt: Date };
      select: { id: true };
    }): Promise<{ id: string }>;
    count(args: {
      where: {
        succeeded: false;
        refused: false;
        createdAt: { gte: Date };
        addressHash?: string;
        kind?: string;
      };
    }): Promise<number>;
    updateMany(args: {
      where: { id: string };
      data: { succeeded: true } | { refused: true };
    }): Promise<CountResult>;
    deleteMany(args: {
      where: { id: string } | { createdAt: { lt: Date } };
    }): Promise<CountResult>;
  };
}

function db(): AdminSignInDb {
  return prisma as unknown as AdminSignInDb;
}

function toCredentialRecord(row: CredentialRow | null): AdminCredentialRecord | null {
  if (!row) return null;
  return {
    userId: row.userId,
    email: row.user.email,
    isActiveAdmin:
      row.user.status === "ACTIVE" && row.user.roles.some((r) => r.role.code === "ADMIN"),
    passwordHash: row.passwordHash,
    totpSecretSealed: row.totpSecretSealed,
  };
}

export const prismaAdminSignInStore: AdminSignInStore = {
  async findCredentialByEmail(email: string) {
    return toCredentialRecord(
      await db().adminCredential.findFirst({
        where: { user: { email } },
        include: CREDENTIAL_INCLUDE,
      })
    );
  },

  async findCredentialByUserId(userId: string) {
    return toCredentialRecord(
      await db().adminCredential.findUnique({ where: { userId }, include: CREDENTIAL_INCLUDE })
    );
  },

  async recordAttempt(input: { kind: AdminAttemptKind; addressHash: string; at: Date }) {
    const row = await db().adminLoginAttempt.create({
      data: { kind: input.kind, addressHash: input.addressHash, createdAt: input.at },
      select: { id: true },
    });
    return row.id;
  },

  async countUnsuccessfulAttempts(input: {
    since: Date;
    addressHash?: string;
    kind?: AdminAttemptKind;
  }) {
    return db().adminLoginAttempt.count({
      where: {
        succeeded: false,
        refused: false,
        createdAt: { gte: input.since },
        ...(input.addressHash ? { addressHash: input.addressHash } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      },
    });
  },

  async markAttemptSucceeded(attemptId: string) {
    await db().adminLoginAttempt.updateMany({
      where: { id: attemptId },
      data: { succeeded: true },
    });
  },

  async discardAttempt(attemptId: string) {
    await db().adminLoginAttempt.deleteMany({ where: { id: attemptId } });
  },

  async markAttemptRefused(attemptId: string) {
    await db().adminLoginAttempt.updateMany({
      where: { id: attemptId },
      data: { refused: true },
    });
  },

  // Three single DELETE statements. Sessions go by their expiry, so a live one is never removed.
  async pruneBefore(cutoff: Date) {
    await db().adminLoginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await db().adminSignInChallenge.deleteMany({ where: { createdAt: { lt: cutoff } } });
    await db().adminSession.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  },

  async createChallenge(input: { userId: string; expiresAt: Date; at: Date }) {
    const row = await db().adminSignInChallenge.create({
      data: { userId: input.userId, expiresAt: input.expiresAt, createdAt: input.at },
      select: { id: true },
    });
    return row.id;
  },

  async claimChallengeTry(input: {
    challengeId: string;
    userId: string;
    now: Date;
    maxTries: number;
  }) {
    const result = await db().adminSignInChallenge.updateMany({
      where: {
        id: input.challengeId,
        userId: input.userId,
        consumedAt: null,
        expiresAt: { gt: input.now },
        tries: { lt: input.maxTries },
      },
      data: { tries: { increment: 1 } },
    });
    return result.count === 1;
  },

  async consumeChallenge(input: { challengeId: string; now: Date }) {
    const result = await db().adminSignInChallenge.updateMany({
      where: { id: input.challengeId, consumedAt: null },
      data: { consumedAt: input.now },
    });
    return result.count === 1;
  },

  async acceptTotpStep(input: { userId: string; step: number }) {
    const result = await db().adminCredential.updateMany({
      where: {
        userId: input.userId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: input.step } }],
      },
      data: { totpLastStep: input.step },
    });
    return result.count === 1;
  },

  async useRecoveryCode(input: { userId: string; codeHash: string; now: Date }) {
    const result = await db().adminRecoveryCode.updateMany({
      where: { userId: input.userId, codeHash: input.codeHash, usedAt: null },
      data: { usedAt: input.now },
    });
    return result.count === 1;
  },

  async createSession(input: { userId: string; expiresAt: Date; at: Date }) {
    const row = await db().adminSession.create({
      data: { userId: input.userId, expiresAt: input.expiresAt, createdAt: input.at },
      select: { id: true },
    });
    return row.id;
  },

  async findSession(sessionId: string) {
    return db().adminSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  },

  async revokeSession(input: { sessionId: string; now: Date }) {
    await db().adminSession.updateMany({
      where: { id: input.sessionId, revokedAt: null },
      data: { revokedAt: input.now },
    });
  },

  async revokeAllSessions(input: { userId: string; now: Date }) {
    await db().adminSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: input.now },
    });
  },
};
