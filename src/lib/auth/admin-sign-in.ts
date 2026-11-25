/**
 * Admin sign-in rules: password step, authenticator (or recovery code) step, lockout.
 *
 * Pure with respect to the outside world: storage, the clock and the master secret are passed
 * in, so every rule here runs in tests against an in-memory store that has the same atomic
 * behaviour as the database one (src/lib/auth/admin-store.ts).
 *
 * Every failure returns the same value, `{ ok: false }`: a caller cannot tell a wrong password
 * from a wrong code, an unknown email or a lockout.
 */
import crypto from "node:crypto";
import {
  SIGN_IN_RECORD_RETENTION_MS,
  codeFailureWindowStart,
  isCodeEntryPaused,
  isLockedOut,
  lockoutWindowStart,
} from "./lockout";
import { verifyPassword } from "./password";
import { hashRecoveryCode, normalizeRecoveryCode } from "./recovery-codes";
import { deriveAdminKey, openSecret } from "./secret-box";
import { findMatchingTimeStep, normalizeTotpInput } from "./totp";

export const ADMIN_SESSION_LIFETIME_MS = 8 * 60 * 60_000;
export const SIGN_IN_CHALLENGE_LIFETIME_MS = 5 * 60_000;
export const SIGN_IN_CHALLENGE_MAX_TRIES = 5;

/**
 * PASSWORD: an email-and-password try. CODE: an authenticator-code try. RECOVERY: a
 * recovery-code try. The last two are only ever written after a correct password.
 */
export type AdminAttemptKind = "PASSWORD" | "CODE" | "RECOVERY";

export interface AdminCredentialRecord {
  userId: string;
  email: string | null;
  /** True only for an ACTIVE user that holds the ADMIN role. */
  isActiveAdmin: boolean;
  passwordHash: string;
  totpSecretSealed: string;
}

export interface AdminSessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Storage port. Methods marked ATOMIC must be a single conditional statement in the database
 * (or the equivalent in a fake): two callers racing must never both get `true`.
 */
export interface AdminSignInStore {
  findCredentialByEmail(email: string): Promise<AdminCredentialRecord | null>;
  findCredentialByUserId(userId: string): Promise<AdminCredentialRecord | null>;

  /** Writes one unsuccessful try and returns its id. Called before anything is checked. */
  recordAttempt(input: { kind: AdminAttemptKind; addressHash: string; at: Date }): Promise<string>;
  /**
   * Unsuccessful tries since `since` that were not marked refused; from one address when
   * `addressHash` is given, of one kind when `kind` is given.
   */
  countUnsuccessfulAttempts(input: {
    since: Date;
    addressHash?: string;
    kind?: AdminAttemptKind;
  }): Promise<number>;
  markAttemptSucceeded(attemptId: string): Promise<void>;
  /** Removes a try that was refused by the lockout, so refusals do not extend the lockout. */
  discardAttempt(attemptId: string): Promise<void>;
  /**
   * Keeps a try that was refused by the slow code limit, marked so that it no longer counts
   * toward any limit. It stays on record so the admin is told about it after signing in.
   */
  markAttemptRefused(attemptId: string): Promise<void>;
  /** Deletes sign-in tries and challenges created, and sessions expired, before `cutoff`. */
  pruneBefore(cutoff: Date): Promise<void>;

  createChallenge(input: { userId: string; expiresAt: Date; at: Date }): Promise<string>;
  /** ATOMIC. Takes one try if the challenge is this user's, unused, unexpired and under the cap. */
  claimChallengeTry(input: {
    challengeId: string;
    userId: string;
    now: Date;
    maxTries: number;
  }): Promise<boolean>;
  /** ATOMIC. Marks the challenge used; true for exactly one caller. */
  consumeChallenge(input: { challengeId: string; now: Date }): Promise<boolean>;

  /** ATOMIC. Records `step` as the newest accepted step only if it is newer than the stored one. */
  acceptTotpStep(input: { userId: string; step: number }): Promise<boolean>;
  /** ATOMIC. Marks an unused recovery code used; true for exactly one caller. */
  useRecoveryCode(input: { userId: string; codeHash: string; now: Date }): Promise<boolean>;

  createSession(input: { userId: string; expiresAt: Date; at: Date }): Promise<string>;
  findSession(sessionId: string): Promise<AdminSessionRecord | null>;
  revokeSession(input: { sessionId: string; now: Date }): Promise<void>;
  revokeAllSessions(input: { userId: string; now: Date }): Promise<void>;
}

export interface AdminSignInDeps {
  store: AdminSignInStore;
  now: () => Date;
  /** ADMIN_SESSION_SECRET. */
  masterSecret: string;
}

export function normalizeAdminEmail(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.normalize("NFKC").trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !email.includes("@")) return null;
  return email;
}

/** The address is stored only as a keyed hash. */
export function hashClientAddress(address: string, masterSecret: string): string {
  const key = deriveAdminKey(masterSecret, "address-hash");
  return crypto.createHmac("sha256", key).update(address.trim().toLowerCase()).digest("hex");
}

/**
 * Write the try, count it, decide. Returns the attempt id when the try may go ahead, or null
 * when it is refused (the refused try is removed again).
 */
async function admitAttempt(
  deps: AdminSignInDeps,
  kind: AdminAttemptKind,
  addressHash: string
): Promise<string | null> {
  const now = deps.now();
  const attemptId = await deps.store.recordAttempt({ kind, addressHash, at: now });
  const since = lockoutWindowStart(now);
  const [perAddress, overall] = await Promise.all([
    deps.store.countUnsuccessfulAttempts({ since, addressHash }),
    deps.store.countUnsuccessfulAttempts({ since }),
  ]);
  if (isLockedOut({ perAddress, overall })) {
    await deps.store.discardAttempt(attemptId);
    return null;
  }
  return attemptId;
}

export type PasswordStepResult =
  | { ok: true; userId: string; challengeId: string; challengeExpiresAt: Date }
  | { ok: false };

/** Step 1: email and password. On success a short-lived challenge is opened for step 2. */
export async function beginAdminSignIn(
  deps: AdminSignInDeps,
  input: { email: string; password: string; addressHash: string }
): Promise<PasswordStepResult> {
  const attemptId = await admitAttempt(deps, "PASSWORD", input.addressHash);
  if (!attemptId) return { ok: false };

  const email = normalizeAdminEmail(input.email);
  const credential = email ? await deps.store.findCredentialByEmail(email) : null;
  // Always one full scrypt, also when there is no such admin.
  const passwordMatches = await verifyPassword(
    typeof input.password === "string" ? input.password : "",
    credential?.passwordHash
  );
  if (!credential || !credential.isActiveAdmin || !passwordMatches) {
    return { ok: false };
  }

  const now = deps.now();
  const challengeExpiresAt = new Date(now.getTime() + SIGN_IN_CHALLENGE_LIFETIME_MS);
  const challengeId = await deps.store.createChallenge({
    userId: credential.userId,
    expiresAt: challengeExpiresAt,
    at: now,
  });
  await deps.store.markAttemptSucceeded(attemptId);
  return { ok: true, userId: credential.userId, challengeId, challengeExpiresAt };
}

export type CodeStepResult =
  | {
      ok: true;
      userId: string;
      sessionId: string;
      sessionExpiresAt: Date;
      usedRecoveryCode: boolean;
    }
  | { ok: false };

/**
 * Step 2: a code from the authenticator app, or a recovery code. `userId` and `challengeId`
 * come from the signed pending token set by step 1; the caller verifies that token first and
 * does not call this function without it.
 */
export async function completeAdminSignIn(
  deps: AdminSignInDeps,
  input: { userId: string; challengeId: string; code: string; addressHash: string }
): Promise<CodeStepResult> {
  const rawCode = typeof input.code === "string" ? input.code : "";
  // Six digits is an authenticator code; anything else is treated as a recovery code.
  const isAuthenticatorCode = normalizeTotpInput(rawCode) !== null;
  const attemptId = await admitAttempt(
    deps,
    isAuthenticatorCode ? "CODE" : "RECOVERY",
    input.addressHash
  );
  if (!attemptId) return { ok: false };

  if (isAuthenticatorCode) {
    // The slow limit. Same rule as the lockout: the try is already written, so tries sent at
    // the same moment all see each other, and no more than the limit can ever get through.
    const codeFailures = await deps.store.countUnsuccessfulAttempts({
      since: codeFailureWindowStart(deps.now()),
      kind: "CODE",
    });
    if (isCodeEntryPaused(codeFailures)) {
      await deps.store.markAttemptRefused(attemptId);
      return { ok: false };
    }
  }

  // Take one of the challenge's tries before looking at the code.
  const claimed = await deps.store.claimChallengeTry({
    challengeId: input.challengeId,
    userId: input.userId,
    now: deps.now(),
    maxTries: SIGN_IN_CHALLENGE_MAX_TRIES,
  });
  if (!claimed) return { ok: false };

  const credential = await deps.store.findCredentialByUserId(input.userId);
  if (!credential || !credential.isActiveAdmin) return { ok: false };

  let accepted = false;
  let usedRecoveryCode = false;

  if (isAuthenticatorCode) {
    const secret = openSecret(
      credential.totpSecretSealed,
      deriveAdminKey(deps.masterSecret, "totp-secret")
    );
    const step = secret ? findMatchingTimeStep(secret, rawCode, deps.now().getTime()) : null;
    if (step !== null) {
      // Only a step newer than the last accepted one: a code is good once.
      accepted = await deps.store.acceptTotpStep({ userId: credential.userId, step });
    }
  } else {
    const recovery = normalizeRecoveryCode(rawCode);
    if (recovery) {
      accepted = await deps.store.useRecoveryCode({
        userId: credential.userId,
        codeHash: hashRecoveryCode(recovery, deriveAdminKey(deps.masterSecret, "recovery-codes")),
        now: deps.now(),
      });
      usedRecoveryCode = accepted;
    }
  }
  if (!accepted) return { ok: false };

  const consumed = await deps.store.consumeChallenge({
    challengeId: input.challengeId,
    now: deps.now(),
  });
  if (!consumed) return { ok: false };

  const now = deps.now();
  const sessionExpiresAt = new Date(now.getTime() + ADMIN_SESSION_LIFETIME_MS);
  const sessionId = await deps.store.createSession({
    userId: credential.userId,
    expiresAt: sessionExpiresAt,
    at: now,
  });
  await deps.store.markAttemptSucceeded(attemptId);
  // Housekeeping. A failure here must not undo a sign-in that has already succeeded.
  try {
    await deps.store.pruneBefore(new Date(now.getTime() - SIGN_IN_RECORD_RETENTION_MS));
  } catch {
    // Old rows are removed at the next sign-in instead.
  }
  return { ok: true, userId: credential.userId, sessionId, sessionExpiresAt, usedRecoveryCode };
}

/**
 * The session named by a verified cookie, if the database still stands behind it.
 * Returns the admin's user id, or null.
 */
export async function resolveAdminSession(
  deps: Pick<AdminSignInDeps, "store" | "now">,
  claims: { userId: string; sessionId: string }
): Promise<string | null> {
  const session = await deps.store.findSession(claims.sessionId);
  if (!session) return null;
  if (session.userId !== claims.userId) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= deps.now().getTime()) return null;
  return session.userId;
}
