/**
 * Setting up the single admin account: password, authenticator secret, recovery codes.
 * Used only by the founder's local command (scripts/create-admin.ts), never by the website.
 *
 * Pure with respect to the outside world: storage, the clock and the master secret are passed
 * in. The secrets this returns are shown once by the caller and are not stored in the clear.
 */
import { normalizeAdminEmail } from "./admin-sign-in";
import { hashPassword, isAcceptablePassword, verifyPassword } from "./password";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";
import { deriveAdminKey, sealSecret } from "./secret-box";
import { buildOtpAuthUri, formatSetupKey, generateTotpSecret } from "./totp";

export const ADMIN_TOTP_ISSUER = "Thi But Admin";

export interface AdminAccountWrite {
  /** The existing user with this email, or null to create one. */
  existingUserId: string | null;
  email: string;
  /** Null leaves the stored password as it is (authenticator reset). */
  passwordHash: string | null;
  totpSecretSealed: string;
  recoveryCodeHashes: string[];
  now: Date;
}

/**
 * Storage port. `writeAdminAccount` must do all of this in ONE transaction: make sure the ADMIN
 * role exists and the user holds it, write the credential (clearing the last accepted
 * authenticator step), replace every recovery code, and revoke every admin session.
 */
export interface AdminEnrolmentStore {
  /** The user that already has an admin credential, if any. There is at most one. */
  findCredentialOwner(): Promise<{ userId: string; email: string | null } | null>;
  findUserIdByEmail(email: string): Promise<string | null>;
  findPasswordHash(userId: string): Promise<string | null>;
  writeAdminAccount(input: AdminAccountWrite): Promise<{ userId: string }>;
  /**
   * Deletes the unsuccessful sign-in tries (the rows both lockouts count) and returns how many.
   * Nothing else: no session, credential, recovery code or successful try is touched.
   */
  clearUnsuccessfulAttempts(): Promise<number>;
}

export interface AdminEnrolmentDeps {
  store: AdminEnrolmentStore;
  now: () => Date;
  /** ADMIN_SESSION_SECRET: the same value the website runs with. */
  masterSecret: string;
}

export type AdminEnrolmentFailure =
  | "invalid-email"
  | "weak-password"
  | "another-admin-exists"
  | "no-such-admin"
  | "wrong-password";

export type AdminEnrolmentResult =
  | {
      ok: true;
      userId: string;
      email: string;
      replacedExisting: boolean;
      /** Shown once, typed into the authenticator app. */
      setupKey: string;
      otpAuthUri: string;
      /** Shown once. */
      recoveryCodes: string[];
    }
  | { ok: false; reason: AdminEnrolmentFailure };

function newAuthenticator(deps: AdminEnrolmentDeps, email: string) {
  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  const recoveryKey = deriveAdminKey(deps.masterSecret, "recovery-codes");
  return {
    totpSecretSealed: sealSecret(secret, deriveAdminKey(deps.masterSecret, "totp-secret")),
    setupKey: formatSetupKey(secret),
    otpAuthUri: buildOtpAuthUri({ secret, accountName: email, issuer: ADMIN_TOTP_ISSUER }),
    recoveryCodes,
    recoveryCodeHashes: recoveryCodes.map((code) =>
      hashRecoveryCode(normalizeRecoveryCode(code) ?? code, recoveryKey)
    ),
  };
}

/**
 * Creates the admin, or replaces the admin's password, authenticator and recovery codes.
 * Refuses when a different user already holds the admin credential.
 *
 * When an admin already exists, the CURRENT password must be given and is checked first.
 * `forgotPassword: true` skips that check: it is for a founder who has lost the password, and
 * the calling command asks for an explicit typed confirmation before passing it. (Whoever can
 * run the command already holds the database address and the master secret, so the check
 * guards against mistakes, not against that person.)
 */
export async function enrolAdmin(
  deps: AdminEnrolmentDeps,
  input: {
    email: string;
    password: string;
    currentPassword?: string;
    forgotPassword?: boolean;
  }
): Promise<AdminEnrolmentResult> {
  const email = normalizeAdminEmail(input.email);
  if (!email) return { ok: false, reason: "invalid-email" };
  if (!isAcceptablePassword(input.password)) return { ok: false, reason: "weak-password" };

  const owner = await deps.store.findCredentialOwner();
  const existingUserId = await deps.store.findUserIdByEmail(email);
  if (owner && owner.userId !== existingUserId) {
    return { ok: false, reason: "another-admin-exists" };
  }
  if (owner && input.forgotPassword !== true) {
    const storedHash = await deps.store.findPasswordHash(owner.userId);
    const currentMatches = await verifyPassword(
      typeof input.currentPassword === "string" ? input.currentPassword : "",
      storedHash
    );
    if (!currentMatches) return { ok: false, reason: "wrong-password" };
  }

  const authenticator = newAuthenticator(deps, email);
  const passwordHash = await hashPassword(input.password);
  const { userId } = await deps.store.writeAdminAccount({
    existingUserId,
    email,
    passwordHash,
    totpSecretSealed: authenticator.totpSecretSealed,
    recoveryCodeHashes: authenticator.recoveryCodeHashes,
    now: deps.now(),
  });
  return {
    ok: true,
    userId,
    email,
    replacedExisting: owner !== null,
    setupKey: authenticator.setupKey,
    otpAuthUri: authenticator.otpAuthUri,
    recoveryCodes: authenticator.recoveryCodes,
  };
}

/**
 * New authenticator secret and recovery codes for the existing admin, after the password is
 * checked again. The password itself is left unchanged.
 */
export async function resetAdminAuthenticator(
  deps: AdminEnrolmentDeps,
  input: { email: string; password: string }
): Promise<AdminEnrolmentResult> {
  const email = normalizeAdminEmail(input.email);
  const owner = await deps.store.findCredentialOwner();
  const userId = email ? await deps.store.findUserIdByEmail(email) : null;
  const storedHash =
    owner && userId === owner.userId ? await deps.store.findPasswordHash(userId) : null;
  // One full scrypt whatever was typed.
  const passwordMatches = await verifyPassword(input.password, storedHash);
  if (!email || !owner || userId !== owner.userId) return { ok: false, reason: "no-such-admin" };
  if (!passwordMatches) return { ok: false, reason: "wrong-password" };

  const authenticator = newAuthenticator(deps, email);
  await deps.store.writeAdminAccount({
    existingUserId: owner.userId,
    email,
    passwordHash: null,
    totpSecretSealed: authenticator.totpSecretSealed,
    recoveryCodeHashes: authenticator.recoveryCodeHashes,
    now: deps.now(),
  });
  return {
    ok: true,
    userId: owner.userId,
    email,
    replacedExisting: true,
    setupKey: authenticator.setupKey,
    otpAuthUri: authenticator.otpAuthUri,
    recoveryCodes: authenticator.recoveryCodes,
  };
}

export type ClearLockoutResult =
  | { ok: true; removed: number }
  | { ok: false; reason: "no-such-admin" | "wrong-password" };

/**
 * Ends a sign-in lockout by deleting the unsuccessful tries, after the admin's password is
 * checked. For the founder's local command only: it is the way back in when someone keeps the
 * sign-in page locked, or when the slow limit on wrong codes has been reached.
 */
export async function clearAdminLockout(
  deps: AdminEnrolmentDeps,
  input: { email: string; password: string }
): Promise<ClearLockoutResult> {
  const email = normalizeAdminEmail(input.email);
  const owner = await deps.store.findCredentialOwner();
  const userId = email ? await deps.store.findUserIdByEmail(email) : null;
  const storedHash =
    owner && userId === owner.userId ? await deps.store.findPasswordHash(userId) : null;
  // One full scrypt whatever was typed.
  const passwordMatches = await verifyPassword(input.password, storedHash);
  if (!email || !owner || userId !== owner.userId) return { ok: false, reason: "no-such-admin" };
  if (!passwordMatches) return { ok: false, reason: "wrong-password" };
  return { ok: true, removed: await deps.store.clearUnsuccessfulAttempts() };
}
