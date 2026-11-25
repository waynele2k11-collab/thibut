import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as nodeModule from "node:module";
import sharp from "sharp";
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

interface MockCookieRecord {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

interface MockRoleEntry {
  role: { code: string };
}

interface MockDbUser {
  id: string;
  email: string | null;
  phoneNumber?: string | null;
  name?: string | null;
  status: "ACTIVE" | "SUSPENDED";
  roles: MockRoleEntry[];
}

interface MockDeviceVerification {
  id: string;
  userId: string;
  code: string;
  deviceId: string | null;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

interface MockAssetRecord {
  id: string;
  objectKey: string;
  mimeType: string;
  sha256: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  storageProvider: string;
  ownerId: string | null;
  anonymousSessionId: string | null;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
}

interface TestHarnessState {
  cookies: Map<string, MockCookieRecord>;
  deletedCookies: string[];
  supabaseUser: { id: string; email?: string; phone?: string } | null;
  exchangeCodeError: Error | null;
  usersById: Map<string, MockDbUser>;
  deviceVerifications: Map<string, MockDeviceVerification>;
  assets: Map<string, MockAssetRecord>;
  presetCreatedCount: number;
  galleryCreatedCount: number;
  galleryItems: Map<
    string,
    { id: string; title: string; published: boolean; listedPriceMinor: bigint }
  >;
}

const harness: TestHarnessState = {
  cookies: new Map(),
  deletedCookies: [],
  supabaseUser: null,
  exchangeCodeError: null,
  usersById: new Map(),
  deviceVerifications: new Map(),
  assets: new Map(),
  presetCreatedCount: 0,
  galleryCreatedCount: 0,
  galleryItems: new Map(),
};

function resetHarness(): void {
  harness.cookies.clear();
  harness.deletedCookies = [];
  harness.supabaseUser = null;
  harness.exchangeCodeError = null;
  harness.usersById.clear();
  harness.deviceVerifications.clear();
  harness.assets.clear();
  harness.presetCreatedCount = 0;
  harness.galleryCreatedCount = 0;
  harness.galleryItems.clear();
}

class RedirectSignal extends Error {
  public readonly destination: string;

  constructor(destination: string) {
    super(`NEXT_REDIRECT:${destination}`);
    this.name = "RedirectSignal";
    this.destination = destination;
  }
}

declare global {
  var __tbSecTestHooks: {
    getCookiesStore: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) => void;
      delete: (name: string) => void;
    }>;
    redirect: (url: string) => never;
    revalidatePath: (_path: string) => void;
    createSupabaseClient: () => Promise<{
      auth: {
        getUser: () => Promise<{
          data: { user: TestHarnessState["supabaseUser"] };
          error: Error | null;
        }>;
        exchangeCodeForSession: (
          _code: string
        ) => Promise<{ error: Error | null }>;
      };
    }>;
    prisma: Record<string, unknown>;
  };
}

globalThis.__tbSecTestHooks = {
  async getCookiesStore() {
    return {
      get(name: string) {
        const entry = harness.cookies.get(name);
        return entry ? { name: entry.name, value: entry.value } : undefined;
      },
      set(
        nameOrObj: string | { name: string; value: string },
        value?: string,
        options?: Record<string, unknown>
      ) {
        if (typeof nameOrObj === "string") {
          harness.cookies.set(nameOrObj, {
            name: nameOrObj,
            value: value ?? "",
            options,
          });
        } else {
          harness.cookies.set(nameOrObj.name, {
            name: nameOrObj.name,
            value: nameOrObj.value,
          });
        }
      },
      delete(name: string) {
        harness.cookies.delete(name);
        harness.deletedCookies.push(name);
      },
    };
  },
  redirect(url: string): never {
    throw new RedirectSignal(url);
  },
  revalidatePath() {
    // no-op in unit tests
  },
  async createSupabaseClient() {
    return {
      auth: {
        async getUser() {
          if (!harness.supabaseUser) {
            return { data: { user: null }, error: new Error("No session") };
          }
          return { data: { user: harness.supabaseUser }, error: null };
        },
        async exchangeCodeForSession() {
          return { error: harness.exchangeCodeError };
        },
      },
    };
  },
  prisma: {
    user: {
      async findUnique(args: { where: { id?: string; email?: string } }) {
        if (args.where.id) {
          return harness.usersById.get(args.where.id) ?? null;
        }
        if (args.where.email) {
          for (const u of harness.usersById.values()) {
            if (u.email === args.where.email) return u;
          }
        }
        return null;
      },
      async upsert(args: {
        where: { id: string };
        create: { id: string; email: string | null; phoneNumber: string | null };
        update: { email: string | null; phoneNumber: string | null };
      }) {
        const existing = harness.usersById.get(args.where.id);
        if (existing) {
          existing.email = args.update.email;
          existing.phoneNumber = args.update.phoneNumber;
          return existing;
        }
        const created: MockDbUser = {
          id: args.create.id,
          email: args.create.email,
          phoneNumber: args.create.phoneNumber,
          status: "ACTIVE",
          roles: [],
        };
        harness.usersById.set(created.id, created);
        return created;
      },
    },
    backgroundPreset: {
      async create() {
        harness.presetCreatedCount += 1;
        return { id: "preset-1" };
      },
      async update() {
        return { id: "preset-1" };
      },
      async delete() {
        return { id: "preset-1" };
      },
    },
    galleryItem: {
      async create(args: {
        data: { title: string; published: boolean; listedPriceMinor: bigint };
      }) {
        harness.galleryCreatedCount += 1;
        const id = `gal-${harness.galleryCreatedCount}`;
        const record = {
          id,
          title: args.data.title,
          published: args.data.published,
          listedPriceMinor: args.data.listedPriceMinor,
        };
        harness.galleryItems.set(id, record);
        return record;
      },
      async findFirst(args: { where: { id: string; published?: boolean } }) {
        const found = harness.galleryItems.get(args.where.id);
        if (!found) return null;
        if (
          args.where.published !== undefined &&
          found.published !== args.where.published
        ) {
          return null;
        }
        return found;
      },
    },
    deviceVerification: {
      async findFirst(args: {
        where: { userId: string; verified: boolean };
      }) {
        const matches = Array.from(harness.deviceVerifications.values()).filter(
          (v) =>
            v.userId === args.where.userId &&
            v.verified === args.where.verified &&
            v.expiresAt.getTime() > Date.now()
        );
        matches.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        return matches[0] ?? null;
      },
      async update(args: {
        where: { id: string };
        data: {
          attempts?: { increment: number };
          verified?: boolean;
          deviceId?: string;
        };
      }) {
        const rec = harness.deviceVerifications.get(args.where.id);
        if (!rec) throw new Error("Not found");
        if (args.data.attempts?.increment) {
          rec.attempts += args.data.attempts.increment;
        }
        if (args.data.verified !== undefined) {
          rec.verified = args.data.verified;
        }
        if (args.data.deviceId !== undefined) {
          rec.deviceId = args.data.deviceId;
        }
        return rec;
      },
      async delete(args: { where: { id: string } }) {
        const rec = harness.deviceVerifications.get(args.where.id);
        harness.deviceVerifications.delete(args.where.id);
        return rec;
      },
      async deleteMany(args: { where: { userId: string; verified: boolean } }) {
        let count = 0;
        for (const [id, v] of harness.deviceVerifications.entries()) {
          if (
            v.userId === args.where.userId &&
            v.verified === args.where.verified
          ) {
            harness.deviceVerifications.delete(id);
            count += 1;
          }
        }
        return { count };
      },
      async create(args: {
        data: {
          userId: string;
          code: string;
          attempts?: number;
          expiresAt: Date;
        };
      }) {
        const id = `dv-${harness.deviceVerifications.size + 1}`;
        const rec: MockDeviceVerification = {
          id,
          userId: args.data.userId,
          code: args.data.code,
          deviceId: null,
          attempts: args.data.attempts ?? 0,
          expiresAt: args.data.expiresAt,
          verified: false,
          createdAt: new Date(),
        };
        harness.deviceVerifications.set(id, rec);
        return rec;
      },
    },
    asset: {
      async create(args: { data: Omit<MockAssetRecord, "id"> }) {
        const id = `asset-${harness.assets.size + 1}`;
        const rec: MockAssetRecord = { id, ...args.data };
        harness.assets.set(id, rec);
        return rec;
      },
      async findUnique(args: { where: { id: string } }) {
        return harness.assets.get(args.where.id) ?? null;
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
        url: "data:text/javascript,export const cookies = () => globalThis.__tbSecTestHooks.getCookiesStore();",
        shortCircuit: true,
      };
    }
    if (specifier === "next/navigation") {
      return {
        url: "data:text/javascript,export const redirect = (u) => globalThis.__tbSecTestHooks.redirect(u); export const notFound = () => { throw new Error('NEXT_NOT_FOUND'); };",
        shortCircuit: true,
      };
    }
    if (specifier === "next/cache") {
      return {
        url: "data:text/javascript,export const revalidatePath = (p) => globalThis.__tbSecTestHooks.revalidatePath(p);",
        shortCircuit: true,
      };
    }
    if (isAuthSeamSpecifier(specifier)) {
      return {
        url: authSeamStubUrl("__tbSecTestHooks"),
        shortCircuit: true,
      };
    }
    if (specifier === "@/lib/prisma" || specifier.endsWith("/lib/prisma")) {
      return {
        url: "data:text/javascript,export default globalThis.__tbSecTestHooks.prisma;",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { safeRedirectPath } = await import("@/lib/security/redirect");
const { resetRateLimitStore } = await import("@/lib/security/rate-limit");
const {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  signDeviceTrustToken,
  verifyDeviceTrustToken,
} = await import("@/lib/security/tokens");
const {
  UploadService,
  UploadValidationError,
  sniffImageMagicBytes,
  validateAndSanitizeImage,
} = await import("@/lib/services/UploadService");
const { POST: uploadBackgroundPost, GET: uploadBackgroundGet } = await import(
  "@/app/api/uploads/background/route"
);
const { createPreset, deletePreset } = await import(
  "@/app/adm/admin/(panel)/background-presets/actions"
);
const { createGalleryItem, getGalleryItemById } = await import(
  "@/app/actions/gallery"
);
const { POST: benchmarkPost } = await import(
  "@/app/api/admin/calligraphy/benchmark/route"
);
const { BenchmarkRequestSchema } = await import(
  "@/lib/calligraphy/CalligraphyBenchmarkSuite"
);
const { POST: adminGalleryCreatePost } = await import(
  "@/app/api/admin/gallery/create/route"
);
const { buildCspHeader } = await import("@/lib/security/headers");
const { ADMIN_BASE_PATH, ADMIN_SIGN_IN_PATH } = await import("@/lib/admin-path");

test("T-104: safeRedirectPath and auth callback/confirm routes block open redirects", async () => {
  resetHarness();
  resetRateLimitStore();

  assert.equal(safeRedirectPath("/studio/designs?tab=published"), "/studio/designs?tab=published");
  assert.equal(safeRedirectPath("https://evil.com/phish"), "/studio");
  assert.equal(safeRedirectPath("//evil.com/phish"), "/studio");
  assert.equal(safeRedirectPath("/\\evil.com"), "/studio");
  assert.equal(safeRedirectPath("@evil.com"), "/studio");
  assert.equal(safeRedirectPath("http://user:pass@evil.com"), "/studio");
  assert.equal(safeRedirectPath("/valid\r\nSet-Cookie: hacked=1"), "/studio");

  // The admin sign-in pages pass the admin address as the fallback: a hostile `next` lands there.
  for (const maliciousNext of [
    "https://evil.com",
    "//evil.com/steal",
    "@evil.com",
    "/\\evil.com",
  ]) {
    assert.equal(safeRedirectPath(maliciousNext, ADMIN_BASE_PATH), ADMIN_BASE_PATH);
  }
  assert.equal(
    safeRedirectPath(`${ADMIN_BASE_PATH}/orders?status=PAID`, ADMIN_BASE_PATH),
    `${ADMIN_BASE_PATH}/orders?status=PAID`
  );
  assert.equal(safeRedirectPath(undefined, ADMIN_BASE_PATH), ADMIN_BASE_PATH);

  // The Supabase sign-in routes that used to take a redirect target are gone.
  for (const removed of [
    "src/app/api/auth/callback/route.ts",
    "src/app/api/auth/confirm/route.ts",
    "src/app/api/auth/device-check/route.ts",
    "src/app/auth/verify-device/actions.ts",
    "src/app/auth/update-password/page.tsx",
    "src/app/admin-verify/actions.ts",
  ]) {
    assert.equal(
      existsSync(path.join(process.cwd(), removed)),
      false,
      `${removed} must not exist after the sign-in move`
    );
  }
});

test("T-106 & INV-014: magic-byte sniffing, sharp re-encoding, and private upload route reject HTML/SVG disguised as PNG", async () => {
  resetHarness();
  resetRateLimitStore();
  process.env.ANON_SESSION_SECRET = "test-anon-session-secret-minimum-32!!";

  // 1. HTML disguised with .png extension and image/png MIME
  const htmlBytes = Buffer.from(
    "<!DOCTYPE html><html><body><script>alert('xss')</script></body></html>",
    "utf8"
  );
  assert.equal(sniffImageMagicBytes(htmlBytes), null);
  await assert.rejects(
    () => validateAndSanitizeImage(htmlBytes),
    UploadValidationError
  );

  // 2. Polyglot starting with PNG 8-byte header followed by HTML script payload
  const pngMagicWithHtml = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("<html><script>alert(1)</script></html>", "utf8"),
  ]);
  assert.equal(sniffImageMagicBytes(pngMagicWithHtml), "png");
  await assert.rejects(
    () => validateAndSanitizeImage(pngMagicWithHtml),
    UploadValidationError
  );

  // 3. HTTP POST /api/uploads/background rejects HTML-as-PNG upload with 400
  const badForm = new FormData();
  badForm.append(
    "file",
    new File([htmlBytes], "exploit.png", { type: "image/png" })
  );
  const badRes = await uploadBackgroundPost(
    new Request("http://localhost:3000/api/uploads/background", {
      method: "POST",
      body: badForm,
    })
  );
  assert.equal(badRes.status, 400);
  assert.equal(harness.assets.size, 0);

  // 4. Forged tb_anon_session cookie is rejected with 401
  const validPngBuffer = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 20, g: 30, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const forgedForm = new FormData();
  forgedForm.append(
    "file",
    new File([new Uint8Array(validPngBuffer)], "bg.png", { type: "image/png" })
  );
  const forgedRes = await uploadBackgroundPost(
    new Request("http://localhost:3000/api/uploads/background", {
      method: "POST",
      headers: { cookie: `${ANON_SESSION_COOKIE}=forged.jwt.token` },
      body: forgedForm,
    })
  );
  assert.equal(forgedRes.status, 401);

  // 5. Valid signed anonymous session stores Asset as PRIVATE outside public/ and enforces owner access on GET
  const { anonId, token: validAnonToken } = await signAnonSessionToken("anon-buyer-1");
  const goodForm = new FormData();
  goodForm.append(
    "file",
    new File([new Uint8Array(validPngBuffer)], "sneaky-name.html", {
      type: "application/octet-stream",
    })
  );
  const goodRes = await uploadBackgroundPost(
    new Request("http://localhost:3000/api/uploads/background", {
      method: "POST",
      headers: { cookie: `${ANON_SESSION_COOKIE}=${validAnonToken}` },
      body: goodForm,
    })
  );
  assert.equal(goodRes.status, 200);
  const goodJson = (await goodRes.json()) as {
    success: boolean;
    assetId: string;
    mimeType: string;
  };
  assert.equal(goodJson.success, true);
  assert.equal(goodJson.mimeType, "image/png");

  const storedAsset = harness.assets.get(goodJson.assetId);
  assert.ok(storedAsset);
  assert.equal(storedAsset.visibility, "PRIVATE");
  assert.equal(storedAsset.anonymousSessionId, anonId);
  assert.equal(storedAsset.storageProvider, "local-private");
  assert.ok(storedAsset.objectKey.startsWith("local-private://backgrounds/"));
  assert.ok(storedAsset.objectKey.endsWith(".png"));

  // Different anonymous user cannot read private upload (403)
  const { token: otherAnonToken } = await signAnonSessionToken("anon-attacker-2");
  const forbiddenGet = await uploadBackgroundGet(
    new Request(
      `http://localhost:3000/api/uploads/background?assetId=${goodJson.assetId}`,
      { headers: { cookie: `${ANON_SESSION_COOKIE}=${otherAnonToken}` } }
    )
  );
  assert.equal(forbiddenGet.status, 403);

  // Rightful anonymous owner can read their sanitized private upload (200)
  const ownerGet = await uploadBackgroundGet(
    new Request(
      `http://localhost:3000/api/uploads/background?assetId=${goodJson.assetId}`,
      { headers: { cookie: `${ANON_SESSION_COOKIE}=${validAnonToken}` } }
    )
  );
  assert.equal(ownerGet.status, 200);
  assert.equal(ownerGet.headers.get("x-content-type-options"), "nosniff");

  // Clean up test file written to .local-private-uploads
  await fs
    .rm(path.join(process.cwd(), ".local-private-uploads"), {
      recursive: true,
      force: true,
    })
    .catch(() => undefined);

  // 6. Production mode fails closed without Blob token (never falls back to public/ or disk)
  const prevNodeEnv = process.env.NODE_ENV;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  try {
    const prodRes = await UploadService.uploadBackgroundImage(
      validPngBuffer,
      "prod.png"
    );
    assert.equal(prodRes.success, false);
    assert.equal(prodRes.url, null);
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
  }
});

test("T-100 & T-101: unauthenticated and non-admin callers are rejected on admin actions & routes, and benchmark samplesPerCase is capped at 10", async () => {
  resetHarness();
  resetRateLimitStore();
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-32-chars!!";

  // 1. Unauthenticated createPreset & deletePreset reject with redirect to the admin sign-in
  await assert.rejects(
    () =>
      createPreset({
        key: "zen-mist",
        name: "Zen Mist",
        category: "Style",
        description: "Test",
        promptTemplate: "misty ink",
        defaultMood: "calm",
        defaultPalette: "monochrome",
        defaultIntensity: "subtle",
        enabled: true,
        sortOrder: 0,
      }),
    (err: unknown) =>
      err instanceof RedirectSignal && err.destination === ADMIN_SIGN_IN_PATH
  );
  assert.equal(harness.presetCreatedCount, 0);

  await assert.rejects(
    () => deletePreset("preset-1"),
    (err: unknown) =>
      err instanceof RedirectSignal && err.destination === ADMIN_SIGN_IN_PATH
  );

  // 2. Unauthenticated createGalleryItem rejects before touching DB
  const form = new FormData();
  form.set("designId", "d-1");
  form.set("catalogProductId", "p-1");
  const resPromise = createGalleryItem(form);
  await assert.rejects(
    () => resPromise,
    (err: unknown) =>
      err instanceof RedirectSignal && err.destination === ADMIN_SIGN_IN_PATH
  );
  assert.equal(harness.galleryCreatedCount, 0);

  // 3. Unauthenticated benchmark POST returns 401
  const unauthBench = await benchmarkPost(
    new Request("http://localhost:3000/api/admin/calligraphy/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samplesPerCase: 3 }),
    })
  );
  assert.equal(unauthBench.status, 401);

  // 4. Legacy forged cookie + hardcoded email WITHOUT DB ADMIN role is rejected with 403
  harness.cookies.set("admin_master_pwd_verified", {
    name: "admin_master_pwd_verified",
    value: "true",
  });
  harness.supabaseUser = { id: "u-nonadmin", email: "waynele2k11@gmail.com" };
  harness.usersById.set("u-nonadmin", {
    id: "u-nonadmin",
    email: "waynele2k11@gmail.com",
    status: "ACTIVE",
    roles: [{ role: { code: "CREATOR" } }],
  });

  const forbiddenGalleryCreate = await adminGalleryCreatePost(
    new Request("http://localhost:3000/api/admin/gallery/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        svgBase64: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        product: "Tee",
        text: "An",
      }),
    })
  );
  assert.equal(forbiddenGalleryCreate.status, 403);

  // 5. Unpublished gallery items are hidden from non-admin getGalleryItemById
  harness.galleryItems.set("draft-1", {
    id: "draft-1",
    title: "Secret Draft",
    published: false,
    listedPriceMinor: 4500n,
  });
  assert.equal(await getGalleryItemById("draft-1"), null);

  // 6. Authenticated ADMIN (ACTIVE user with the DB ADMIN role):
  //    - the legacy forgeable cookie is never what grants access
  //    - benchmark route rejects samplesPerCase > 10 with 400
  harness.supabaseUser = { id: "u-admin", email: "admin@thibut.com" };
  harness.usersById.set("u-admin", {
    id: "u-admin",
    email: "admin@thibut.com",
    status: "ACTIVE",
    roles: [{ role: { code: "ADMIN" } }],
  });
  harness.cookies.delete("admin_master_pwd_verified");

  // Benchmark schema strictly caps samplesPerCase at 1..10 (default 3)
  assert.equal(BenchmarkRequestSchema.parse({}).samplesPerCase, 3);
  assert.equal(
    BenchmarkRequestSchema.safeParse({ samplesPerCase: 11 }).success,
    false
  );
  assert.equal(
    BenchmarkRequestSchema.safeParse({ samplesPerCase: 0 }).success,
    false
  );

  // Signed in as the admin: the route is reached and rejects samplesPerCase > 10 with 400
  const cappedBenchRes = await benchmarkPost(
    new Request("http://localhost:3000/api/admin/calligraphy/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samplesPerCase: 50 }),
    })
  );
  assert.equal(cappedBenchRes.status, 400);

  // Admin CAN read unpublished gallery item via getGalleryItemById
  const adminDraftView = await getGalleryItemById("draft-1");
  assert.equal(adminDraftView?.id, "draft-1");
});

test("T-103 & T-108: device trust tokens are signed and bound to one user, an inactive admin is refused, and the CSP header embeds the nonce", async () => {
  resetHarness();
  resetRateLimitStore();
  process.env.DEVICE_TRUST_SECRET = "test-device-trust-secret-32-chars!!!";
  process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-32-chars!!";

  // Forged legacy string "verified" is rejected
  assert.equal(await verifyDeviceTrustToken("verified", "u-creator-1"), null);
  // A signed token verifies for u-creator-1, but fails for any other user ID
  const deviceToken = await signDeviceTrustToken({
    userId: "u-creator-1",
    deviceId: "device-1",
  });
  const verifiedClaims = await verifyDeviceTrustToken(deviceToken, "u-creator-1");
  assert.equal(verifiedClaims?.userId, "u-creator-1");
  assert.equal(verifiedClaims?.deviceId, "device-1");
  assert.equal(await verifyDeviceTrustToken(deviceToken, "u-other-user"), null);

  // An admin whose user row is no longer ACTIVE is treated as signed out (401), at once
  harness.supabaseUser = { id: "u-admin-off", email: "former-admin@thibut.com" };
  harness.usersById.set("u-admin-off", {
    id: "u-admin-off",
    email: "former-admin@thibut.com",
    status: "SUSPENDED",
    roles: [{ role: { code: "ADMIN" } }],
  });
  const suspendedRes = await benchmarkPost(
    new Request("http://localhost:3000/api/admin/calligraphy/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samplesPerCase: 3 }),
    })
  );
  assert.equal(suspendedRes.status, 401);

  // Verify CSP header directives
  const csp = buildCspHeader("testNonceBase64==", false);
  assert.ok(csp.includes("'nonce-testNonceBase64=='"));
  assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"));
  assert.ok(csp.includes("https://files.cdn.printful.com"));
  assert.equal(csp.includes("supabase"), false, "the CSP must no longer allow Supabase hosts");
  assert.ok(csp.includes("https://api.stripe.com"));
  assert.ok(csp.includes("frame-ancestors 'self'"));
});
