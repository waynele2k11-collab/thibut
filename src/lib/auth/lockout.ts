/**
 * Sign-in lockout arithmetic. Pure.
 *
 * The rule is "write the try, then count it, then decide" (see admin-sign-in.ts): a try is
 * recorded before anything is checked, so tries sent at the same moment all see each other.
 */
export const LOCKOUT_WINDOW_MS = 15 * 60_000;
/** Unsuccessful tries allowed from one address inside the window. */
export const LOCKOUT_MAX_PER_ADDRESS = 5;
/** Unsuccessful tries allowed from all addresses together inside the window. */
export const LOCKOUT_MAX_OVERALL = 20;

export function lockoutWindowStart(now: Date): Date {
  return new Date(now.getTime() - LOCKOUT_WINDOW_MS);
}

/**
 * `perAddress` and `overall` are the unsuccessful tries inside the window, INCLUDING the one
 * just written. The try is refused when either is above its limit.
 */
export function isLockedOut(counts: { perAddress: number; overall: number }): boolean {
  return (
    counts.perAddress > LOCKOUT_MAX_PER_ADDRESS || counts.overall > LOCKOUT_MAX_OVERALL
  );
}

/**
 * A second, slower limit on wrong AUTHENTICATOR codes. A code try is only ever counted after a
 * correct password (the code step refuses earlier without the signed pending token), so these
 * are the tries of someone who already knows the password. After this many in the window,
 * authenticator codes are refused until the oldest ones leave the window; a recovery code, or
 * the founder's local `--clear-lockout` command, still gets in.
 */
export const CODE_FAILURE_WINDOW_MS = 24 * 60 * 60_000;
export const CODE_FAILURE_MAX = 10;

export function codeFailureWindowStart(now: Date): Date {
  return new Date(now.getTime() - CODE_FAILURE_WINDOW_MS);
}

/** `codeFailures` is the count inside the window INCLUDING the try just written. */
export function isCodeEntryPaused(codeFailures: number): boolean {
  return codeFailures > CODE_FAILURE_MAX;
}

/** Sign-in rows older than this are deleted when the admin next signs in. */
export const SIGN_IN_RECORD_RETENTION_MS = 30 * 24 * 60 * 60_000;
