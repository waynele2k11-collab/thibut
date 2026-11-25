/**
 * Admin sign-in (docs/AUTH_MOVE_PLAN.md, option B): password, authenticator app, recovery
 * codes, lockout, sessions. Rules are tested against in-memory stores with the same atomic
 * behaviour as the database ones (tests/helpers/admin-sign-in-fakes.ts).
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  ADMIN_SESSION_LIFETIME_MS,
  SIGN_IN_CHALLENGE_LIFETIME_MS,
  SIGN_IN_CHALLENGE_MAX_TRIES,
  beginAdminSignIn,
  completeAdminSignIn,
  hashClientAddress,
  normalizeAdminEmail,
  resolveAdminSession,
  type AdminSignInDeps,
} from "@/lib/auth/admin-sign-in";
import {
  clearAdminLockout,
  enrolAdmin,
  resetAdminAuthenticator,
} from "@/lib/auth/admin-enrolment";
import {
  adminPendingCookieClearing,
  adminPendingCookieName,
  adminSessionCookieClearing,
  adminSessionCookieName,
  adminSessionCookieOptions,
} from "@/lib/auth/admin-cookies";
import { describeSignInReport } from "@/lib/auth/sign-in-report";
import { isPlaceholderSecret } from "@/lib/security/placeholder";
import {
  CODE_FAILURE_MAX,
  CODE_FAILURE_WINDOW_MS,
  SIGN_IN_RECORD_RETENTION_MS,
  isCodeEntryPaused,
  LOCKOUT_MAX_OVERALL,
  LOCKOUT_MAX_PER_ADDRESS,
  LOCKOUT_WINDOW_MS,
  isLockedOut,
} from "@/lib/auth/lockout";
import {
  DEFAULT_SCRYPT_PARAMS,
  hashPassword,
  isAcceptablePassword,
  parsePasswordHash,
  verifyPassword,
} from "@/lib/auth/password";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "@/lib/auth/recovery-codes";
import { deriveAdminKey, openSecret, sealSecret } from "@/lib/auth/secret-box";
import {
  TOTP_STEP_SECONDS,
  base32Decode,
  base32Encode,
  buildOtpAuthUri,
  findMatchingTimeStep,
  hotp,
  timeStepAt,
  totpAt,
} from "@/lib/auth/totp";
import {
  signAdminPendingToken,
  signAdminSessionToken,
  verifyAdminPendingToken,
  verifyAdminSessionToken,
} from "@/lib/security/tokens";
import { FakeAdminDatabase, TestClock } from "./helpers/admin-sign-in-fakes";

type ResponseCookiesCtor = new (headers: Headers) => {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
  delete(name: string): unknown;
};

const MASTER_SECRET = "test-admin-session-secret-of-40-characters";
const PASSWORD = "correct horse battery staple";
/** Cheap scrypt for stored test hashes; the default cost is checked once on its own. */
const FAST_SCRYPT = { N: 16384, r: 8, p: 1 };
const ADDRESS_A = hashClientAddress("198.51.100.10", MASTER_SECRET);
const START_MS = Date.UTC(2026, 10, 24, 12, 0, 15);

interface SeededAdmin {
  db: FakeAdminDatabase;
  clock: TestClock;
  deps: AdminSignInDeps;
  userId: string;
  totpSecret: Buffer;
  recoveryCodes: string[];
}

async function seedAdmin(options?: {
  status?: "ACTIVE" | "SUSPENDED";
  isAdmin?: boolean;
}): Promise<SeededAdmin> {
  const db = new FakeAdminDatabase();
  const clock = new TestClock(START_MS);
  const userId = "admin-user-1";
  const totpSecret = crypto.randomBytes(20);
  db.users.set(userId, {
    id: userId,
    email: "owner@thibut.test",
    status: options?.status ?? "ACTIVE",
    isAdmin: options?.isAdmin ?? true,
  });
  db.credentials.set(userId, {
    userId,
    passwordHash: await hashPassword(PASSWORD, FAST_SCRYPT),
    totpSecretSealed: sealSecret(totpSecret, deriveAdminKey(MASTER_SECRET, "totp-secret")),
    totpLastStep: null,
  });
  const recoveryCodes = generateRecoveryCodes();
  const recoveryKey = deriveAdminKey(MASTER_SECRET, "recovery-codes");
  for (const code of recoveryCodes) {
    db.recoveryCodes.push({
      userId,
      codeHash: hashRecoveryCode(normalizeRecoveryCode(code)!, recoveryKey),
      usedAt: null,
    });
  }
  const deps: AdminSignInDeps = {
    store: db.signInStore(),
    now: clock.now,
    masterSecret: MASTER_SECRET,
  };
  return { db, clock, deps, userId, totpSecret, recoveryCodes };
}

async function passPasswordStep(admin: SeededAdmin, addressHash = ADDRESS_A) {
  const result = await beginAdminSignIn(admin.deps, {
    email: "owner@thibut.test",
    password: PASSWORD,
    addressHash,
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result;
}

function failedTries(db: FakeAdminDatabase): number {
  return [...db.attempts.values()].filter((attempt) => !attempt.succeeded).length;
}

function wrongCodeFor(admin: SeededAdmin): string {
  const now = admin.clock.now().getTime();
  const valid = new Set(
    [-1, 0, 1].map((delta) => hotp(admin.totpSecret, timeStepAt(now) + delta))
  );
  for (let n = 0; n < 1_000_000; n++) {
    const candidate = n.toString().padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
  throw new Error("unreachable");
}

// ───────────────────────────── password ─────────────────────────────

test("password: scrypt hash round-trips, is salted, and a wrong or over-long password fails", async () => {
  const hash = await hashPassword(PASSWORD, FAST_SCRYPT);
  assert.match(hash, /^scrypt:16384:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(hash.includes("$"), false, "no $ so env loaders cannot expand it");
  assert.equal(hash.includes(PASSWORD), false);
  assert.notEqual(hash, await hashPassword(PASSWORD, FAST_SCRYPT), "a fresh salt every time");

  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword(`${PASSWORD} `, hash), false);
  assert.equal(await verifyPassword("", hash), false);
  assert.equal(await verifyPassword("x".repeat(5000), hash), false);

  assert.equal(isAcceptablePassword("short"), false);
  await assert.rejects(() => hashPassword("short"), /12 to 256/);
  assert.deepEqual(DEFAULT_SCRYPT_PARAMS, { N: 131072, r: 8, p: 1 });
});

test("password: a missing, tampered or weakened stored hash never verifies", async () => {
  const hash = await hashPassword(PASSWORD, FAST_SCRYPT);
  const parts = hash.split(":");

  assert.equal(await verifyPassword(PASSWORD, null), false);
  assert.equal(await verifyPassword(PASSWORD, ""), false);
  assert.equal(await verifyPassword(PASSWORD, PASSWORD), false, "a plain-text value is not a hash");

  const flipped = [...parts];
  flipped[5] = (flipped[5][0] === "A" ? "B" : "A") + flipped[5].slice(1);
  assert.equal(await verifyPassword(PASSWORD, flipped.join(":")), false);

  // Parameters an attacker might write to make guessing cheap, or to exhaust memory
  for (const [n, r, p] of [
    ["2", "8", "1"],
    ["1024", "8", "1"],
    ["16385", "8", "1"],
    ["16384", "1", "1"],
    ["4194304", "8", "1"],
    ["16384", "8", "99"],
  ]) {
    const weakened = ["scrypt", n, r, p, parts[4], parts[5]].join(":");
    assert.equal(parsePasswordHash(weakened), null, `N=${n} r=${r} p=${p} must be refused`);
    assert.equal(await verifyPassword(PASSWORD, weakened), false);
  }
  assert.equal(parsePasswordHash(`bcrypt:${parts.slice(1).join(":")}`), null);
  assert.equal(parsePasswordHash(parts.slice(0, 5).join(":")), null);
});

// ───────────────────────────── authenticator codes ─────────────────────────────

test("TOTP: matches the RFC 6238 SHA-1 test vectors and RFC 4226 HOTP values", () => {
  const secret = Buffer.from("12345678901234567890", "ascii");
  // RFC 6238 appendix B (8 digits, SHA-1)
  for (const [seconds, expected] of [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ] as const) {
    assert.equal(hotp(secret, Math.floor(seconds / TOTP_STEP_SECONDS), 8), expected);
    assert.equal(totpAt(secret, seconds * 1000), expected.slice(2), "6 digits are the last six");
  }
  // RFC 4226 appendix D (6 digits)
  const rfc4226 = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  rfc4226.forEach((expected, counter) => assert.equal(hotp(secret, counter), expected));

  // Base32 as authenticator apps expect it (RFC 4648 vectors)
  assert.equal(base32Encode(Buffer.from("foobar")), "MZXW6YTBOI");
  assert.equal(base32Decode("mzxw 6ytb oi")?.toString(), "foobar");
  assert.equal(base32Decode("not-base32-!"), null);
  assert.equal(base32Encode(secret), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  const uri = buildOtpAuthUri({ secret, accountName: "owner@thibut.test", issuer: "Thi But Admin" });
  assert.match(uri, /^otpauth:\/\/totp\/Thi%20But%20Admin:owner%40thibut\.test\?/);
  assert.match(uri, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
  assert.match(uri, /digits=6/);
  assert.match(uri, /period=30/);
});

test("TOTP: accepts the previous, current and next step only, and nothing malformed", () => {
  const secret = crypto.randomBytes(20);
  const step = timeStepAt(START_MS);
  for (const delta of [-1, 0, 1]) {
    assert.equal(findMatchingTimeStep(secret, hotp(secret, step + delta), START_MS), step + delta);
  }
  for (const delta of [-3, -2, 2, 3]) {
    const code = hotp(secret, step + delta);
    const stillValid = [-1, 0, 1].some((d) => hotp(secret, step + d) === code);
    if (!stillValid) assert.equal(findMatchingTimeStep(secret, code, START_MS), null);
  }
  assert.equal(findMatchingTimeStep(secret, ` ${hotp(secret, step)} `, START_MS), step);
  for (const bad of ["", "12345", "1234567", "12345a", "１２３４５６", "-12345", "1e5000"]) {
    assert.equal(findMatchingTimeStep(secret, bad, START_MS), null, JSON.stringify(bad));
  }
});

test("recovery codes: ten, unambiguous, normalised, and stored only as a keyed hash", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, RECOVERY_CODE_COUNT);
  const key = deriveAdminKey(MASTER_SECRET, "recovery-codes");
  for (const code of codes) {
    assert.match(code, /^[A-HJ-KM-NP-Z2-9]{5}-[A-HJ-KM-NP-Z2-9]{5}$/);
    const normalized = normalizeRecoveryCode(code.toLowerCase().replace("-", " "));
    assert.equal(normalized, code.replace("-", ""));
    const hash = hashRecoveryCode(normalized!, key);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hash.includes(normalized!), false);
  }
  assert.equal(normalizeRecoveryCode("123456"), null);
  assert.equal(normalizeRecoveryCode("ABCDE-FGHJ"), null);
  assert.equal(normalizeRecoveryCode("ABCDE-FGH0O"), null, "0 and O are not in the alphabet");
  assert.notEqual(
    hashRecoveryCode("ABCDEFGHJK", key),
    hashRecoveryCode("ABCDEFGHJK", deriveAdminKey(`${MASTER_SECRET}!`, "recovery-codes"))
  );
});

test("secret box: sealed with AES-256-GCM, opens only with the same key and unaltered", () => {
  const key = deriveAdminKey(MASTER_SECRET, "totp-secret");
  const secret = crypto.randomBytes(20);
  const sealed = sealSecret(secret, key);
  assert.match(sealed, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(sealed.includes(secret.toString("base64url")), false);
  assert.notEqual(sealed, sealSecret(secret, key), "a fresh IV every time");
  assert.deepEqual(openSecret(sealed, key), secret);

  assert.equal(openSecret(sealed, deriveAdminKey(`${MASTER_SECRET}x`, "totp-secret")), null);
  assert.equal(openSecret(sealed, deriveAdminKey(MASTER_SECRET, "recovery-codes")), null, "one key per purpose");
  const parts = sealed.split(".");
  const tampered = [parts[0], parts[1], parts[2], Buffer.from(crypto.randomBytes(20)).toString("base64url")].join(".");
  assert.equal(openSecret(tampered, key), null);
  assert.equal(openSecret("v1.a.b", key), null);
  assert.equal(openSecret(null, key), null);
  assert.throws(() => deriveAdminKey("too-short", "totp-secret"), /ADMIN_SESSION_SECRET/);
});

// ───────────────────────────── the two steps ─────────────────────────────

test("sign-in: right password then right code opens an 8-hour session; a code is good once", async () => {
  const admin = await seedAdmin();
  const step1 = await passPasswordStep(admin);
  assert.equal(
    step1.challengeExpiresAt.getTime() - admin.clock.now().getTime(),
    SIGN_IN_CHALLENGE_LIFETIME_MS
  );
  assert.equal(admin.db.sessions.size, 0, "the password alone opens nothing");

  const code = totpAt(admin.totpSecret, admin.clock.now().getTime());
  const step2 = await completeAdminSignIn(admin.deps, {
    userId: step1.userId,
    challengeId: step1.challengeId,
    code,
    addressHash: ADDRESS_A,
  });
  assert.equal(step2.ok, true);
  if (!step2.ok) return;
  assert.equal(step2.userId, admin.userId);
  assert.equal(step2.usedRecoveryCode, false);
  assert.equal(
    step2.sessionExpiresAt.getTime() - admin.clock.now().getTime(),
    ADMIN_SESSION_LIFETIME_MS
  );
  assert.equal(ADMIN_SESSION_LIFETIME_MS, 8 * 60 * 60_000);
  assert.equal(
    await resolveAdminSession(admin.deps, { userId: admin.userId, sessionId: step2.sessionId }),
    admin.userId
  );
  // Successful tries do not count toward the lockout
  assert.equal([...admin.db.attempts.values()].every((a) => a.succeeded), true);

  // The same code again, on a NEW password step and still inside its 30 seconds: refused
  const again = await passPasswordStep(admin);
  const replay = await completeAdminSignIn(admin.deps, {
    userId: again.userId,
    challengeId: again.challengeId,
    code,
    addressHash: ADDRESS_A,
  });
  assert.deepEqual(replay, { ok: false });
  assert.equal(admin.db.sessions.size, 1);

  // The next step's code works
  admin.clock.advance(TOTP_STEP_SECONDS * 1000);
  const fresh = await completeAdminSignIn(admin.deps, {
    userId: again.userId,
    challengeId: again.challengeId,
    code: totpAt(admin.totpSecret, admin.clock.now().getTime()),
    addressHash: ADDRESS_A,
  });
  assert.equal(fresh.ok, true);
  // ...and an older step's code is refused once a newer one was accepted
  const older = await passPasswordStep(admin);
  const stale = await completeAdminSignIn(admin.deps, {
    userId: older.userId,
    challengeId: older.challengeId,
    code: hotp(admin.totpSecret, timeStepAt(admin.clock.now().getTime()) - 1),
    addressHash: ADDRESS_A,
  });
  assert.deepEqual(stale, { ok: false });
});

test("sign-in: every failure looks the same, whatever went wrong", async () => {
  const admin = await seedAdmin();
  const failures = [
    await beginAdminSignIn(admin.deps, { email: "owner@thibut.test", password: "wrong password!!", addressHash: ADDRESS_A }),
    await beginAdminSignIn(admin.deps, { email: "nobody@thibut.test", password: PASSWORD, addressHash: ADDRESS_A }),
    await beginAdminSignIn(admin.deps, { email: "not an email", password: PASSWORD, addressHash: ADDRESS_A }),
    await beginAdminSignIn(admin.deps, { email: "", password: "", addressHash: ADDRESS_A }),
  ];
  for (const failure of failures) assert.deepEqual(failure, { ok: false });
  assert.equal(admin.db.challenges.size, 0);

  // The email is matched without regard to case or surrounding spaces
  assert.equal(normalizeAdminEmail("  Owner@ThiBut.Test "), "owner@thibut.test");
  const mixedCase = await beginAdminSignIn(admin.deps, {
    email: "  Owner@ThiBut.Test ",
    password: PASSWORD,
    addressHash: hashClientAddress("203.0.113.5", MASTER_SECRET),
  });
  assert.equal(mixedCase.ok, true);

  // A suspended user, or one without the ADMIN role, cannot pass even with the right password
  for (const options of [{ status: "SUSPENDED" as const }, { isAdmin: false }]) {
    const blocked = await seedAdmin(options);
    assert.deepEqual(
      await beginAdminSignIn(blocked.deps, { email: "owner@thibut.test", password: PASSWORD, addressHash: ADDRESS_A }),
      { ok: false }
    );
  }
});

test("code step: bound to its own password step, capped at five tries, and expires", async () => {
  const admin = await seedAdmin();
  const step1 = await passPasswordStep(admin);
  const code = () => totpAt(admin.totpSecret, admin.clock.now().getTime());

  // A challenge id that does not exist, or one presented for another user
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: admin.userId, challengeId: crypto.randomUUID(), code: code(), addressHash: ADDRESS_A }),
    { ok: false }
  );
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: "someone-else", challengeId: step1.challengeId, code: code(), addressHash: ADDRESS_A }),
    { ok: false }
  );
  assert.equal(admin.db.sessions.size, 0);

  // Five wrong codes use the challenge up; then even the right code is refused on it
  const other = hashClientAddress("203.0.113.77", MASTER_SECRET);
  const capped = await passPasswordStep(admin, other);
  for (let i = 0; i < SIGN_IN_CHALLENGE_MAX_TRIES; i++) {
    assert.deepEqual(
      await completeAdminSignIn(admin.deps, { userId: capped.userId, challengeId: capped.challengeId, code: wrongCodeFor(admin), addressHash: other }),
      { ok: false }
    );
  }
  assert.equal(admin.db.challenges.get(capped.challengeId)?.tries, SIGN_IN_CHALLENGE_MAX_TRIES);
  // (from a third address, so it is the try cap and not the address lockout that refuses)
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: capped.userId, challengeId: capped.challengeId, code: code(), addressHash: hashClientAddress("203.0.113.78", MASTER_SECRET) }),
    { ok: false }
  );
  assert.equal(admin.db.sessions.size, 0);

  // An expired challenge is refused; a used one cannot be used twice
  const expiring = await seedAdmin();
  const slow = await passPasswordStep(expiring);
  expiring.clock.advance(SIGN_IN_CHALLENGE_LIFETIME_MS);
  assert.deepEqual(
    await completeAdminSignIn(expiring.deps, { userId: slow.userId, challengeId: slow.challengeId, code: totpAt(expiring.totpSecret, expiring.clock.now().getTime()), addressHash: ADDRESS_A }),
    { ok: false }
  );
  const quick = await passPasswordStep(expiring);
  assert.equal(
    (await completeAdminSignIn(expiring.deps, { userId: quick.userId, challengeId: quick.challengeId, code: totpAt(expiring.totpSecret, expiring.clock.now().getTime()), addressHash: ADDRESS_A })).ok,
    true
  );
  expiring.clock.advance(TOTP_STEP_SECONDS * 1000);
  assert.deepEqual(
    await completeAdminSignIn(expiring.deps, { userId: quick.userId, challengeId: quick.challengeId, code: totpAt(expiring.totpSecret, expiring.clock.now().getTime()), addressHash: ADDRESS_A }),
    { ok: false }
  );
});

test("recovery code: signs in once in place of the authenticator, and never again", async () => {
  const admin = await seedAdmin();
  const [first, second] = admin.recoveryCodes;

  const step1 = await passPasswordStep(admin);
  const viaRecovery = await completeAdminSignIn(admin.deps, {
    userId: step1.userId,
    challengeId: step1.challengeId,
    code: first.toLowerCase(),
    addressHash: ADDRESS_A,
  });
  assert.equal(viaRecovery.ok, true);
  if (viaRecovery.ok) assert.equal(viaRecovery.usedRecoveryCode, true);

  const step1Again = await passPasswordStep(admin);
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: step1Again.userId, challengeId: step1Again.challengeId, code: first, addressHash: ADDRESS_A }),
    { ok: false }
  );
  // A recovery code is no use without the password step
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: admin.userId, challengeId: crypto.randomUUID(), code: second, addressHash: ADDRESS_A }),
    { ok: false }
  );
  assert.equal(admin.db.recoveryCodes.filter((c) => c.usedAt !== null).length, 1);

  // Two requests racing with the same unused code: exactly one session
  const racing = await seedAdmin();
  const a = await passPasswordStep(racing);
  const b = await passPasswordStep(racing);
  const results = await Promise.all(
    [a, b].map((step) =>
      completeAdminSignIn(racing.deps, { userId: step.userId, challengeId: step.challengeId, code: racing.recoveryCodes[0], addressHash: ADDRESS_A })
    )
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(racing.db.sessions.size, 1);
});

// ───────────────────────────── lockout ─────────────────────────────

test("lockout: five failures per address in a sliding fifteen minutes, twenty overall", async () => {
  assert.equal(isLockedOut({ perAddress: LOCKOUT_MAX_PER_ADDRESS, overall: 1 }), false);
  assert.equal(isLockedOut({ perAddress: LOCKOUT_MAX_PER_ADDRESS + 1, overall: 1 }), true);
  assert.equal(isLockedOut({ perAddress: 1, overall: LOCKOUT_MAX_OVERALL }), false);
  assert.equal(isLockedOut({ perAddress: 1, overall: LOCKOUT_MAX_OVERALL + 1 }), true);

  const admin = await seedAdmin();
  const wrong = { email: "owner@thibut.test", password: "wrong password!!", addressHash: ADDRESS_A };
  for (let i = 0; i < LOCKOUT_MAX_PER_ADDRESS; i++) {
    assert.deepEqual(await beginAdminSignIn(admin.deps, wrong), { ok: false });
    admin.clock.advance(60_000);
  }
  assert.equal(admin.db.attempts.size, LOCKOUT_MAX_PER_ADDRESS);

  // Locked: the RIGHT password is now refused from this address, with the same answer
  const lookupsBefore = admin.db.calls.findCredentialByEmail;
  assert.deepEqual(
    await beginAdminSignIn(admin.deps, { ...wrong, password: PASSWORD }),
    { ok: false }
  );
  assert.equal(admin.db.calls.findCredentialByEmail, lookupsBefore, "refused before any check");
  assert.equal(admin.db.attempts.size, LOCKOUT_MAX_PER_ADDRESS, "a refused try does not extend the lockout");

  // Another address is not locked by this one
  const elsewhere = hashClientAddress("203.0.113.9", MASTER_SECRET);
  assert.equal((await beginAdminSignIn(admin.deps, { ...wrong, password: PASSWORD, addressHash: elsewhere })).ok, true);

  // Sliding window: the first failure was 5 minutes into... wait until it is 15 minutes old
  admin.clock.set(START_MS + LOCKOUT_WINDOW_MS - 1);
  assert.deepEqual(await beginAdminSignIn(admin.deps, { ...wrong, password: PASSWORD }), { ok: false });
  admin.clock.set(START_MS + LOCKOUT_WINDOW_MS + 1);
  assert.equal((await beginAdminSignIn(admin.deps, { ...wrong, password: PASSWORD })).ok, true);

  // Overall limit: twenty failures spread over many addresses lock everyone
  const spread = await seedAdmin();
  for (let i = 0; i < LOCKOUT_MAX_OVERALL; i++) {
    const address = hashClientAddress(`192.0.2.${i}`, MASTER_SECRET);
    // An unknown challenge is a failed try that needs no password hashing. A recovery-shaped
    // value is used so that the separate slow limit on authenticator codes stays out of it.
    assert.deepEqual(
      await completeAdminSignIn(spread.deps, { userId: spread.userId, challengeId: crypto.randomUUID(), code: "not-a-six-digit-code", addressHash: address }),
      { ok: false }
    );
  }
  assert.deepEqual(
    await beginAdminSignIn(spread.deps, { email: "owner@thibut.test", password: PASSWORD, addressHash: hashClientAddress("192.0.2.200", MASTER_SECRET) }),
    { ok: false }
  );
  spread.clock.advance(LOCKOUT_WINDOW_MS + 1);
  assert.equal(
    (await beginAdminSignIn(spread.deps, { email: "owner@thibut.test", password: PASSWORD, addressHash: hashClientAddress("192.0.2.200", MASTER_SECRET) })).ok,
    true
  );
});

test("lockout under load: 300 wrong codes at once are capped, and 200 wrong plus the right code open no session", async () => {
  // 300 wrong codes sent together against one challenge, from one address
  const flood = await seedAdmin();
  const step1 = await passPasswordStep(flood);
  const wrongCode = wrongCodeFor(flood);
  const floodResults = await Promise.all(
    Array.from({ length: 300 }, () =>
      completeAdminSignIn(flood.deps, { userId: step1.userId, challengeId: step1.challengeId, code: wrongCode, addressHash: ADDRESS_A })
    )
  );
  assert.equal(floodResults.every((r) => !r.ok), true);
  assert.equal(flood.db.sessions.size, 0);
  const challenge = flood.db.challenges.get(step1.challengeId);
  assert.ok(challenge);
  assert.ok(challenge.tries <= SIGN_IN_CHALLENGE_MAX_TRIES, `tries taken: ${challenge.tries}`);
  // "Write the try, count it, decide": tries that arrive together all see each other, so at
  // most the allowed number were ever compared. Refused tries are removed again, so a flood
  // cannot buy a longer lockout than the tries that were really checked.
  assert.ok(
    failedTries(flood.db) <= LOCKOUT_MAX_PER_ADDRESS,
    `tries that were checked: ${failedTries(flood.db)}`
  );
  assert.equal(challenge.tries, failedTries(flood.db), "every checked try took one challenge try");

  // The same 300 one after another: five are checked, then the address is locked, and the
  // right code is refused
  const steady = await seedAdmin();
  const steadyStep = await passPasswordStep(steady);
  const steadyWrong = wrongCodeFor(steady);
  for (let i = 0; i < 300; i++) {
    const result = await completeAdminSignIn(steady.deps, { userId: steadyStep.userId, challengeId: steadyStep.challengeId, code: steadyWrong, addressHash: ADDRESS_A });
    assert.equal(result.ok, false);
  }
  assert.equal(failedTries(steady.db), LOCKOUT_MAX_PER_ADDRESS);
  assert.equal(steady.db.challenges.get(steadyStep.challengeId)?.tries, SIGN_IN_CHALLENGE_MAX_TRIES);
  assert.deepEqual(
    await completeAdminSignIn(steady.deps, { userId: steadyStep.userId, challengeId: steadyStep.challengeId, code: totpAt(steady.totpSecret, steady.clock.now().getTime()), addressHash: ADDRESS_A }),
    { ok: false }
  );
  assert.equal(steady.db.sessions.size, 0);

  // 200 wrong codes and the right one, all at the same moment
  const burst = await seedAdmin();
  const burstStep = await passPasswordStep(burst);
  const right = totpAt(burst.totpSecret, burst.clock.now().getTime());
  const wrongForBurst = wrongCodeFor(burst);
  const codes = Array.from({ length: 200 }, () => wrongForBurst);
  codes.splice(137, 0, right);
  const burstResults = await Promise.all(
    codes.map((code) =>
      completeAdminSignIn(burst.deps, { userId: burstStep.userId, challengeId: burstStep.challengeId, code, addressHash: ADDRESS_A })
    )
  );
  assert.equal(burstResults.filter((r) => r.ok).length, 0, "a guess hidden in a burst must not get in");
  assert.equal(burst.db.sessions.size, 0);

  // Many correct codes at once (double submit): exactly one session
  const doubled = await seedAdmin();
  const doubledStep = await passPasswordStep(doubled);
  const doubledCode = totpAt(doubled.totpSecret, doubled.clock.now().getTime());
  const doubledResults = await Promise.all(
    Array.from({ length: 4 }, () =>
      completeAdminSignIn(doubled.deps, { userId: doubledStep.userId, challengeId: doubledStep.challengeId, code: doubledCode, addressHash: ADDRESS_A })
    )
  );
  assert.equal(doubledResults.filter((r) => r.ok).length, 1);
  assert.equal(doubled.db.sessions.size, 1);
});

// ───────────────────────────── sessions and cookies ─────────────────────────────

test("session: the cookie is only as good as its database row (expired, revoked, wrong user, forged)", async () => {
  process.env.ADMIN_SESSION_SECRET = MASTER_SECRET;
  const admin = await seedAdmin();
  const store = admin.deps.store;
  const sessionId = await store.createSession({
    userId: admin.userId,
    expiresAt: new Date(admin.clock.now().getTime() + ADMIN_SESSION_LIFETIME_MS),
    at: admin.clock.now(),
  });
  const claims = { userId: admin.userId, sessionId };
  assert.equal(await resolveAdminSession(admin.deps, claims), admin.userId);
  assert.equal(await resolveAdminSession(admin.deps, { userId: "someone-else", sessionId }), null);
  assert.equal(await resolveAdminSession(admin.deps, { userId: admin.userId, sessionId: crypto.randomUUID() }), null);

  // Sign out: the row is revoked, so a copy of the cookie stops working at once
  await store.revokeSession({ sessionId, now: admin.clock.now() });
  assert.equal(await resolveAdminSession(admin.deps, claims), null);

  // Eight hours: valid one millisecond before, refused at the limit
  const second = await store.createSession({
    userId: admin.userId,
    expiresAt: new Date(admin.clock.now().getTime() + ADMIN_SESSION_LIFETIME_MS),
    at: admin.clock.now(),
  });
  admin.clock.advance(ADMIN_SESSION_LIFETIME_MS - 1);
  assert.equal(await resolveAdminSession(admin.deps, { userId: admin.userId, sessionId: second }), admin.userId);
  admin.clock.advance(1);
  assert.equal(await resolveAdminSession(admin.deps, { userId: admin.userId, sessionId: second }), null);

  // Sign out everywhere
  const third = await store.createSession({ userId: admin.userId, expiresAt: new Date(admin.clock.now().getTime() + 1000), at: admin.clock.now() });
  const fourth = await store.createSession({ userId: admin.userId, expiresAt: new Date(admin.clock.now().getTime() + 1000), at: admin.clock.now() });
  await store.revokeAllSessions({ userId: admin.userId, now: admin.clock.now() });
  for (const id of [third, fourth]) {
    assert.equal(await resolveAdminSession(admin.deps, { userId: admin.userId, sessionId: id }), null);
  }

  // The signed token itself: forged, altered, signed with another secret, expired, wrong purpose
  const token = await signAdminSessionToken({ userId: admin.userId, sessionId });
  assert.deepEqual(await verifyAdminSessionToken(token), claims);
  assert.equal(await verifyAdminSessionToken(`${token.slice(0, -3)}abc`), null);
  assert.equal(await verifyAdminSessionToken("verified"), null);
  assert.equal(await verifyAdminSessionToken(""), null);
  const [header, payload] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: "attacker" })
  ).toString("base64url");
  assert.equal(await verifyAdminSessionToken(`${header}.${forgedPayload}.${token.split(".")[2]}`), null);
  const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${payload}.`;
  assert.equal(await verifyAdminSessionToken(unsigned), null);
  assert.equal(await verifyAdminSessionToken(await signAdminSessionToken(claims, -10)), null);
  assert.equal(await verifyAdminSessionToken(await signAdminPendingToken({ userId: admin.userId, challengeId: "c" })), null);
  assert.equal(await verifyAdminPendingToken(token), null);

  process.env.ADMIN_SESSION_SECRET = `${MASTER_SECRET}-rotated`;
  assert.equal(await verifyAdminSessionToken(token), null, "changing the secret ends every session");
  delete process.env.ADMIN_SESSION_SECRET;
  assert.equal(await verifyAdminSessionToken(token), null, "no secret: nothing verifies");
  process.env.ADMIN_SESSION_SECRET = MASTER_SECRET;
});

test("cookies: __Host- prefix, HttpOnly, Secure and SameSite=Strict on the live site; plain names on http://localhost", () => {
  const live = { NODE_ENV: "production" };
  const local = { NODE_ENV: "development" };
  assert.equal(adminSessionCookieName(live), "__Host-tb_admin");
  assert.equal(adminPendingCookieName(live), "__Host-tb_admin_pending");
  assert.deepEqual(adminSessionCookieOptions(live), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  // A __Host- or Secure cookie is not accepted over plain http, so local development drops both
  assert.equal(adminSessionCookieName(local), "tb_admin");
  assert.equal(adminPendingCookieName(local), "tb_admin_pending");
  assert.equal(adminSessionCookieOptions(local).secure, false);
  assert.equal(adminSessionCookieOptions(local).httpOnly, true);
  assert.equal(adminSessionCookieOptions(local).sameSite, "strict");
});

// ───────────────────────────── slow limit, housekeeping, report ─────

test("slow limit: ten wrong authenticator codes in 24 hours pause code entry; a recovery code or --clear-lockout still gets in", async () => {
  assert.equal(isCodeEntryPaused(CODE_FAILURE_MAX), false);
  assert.equal(isCodeEntryPaused(CODE_FAILURE_MAX + 1), true);

  const admin = await seedAdmin();
  // Ten wrong codes, each after a correct password, spread out so the 15-minute lockout
  // never comes into it.
  for (let i = 0; i < CODE_FAILURE_MAX; i++) {
    const step = await passPasswordStep(admin);
    assert.deepEqual(
      await completeAdminSignIn(admin.deps, { userId: step.userId, challengeId: step.challengeId, code: wrongCodeFor(admin), addressHash: ADDRESS_A }),
      { ok: false }
    );
    admin.clock.advance(20 * 60_000);
  }
  const firstFailureAt = START_MS;

  // Now even the RIGHT code is refused, with the same answer, and before it is looked at
  const claimsBefore = admin.db.calls.claimChallengeTry;
  const paused = await passPasswordStep(admin);
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: paused.userId, challengeId: paused.challengeId, code: totpAt(admin.totpSecret, admin.clock.now().getTime()), addressHash: ADDRESS_A }),
    { ok: false }
  );
  assert.equal(admin.db.calls.claimChallengeTry, claimsBefore, "refused before the code is checked");
  const refused = [...admin.db.attempts.values()].filter((a) => a.refused);
  assert.equal(refused.length, 1, "the refused try is kept for the record");
  assert.equal(admin.db.sessions.size, 0);
  // ...and it does not count toward the 15-minute lockout
  assert.equal(
    await admin.deps.store.countUnsuccessfulAttempts({ since: new Date(admin.clock.now().getTime() - LOCKOUT_WINDOW_MS) }),
    0,
    "the refused try, written just now, is not counted toward the 15-minute lockout"
  );

  // A recovery code is not paused
  const withRecovery = await completeAdminSignIn(admin.deps, { userId: paused.userId, challengeId: paused.challengeId, code: admin.recoveryCodes[0], addressHash: ADDRESS_A });
  assert.equal(withRecovery.ok, true);
  assert.equal(withRecovery.ok && withRecovery.usedRecoveryCode, true);

  // Still paused for authenticator codes one millisecond before the first failure is 24 hours old
  admin.clock.set(firstFailureAt + CODE_FAILURE_WINDOW_MS - 1);
  const stillPaused = await passPasswordStep(admin);
  assert.deepEqual(
    await completeAdminSignIn(admin.deps, { userId: stillPaused.userId, challengeId: stillPaused.challengeId, code: totpAt(admin.totpSecret, admin.clock.now().getTime()), addressHash: ADDRESS_A }),
    { ok: false }
  );
  // ...and open again once it has left the window
  admin.clock.set(firstFailureAt + CODE_FAILURE_WINDOW_MS + 1);
  const open = await passPasswordStep(admin);
  assert.equal(
    (await completeAdminSignIn(admin.deps, { userId: open.userId, challengeId: open.challengeId, code: totpAt(admin.totpSecret, admin.clock.now().getTime()), addressHash: ADDRESS_A })).ok,
    true
  );

  // The founder's local command ends a pause at once, after the password is checked
  const locked = await seedAdmin();
  for (let i = 0; i < CODE_FAILURE_MAX; i++) {
    const step = await passPasswordStep(locked);
    await completeAdminSignIn(locked.deps, { userId: step.userId, challengeId: step.challengeId, code: wrongCodeFor(locked), addressHash: ADDRESS_A });
    locked.clock.advance(20 * 60_000);
  }
  const enrolDeps = { store: locked.db.enrolmentStore(), now: locked.clock.now, masterSecret: MASTER_SECRET };
  assert.deepEqual(
    await clearAdminLockout(enrolDeps, { email: "owner@thibut.test", password: "not the password" }),
    { ok: false, reason: "wrong-password" }
  );
  assert.deepEqual(
    await clearAdminLockout(enrolDeps, { email: "someone@thibut.test", password: PASSWORD }),
    { ok: false, reason: "no-such-admin" }
  );
  assert.equal(failedTries(locked.db), CODE_FAILURE_MAX, "a refused clear removes nothing");
  const sessionsBefore = locked.db.sessions.size;
  const succeededBefore = [...locked.db.attempts.values()].filter((a) => a.succeeded).length;
  assert.deepEqual(
    await clearAdminLockout(enrolDeps, { email: "owner@thibut.test", password: PASSWORD }),
    { ok: true, removed: CODE_FAILURE_MAX }
  );
  assert.equal(failedTries(locked.db), 0);
  assert.equal([...locked.db.attempts.values()].filter((a) => a.succeeded).length, succeededBefore, "successful tries are kept");
  assert.equal(locked.db.sessions.size, sessionsBefore, "no session is touched");
  assert.equal(locked.db.credentials.size, 1);
  const after = await passPasswordStep(locked);
  assert.equal(
    (await completeAdminSignIn(locked.deps, { userId: after.userId, challengeId: after.challengeId, code: totpAt(locked.totpSecret, locked.clock.now().getTime()), addressHash: ADDRESS_A })).ok,
    true
  );
});

test("slow limit under load: 300 wrong codes at once never get more than ten looked at", async () => {
  const admin = await seedAdmin();
  const store = admin.deps.store;
  // One challenge and one address per try, so neither the five-try challenge cap nor the
  // per-address lockout does the limiting here.
  const tries = await Promise.all(
    Array.from({ length: 300 }, async (_unused, i) => ({
      challengeId: await store.createChallenge({
        userId: admin.userId,
        expiresAt: new Date(admin.clock.now().getTime() + SIGN_IN_CHALLENGE_LIFETIME_MS),
        at: admin.clock.now(),
      }),
      addressHash: hashClientAddress(`198.18.${Math.floor(i / 250)}.${i % 250}`, MASTER_SECRET),
    }))
  );
  const wrong = wrongCodeFor(admin);
  const results = await Promise.all(
    tries.map((t) =>
      completeAdminSignIn(admin.deps, { userId: admin.userId, challengeId: t.challengeId, code: wrong, addressHash: t.addressHash })
    )
  );
  assert.equal(results.every((r) => !r.ok), true);
  assert.ok(
    (admin.db.calls.claimChallengeTry ?? 0) <= CODE_FAILURE_MAX,
    `at most ${CODE_FAILURE_MAX} tries may reach the code check, got ${admin.db.calls.claimChallengeTry}`
  );
  const counted = [...admin.db.attempts.values()].filter((a) => a.kind === "CODE" && !a.succeeded && !a.refused);
  assert.ok(counted.length <= CODE_FAILURE_MAX);
  assert.equal(admin.db.sessions.size, 0);
});

test("housekeeping: a successful sign-in removes sign-in rows older than 30 days, and a failure there does not undo the sign-in", async () => {
  const admin = await seedAdmin();
  const store = admin.deps.store;
  const old = new Date(START_MS - SIGN_IN_RECORD_RETENTION_MS - 60_000);
  const recent = new Date(START_MS - SIGN_IN_RECORD_RETENTION_MS + 60_000);
  const oldAttempt = await store.recordAttempt({ kind: "PASSWORD", addressHash: ADDRESS_A, at: old });
  const recentAttempt = await store.recordAttempt({ kind: "PASSWORD", addressHash: "other-address", at: recent });
  const oldChallenge = await store.createChallenge({ userId: admin.userId, expiresAt: old, at: old });
  const longExpired = await store.createSession({ userId: admin.userId, expiresAt: old, at: old });
  const justExpired = await store.createSession({ userId: admin.userId, expiresAt: recent, at: recent });

  const step = await passPasswordStep(admin);
  const done = await completeAdminSignIn(admin.deps, { userId: step.userId, challengeId: step.challengeId, code: totpAt(admin.totpSecret, admin.clock.now().getTime()), addressHash: ADDRESS_A });
  assert.equal(done.ok, true);
  if (!done.ok) return;
  assert.equal(admin.db.attempts.has(oldAttempt), false);
  assert.equal(admin.db.attempts.has(recentAttempt), true);
  assert.equal(admin.db.challenges.has(oldChallenge), false);
  assert.equal(admin.db.challenges.has(step.challengeId), true);
  assert.equal(admin.db.sessions.has(longExpired), false);
  assert.equal(admin.db.sessions.has(justExpired), true);
  assert.equal(admin.db.sessions.has(done.sessionId), true, "the new session is never removed");

  const failing = await seedAdmin();
  failing.db.failPrune = true;
  const step2 = await passPasswordStep(failing);
  assert.equal(
    (await completeAdminSignIn(failing.deps, { userId: step2.userId, challengeId: step2.challengeId, code: totpAt(failing.totpSecret, failing.clock.now().getTime()), addressHash: ADDRESS_A })).ok,
    true
  );
  assert.equal(failing.db.calls.pruneBefore, 1);
});

test("report: failed code tries and a used recovery code are shown to the admin after sign-in", () => {
  const quiet = { previousSignInAt: new Date(START_MS), failedCodeTries: 0, recoveryCodesLeft: 10, lastRecoveryCodeUsedAt: null, recoveryCodeUsedSinceLastSignIn: false };
  assert.deepEqual(describeSignInReport(quiet), []);

  const tried = describeSignInReport({ ...quiet, failedCodeTries: 3 });
  assert.equal(tried.length, 1);
  assert.equal(tried[0].tone, "warning");
  assert.match(tried[0].text, /^3 failed code attempts since your last sign-in\./);
  assert.match(describeSignInReport({ ...quiet, failedCodeTries: 1 })[0].text, /^1 failed code attempt since/);

  const usedAt = new Date(Date.UTC(2026, 10, 24, 9, 30));
  const used = describeSignInReport({ ...quiet, recoveryCodesLeft: 9, lastRecoveryCodeUsedAt: usedAt, recoveryCodeUsedSinceLastSignIn: true });
  assert.deepEqual(used.map((n) => n.tone), ["warning"]);
  assert.match(used[0].text, /A recovery code was used on 2026-11-24 09:30 UTC\. 9 left\./);

  // An older use is not repeated at every sign-in, but running low is mentioned
  assert.deepEqual(describeSignInReport({ ...quiet, recoveryCodesLeft: 9, lastRecoveryCodeUsedAt: usedAt }), []);
  const low = describeSignInReport({ ...quiet, recoveryCodesLeft: 1, lastRecoveryCodeUsedAt: usedAt });
  assert.deepEqual(low.map((n) => n.tone), ["info"]);
  assert.match(low[0].text, /^1 recovery code left\./);
});

test("placeholder secrets from .env.example count as not set", () => {
  for (const value of [
    "replace-with-32-plus-char-random-admin-session-secret",
    "REPLACE_WITH_something-long-enough-to-pass-length",
    "changeme-changeme-changeme-changeme-1234",
    "your-secret-goes-here-your-secret-goes-here",
    "sk_test_placeholder",
  ]) {
    assert.equal(isPlaceholderSecret(value), true, value);
  }
  for (const value of [MASTER_SECRET, crypto.randomBytes(32).toString("hex"), "", "   ", null, undefined]) {
    assert.equal(isPlaceholderSecret(value), false, String(value));
  }
});

test("cookies are removed with the attributes they were set with, so a browser honours it for __Host- names", async () => {
  const live = { NODE_ENV: "production" };
  for (const clearing of [adminSessionCookieClearing(live), adminPendingCookieClearing(live)]) {
    assert.match(clearing.name, /^__Host-tb_admin/);
    assert.equal(clearing.value, "");
    assert.equal(clearing.options.secure, true);
    assert.equal(clearing.options.httpOnly, true);
    assert.equal(clearing.options.sameSite, "strict");
    assert.equal(clearing.options.path, "/");
    assert.equal(clearing.options.maxAge, 0);
    assert.equal(clearing.options.expires?.getTime(), 0);
  }

  // What Next.js actually sends for it, compared with what its own delete() sends
  const cookiesModule = (await import("next/dist/compiled/@edge-runtime/cookies/index.js")) as unknown as {
    default?: { ResponseCookies: ResponseCookiesCtor };
    ResponseCookies?: ResponseCookiesCtor;
  };
  const ResponseCookies = cookiesModule.ResponseCookies ?? cookiesModule.default?.ResponseCookies;
  assert.ok(ResponseCookies, "Next's ResponseCookies must be importable");
  const clearing = adminSessionCookieClearing(live);
  const headers = new Headers();
  new ResponseCookies(headers).set(clearing.name, clearing.value, { ...clearing.options });
  const sent = headers.get("set-cookie") ?? "";
  assert.match(sent, /^__Host-tb_admin=;/);
  assert.match(sent, /; Path=\/(;|$)/);
  assert.match(sent, /; Secure(;|$)/);
  assert.match(sent, /; HttpOnly(;|$)/);
  assert.match(sent, /; Max-Age=0(;|$)/);
  assert.match(sent, /; Expires=Thu, 01 Jan 1970/);

  const deleted = new Headers();
  new ResponseCookies(deleted).delete(clearing.name);
  assert.doesNotMatch(
    deleted.get("set-cookie") ?? "",
    /Secure/,
    "delete() sends no Secure, which is why the sign-in code must not use it for these cookies"
  );

  // Local development: plain names, no Secure, still expired
  const local = adminSessionCookieClearing({ NODE_ENV: "development" });
  assert.equal(local.name, "tb_admin");
  assert.equal(local.options.secure, false);
  assert.equal(local.options.maxAge, 0);
});

// ───────────────────────────── set-up command rules ─────────────────────────────

test("set-up: creates the admin, the printed setup key and recovery codes really sign in, and a reset replaces them", async () => {
  const db = new FakeAdminDatabase();
  const clock = new TestClock(START_MS);
  const enrolDeps = { store: db.enrolmentStore(), now: clock.now, masterSecret: MASTER_SECRET };
  const signInDeps: AdminSignInDeps = { store: db.signInStore(), now: clock.now, masterSecret: MASTER_SECRET };

  assert.deepEqual(await enrolAdmin(enrolDeps, { email: "nope", password: PASSWORD }), { ok: false, reason: "invalid-email" });
  assert.deepEqual(await enrolAdmin(enrolDeps, { email: "owner@thibut.test", password: "short" }), { ok: false, reason: "weak-password" });
  assert.equal(db.credentials.size, 0);

  const created = await enrolAdmin(enrolDeps, { email: " Owner@ThiBut.test ", password: PASSWORD });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.email, "owner@thibut.test");
  assert.equal(created.replacedExisting, false);
  assert.equal(created.recoveryCodes.length, RECOVERY_CODE_COUNT);
  assert.match(created.setupKey, /^([A-Z2-7]{4} ){7}[A-Z2-7]{4}$/, "32 base32 characters = 160 bits");
  assert.match(created.otpAuthUri, /^otpauth:\/\/totp\//);

  // Nothing readable is stored
  const stored = db.credentials.get(created.userId);
  assert.ok(stored);
  assert.match(stored.passwordHash, /^scrypt:131072:8:1:/);
  const everythingStored = JSON.stringify([stored, db.recoveryCodes]);
  assert.equal(everythingStored.includes(PASSWORD), false);
  assert.equal(everythingStored.includes(created.setupKey.replace(/ /g, "")), false);
  for (const code of created.recoveryCodes) {
    assert.equal(everythingStored.includes(code.replace("-", "")), false);
  }

  // What the founder types into the authenticator app produces codes the site accepts
  const typedSecret = base32Decode(created.setupKey);
  assert.ok(typedSecret);
  const address = hashClientAddress("198.51.100.20", MASTER_SECRET);
  const step1 = await beginAdminSignIn(signInDeps, { email: "owner@thibut.test", password: PASSWORD, addressHash: address });
  assert.equal(step1.ok, true);
  if (!step1.ok) return;
  const step2 = await completeAdminSignIn(signInDeps, { userId: step1.userId, challengeId: step1.challengeId, code: totpAt(typedSecret, clock.now().getTime()), addressHash: address });
  assert.equal(step2.ok, true);
  if (!step2.ok) return;

  // A second, different admin is refused
  assert.deepEqual(
    await enrolAdmin(enrolDeps, { email: "second@thibut.test", password: PASSWORD }),
    { ok: false, reason: "another-admin-exists" }
  );

  // Replacing the existing admin needs the CURRENT password...
  const NEW_PASSWORD = "an entirely new long password";
  for (const currentPassword of [undefined, "", "not the password"]) {
    assert.deepEqual(
      await enrolAdmin(enrolDeps, { email: "owner@thibut.test", password: NEW_PASSWORD, currentPassword }),
      { ok: false, reason: "wrong-password" }
    );
  }
  assert.equal(db.credentials.get(created.userId)?.passwordHash, stored.passwordHash, "nothing was replaced");
  assert.equal(await resolveAdminSession(signInDeps, { userId: step2.userId, sessionId: step2.sessionId }), step2.userId);
  // ...unless the founder has said the password is lost (the command asks for a typed phrase)
  const replacedDb = new FakeAdminDatabase();
  const replacedDeps = { store: replacedDb.enrolmentStore(), now: clock.now, masterSecret: MASTER_SECRET };
  const first = await enrolAdmin(replacedDeps, { email: "owner@thibut.test", password: PASSWORD });
  assert.equal(first.ok, true);
  const withCurrent = await enrolAdmin(replacedDeps, { email: "owner@thibut.test", password: NEW_PASSWORD, currentPassword: PASSWORD });
  assert.equal(withCurrent.ok && withCurrent.replacedExisting, true);
  const forgotten = await enrolAdmin(replacedDeps, { email: "owner@thibut.test", password: PASSWORD, forgotPassword: true });
  assert.equal(forgotten.ok && forgotten.replacedExisting, true);

  // Resetting the authenticator needs the current password
  assert.deepEqual(
    await resetAdminAuthenticator(enrolDeps, { email: "owner@thibut.test", password: "not the password" }),
    { ok: false, reason: "wrong-password" }
  );
  assert.deepEqual(
    await resetAdminAuthenticator(enrolDeps, { email: "second@thibut.test", password: PASSWORD }),
    { ok: false, reason: "no-such-admin" }
  );
  const reset = await resetAdminAuthenticator(enrolDeps, { email: "owner@thibut.test", password: PASSWORD });
  assert.equal(reset.ok, true);
  if (!reset.ok) return;
  assert.notEqual(reset.setupKey, created.setupKey);
  assert.equal(db.credentials.get(created.userId)?.passwordHash, stored.passwordHash, "the password is unchanged");
  // ...it signs every session out, and the old authenticator and old recovery codes stop working
  assert.equal(await resolveAdminSession(signInDeps, { userId: step2.userId, sessionId: step2.sessionId }), null);
  clock.advance(TOTP_STEP_SECONDS * 1000 * 3);
  for (const oldCode of [totpAt(typedSecret, clock.now().getTime()), created.recoveryCodes[0]]) {
    const again = await beginAdminSignIn(signInDeps, { email: "owner@thibut.test", password: PASSWORD, addressHash: address });
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.deepEqual(
      await completeAdminSignIn(signInDeps, { userId: again.userId, challengeId: again.challengeId, code: oldCode, addressHash: address }),
      { ok: false }
    );
  }
  const newSecret = base32Decode(reset.setupKey);
  assert.ok(newSecret);
  const withNew = await beginAdminSignIn(signInDeps, { email: "owner@thibut.test", password: PASSWORD, addressHash: address });
  assert.equal(withNew.ok, true);
  if (!withNew.ok) return;
  assert.equal(
    (await completeAdminSignIn(signInDeps, { userId: withNew.userId, challengeId: withNew.challengeId, code: totpAt(newSecret, clock.now().getTime()), addressHash: address })).ok,
    true
  );
});
