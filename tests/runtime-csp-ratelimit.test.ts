import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as nodeModule from "node:module";
import { authSeamStubUrl, isAuthSeamSpecifier } from "./helpers/auth-seam-stub";

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

type NextResolveFn = (
  specifier: string,
  context: ResolveContext
) => ResolveResult;

interface ModuleHooksApi {
  registerHooks: (hooks: {
    resolve?: (
      specifier: string,
      context: ResolveContext,
      nextResolve: NextResolveFn
    ) => ResolveResult;
  }) => void;
}

interface MockCookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

interface MockSessionRow {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  designId: string | null;
  designVersionId: string | null;
  mode: string;
  inputText: string;
  culturalStyle: string;
  status: string;
  compositionJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface MockDeviceVerificationRow {
  id: string;
  userId: string;
  code: string;
  attempts: number;
  verified: boolean;
  expiresAt: Date;
}

const state = {
  cookies: new Map<string, MockCookieEntry>(),
  requestHeaders: new Headers(),
  supabaseUser: null as {
    id: string;
    email?: string;
    phone?: string;
    user_metadata?: Record<string, unknown>;
  } | null,
  users: new Map<
    string,
    { id: string; email: string | null; phoneNumber: string | null; name?: string | null; status: string }
  >(),
  sessions: new Map<string, MockSessionRow>(),
  sessionCreateCount: 0,
  deviceVerifications: new Map<string, MockDeviceVerificationRow>(),
};

function resetHarnessState(): void {
  state.cookies.clear();
  state.requestHeaders = new Headers();
  state.supabaseUser = null;
  state.users.clear();
  state.sessions.clear();
  state.sessionCreateCount = 0;
  state.deviceVerifications.clear();
}

declare global {
  var __tbRuntimeTestHooks: {
    getCookiesStore: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) => void;
      delete: (name: string) => void;
    }>;
    getHeaders: () => Promise<Headers>;
    createSupabaseClient: () => Promise<{
      auth: {
        getUser: () => Promise<{
          data: { user: typeof state.supabaseUser };
          error: Error | null;
        }>;
      };
    }>;
    prisma: Record<string, unknown>;
  };
}

globalThis.__tbRuntimeTestHooks = {
  async getCookiesStore() {
    return {
      get(name: string) {
        const found = state.cookies.get(name);
        return found ? { name: found.name, value: found.value } : undefined;
      },
      set(
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) {
        if (typeof nameOrObj === "string") {
          state.cookies.set(nameOrObj, {
            name: nameOrObj,
            value: value ?? "",
            options,
          });
        } else {
          state.cookies.set(nameOrObj.name, {
            name: nameOrObj.name,
            value: nameOrObj.value,
          });
        }
      },
      delete(name: string) {
        state.cookies.delete(name);
      },
    };
  },
  async getHeaders() {
    return state.requestHeaders;
  },
  async createSupabaseClient() {
    return {
      auth: {
        async getUser() {
          if (!state.supabaseUser) {
            return { data: { user: null }, error: new Error("Unauthenticated") };
          }
          return { data: { user: state.supabaseUser }, error: null };
        },
      },
    };
  },
  prisma: {
    user: {
      async findUnique(args: { where: { id?: string; email?: string } }) {
        if (args.where.id) return state.users.get(args.where.id) ?? null;
        if (args.where.email) {
          for (const u of state.users.values()) {
            if (u.email === args.where.email) return u;
          }
        }
        return null;
      },
      async create(args: {
        data: { id: string; email: string; name?: string };
      }) {
        const row = {
          id: args.data.id,
          email: args.data.email,
          phoneNumber: null,
          name: args.data.name ?? null,
          status: "ACTIVE",
        };
        state.users.set(row.id, row);
        return row;
      },
      async upsert(args: {
        where: { id: string };
        create: { id: string; email: string | null; phoneNumber: string | null };
        update: { email?: string; phoneNumber?: string };
      }) {
        const existing = state.users.get(args.where.id);
        if (existing) {
          if (args.update.email !== undefined) existing.email = args.update.email;
          if (args.update.phoneNumber !== undefined) {
            existing.phoneNumber = args.update.phoneNumber;
          }
          return existing;
        }
        const created = {
          id: args.create.id,
          email: args.create.email,
          phoneNumber: args.create.phoneNumber,
          status: "ACTIVE",
        };
        state.users.set(created.id, created);
        return created;
      },
    },
    personalizationSession: {
      async findUnique(args: { where: { id: string } }) {
        return state.sessions.get(args.where.id) ?? null;
      },
      async findFirst(args: {
        where: {
          userId?: string;
          anonymousSessionId?: string;
          status?: string;
        };
      }) {
        const matches = Array.from(state.sessions.values()).filter((s) => {
          if (args.where.status && s.status !== args.where.status) return false;
          if (args.where.userId !== undefined && s.userId !== args.where.userId) {
            return false;
          }
          if (
            args.where.anonymousSessionId !== undefined &&
            s.anonymousSessionId !== args.where.anonymousSessionId
          ) {
            return false;
          }
          return true;
        });
        matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return matches[0] ?? null;
      },
      async create(args: {
        data: {
          id?: string;
          userId?: string | null;
          anonymousSessionId?: string | null;
          designId?: string | null;
          designVersionId?: string | null;
          mode: string;
          inputText: string;
          culturalStyle: string;
          status: string;
          compositionJson?: unknown;
        };
      }) {
        state.sessionCreateCount += 1;
        const id = args.data.id ?? crypto.randomUUID();
        const now = new Date();
        const row: MockSessionRow = {
          id,
          userId: args.data.userId ?? null,
          anonymousSessionId: args.data.anonymousSessionId ?? null,
          designId: args.data.designId ?? null,
          designVersionId: args.data.designVersionId ?? null,
          mode: args.data.mode,
          inputText: args.data.inputText,
          culturalStyle: args.data.culturalStyle,
          status: args.data.status,
          compositionJson: args.data.compositionJson ?? null,
          createdAt: now,
          updatedAt: now,
        };
        state.sessions.set(id, row);
        return row;
      },
      async update(args: {
        where: { id: string };
        data: Partial<MockSessionRow>;
      }) {
        const row = state.sessions.get(args.where.id);
        if (!row) throw new Error("Session not found");
        Object.assign(row, args.data, { updatedAt: new Date() });
        return row;
      },
    },
    deviceVerification: {
      async deleteMany(args: { where: { userId: string; verified: boolean } }) {
        let count = 0;
        for (const [id, rec] of state.deviceVerifications.entries()) {
          if (
            rec.userId === args.where.userId &&
            rec.verified === args.where.verified
          ) {
            state.deviceVerifications.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      async create(args: {
        data: { userId: string; code: string; attempts: number; expiresAt: Date };
      }) {
        const id = crypto.randomUUID();
        const rec: MockDeviceVerificationRow = {
          id,
          userId: args.data.userId,
          code: args.data.code,
          attempts: args.data.attempts,
          verified: false,
          expiresAt: args.data.expiresAt,
        };
        state.deviceVerifications.set(id, rec);
        return rec;
      },
    },
  },
};

(nodeModule as unknown as ModuleHooksApi).registerHooks({
  resolve(
    specifier: string,
    context: ResolveContext,
    nextResolve: NextResolveFn
  ): ResolveResult {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier === "next/headers") {
      return {
        url: "data:text/javascript,export const cookies = () => globalThis.__tbRuntimeTestHooks.getCookiesStore(); export const headers = () => globalThis.__tbRuntimeTestHooks.getHeaders();",
        shortCircuit: true,
      };
    }
    if (isAuthSeamSpecifier(specifier)) {
      return {
        url: authSeamStubUrl("__tbRuntimeTestHooks"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma" || specifier.endsWith("/lib/prisma")) {
      return {
        url: "data:text/javascript,export default globalThis.__tbRuntimeTestHooks.prisma;",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { NextResponse } = await import("next/server");
const { EnvValidationError, validateServerEnv } = await import("@/lib/env");
const {
  RateLimitError,
  createSharedMemoryRateLimitStore,
  createUpstashRestRateLimitStore,
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  resetRateLimitStore,
  setDistributedRateLimitStoreForTests,
} = await import("@/lib/security/rate-limit");
const {
  CSP_REPORT_TO_HEADER_VALUE,
  applySecurityHeaders,
  buildCspHeader,
} = await import("@/lib/security/headers");
const { POST: cspReportPost } = await import("@/app/api/csp-report/route");
const { ensureStudioSessionAction } = await import("@/app/actions/composition");
const analyzeRoute = await import("@/app/api/personalization/analyze/route");
const generateRoute = await import("@/app/api/personalization/generate/route");
const detectLanguageRoute = await import(
  "@/app/api/personalization/detect-language/route"
);
const inngestRoute = await import("@/app/api/inngest/route");

function buildValidProductionEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://thibut.com",
    DATABASE_URL: "postgresql://user:pass@db.example.com:5432/thibut",
    STRIPE_SECRET_KEY: "sk_live_real_secret_key_for_thibut_platform",
    STRIPE_WEBHOOK_SECRET: "whsec_real_stripe_webhook_secret_123456",
    INNGEST_SIGNING_KEY: "signkey-prod-0123456789abcdef0123456789abcdef",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_live_token_123456789",
    ADMIN_SESSION_SECRET: "a".repeat(32),
    DEVICE_TRUST_SECRET: "b".repeat(32),
    DOWNLOAD_TOKEN_SECRET: "c".repeat(32),
    ANON_SESSION_SECRET: "d".repeat(32),
    FULFILLMENT_SECRET_KEY: "e".repeat(32),
  };
}

test("R-002, R-303 & R-400: validateServerEnv enforces INNGEST_SIGNING_KEY and >=32-char secrets in production and heavy routes export nodejs + maxDuration=60", () => {
  // 1. Missing INNGEST_SIGNING_KEY fails with EnvValidationError when forceProduction: true
  const missingInngestEnv = buildValidProductionEnv();
  delete missingInngestEnv.INNGEST_SIGNING_KEY;

  assert.throws(
    () => validateServerEnv(missingInngestEnv, { forceProduction: true }),
    (err: unknown) =>
      err instanceof EnvValidationError &&
      err.issues.some((msg) => msg.includes("INNGEST_SIGNING_KEY"))
  );

  // 2. Short (<32 chars) signing secrets fail with EnvValidationError
  const shortSecretEnv = {
    ...buildValidProductionEnv(),
    DEVICE_TRUST_SECRET: "too-short-secret",
    ANON_SESSION_SECRET: "short",
  };

  assert.throws(
    () => validateServerEnv(shortSecretEnv, { forceProduction: true }),
    (err: unknown) =>
      err instanceof EnvValidationError &&
      err.issues.some((msg) => msg.includes("DEVICE_TRUST_SECRET")) &&
      err.issues.some((msg) => msg.includes("ANON_SESSION_SECRET"))
  );

  // 3. Placeholder Stripe key fails in production
  const placeholderStripeEnv = {
    ...buildValidProductionEnv(),
    STRIPE_SECRET_KEY: "sk_test_placeholder_key",
  };
  assert.throws(
    () => validateServerEnv(placeholderStripeEnv, { forceProduction: true }),
    (err: unknown) =>
      err instanceof EnvValidationError &&
      err.issues.some((msg) => msg.includes("STRIPE_SECRET_KEY"))
  );

  // 4. During Next.js static build phase (without forceProduction), build-time import does not crash
  const buildPhaseEnv = {
    NODE_ENV: "production",
    NEXT_PHASE: "phase-production-build",
  };
  assert.equal(validateServerEnv(buildPhaseEnv).NODE_ENV, "production");

  // 5. Complete valid production environment passes cleanly
  const validProd = validateServerEnv(buildValidProductionEnv(), {
    forceProduction: true,
  });
  assert.equal(validProd.NODE_ENV, "production");
  assert.ok(validProd.INNGEST_SIGNING_KEY);

  // 5b. The live site starts without any print-on-demand provider setting: the fixture above
  //     names none, and each service the business still uses stays required.
  const fixtureKeys = Object.keys(buildValidProductionEnv());
  assert.equal(
    fixtureKeys.some((key) => key.startsWith("PRINTFUL")),
    false,
    "the valid production fixture must not carry provider settings"
  );
  for (const stillRequired of [
    "DATABASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "INNGEST_SIGNING_KEY",
    "BLOB_READ_WRITE_TOKEN",
    "ADMIN_SESSION_SECRET",
    "ANON_SESSION_SECRET",
    "DOWNLOAD_TOKEN_SECRET",
    "FULFILLMENT_SECRET_KEY",
    "DEVICE_TRUST_SECRET",
  ]) {
    const withoutOne = buildValidProductionEnv();
    delete withoutOne[stillRequired];
    assert.throws(
      () => validateServerEnv(withoutOne, { forceProduction: true }),
      (err: unknown) =>
        err instanceof EnvValidationError &&
        err.issues.some((msg) => msg.includes(stillRequired)),
      `${stillRequired} must stay required on the live site`
    );
  }

  // 6. Heavy personalization & Inngest routes configure runtime = "nodejs" and maxDuration = 60
  for (const mod of [
    analyzeRoute,
    generateRoute,
    detectLanguageRoute,
    inngestRoute,
  ]) {
    assert.equal(mod.runtime, "nodejs");
    assert.equal(mod.maxDuration, 60);
  }
});

test("R-100, R-101 & R-302: dynamic nonce layout, self-hosted DESIGN.md fonts, strict CSP without bare https:, and /api/csp-report validation + rate limiting", async () => {
  resetHarnessState();
  resetRateLimitStore();

  // 1. Verify CSP header directives
  const csp = buildCspHeader("nonce-r302-test==", false);
  assert.ok(csp.includes("'nonce-nonce-r302-test=='"));
  assert.ok(csp.includes("'strict-dynamic'"));
  assert.equal(csp.includes("fonts.googleapis.com"), false);
  assert.equal(csp.includes("fonts.gstatic.com"), false);
  assert.equal(csp.includes("typekit"), false);
  assert.ok(csp.includes("report-uri /api/csp-report"));
  assert.ok(csp.includes("report-to csp-endpoint"));

  const imgSrcDirective = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("img-src "));
  assert.ok(imgSrcDirective, "Expected img-src directive in CSP");
  const imgTokens = imgSrcDirective.split(/\s+/).slice(1);
  assert.equal(
    imgTokens.includes("https:"),
    false,
    "img-src must NOT contain bare wildcard https:"
  );
  assert.ok(imgTokens.includes("https://files.cdn.printful.com"));
  assert.ok(imgTokens.includes("https://*.public.blob.vercel-storage.com"));
  assert.equal(
    csp.includes("supabase"),
    false,
    "No CSP directive may allow Supabase hosts after the sign-in move"
  );

  // 2. Verify applySecurityHeaders attaches Report-To JSON header
  const dummyRes = applySecurityHeaders(NextResponse.next(), csp);
  assert.equal(dummyRes.headers.get("Content-Security-Policy"), csp);
  assert.equal(dummyRes.headers.get("Report-To"), CSP_REPORT_TO_HEADER_VALUE);
  const parsedReportTo = JSON.parse(
    dummyRes.headers.get("Report-To") ?? "{}"
  ) as { group?: string; endpoints?: Array<{ url?: string }> };
  assert.equal(parsedReportTo.group, "csp-endpoint");
  assert.equal(parsedReportTo.endpoints?.[0]?.url, "/api/csp-report");

  // 3. Verify RootLayout, scoped brush font layouts, and globals.css invariants (R-100, R-101)
  const rootLayoutSrc = await fs.readFile(
    path.join(process.cwd(), "src/app/layout.tsx"),
    "utf8"
  );
  assert.match(rootLayoutSrc, /export default async function RootLayout/);
  assert.match(rootLayoutSrc, /await connection\(\)/);
  assert.match(rootLayoutSrc, /headers\(\)/);
  assert.match(rootLayoutSrc, /nonce=\{nonce\}/);
  assert.equal(rootLayoutSrc.includes("typekit.net"), false);
  assert.equal(rootLayoutSrc.includes("Geist"), false);
  assert.equal(rootLayoutSrc.includes("MobileNav"), false);
  assert.equal(rootLayoutSrc.includes("pb-16"), false);
  assert.equal(rootLayoutSrc.includes("fontVnAlexBrush"), false);

  const globalsCssSrc = await fs.readFile(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );
  assert.equal(globalsCssSrc.includes("fonts.googleapis.com"), false);
  assert.equal(globalsCssSrc.includes("--color-tb-"), false);
  assert.ok(globalsCssSrc.includes("var(--font-playfair)"));
  assert.ok(globalsCssSrc.includes("var(--font-inter)"));

  const createLayoutSrc = await fs.readFile(
    path.join(process.cwd(), "src/app/create/layout.tsx"),
    "utf8"
  );
  const studioLayoutSrc = await fs.readFile(
    path.join(process.cwd(), "src/app/studio/layout.tsx"),
    "utf8"
  );
  assert.ok(createLayoutSrc.includes("studioBrushFontVariables"));
  assert.ok(studioLayoutSrc.includes("studioBrushFontVariables"));
  assert.ok(studioLayoutSrc.includes("verifyDeviceTrustToken"));

  // 4. Test POST /api/csp-report: validates payload, strips tokens/queries, logs concise warning, returns 204
  const loggedWarnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    loggedWarnings.push(args.map(String).join(" "));
  };

  try {
    // Legacy application/csp-report payload with sensitive query token
    const legacyRes = await cspReportPost(
      new Request("https://thibut.com/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/csp-report",
          "x-vercel-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({
          "csp-report": {
            "document-uri":
              "https://thibut.com/api/download?token=super_secret_jwt_123#frag",
            "blocked-uri": "https://evil.example.com/inject.js?session=abc",
            "effective-directive": "script-src-elem",
            disposition: "enforce",
          },
        }),
      })
    );
    assert.equal(legacyRes.status, 204);
    assert.equal(loggedWarnings.length, 1);
    assert.ok(loggedWarnings[0].includes("https://thibut.com/api/download"));
    assert.equal(
      loggedWarnings[0].includes("super_secret_jwt_123"),
      false,
      "Query tokens must be stripped from logged CSP URIs"
    );
    assert.equal(loggedWarnings[0].includes("session=abc"), false);

    // Reporting API application/reports+json array payload
    const reportToRes = await cspReportPost(
      new Request("https://thibut.com/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/reports+json",
          "x-vercel-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify([
          {
            type: "csp-violation",
            url: "https://thibut.com/checkout?sessionId=secret-uuid",
            body: {
              documentURL: "https://thibut.com/checkout?sessionId=secret-uuid",
              blockedURL: "inline",
              effectiveDirective: "script-src",
              disposition: "enforce",
            },
          },
        ]),
      })
    );
    assert.equal(reportToRes.status, 204);
    assert.equal(loggedWarnings[1].includes("secret-uuid"), false);

    // Invalid schema returns 400
    const badSchemaRes = await cspReportPost(
      new Request("https://thibut.com/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vercel-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({ unrelated: true }),
      })
    );
    assert.equal(badSchemaRes.status, 400);

    // Unsupported Content-Type returns 415
    const wrongTypeRes = await cspReportPost(
      new Request("https://thibut.com/api/csp-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-vercel-forwarded-for": "203.0.113.10",
        },
        body: "a=b",
      })
    );
    assert.equal(wrongTypeRes.status, 415);

    // Exhaust remaining 26 requests for IP 203.0.113.10 (4 already consumed above -> 30 total allowed, 31st returns 429)
    let status429Seen = false;
    for (let i = 0; i < 30; i++) {
      const r = await cspReportPost(
        new Request("https://thibut.com/api/csp-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/csp-report",
            "x-vercel-forwarded-for": "203.0.113.10",
          },
          body: JSON.stringify({
            "csp-report": {
              "document-uri": "https://thibut.com/",
              "blocked-uri": "inline",
              "effective-directive": "script-src",
            },
          }),
        })
      );
      if (r.status === 429) {
        status429Seen = true;
        assert.ok(Number(r.headers.get("Retry-After") ?? "0") >= 1);
        break;
      }
    }
    assert.equal(status429Seen, true, "Expected 429 after exceeding 30 reports/min");
  } finally {
    console.warn = origWarn;
  }
});

test("R-300: distributed rate limiter enforces a single global limit across independent instances via mock Upstash Redis REST pipeline and never collapses headerless clients to 127.0.0.1", async () => {
  resetHarnessState();
  resetRateLimitStore();

  // 1. Verify getClientIpFromHeaders precedence and absence of "127.0.0.1" fallback
  const vercelHeaders = new Headers({
    "x-vercel-forwarded-for": "198.51.100.42, 10.0.0.1",
    "x-forwarded-for": "203.0.113.99",
    "x-real-ip": "203.0.113.100",
  });
  assert.equal(getClientIpFromHeaders(vercelHeaders), "198.51.100.42");

  const emptyHeaders = new Headers();
  const emptyIpA = getClientIpFromHeaders(emptyHeaders);
  const emptyIpB = getClientIpFromHeaders(emptyHeaders);
  assert.notEqual(emptyIpA, "127.0.0.1");
  assert.notEqual(emptyIpB, "127.0.0.1");
  assert.notEqual(
    emptyIpA,
    emptyIpB,
    "Headerless requests without identity must not share a static bucket"
  );
  assert.equal(
    getClientIpFromHeaders(emptyHeaders, "user-abc-123"),
    "id:user-abc-123"
  );

  // 2. Simulate an Upstash Redis sorted-set backend shared by two independent serverless instances
  const redisSortedSets = new Map<string, Map<string, number>>();

  const mockRedisFetch: typeof fetch = async (_input, init) => {
    const commands = JSON.parse(String(init?.body ?? "[]")) as string[][];
    const results = commands.map((cmd) => {
      const [op, key, arg1, arg2, arg3] = cmd;
      let zset = redisSortedSets.get(key);
      if (!zset) {
        zset = new Map();
        redisSortedSets.set(key, zset);
      }

      if (op === "ZREMRANGEBYSCORE") {
        const min = Number(arg1);
        const max = Number(arg2);
        let removed = 0;
        for (const [member, score] of zset.entries()) {
          if (score >= min && score <= max) {
            zset.delete(member);
            removed += 1;
          }
        }
        return { result: removed };
      }

      if (op === "ZADD") {
        const score = Number(arg1);
        const member = arg2;
        zset.set(member, score);
        return { result: 1 };
      }

      if (op === "ZCARD") {
        return { result: zset.size };
      }

      if (op === "ZRANGE") {
        const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
        if (sorted.length === 0) return { result: [] };
        if (arg3 === "WITHSCORES") {
          return { result: [sorted[0][0], String(sorted[0][1])] };
        }
        return { result: [sorted[0][0]] };
      }

      if (op === "ZREM") {
        const deleted = zset.delete(arg1) ? 1 : 0;
        return { result: deleted };
      }

      if (op === "PEXPIRE") {
        return { result: 1 };
      }

      return { result: null };
    });

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  // Two separate client instances (representing two isolated Lambda / Vercel Function containers)
  const instanceA = createUpstashRestRateLimitStore(
    "https://mock-upstash.example.com",
    "mock-token",
    mockRedisFetch
  );
  const instanceB = createUpstashRestRateLimitStore(
    "https://mock-upstash.example.com",
    "mock-token",
    mockRedisFetch
  );

  // Global limit = 3 across BOTH instances combined:
  // Instance A consumes 2, Instance B consumes 1 -> 4th call on Instance B MUST fail with RateLimitError!
  const r1 = await enforceDistributedRateLimit(
    { bucket: "paid-ai", key: "buyer-1", limit: 3, windowMs: 60_000 },
    instanceA
  );
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = await enforceDistributedRateLimit(
    { bucket: "paid-ai", key: "buyer-1", limit: 3, windowMs: 60_000 },
    instanceA
  );
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = await enforceDistributedRateLimit(
    { bucket: "paid-ai", key: "buyer-1", limit: 3, windowMs: 60_000 },
    instanceB
  );
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  await assert.rejects(
    () =>
      enforceDistributedRateLimit(
        { bucket: "paid-ai", key: "buyer-1", limit: 3, windowMs: 60_000 },
        instanceB
      ),
    (err: unknown) => err instanceof RateLimitError && err.status === 429
  );

  // Verify blocked attempt rolled back via ZREM so cardinality stays at 3 (not 4)
  assert.equal(redisSortedSets.get("tb:rl:paid-ai:buyer-1")?.size, 3);

  // 3. The shared store set for tests is the one enforceDistributedRateLimit uses by default:
  //    three tries pass and the fourth is refused with 429 (the admin sign-in brake relies on this)
  const sharedMap = new Map<string, number[]>();
  setDistributedRateLimitStoreForTests(
    createSharedMemoryRateLimitStore(sharedMap)
  );
  for (let i = 0; i < 3; i++) {
    const okRes = await enforceDistributedRateLimit({
      bucket: "admin-sign-in-password",
      key: "198.51.100.77",
      limit: 3,
      windowMs: 15 * 60_000,
    });
    assert.equal(okRes.allowed, true);
  }
  await assert.rejects(
    () =>
      enforceDistributedRateLimit({
        bucket: "admin-sign-in-password",
        key: "198.51.100.77",
        limit: 3,
        windowMs: 15 * 60_000,
      }),
    (err: unknown) => err instanceof RateLimitError && err.status === 429
  );
  assert.equal(sharedMap.size, 1);
  resetRateLimitStore();
});

test("R-301: 50 rapid calls to ensureStudioSessionAction without sessionId reuse the caller's DRAFT session and create at most 1 DB row", async () => {
  resetHarnessState();
  resetRateLimitStore();
  process.env.ANON_SESSION_SECRET = "r301-anon-session-secret-32-chars!!";
  state.requestHeaders = new Headers({
    "x-vercel-forwarded-for": "198.51.100.200",
  });

  // 1. Sequential burst: 50 rapid calls by an anonymous caller
  const returnedSessionIds = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const res = await ensureStudioSessionAction();
    assert.equal(res.ok, true, `Call #${i + 1} should succeed via DRAFT reuse`);
    assert.equal(res.locked, false);
    assert.ok(res.sessionId);
    returnedSessionIds.add(res.sessionId);
  }

  assert.equal(
    state.sessionCreateCount,
    1,
    "50 rapid sequential calls must create at most 1 PersonalizationSession DB row"
  );
  assert.equal(returnedSessionIds.size, 1);

  // 2. Concurrent burst (Promise.all of 50 simultaneous calls for an authenticated user)
  resetHarnessState();
  resetRateLimitStore();
  state.supabaseUser = { id: "u-studio-rapid", email: "buyer@thibut.com" };
  state.requestHeaders = new Headers({
    "x-vercel-forwarded-for": "198.51.100.201",
  });

  const concurrentResults = await Promise.all(
    Array.from({ length: 50 }, () => ensureStudioSessionAction())
  );

  for (const res of concurrentResults) {
    assert.equal(res.ok, true);
    assert.equal(res.sessionId, concurrentResults[0].sessionId);
  }
  assert.equal(
    state.sessionCreateCount,
    1,
    "50 concurrent calls must coalesce and create at most 1 PersonalizationSession DB row"
  );

  // 3. Exceeding the 60/min action rate limit returns { ok: false, error: "Too many requests" }
  let hitRateLimit = false;
  for (let i = 0; i < 20; i++) {
    const extra = await ensureStudioSessionAction();
    if (!extra.ok) {
      hitRateLimit = true;
      assert.equal(extra.error, "Too many requests");
      assert.equal(extra.sessionId, "");
      break;
    }
  }
  assert.equal(hitRateLimit, true);
});
