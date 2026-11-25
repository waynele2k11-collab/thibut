/**
 * Admin sign-in, wired together: the real server actions, the real guard, the real cookie
 * reader and the real database store, running against an in-memory database
 * (tests/helpers/fake-admin-prisma.ts). Plus source checks: Supabase is gone, and every admin
 * page and admin action checks access itself.
 */
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as nodeModule from "node:module";
import { FakeAdminPrisma } from "./helpers/fake-admin-prisma";

interface ResolveContext {
  conditions: string[];
  importAttributes: Record<string, string>;
  parentURL?: string;
}
interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}
type NextResolveFn = (specifier: string, context: ResolveContext) => ResolveResult;
interface ModuleHooksApi {
  registerHooks: (hooks: {
    resolve?: (
      specifier: string,
      context: ResolveContext,
      nextResolve: NextResolveFn
    ) => ResolveResult;
  }) => void;
}

class RedirectSignal extends Error {
  constructor(public readonly destination: string) {
    super(`NEXT_REDIRECT:${destination}`);
    this.name = "RedirectSignal";
  }
}
class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundSignal";
  }
}

interface CookieRecord {
  value: string;
  options?: Record<string, unknown>;
}

const harness = {
  cookies: new Map<string, CookieRecord>(),
  deletedCookies: [] as string[],
  clearingOptions: new Map<string, Record<string, unknown>>(),
  requestHeaders: new Headers({ "x-vercel-forwarded-for": "198.51.100.40" }),
  db: new FakeAdminPrisma(),
};

declare global {
  var __tbAdminWiringHooks: {
    cookies: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (name: string, value: string, options?: Record<string, unknown>) => void;
      delete: (name: string) => void;
    }>;
    headers: () => Promise<Headers>;
    redirect: (url: string) => never;
    notFound: () => never;
    prisma: () => unknown;
  };
}

globalThis.__tbAdminWiringHooks = {
  async cookies() {
    return {
      get(name: string) {
        const entry = harness.cookies.get(name);
        return entry ? { name, value: entry.value } : undefined;
      },
      set(name: string, value: string, options?: Record<string, unknown>) {
        // A browser ignores any Set-Cookie for a `__Host-` name that is not Secure with
        // Path=/, a removal included.
        if (name.startsWith("__Host-") && !(options?.secure === true && options?.path === "/")) {
          return;
        }
        if (options?.maxAge === 0) {
          harness.cookies.delete(name);
          harness.deletedCookies.push(name);
          harness.clearingOptions.set(name, options);
          return;
        }
        harness.cookies.set(name, { value, options });
      },
      delete(name: string) {
        // What Next sends for delete(): no Secure. Ignored for a `__Host-` cookie.
        if (name.startsWith("__Host-")) return;
        harness.cookies.delete(name);
        harness.deletedCookies.push(name);
      },
    };
  },
  async headers() {
    return harness.requestHeaders;
  },
  redirect(url: string): never {
    throw new RedirectSignal(url);
  },
  notFound(): never {
    throw new NotFoundSignal();
  },
  prisma() {
    return harness.db.client();
  },
};

const dataUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;

(nodeModule as unknown as ModuleHooksApi).registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers") {
      return {
        url: dataUrl(
          "export const cookies = () => globalThis.__tbAdminWiringHooks.cookies(); export const headers = () => globalThis.__tbAdminWiringHooks.headers();"
        ),
        shortCircuit: true,
      };
    }
    if (specifier === "next/navigation") {
      return {
        url: dataUrl(
          "export const redirect = (u) => globalThis.__tbAdminWiringHooks.redirect(u); export const notFound = () => globalThis.__tbAdminWiringHooks.notFound(); export const usePathname = () => '/admin';"
        ),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma" || specifier.endsWith("/lib/prisma")) {
      return {
        // A proxy, so each test can swap in a fresh database.
        url: dataUrl(
          "export default new Proxy({}, { get: (_t, prop) => globalThis.__tbAdminWiringHooks.prisma()[prop] });"
        ),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { hashPassword } = await import("@/lib/auth/password");
const { deriveAdminKey, sealSecret } = await import("@/lib/auth/secret-box");
const { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } = await import(
  "@/lib/auth/recovery-codes"
);
const { totpAt, timeStepAt, hotp } = await import("@/lib/auth/totp");
const { SIGN_IN_FAILED_MESSAGE, INITIAL_SIGN_IN_FORM_STATE } = await import(
  "@/lib/auth/sign-in-form"
);
const { adminPendingCookieName, adminSessionCookieName } = await import(
  "@/lib/auth/admin-cookies"
);
const { getAdminIdentity, isAdminSignInConfigured } = await import(
  "@/lib/auth/admin-identity"
);
const { getSessionUser } = await import("@/lib/auth/session");
const { signAdminPendingToken, signAdminSessionToken } = await import(
  "@/lib/security/tokens"
);
const { resetRateLimitStore } = await import("@/lib/security/rate-limit");
const { ADMIN_BASE_PATH, ADMIN_SIGN_IN_CODE_PATH, ADMIN_SIGN_IN_PATH, adminPath, isAdminPath } = await import(
  "@/lib/admin-path"
);
const { AdminAuthError, assertAdminApi, requireAdmin } = await import("@/utils/admin/auth");
const {
  signInWithPasswordAction,
  signOutAction,
  signOutEverywhereAction,
  verifySignInCodeAction,
} = await import("@/app/adm/admin/(sign-in)/login/actions");
const { default: LoginPage } = await import("@/app/adm/admin/(sign-in)/login/page");
const { default: LoginCodePage } = await import("@/app/adm/admin/(sign-in)/login/code/page");

const MASTER_SECRET = "wiring-test-admin-session-secret-40-chars";
const PASSWORD = "correct horse battery staple";
const ADMIN_ID = "admin-user-1";
const EMAIL = "owner@thibut.test";
const REPO_ROOT = process.cwd();

async function freshAdmin(): Promise<{ totpSecret: Buffer; recoveryCodes: string[] }> {
  process.env.ADMIN_SESSION_SECRET = MASTER_SECRET;
  harness.cookies.clear();
  harness.deletedCookies = [];
  harness.clearingOptions.clear();
  harness.requestHeaders = new Headers({ "x-vercel-forwarded-for": "198.51.100.40" });
  harness.db = new FakeAdminPrisma();
  resetRateLimitStore();

  const totpSecret = crypto.randomBytes(20);
  harness.db.users.set(ADMIN_ID, {
    id: ADMIN_ID,
    email: EMAIL,
    status: "ACTIVE",
    roles: [{ role: { code: "ADMIN" } }],
  });
  harness.db.tables.adminCredential.push({
    userId: ADMIN_ID,
    passwordHash: await hashPassword(PASSWORD, { N: 16384, r: 8, p: 1 }),
    totpSecretSealed: sealSecret(totpSecret, deriveAdminKey(MASTER_SECRET, "totp-secret")),
    totpLastStep: null,
  });
  const recoveryCodes = generateRecoveryCodes();
  for (const code of recoveryCodes) {
    harness.db.tables.adminRecoveryCode.push({
      id: crypto.randomUUID(),
      userId: ADMIN_ID,
      codeHash: hashRecoveryCode(
        normalizeRecoveryCode(code)!,
        deriveAdminKey(MASTER_SECRET, "recovery-codes")
      ),
      usedAt: null,
    });
  }
  return { totpSecret, recoveryCodes };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

async function expectRedirect(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error: unknown) {
    if (error instanceof RedirectSignal) return error.destination;
    throw error;
  }
  throw new assert.AssertionError({ message: "Expected a redirect" });
}

function wrongCode(totpSecret: Buffer): string {
  const step = timeStepAt(Date.now());
  const valid = new Set([-2, -1, 0, 1, 2].map((d) => hotp(totpSecret, step + d)));
  for (let n = 0; n < 1_000_000; n++) {
    const candidate = n.toString().padStart(6, "0");
    if (!valid.has(candidate)) return candidate;
  }
  throw new Error("unreachable");
}

async function signInFully(totpSecret: Buffer, next = ADMIN_BASE_PATH): Promise<string> {
  await expectRedirect(() =>
    signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD, next }))
  );
  return expectRedirect(() =>
    verifySignInCodeAction(
      INITIAL_SIGN_IN_FORM_STATE,
      form({ code: totpAt(totpSecret, Date.now()), next })
    )
  );
}

test("not configured: without ADMIN_SESSION_SECRET admin does not exist (404), and nothing is touched", async () => {
  await freshAdmin();
  for (const secret of [
    undefined,
    "",
    "too-short-secret",
    " ".repeat(40),
    // The public placeholder from .env.example is long enough, and is still "not set"
    "replace-with-32-plus-char-random-admin-session-secret",
  ]) {
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = secret;

    assert.equal(isAdminSignInConfigured(), false);
    assert.deepEqual(await getAdminIdentity(), { status: "unconfigured" });
    await assert.rejects(() => requireAdmin(), NotFoundSignal);
    await assert.rejects(
      () => assertAdminApi(),
      (err: unknown) => err instanceof AdminAuthError && err.status === 404,
      "admin API routes answer 404, like the pages, when sign-in is not configured"
    );
    await assert.rejects(() => LoginPage({ searchParams: Promise.resolve({}) }), NotFoundSignal);
    await assert.rejects(() => LoginCodePage({ searchParams: Promise.resolve({}) }), NotFoundSignal);
    assert.deepEqual(
      await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD })),
      { error: SIGN_IN_FAILED_MESSAGE }
    );
    assert.deepEqual(
      await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: "123456" })),
      { error: SIGN_IN_FAILED_MESSAGE }
    );
  }
  assert.equal(harness.db.tables.adminLoginAttempt.length, 0);
  assert.equal(harness.cookies.size, 0);
  process.env.ADMIN_SESSION_SECRET = MASTER_SECRET;
});

test("sign-in through the real actions: two steps, strict cookies, then the guard lets the admin in", async () => {
  const { totpSecret } = await freshAdmin();

  // Signed out: pages go to the sign-in page, API routes answer 401
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" });
  assert.equal(await expectRedirect(() => requireAdmin()), ADMIN_SIGN_IN_PATH);
  await assert.rejects(
    () => assertAdminApi(),
    (err: unknown) => err instanceof AdminAuthError && err.status === 401
  );
  // The code page is only reachable straight after the password step
  assert.equal(
    await expectRedirect(() => LoginCodePage({ searchParams: Promise.resolve({}) })),
    ADMIN_SIGN_IN_PATH
  );
  assert.ok(await LoginPage({ searchParams: Promise.resolve({ next: `${ADMIN_BASE_PATH}/orders` }) }));

  // Step 1
  const toCode = await expectRedirect(() =>
    signInWithPasswordAction(
      INITIAL_SIGN_IN_FORM_STATE,
      form({ email: EMAIL, password: PASSWORD, next: `${ADMIN_BASE_PATH}/orders?status=PAID` })
    )
  );
  assert.equal(toCode, `${ADMIN_SIGN_IN_CODE_PATH}?next=${encodeURIComponent(`${ADMIN_BASE_PATH}/orders?status=PAID`)}`);
  const pending = harness.cookies.get(adminPendingCookieName());
  assert.ok(pending?.value);
  assert.deepEqual(pending.options, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  });
  assert.equal(harness.cookies.has(adminSessionCookieName()), false, "the password alone signs nobody in");
  assert.equal(await expectRedirect(() => requireAdmin()), ADMIN_SIGN_IN_PATH);
  assert.ok(await LoginCodePage({ searchParams: Promise.resolve({ next: `${ADMIN_BASE_PATH}/orders` }) }));

  // Step 2
  const destination = await expectRedirect(() =>
    verifySignInCodeAction(
      INITIAL_SIGN_IN_FORM_STATE,
      form({ code: totpAt(totpSecret, Date.now()), next: `${ADMIN_BASE_PATH}/orders?status=PAID` })
    )
  );
  assert.equal(destination, `${ADMIN_BASE_PATH}/orders?status=PAID`);
  const session = harness.cookies.get(adminSessionCookieName());
  assert.ok(session?.value);
  assert.deepEqual(session.options, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  assert.equal(harness.cookies.has(adminPendingCookieName()), false, "the pending cookie is cleared");
  assert.equal(harness.db.tables.adminSession.length, 1);

  const admin = await requireAdmin();
  assert.equal(admin.id, ADMIN_ID);
  assert.equal((await assertAdminApi()).id, ADMIN_ID);
  const identity = await getAdminIdentity();
  assert.equal(identity.status, "signed-in");
  // Already signed in: the sign-in page sends the admin on
  assert.equal(
    await expectRedirect(() => LoginPage({ searchParams: Promise.resolve({}) })),
    ADMIN_BASE_PATH
  );

  // The customer seam never reports the admin (or anyone): customers are guests
  assert.equal(await getSessionUser(), null);
});

test("the role is re-read on every call: a suspended or demoted admin is out at once", async () => {
  const { totpSecret } = await freshAdmin();
  await signInFully(totpSecret);
  assert.equal((await requireAdmin()).id, ADMIN_ID);

  const user = harness.db.users.get(ADMIN_ID)!;
  user.roles = [{ role: { code: "CREATOR" } }];
  assert.equal(await expectRedirect(() => requireAdmin()), "/");
  await assert.rejects(
    () => assertAdminApi(),
    (err: unknown) => err instanceof AdminAuthError && err.status === 403
  );

  user.roles = [{ role: { code: "ADMIN" } }];
  user.status = "SUSPENDED";
  assert.equal(await expectRedirect(() => requireAdmin()), ADMIN_SIGN_IN_PATH);
  await assert.rejects(
    () => assertAdminApi(),
    (err: unknown) => err instanceof AdminAuthError && err.status === 401
  );
});

test("every failure gives the same sentence, and a hostile `next` never leaves the site", async () => {
  const { totpSecret } = await freshAdmin();
  const failed = { error: SIGN_IN_FAILED_MESSAGE };

  for (const fields of [
    { email: EMAIL, password: "wrong password!!" },
    { email: "nobody@thibut.test", password: PASSWORD },
    { email: "", password: "" },
    { email: "x".repeat(600), password: PASSWORD },
  ]) {
    assert.deepEqual(await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form(fields)), failed);
  }
  assert.equal(harness.cookies.size, 0);

  // Wrong code after a good password: the same sentence, and still no session
  await expectRedirect(() =>
    signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD }))
  );
  assert.deepEqual(
    await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: wrongCode(totpSecret) })),
    failed
  );
  assert.deepEqual(await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: "" })), failed);
  assert.equal(harness.cookies.has(adminSessionCookieName()), false);

  // Hostile redirect targets fall back to the admin landing page
  for (const next of ["https://evil.example/phish", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const { totpSecret: secret } = await freshAdmin();
    assert.equal(
      await expectRedirect(() =>
        signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD, next }))
      ),
      `${ADMIN_SIGN_IN_CODE_PATH}?next=${encodeURIComponent(ADMIN_BASE_PATH)}`
    );
    assert.equal(
      await expectRedirect(() =>
        verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: totpAt(secret, Date.now()), next }))
      ),
      ADMIN_BASE_PATH
    );
  }
});

test("a code try without the password step is refused before anything is counted", async () => {
  await freshAdmin();
  const failed = { error: SIGN_IN_FAILED_MESSAGE };

  // No pending cookie, a forged one, one signed with another secret, and a SESSION token
  // offered as a pending token: all refused, none written to the lockout log
  const candidates: Array<string | null> = [null, "forged.pending.token"];
  process.env.ADMIN_SESSION_SECRET = `${MASTER_SECRET}-other`;
  candidates.push(await signAdminPendingToken({ userId: ADMIN_ID, challengeId: crypto.randomUUID() }));
  process.env.ADMIN_SESSION_SECRET = MASTER_SECRET;
  candidates.push(await signAdminSessionToken({ userId: ADMIN_ID, sessionId: crypto.randomUUID() }));

  for (const candidate of candidates) {
    harness.cookies.clear();
    if (candidate) harness.cookies.set(adminPendingCookieName(), { value: candidate });
    for (let i = 0; i < 30; i++) {
      assert.deepEqual(
        await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: "000000" })),
        failed
      );
    }
  }
  assert.equal(
    harness.db.tables.adminLoginAttempt.length,
    0,
    "tries without the password step must not be able to lock the admin out"
  );
  assert.equal(harness.db.tables.adminSession.length, 0);
});

test("lockout through the real store: five wrong passwords lock the address; the brake protects the hash", async () => {
  const { totpSecret } = await freshAdmin();
  const failed = { error: SIGN_IN_FAILED_MESSAGE };

  for (let i = 0; i < 5; i++) {
    assert.deepEqual(
      await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: "wrong password!!" })),
      failed
    );
  }
  assert.equal(harness.db.tables.adminLoginAttempt.length, 5);
  // The right password is now refused from this address, with the same sentence
  assert.deepEqual(
    await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD })),
    failed
  );
  assert.equal(harness.db.tables.adminLoginAttempt.length, 5, "a refused try is not kept");
  assert.equal(harness.cookies.size, 0);
  // The log holds no address, password, email or code: a keyed hash and two labels only
  for (const row of harness.db.tables.adminLoginAttempt) {
    assert.deepEqual(Object.keys(row).sort(), ["addressHash", "createdAt", "id", "kind", "refused", "succeeded"]);
    assert.match(row.addressHash as string, /^[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(row).includes("198.51.100.40"), false);
  }

  // From another address the admin still gets in
  harness.requestHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.50" });
  assert.equal(await signInFully(totpSecret), ADMIN_BASE_PATH);

  // Request brake: more than 20 password tries a minute from one address never reach the hash
  await freshAdmin();
  harness.requestHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.99" });
  for (let i = 0; i < 40; i++) {
    assert.deepEqual(
      await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: "nobody@thibut.test", password: "x" })),
      failed
    );
  }
  assert.ok(harness.db.tables.adminLoginAttempt.length <= 5);
});

test("sign out revokes the session row; a copied cookie stops working; sign out everywhere ends them all", async () => {
  const { totpSecret } = await freshAdmin();
  await signInFully(totpSecret);
  const copiedCookie = harness.cookies.get(adminSessionCookieName())!.value;

  assert.equal(await expectRedirect(() => signOutAction()), ADMIN_SIGN_IN_PATH);
  assert.equal(harness.cookies.has(adminSessionCookieName()), false);
  assert.ok(harness.db.tables.adminSession[0].revokedAt instanceof Date);
  assert.equal(await expectRedirect(() => requireAdmin()), ADMIN_SIGN_IN_PATH);

  // Someone who copied the cookie before the sign-out gets nowhere
  harness.cookies.set(adminSessionCookieName(), { value: copiedCookie });
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" });
  assert.equal(await expectRedirect(() => requireAdmin()), ADMIN_SIGN_IN_PATH);
  // ...and a revoked session cannot end the others
  harness.db.tables.adminSession.push({
    id: crypto.randomUUID(),
    userId: ADMIN_ID,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
  });
  await expectRedirect(() => signOutEverywhereAction());
  assert.equal(harness.db.tables.adminSession[1].revokedAt, null);

  // Forged, expired and other-user cookies
  harness.cookies.set(adminSessionCookieName(), { value: "verified" });
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" });
  harness.cookies.set(adminSessionCookieName(), {
    value: await signAdminSessionToken({ userId: ADMIN_ID, sessionId: crypto.randomUUID() }),
  });
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" }, "a signed token with no session row");
  const liveSessionId = harness.db.tables.adminSession[1].id as string;
  harness.cookies.set(adminSessionCookieName(), {
    value: await signAdminSessionToken({ userId: "someone-else", sessionId: liveSessionId }),
  });
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" }, "a session row of another user");
  harness.db.tables.adminSession[1].expiresAt = new Date(Date.now() - 1);
  harness.cookies.set(adminSessionCookieName(), {
    value: await signAdminSessionToken({ userId: ADMIN_ID, sessionId: liveSessionId }),
  });
  assert.deepEqual(await getAdminIdentity(), { status: "signed-out" }, "an expired session row");

  // Sign out everywhere, from a live session: every session of the admin ends
  await freshAdmin().then(async ({ totpSecret: secret }) => {
    await signInFully(secret);
    const first = harness.cookies.get(adminSessionCookieName())!.value;
    harness.cookies.clear();
    harness.requestHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.60" });
    // A second sign-in needs the next 30-second code; write a second session row directly
    harness.db.tables.adminSession.push({
      id: crypto.randomUUID(),
      userId: ADMIN_ID,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
    });
    harness.cookies.set(adminSessionCookieName(), { value: first });
    assert.equal(await expectRedirect(() => signOutEverywhereAction()), ADMIN_SIGN_IN_PATH);
    assert.equal(harness.db.tables.adminSession.length, 2);
    assert.equal(harness.db.tables.adminSession.every((row) => row.revokedAt instanceof Date), true);
  });

  // If the database cannot be reached, the browser is still signed out and the admin is told
  const { totpSecret: again } = await freshAdmin();
  await signInFully(again);
  harness.db.failWith = new Error("connection refused at postgres://user:secret@db.example/thibut");
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  try {
    assert.equal(
      await expectRedirect(() => signOutAction()),
      `${ADMIN_SIGN_IN_PATH}?notice=sign-out-incomplete`
    );
  } finally {
    console.error = originalError;
    harness.db.failWith = null;
  }
  assert.equal(harness.cookies.has(adminSessionCookieName()), false);
  assert.equal(logged.join("\n").includes("postgres://"), false, "error messages are never logged");
});

test("on the live site sign-out really removes the __Host- cookies, and a failed revoke still signs the browser out", async () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    const { totpSecret } = await freshAdmin();
    await signInFully(totpSecret);
    assert.equal(adminSessionCookieName(), "__Host-tb_admin");
    assert.equal(harness.cookies.has("__Host-tb_admin"), true);
    // The pending cookie was removed in a way a browser accepts
    assert.equal(harness.cookies.has("__Host-tb_admin_pending"), false);
    assert.equal(harness.clearingOptions.get("__Host-tb_admin_pending")?.secure, true);

    assert.equal(await expectRedirect(() => signOutAction()), ADMIN_SIGN_IN_PATH);
    assert.equal(harness.cookies.has("__Host-tb_admin"), false, "the session cookie is gone from the browser");
    assert.deepEqual(
      {
        secure: harness.clearingOptions.get("__Host-tb_admin")?.secure,
        httpOnly: harness.clearingOptions.get("__Host-tb_admin")?.httpOnly,
        sameSite: harness.clearingOptions.get("__Host-tb_admin")?.sameSite,
        path: harness.clearingOptions.get("__Host-tb_admin")?.path,
        maxAge: harness.clearingOptions.get("__Host-tb_admin")?.maxAge,
      },
      { secure: true, httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 }
    );

    // Database unreachable during sign-out: the cookie is still removed, and the admin is told
    const { totpSecret: again } = await freshAdmin();
    await signInFully(again);
    harness.db.failWith = new Error("database unreachable");
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal(
        await expectRedirect(() => signOutEverywhereAction()),
        `${ADMIN_SIGN_IN_PATH}?notice=sign-out-incomplete`
      );
    } finally {
      console.error = originalError;
      harness.db.failWith = null;
    }
    assert.equal(harness.cookies.has("__Host-tb_admin"), false);

    // An expired or forged pending cookie is removed when it is presented
    await freshAdmin();
    harness.cookies.set("__Host-tb_admin_pending", { value: "not-a-token" });
    assert.deepEqual(
      await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: "123456" })),
      { error: SIGN_IN_FAILED_MESSAGE }
    );
    assert.equal(harness.cookies.has("__Host-tb_admin_pending"), false);
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  }
  // The sign-in code never calls delete() on a cookie store
  const actionsSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/adm/admin/(sign-in)/login/actions.ts"),
    "utf8"
  );
  assert.equal(/cookieStore\.delete\(/.test(actionsSource), false);
});

test("the sign-in report reads failed code tries and recovery-code use between the last two sign-ins", async () => {
  const { loadAdminSignInReport } = await import("@/lib/auth/admin-sign-in-report");
  await freshAdmin();
  const at = (minutes: number) => new Date(Date.UTC(2026, 10, 24, 12, minutes));
  const session = (id: string, createdAt: Date) => ({
    id,
    userId: ADMIN_ID,
    expiresAt: new Date(createdAt.getTime() + 8 * 60 * 60_000),
    revokedAt: null,
    createdAt,
  });
  harness.db.tables.adminSession.push(session("older", at(0)), session("previous", at(10)), session("current", at(40)));
  const attempt = (kind: string, createdAt: Date, extra: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    kind,
    addressHash: "a",
    succeeded: false,
    refused: false,
    createdAt,
    ...extra,
  });
  harness.db.tables.adminLoginAttempt.push(
    attempt("CODE", at(5)), // before the previous sign-in: not reported again
    attempt("PASSWORD", at(20)), // a wrong password proves nothing about the password
    attempt("CODE", at(21)),
    attempt("CODE", at(22), { refused: true }), // refused tries are tries all the same
    attempt("RECOVERY", at(23)),
    attempt("CODE", at(24), { succeeded: true }),
    attempt("CODE", at(45)) // after this sign-in: for the next report
  );
  harness.db.tables.adminRecoveryCode[0].usedAt = at(39);

  assert.deepEqual(await loadAdminSignInReport({ userId: ADMIN_ID, sessionId: "current" }), {
    previousSignInAt: at(10),
    failedCodeTries: 3,
    recoveryCodesLeft: 9,
    lastRecoveryCodeUsedAt: at(39),
    recoveryCodeUsedSinceLastSignIn: true,
  });
  // First sign-in ever: everything on record counts
  assert.deepEqual(await loadAdminSignInReport({ userId: ADMIN_ID, sessionId: "older" }), {
    previousSignInAt: null,
    failedCodeTries: 0,
    recoveryCodesLeft: 9,
    lastRecoveryCodeUsedAt: at(39),
    recoveryCodeUsedSinceLastSignIn: true,
  });
  assert.equal(await loadAdminSignInReport({ userId: "someone-else", sessionId: "current" }), null);
  assert.equal(await loadAdminSignInReport({ userId: ADMIN_ID, sessionId: "missing" }), null);
});

test("checkout success shows an order only with proof of ownership, never for an order number alone", () => {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/checkout/success/page.tsx"),
    "utf8"
  );
  const ownership = source.indexOf("const ownsOrder = Boolean(");
  const refusal = source.indexOf("if (dbOrder && !ownsOrder) {");
  assert.ok(ownership > 0 && refusal > ownership, "ownership is decided before anything is shown");
  const ownershipRule = source.slice(ownership, refusal);
  assert.match(ownershipRule, /dbOrder\.buyerId === userId/);
  assert.match(ownershipRule, /dbOrder\.anonymousSessionId === anonId/);
  assert.match(ownershipRule, /dbOrder\.stripeCheckoutSessionId === cleanSessionId/);
  assert.equal(/orderNumber/.test(ownershipRule), false, "an order number is not proof");

  // The refusal branch returns a page with no order data in it
  const refusalEnd = source.indexOf("let stripePaymentStatus", refusal);
  const refusalBranch = source.slice(refusal, refusalEnd);
  assert.match(refusalBranch, /return \(/);
  assert.equal(/dbOrder\.|formatUsdMinor|orderNumber/.test(refusalBranch.replace("if (dbOrder && !ownsOrder) {", "")), false);
  // ...and every later use of the order's details comes after it
  for (const detail of ["dbOrder.orderNumber", "dbOrder.items", "dbOrder.totalMinor"]) {
    const first = source.indexOf(detail, ownership);
    if (first !== -1) assert.ok(first > refusalEnd, `${detail} is only read after the ownership check`);
  }
});

test("logs carry no email, password, code, cookie or database message", async () => {
  const { totpSecret } = await freshAdmin();
  const logged: string[] = [];
  const original = { error: console.error, warn: console.warn, log: console.log, info: console.info };
  const capture = (...args: unknown[]) => logged.push(args.map(String).join(" "));
  console.error = capture;
  console.warn = capture;
  console.log = capture;
  console.info = capture;
  let goodCode = "";
  try {
    await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: "wrong password!!" }));
    await expectRedirect(() =>
      signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD }))
    );
    await verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: wrongCode(totpSecret) }));
    goodCode = totpAt(totpSecret, Date.now());
    await expectRedirect(() =>
      verifySignInCodeAction(INITIAL_SIGN_IN_FORM_STATE, form({ code: goodCode }))
    );
    // A database failure in the middle of a step is logged as a class name only
    harness.db.failWith = new Error(`db down for ${EMAIL} at postgres://user:secret@db.example`);
    assert.deepEqual(
      await signInWithPasswordAction(INITIAL_SIGN_IN_FORM_STATE, form({ email: EMAIL, password: PASSWORD })),
      { error: SIGN_IN_FAILED_MESSAGE }
    );
  } finally {
    Object.assign(console, original);
    harness.db.failWith = null;
  }
  const all = logged.join("\n");
  assert.ok(all.includes("[AdminSignIn] Password step could not be completed: Error"));
  for (const secret of [EMAIL, PASSWORD, "wrong password!!", goodCode, "postgres://", MASTER_SECRET]) {
    assert.equal(all.includes(secret), false, `logs must not contain ${JSON.stringify(secret)}`);
  }
  const sessionCookie = harness.cookies.get(adminSessionCookieName())?.value;
  assert.ok(sessionCookie);
  assert.equal(all.includes(sessionCookie), false);
});

// ───────────────────────────── source checks ─────────────────────────────

function collectFiles(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...collectFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const read = (relative: string) => fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");

test("Supabase is gone: no import, no package, no setting, no CSP entry", () => {
  const sourceFiles = [
    ...collectFiles(path.join(REPO_ROOT, "src"), [".ts", ".tsx", ".css", ".mjs"]),
    ...collectFiles(path.join(REPO_ROOT, "scripts"), [".ts", ".tsx", ".mjs", ".js"]),
    ...collectFiles(path.join(REPO_ROOT, "e2e"), [".ts"]),
  ];
  assert.ok(sourceFiles.length > 100, "expected to scan the whole source tree");
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(REPO_ROOT, file);
    assert.equal(/@supabase\//.test(content), false, `${rel} imports a Supabase package`);
    assert.equal(/supabase/i.test(content), false, `${rel} still mentions Supabase`);
  }
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "src/utils/supabase")), false);

  const pkg = JSON.parse(read("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    assert.equal(name.includes("supabase"), false, `package.json still depends on ${name}`);
  }
  assert.equal(/supabase/i.test(read("package-lock.json")), false, "package-lock.json still lists Supabase");

  for (const file of [".env.example", "next.config.ts", "scripts/launch-readiness.ts", "src/lib/env.ts"]) {
    assert.equal(/supabase/i.test(read(file)), false, `${file} still mentions Supabase`);
  }
  assert.equal(read(".env.example").includes("ADMIN_MASTER_PASSWORD"), false);
  assert.match(read(".env.example"), /^ADMIN_SESSION_SECRET=/m);
});

test("every admin page, admin route and admin action checks access itself", () => {
  const guardCall = /\b(requireAdmin|assertAdminApi)\(/;

  // Pages and layouts of the admin area, and route handlers there and under /api/admin
  const entryFiles = [
    ...collectFiles(path.join(REPO_ROOT, "src/app/adm/admin/(panel)"), ["page.tsx", "layout.tsx", "route.ts"]),
    ...collectFiles(path.join(REPO_ROOT, "src/app/api/admin"), ["route.ts"]),
  ];
  assert.ok(entryFiles.length >= 25, `expected the admin entry files, found ${entryFiles.length}`);
  let guarded = 0;
  for (const file of entryFiles) {
    const rel = path.relative(REPO_ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    const isClientComponent = /^\s*["']use client["']/.test(content);
    const readsData = /\bprisma\b|\bawait\b/.test(content);
    if (isClientComponent || !readsData) {
      // A client page holds no data of its own: everything it loads comes from a guarded
      // action or route (checked below). A static page has nothing to protect.
      continue;
    }
    const guardAt = content.search(guardCall);
    assert.ok(guardAt >= 0, `${rel} reads data but never calls requireAdmin or assertAdminApi`);
    const body = content.slice(content.search(/export (default )?(async )?function|export const (GET|POST|PUT|PATCH|DELETE)/));
    const firstData = body.search(/\bprisma\.|\bawait (?!requireAdmin|assertAdminApi|params|searchParams)/);
    const firstGuard = body.search(guardCall);
    assert.ok(firstGuard >= 0, `${rel}: the guard must be called inside the handler`);
    assert.ok(
      firstData === -1 || firstGuard < firstData,
      `${rel}: the guard must run before any data is read`
    );
    guarded += 1;
  }
  assert.ok(guarded >= 20, `expected at least 20 guarded admin entry files, found ${guarded}`);

  // Server actions: every exported function of an admin action file calls the guard
  const adminActionFiles = [
    "src/app/actions/fonts.ts",
    "src/app/actions/gallery.ts",
    "src/app/actions/indexnow.ts",
    "src/app/actions/keepsake-admin.ts",
    "src/app/actions/printful-admin.ts",
    "src/app/adm/admin/(panel)/background-presets/actions.ts",
  ];
  const actionFiles = collectFiles(path.join(REPO_ROOT, "src"), [".ts", ".tsx"]).filter((file) =>
    /^\s*["']use server["']/.test(fs.readFileSync(file, "utf8"))
  );
  for (const expected of adminActionFiles) {
    assert.ok(
      actionFiles.some((file) => path.relative(REPO_ROOT, file) === expected),
      `${expected} must exist and be a server action file`
    );
  }
  for (const file of actionFiles) {
    const rel = path.relative(REPO_ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    const isAdminFile =
      adminActionFiles.includes(rel) ||
      rel.startsWith(path.join("src", "app", "adm", "admin", "(panel)") + path.sep) ||
      content.includes("@/utils/admin/auth");
    if (!isAdminFile) continue;
    const starts = [...content.matchAll(/^export async function (\w+)/gm)];
    assert.ok(starts.length > 0, `${rel} exports no action`);
    starts.forEach((match, index) => {
      const end = index + 1 < starts.length ? starts[index + 1].index! : content.length;
      const body = content.slice(match.index!, end);
      assert.ok(guardCall.test(body), `${rel}: action ${match[1]} does not call the admin guard`);
    });
  }

  // The guard takes identity from the admin session only, and the customer seam stays "guest"
  const guardSource = read("src/utils/admin/auth.ts");
  assert.match(guardSource, /getAdminIdentity\(\)/);
  assert.equal(guardSource.includes("getSessionUser"), false);
  assert.match(read("src/lib/auth/session.ts"), /export async function getSessionUser\(\): Promise<SessionUser \| null> \{\n  return null;\n\}/);
  // The sign-in actions themselves must not sit behind the guard, and must not log inputs
  const signInSource = read("src/app/adm/admin/(sign-in)/login/actions.ts");
  assert.equal(/console\.(log|info|debug)\(/.test(signInSource), false);
  assert.equal(/console\.error\([^)]*(formData|password|code|email|token)/i.test(signInSource), false);
});

test("the admin area lives at ADMIN_BASE_PATH only: one constant, no trace of the old addresses, nothing in robots", async () => {
  assert.equal(ADMIN_BASE_PATH, "/adm/admin");
  assert.equal(adminPath(), ADMIN_BASE_PATH);
  assert.equal(adminPath("/orders"), `${ADMIN_BASE_PATH}/orders`);
  assert.equal(adminPath("orders"), `${ADMIN_BASE_PATH}/orders`);
  assert.equal(ADMIN_SIGN_IN_PATH, `${ADMIN_BASE_PATH}/login`);
  assert.equal(ADMIN_SIGN_IN_CODE_PATH, `${ADMIN_BASE_PATH}/login/code`);
  assert.equal(isAdminPath(ADMIN_BASE_PATH), true);
  assert.equal(isAdminPath(`${ADMIN_BASE_PATH}/orders`), true);
  assert.equal(isAdminPath("/admin"), false);
  assert.equal(isAdminPath(`${ADMIN_BASE_PATH}istrator`), false);

  // The folders match the constant (Next.js takes the address from the folder names)
  const appDir = path.join(REPO_ROOT, "src", "app");
  const adminDir = path.join(appDir, ...ADMIN_BASE_PATH.split("/").filter(Boolean));
  assert.equal(fs.existsSync(path.join(adminDir, "(panel)", "layout.tsx")), true);
  assert.equal(fs.existsSync(path.join(adminDir, "(panel)", "page.tsx")), true);
  assert.equal(fs.existsSync(path.join(adminDir, "(sign-in)", "login", "page.tsx")), true);
  assert.equal(fs.existsSync(path.join(adminDir, "(sign-in)", "login", "code", "page.tsx")), true);
  // The sign-in pages sit outside the guarded layout, or nobody could ever sign in
  assert.equal(fs.existsSync(path.join(adminDir, "layout.tsx")), false);
  assert.match(fs.readFileSync(path.join(adminDir, "(panel)", "layout.tsx"), "utf8"), /await requireAdmin\(\)/);

  // The old addresses have no page, route or redirect behind them: they are ordinary 404s
  for (const gone of ["admin", "admin-verify", path.join("auth", "login")]) {
    const dir = path.join(appDir, gone);
    const files = fs.existsSync(dir) ? collectFiles(dir, [".ts", ".tsx"]) : [];
    assert.deepEqual(files, [], `src/app/${gone} must hold no page or route`);
  }
  const { isDivisionSlug } = await import("@/lib/catalog/divisions");
  for (const segment of ["admin", "adm", "auth"]) {
    assert.equal(isDivisionSlug(segment), false, `/${segment} must not be a storefront division`);
  }
  const config = (await import("../next.config")).default;
  const redirects = (await config.redirects?.()) ?? [];
  for (const rule of redirects) {
    assert.equal(/^\/(admin|adm|auth)(\/|$)/.test(rule.source), false, `no redirect may start at ${rule.source}`);
    assert.equal(rule.destination.includes("/adm"), false, "no redirect may point into the admin area");
  }

  // next.config.ts writes the address out; it must agree with the constant
  const tracingKeys = Object.keys(config.outputFileTracingIncludes ?? {});
  assert.ok(tracingKeys.includes(`${ADMIN_BASE_PATH}/keepsake-editor`));
  assert.ok(tracingKeys.includes(`${ADMIN_BASE_PATH}/keepsake-editor/fonts/*`));
  assert.equal(tracingKeys.some((key) => key.startsWith("/admin")), false);
  const headerRules = (await config.headers?.()) ?? [];
  const adminHeaders = headerRules.find((rule) => rule.source === `${ADMIN_BASE_PATH}/:path*`);
  assert.ok(adminHeaders, "next.config.ts must set headers for the admin area");
  assert.deepEqual(adminHeaders.headers, [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);

  // robots.txt is public: it must not say where admin lives, old address or new
  const robots = (await import("@/app/robots")).default();
  const robotsText = JSON.stringify(robots);
  assert.equal(/adm/i.test(robotsText), false, "robots.txt must not mention the admin area");
  assert.equal(/adm/i.test(read("src/app/sitemap.ts")), false);
  // ...and the admin pages are marked noindex themselves
  for (const file of ["(panel)/layout.tsx", "(sign-in)/login/page.tsx", "(sign-in)/login/code/page.tsx"]) {
    assert.match(
      fs.readFileSync(path.join(adminDir, file), "utf8"),
      /robots: \{ index: false, follow: false \}/,
      `${file} must be noindex`
    );
  }

  // No source file writes an admin address by hand: all of them build on the constant.
  // (/api/admin/... is a different thing: the guarded admin API, which stayed where it was.)
  const offenders: string[] = [];
  for (const file of collectFiles(path.join(REPO_ROOT, "src"), [".ts", ".tsx"])) {
    const rel = path.relative(REPO_ROOT, file);
    if (rel === path.join("src", "lib", "admin-path.ts")) continue;
    const content = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const withoutImports = content.replace(/from\s+"[^"]+"/g, "").replace(/import\(\s*"[^"]+"\s*\)/g, "");
    if (/["'`]\/(admin|adm|auth\/login)(\/|["'`?])/.test(withoutImports)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], "these files write an admin address by hand");
});

test("migration 0004 matches the schema and the columns the database store relies on", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/0004_admin_sign_in/migration.sql");
  const store = read("src/lib/auth/admin-store.ts");

  // Additive only
  assert.equal(/\b(DROP|TRUNCATE|DELETE FROM|ALTER TABLE "(?!Admin)[A-Za-z]+")/i.test(migration), false);

  const expected: Record<string, Record<string, string>> = {
    AdminCredential: {
      userId: "TEXT NOT NULL",
      passwordHash: "TEXT NOT NULL",
      totpSecretSealed: "TEXT NOT NULL",
      totpLastStep: "INTEGER",
      createdAt: "TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
      updatedAt: "TIMESTAMP(3) NOT NULL",
    },
    AdminRecoveryCode: {
      id: "TEXT NOT NULL",
      userId: "TEXT NOT NULL",
      codeHash: "TEXT NOT NULL",
      usedAt: "TIMESTAMP(3)",
      createdAt: "TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
    AdminSession: {
      id: "TEXT NOT NULL",
      userId: "TEXT NOT NULL",
      expiresAt: "TIMESTAMP(3) NOT NULL",
      revokedAt: "TIMESTAMP(3)",
      createdAt: "TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
    AdminSignInChallenge: {
      id: "TEXT NOT NULL",
      userId: "TEXT NOT NULL",
      tries: "INTEGER NOT NULL DEFAULT 0",
      expiresAt: "TIMESTAMP(3) NOT NULL",
      consumedAt: "TIMESTAMP(3)",
      createdAt: "TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
    AdminLoginAttempt: {
      id: "TEXT NOT NULL",
      kind: "TEXT NOT NULL",
      addressHash: "TEXT NOT NULL",
      succeeded: "BOOLEAN NOT NULL DEFAULT false",
      refused: "BOOLEAN NOT NULL DEFAULT false",
      createdAt: "TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP",
    },
  };

  for (const [model, columns] of Object.entries(expected)) {
    const modelBlock = new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
    assert.ok(modelBlock, `schema.prisma must define model ${model}`);
    const schemaFields = modelBlock[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/))
      .filter(([, type]) => type && !/^User\b/.test(type))
      .map(([name]) => name);
    assert.deepEqual(schemaFields.sort(), Object.keys(columns).sort(), `${model}: schema fields`);

    const tableBlock = new RegExp(`CREATE TABLE "${model}" \\(([\\s\\S]*?)\\n\\);`).exec(migration);
    assert.ok(tableBlock, `migration must create table ${model}`);
    const sqlColumns: Record<string, string> = {};
    for (const line of tableBlock[1].split("\n")) {
      const column = /^\s*"(\w+)" (.+?),?$/.exec(line);
      if (column) sqlColumns[column[1]] = column[2];
    }
    assert.deepEqual(sqlColumns, columns, `${model}: migration columns`);
  }
  for (const model of ["AdminCredential", "AdminRecoveryCode", "AdminSession", "AdminSignInChallenge"]) {
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "${model}" ADD CONSTRAINT "${model}_userId_fkey" FOREIGN KEY \\("userId"\\) REFERENCES "User"\\("id"\\)`)
    );
  }
  assert.match(migration, /CREATE UNIQUE INDEX "AdminRecoveryCode_userId_codeHash_key"/);
  assert.match(migration, /CREATE INDEX "AdminLoginAttempt_addressHash_createdAt_idx"/);

  // Every delegate and column name the store uses exists
  const delegateToModel: Record<string, string> = {
    adminCredential: "AdminCredential",
    adminRecoveryCode: "AdminRecoveryCode",
    adminSession: "AdminSession",
    adminSignInChallenge: "AdminSignInChallenge",
    adminLoginAttempt: "AdminLoginAttempt",
  };
  for (const [delegate, model] of Object.entries(delegateToModel)) {
    assert.ok(store.includes(`db().${delegate}.`), `the store must use ${delegate}`);
    const typeBlock = new RegExp(`\\n  ${delegate}: \\{([\\s\\S]*?)\\n  \\};`).exec(store);
    assert.ok(typeBlock, `the store must type the ${delegate} delegate`);
    const used = new Set(
      [...typeBlock[1].matchAll(/\b([a-z][A-Za-z]+)\??: /g)]
        .map((match) => match[1])
        .filter((name) => !["where", "data", "select", "include", "args", "increment", "lt", "gt", "gte", "user", "email"].includes(name))
    );
    for (const name of used) {
      assert.ok(name in expected[model], `${model} has no column "${name}" (used by the store)`);
    }
  }

  // No setting holds a password, and the plain-text master password is gone from the code
  assert.equal(read("src/lib/env.ts").includes("ADMIN_MASTER_PASSWORD"), false);
  assert.equal(read("src/lib/env.ts").includes("PASSWORD"), false);
});
