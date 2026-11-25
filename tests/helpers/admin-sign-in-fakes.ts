/**
 * In-memory stand-ins for the admin sign-in storage ports.
 *
 * They behave like the database versions in the one way that matters for these rules: every
 * method yields first (so concurrent callers really interleave), and then does its check and
 * its write in one uninterrupted step, like a single conditional SQL statement.
 */
import crypto from "node:crypto";
import type {
  AdminAttemptKind,
  AdminCredentialRecord,
  AdminSessionRecord,
  AdminSignInStore,
} from "@/lib/auth/admin-sign-in";
import type { AdminAccountWrite, AdminEnrolmentStore } from "@/lib/auth/admin-enrolment";

function yieldToOthers(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export interface FakeUser {
  id: string;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED";
  isAdmin: boolean;
}

export interface FakeCredential {
  userId: string;
  passwordHash: string;
  totpSecretSealed: string;
  totpLastStep: number | null;
}

export interface FakeAttempt {
  id: string;
  kind: AdminAttemptKind;
  addressHash: string;
  succeeded: boolean;
  refused: boolean;
  createdAt: Date;
}

export interface FakeChallenge {
  id: string;
  userId: string;
  tries: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface FakeRecoveryCode {
  userId: string;
  codeHash: string;
  usedAt: Date | null;
}

export class FakeAdminDatabase {
  users = new Map<string, FakeUser>();
  credentials = new Map<string, FakeCredential>();
  attempts = new Map<string, FakeAttempt>();
  challenges = new Map<string, FakeChallenge>();
  recoveryCodes: FakeRecoveryCode[] = [];
  sessions = new Map<string, AdminSessionRecord>();
  /** How many times each store method ran, for "nothing was counted" assertions. */
  calls: Record<string, number> = {};
  /** Set to make the housekeeping delete fail, as a database error would. */
  failPrune = false;

  private count(name: string): void {
    this.calls[name] = (this.calls[name] ?? 0) + 1;
  }

  private toRecord(credential: FakeCredential | undefined): AdminCredentialRecord | null {
    if (!credential) return null;
    const user = this.users.get(credential.userId);
    if (!user) return null;
    return {
      userId: credential.userId,
      email: user.email,
      isActiveAdmin: user.status === "ACTIVE" && user.isAdmin,
      passwordHash: credential.passwordHash,
      totpSecretSealed: credential.totpSecretSealed,
    };
  }

  signInStore(): AdminSignInStore {
    return {
      findCredentialByEmail: async (email) => {
        await yieldToOthers();
        this.count("findCredentialByEmail");
        for (const credential of this.credentials.values()) {
          if (this.users.get(credential.userId)?.email === email) {
            return this.toRecord(credential);
          }
        }
        return null;
      },
      findCredentialByUserId: async (userId) => {
        await yieldToOthers();
        return this.toRecord(this.credentials.get(userId));
      },
      recordAttempt: async (input) => {
        await yieldToOthers();
        this.count("recordAttempt");
        const id = crypto.randomUUID();
        this.attempts.set(id, {
          id,
          kind: input.kind,
          addressHash: input.addressHash,
          succeeded: false,
          refused: false,
          createdAt: input.at,
        });
        return id;
      },
      countUnsuccessfulAttempts: async (input) => {
        await yieldToOthers();
        let total = 0;
        for (const attempt of this.attempts.values()) {
          if (attempt.succeeded || attempt.refused) continue;
          if (attempt.createdAt.getTime() < input.since.getTime()) continue;
          if (input.addressHash && attempt.addressHash !== input.addressHash) continue;
          if (input.kind && attempt.kind !== input.kind) continue;
          total += 1;
        }
        return total;
      },
      markAttemptSucceeded: async (attemptId) => {
        await yieldToOthers();
        const attempt = this.attempts.get(attemptId);
        if (attempt) attempt.succeeded = true;
      },
      discardAttempt: async (attemptId) => {
        await yieldToOthers();
        this.attempts.delete(attemptId);
      },
      markAttemptRefused: async (attemptId) => {
        await yieldToOthers();
        const attempt = this.attempts.get(attemptId);
        if (attempt) attempt.refused = true;
      },
      pruneBefore: async (cutoff) => {
        await yieldToOthers();
        this.count("pruneBefore");
        if (this.failPrune) throw new Error("prune failed");
        for (const [id, attempt] of this.attempts) {
          if (attempt.createdAt.getTime() < cutoff.getTime()) this.attempts.delete(id);
        }
        for (const [id, challenge] of this.challenges) {
          if (challenge.createdAt.getTime() < cutoff.getTime()) this.challenges.delete(id);
        }
        for (const [id, session] of this.sessions) {
          if (session.expiresAt.getTime() < cutoff.getTime()) this.sessions.delete(id);
        }
      },
      createChallenge: async (input) => {
        await yieldToOthers();
        const id = crypto.randomUUID();
        this.challenges.set(id, {
          id,
          userId: input.userId,
          tries: 0,
          expiresAt: input.expiresAt,
          consumedAt: null,
          createdAt: input.at,
        });
        return id;
      },
      claimChallengeTry: async (input) => {
        await yieldToOthers();
        this.count("claimChallengeTry");
        const challenge = this.challenges.get(input.challengeId);
        if (
          !challenge ||
          challenge.userId !== input.userId ||
          challenge.consumedAt !== null ||
          challenge.expiresAt.getTime() <= input.now.getTime() ||
          challenge.tries >= input.maxTries
        ) {
          return false;
        }
        challenge.tries += 1;
        return true;
      },
      consumeChallenge: async (input) => {
        await yieldToOthers();
        const challenge = this.challenges.get(input.challengeId);
        if (!challenge || challenge.consumedAt !== null) return false;
        challenge.consumedAt = input.now;
        return true;
      },
      acceptTotpStep: async (input) => {
        await yieldToOthers();
        const credential = this.credentials.get(input.userId);
        if (!credential) return false;
        if (credential.totpLastStep !== null && credential.totpLastStep >= input.step) {
          return false;
        }
        credential.totpLastStep = input.step;
        return true;
      },
      useRecoveryCode: async (input) => {
        await yieldToOthers();
        const row = this.recoveryCodes.find(
          (code) =>
            code.userId === input.userId &&
            code.codeHash === input.codeHash &&
            code.usedAt === null
        );
        if (!row) return false;
        row.usedAt = input.now;
        return true;
      },
      createSession: async (input) => {
        await yieldToOthers();
        const id = crypto.randomUUID();
        this.sessions.set(id, {
          id,
          userId: input.userId,
          expiresAt: input.expiresAt,
          revokedAt: null,
        });
        return id;
      },
      findSession: async (sessionId) => {
        await yieldToOthers();
        return this.sessions.get(sessionId) ?? null;
      },
      revokeSession: async (input) => {
        await yieldToOthers();
        const session = this.sessions.get(input.sessionId);
        if (session && session.revokedAt === null) session.revokedAt = input.now;
      },
      revokeAllSessions: async (input) => {
        await yieldToOthers();
        for (const session of this.sessions.values()) {
          if (session.userId === input.userId && session.revokedAt === null) {
            session.revokedAt = input.now;
          }
        }
      },
    };
  }

  enrolmentStore(): AdminEnrolmentStore {
    return {
      findCredentialOwner: async () => {
        const first = [...this.credentials.values()][0];
        if (!first) return null;
        return { userId: first.userId, email: this.users.get(first.userId)?.email ?? null };
      },
      findUserIdByEmail: async (email) => {
        for (const user of this.users.values()) {
          if (user.email === email) return user.id;
        }
        return null;
      },
      findPasswordHash: async (userId) => this.credentials.get(userId)?.passwordHash ?? null,
      writeAdminAccount: async (input: AdminAccountWrite) => {
        const userId = input.existingUserId ?? crypto.randomUUID();
        const existingUser = this.users.get(userId);
        this.users.set(userId, {
          id: userId,
          email: existingUser?.email ?? input.email,
          status: "ACTIVE",
          isAdmin: true,
        });
        const existing = this.credentials.get(userId);
        if (!input.passwordHash && !existing) {
          throw new Error("No credential to update");
        }
        this.credentials.set(userId, {
          userId,
          passwordHash: input.passwordHash ?? existing!.passwordHash,
          totpSecretSealed: input.totpSecretSealed,
          totpLastStep: null,
        });
        this.recoveryCodes = this.recoveryCodes.filter((code) => code.userId !== userId);
        for (const codeHash of input.recoveryCodeHashes) {
          this.recoveryCodes.push({ userId, codeHash, usedAt: null });
        }
        for (const session of this.sessions.values()) {
          if (session.userId === userId && session.revokedAt === null) {
            session.revokedAt = input.now;
          }
        }
        for (const challenge of this.challenges.values()) {
          if (challenge.userId === userId && challenge.consumedAt === null) {
            challenge.consumedAt = input.now;
          }
        }
        return { userId };
      },
      clearUnsuccessfulAttempts: async () => {
        let removed = 0;
        for (const [id, attempt] of this.attempts) {
          if (!attempt.succeeded) {
            this.attempts.delete(id);
            removed += 1;
          }
        }
        return removed;
      },
    };
  }
}

/** A clock the test moves by hand. */
export class TestClock {
  constructor(private ms: number) {}
  now = (): Date => new Date(this.ms);
  advance(ms: number): void {
    this.ms += ms;
  }
  set(ms: number): void {
    this.ms = ms;
  }
}
