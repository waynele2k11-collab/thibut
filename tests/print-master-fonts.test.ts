import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import zlib from "node:zlib";
import { PNG } from "pngjs";
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

interface MockAssetRecord {
  id: string;
  objectKey: string;
  mimeType: string;
  sha256: string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  storageProvider: string;
  ownerId?: string | null;
  anonymousSessionId?: string | null;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
}

interface MockPvRecord {
  id: string;
  styleSnapshot: unknown;
  printAssetId: string | null;
}

interface MockOrderRecord {
  id: string;
  orderNumber: string;
  buyerId: string | null;
  anonymousSessionId: string | null;
  status: string;
  paymentStatus: string;
}

interface MockOrderItemRecord {
  id: string;
  orderId: string;
  designVersionId: string;
  personalizationVersionId: string | null;
}

interface PrintTestHarnessState {
  cookies: Map<string, string>;
  assets: Map<string, MockAssetRecord>;
  presets: Map<
    string,
    {
      id: string;
      key: string;
      name: string;
      promptTemplate: string;
      defaultMood: string | null;
      defaultPalette: string | null;
      defaultIntensity: string | null;
      enabled: boolean;
    }
  >;
  generatedBackgrounds: Array<Record<string, unknown>>;
  personalizationVersions: Map<string, MockPvRecord>;
  orders: Map<string, MockOrderRecord>;
  orderItems: Map<string, MockOrderItemRecord>;
  designVersionAssets: Array<{
    designVersionId: string;
    assetId: string;
    type: string;
  }>;
  falReturnUrl: string;
}

const harnessState: PrintTestHarnessState = {
  cookies: new Map(),
  assets: new Map(),
  presets: new Map(),
  generatedBackgrounds: [],
  personalizationVersions: new Map(),
  orders: new Map(),
  orderItems: new Map(),
  designVersionAssets: [],
  falReturnUrl: "https://v3.fal.media/files/test-ai-wash.jpg",
};

function resetHarnessState(): void {
  harnessState.cookies.clear();
  harnessState.assets.clear();
  harnessState.presets.clear();
  harnessState.generatedBackgrounds = [];
  harnessState.personalizationVersions.clear();
  harnessState.orders.clear();
  harnessState.orderItems.clear();
  harnessState.designVersionAssets = [];
  harnessState.falReturnUrl = "https://v3.fal.media/files/test-ai-wash.jpg";
}

declare global {
  var __tbPrintTestHooks: {
    cookies: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (name: string, value: string) => void;
      delete: (name: string) => void;
    }>;
    createSupabaseClient: () => Promise<{
      auth: {
        getUser: () => Promise<{
          data: { user: null };
          error: Error;
        }>;
      };
    }>;
    falSubscribe: () => Promise<{ images: Array<{ url: string }> }>;
    prisma: Record<string, unknown>;
  };
}

globalThis.__tbPrintTestHooks = {
  async cookies() {
    return {
      get(name: string) {
        const val = harnessState.cookies.get(name);
        return val !== undefined ? { name, value: val } : undefined;
      },
      set(name: string, value: string) {
        harnessState.cookies.set(name, value);
      },
      delete(name: string) {
        harnessState.cookies.delete(name);
      },
    };
  },
  async createSupabaseClient() {
    return {
      auth: {
        async getUser() {
          return { data: { user: null }, error: new Error("Unauthenticated") };
        },
      },
    };
  },
  async falSubscribe() {
    return {
      images: [{ url: harnessState.falReturnUrl }],
    };
  },
  prisma: {
    font: {
      async findMany() {
        return [];
      },
      async update() {
        return {};
      },
      async upsert() {
        return {};
      },
    },
    user: {
      async findUnique() {
        return null;
      },
    },
    backgroundPreset: {
      async findUnique(args: { where: { key: string } }) {
        return harnessState.presets.get(args.where.key) ?? null;
      },
    },
    asset: {
      async create(args: { data: Omit<MockAssetRecord, "id"> }) {
        const id = crypto.randomUUID();
        const created: MockAssetRecord = { id, ...args.data };
        harnessState.assets.set(id, created);
        return created;
      },
      async findUnique(args: { where: { id: string } }) {
        return harnessState.assets.get(args.where.id) ?? null;
      },
    },
    generatedBackground: {
      async create(args: { data: Record<string, unknown> }) {
        const id = crypto.randomUUID();
        const row = { id, ...args.data };
        harnessState.generatedBackgrounds.push(row);
        return row;
      },
    },
    designVersionAsset: {
      async create(args: {
        data: { designVersionId: string; assetId: string; type: string };
      }) {
        harnessState.designVersionAssets.push(args.data);
        return { id: crypto.randomUUID(), ...args.data };
      },
    },
    personalizationVersion: {
      async update(args: {
        where: { id: string };
        data: { printAssetId: string };
      }) {
        const existing = harnessState.personalizationVersions.get(args.where.id);
        if (!existing) {
          throw new Error(`PersonalizationVersion ${args.where.id} not found`);
        }
        existing.printAssetId = args.data.printAssetId;
        return existing;
      },
    },
    orderItem: {
      async findUnique(args: { where: { id: string } }) {
        const item = harnessState.orderItems.get(args.where.id);
        if (!item) return null;
        const order = harnessState.orders.get(item.orderId) ?? null;
        const pv = item.personalizationVersionId
          ? (harnessState.personalizationVersions.get(
              item.personalizationVersionId
            ) ?? null)
          : null;
        const printAsset =
          pv?.printAssetId
            ? (harnessState.assets.get(pv.printAssetId) ?? null)
            : null;
        return {
          ...item,
          order,
          personalizationVersion: pv ? { ...pv, printAsset } : null,
        };
      },
    },
  },
};

const hooksApi = nodeModule as unknown as Partial<ModuleHooksApi>;
if (typeof hooksApi.registerHooks === "function") {
  hooksApi.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
      }
      if (specifier === "next/navigation") {
        return nextResolve("next/navigation.js", context);
      }
      if (specifier === "next/headers") {
        return {
          url: "data:text/javascript,export const cookies = (...args) => globalThis.__tbPrintTestHooks.cookies(...args);",
          format: "module",
          shortCircuit: true,
        };
      }
      if (isAuthSeamSpecifier(specifier)) {
        return {
          url: authSeamStubUrl("__tbPrintTestHooks"),
          format: "module",
          shortCircuit: true,
        };
      }
      if (specifier === "@fal-ai/client") {
        return {
          url: "data:text/javascript,export const fal = { subscribe: (...args) => globalThis.__tbPrintTestHooks.falSubscribe(...args) };",
          format: "module",
          shortCircuit: true,
        };
      }
      if (specifier === "@/lib/prisma" || specifier.endsWith("/lib/prisma")) {
        return {
          url: "data:text/javascript,export default globalThis.__tbPrintTestHooks.prisma; export const prisma = globalThis.__tbPrintTestHooks.prisma;",
          format: "module",
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}

const {
  CompositionSchema,
  PRINT_MASTER_DPI,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_PIXELS_PER_METER,
  PRINT_MASTER_WIDTH,
} = await import("@/lib/print/types");
const {
  DEFAULT_SEAL_FONT_FAMILY,
  FontLicenseError,
  FontRegistryService,
  isFontLicensedForPrint,
  isUnverifiedLegacyArchiveFile,
} = await import("@/lib/fonts/FontRegistryService");
const {
  GlyphCoverageError,
  PrintMasterHttpError,
  authorizeAndParsePrintMasterRequest,
  generatePrintMasterPng,
  getPrintMasterRenderCount,
  renderAndStorePrintMaster,
  resetPrintMasterRenderCountForTests,
} = await import("@/lib/print-generator");
const { generateInstantSvgString } = await import(
  "@/lib/calligraphy/ClientCalligraphyRenderer"
);
const {
  ANON_SESSION_COOKIE,
  computeHmacSha256Hex,
  signDownloadToken,
} = await import("@/lib/security/tokens");
const { resetRateLimitStore } = await import("@/lib/security/rate-limit");
const nextConfigModule = await import("../next.config");
const { GET: fontByIdGet } = await import("@/app/api/fonts/[id]/route");
const { POST: backgroundGeneratePost } = await import(
  "@/app/api/backgrounds/generate/route"
);
const { GET: uploadBackgroundGet } = await import(
  "@/app/api/uploads/background/route"
);
const printMasterRouteMod = await import("@/app/api/print-master/route");
const downloadRouteMod = await import("@/app/api/download/route");

interface ParsedPhysChunk {
  ppuX: number;
  ppuY: number;
  unit: number;
  crcValid: boolean;
}

function findPngPhysChunk(png: Buffer): ParsedPhysChunk | null {
  let offset = 8; // skip 8-byte PNG signature
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const storedCrc = png.readUInt32BE(dataEnd);

    if (type === "pHYs") {
      assert.equal(length, 9, "pHYs chunk data length must be 9 bytes");
      const ppuX = png.readUInt32BE(dataStart);
      const ppuY = png.readUInt32BE(dataStart + 4);
      const unit = png.readUInt8(dataStart + 8);
      const computedCrc = zlib.crc32(png.subarray(offset + 4, dataEnd)) >>> 0;
      return {
        ppuX,
        ppuY,
        unit,
        crcValid: storedCrc === computedCrc,
      };
    }

    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  return null;
}

function removeLocalPrivateFileIfCreated(objectKey: string | undefined): void {
  if (!objectKey || !objectKey.startsWith("local-private://")) return;
  const rel = objectKey.slice("local-private://".length);
  const abs = path.resolve(process.cwd(), ".local-private-uploads", rel);
  const root = path.resolve(process.cwd(), ".local-private-uploads");
  if (abs.startsWith(root + path.sep) && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }
}

test("T-301 / INV-013: generatePrintMasterPng renders 4500x5400 RGBA transparent PNG @ 300 DPI (pHYs=11811)", async () => {
  const savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const fixture = CompositionSchema.parse({
      placement: "front",
      color: "#121212",
      layers: [
        {
          id: "layer-calligraphy-1",
          type: "calligraphy",
          text: "Có Chí Thì Nên",
          fontFamily: "UTM ThuPhap Thien An",
          layout: "VERTICAL",
          colorHex: "#121212",
          zIndex: 10,
          opacity: 1,
          transform: {
            x: 0.5,
            y: 0.46,
            scale: 1,
            rotation: 0,
          },
        },
        {
          id: "layer-seal-1",
          type: "seal",
          sealText: "印",
          fontFamily: DEFAULT_SEAL_FONT_FAMILY,
          colorHex: "#B71032",
          zIndex: 20,
          opacity: 0.95,
          transform: {
            x: 0.66,
            y: 0.84,
            scale: 1,
            rotation: 0,
          },
        },
      ],
    });

    const artifact = await renderAndStorePrintMaster(fixture, {
      persistAsset: false,
    });

    assert.equal(artifact.width, PRINT_MASTER_WIDTH);
    assert.equal(artifact.height, PRINT_MASTER_HEIGHT);
    assert.equal(artifact.dpi, PRINT_MASTER_DPI);
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);

    const pngBuffer = artifact.buffer;

    // 1. Verify raw IHDR dimensions & RGBA colorType === 6
    const ihdrWidth = pngBuffer.readUInt32BE(16);
    const ihdrHeight = pngBuffer.readUInt32BE(20);
    const bitDepth = pngBuffer[24];
    const colorType = pngBuffer[25];

    assert.equal(ihdrWidth, 4500);
    assert.equal(ihdrHeight, 5400);
    assert.equal(bitDepth, 8);
    assert.equal(
      colorType,
      6,
      "PNG must be colorType 6 (RGBA with alpha channel)"
    );

    // 2. Verify pHYs chunk (11811 px/m X & Y, unit = 1 meter -> 300 DPI) + CRC32
    const phys = findPngPhysChunk(pngBuffer);
    assert.ok(phys, "PNG must embed a pHYs physical pixel dimensions chunk");
    assert.equal(phys.ppuX, PRINT_MASTER_PIXELS_PER_METER);
    assert.equal(phys.ppuY, PRINT_MASTER_PIXELS_PER_METER);
    assert.equal(phys.ppuX, 11811);
    assert.equal(phys.ppuY, 11811);
    assert.equal(phys.unit, 1);
    assert.equal(phys.crcValid, true, "pHYs chunk CRC32 checksum must be valid");

    // 3. Decode full RGBA raster with pngjs and verify corner transparency + rendered ink pixels
    const decoded: PNG = PNG.sync.read(pngBuffer);
    const decodedWidth: number = decoded.width;
    const decodedHeight: number = decoded.height;
    assert.equal(decodedWidth, 4500);
    assert.equal(decodedHeight, 5400);

    const cornerCoords: Array<[number, number]> = [
      [0, 0],
      [4499, 0],
      [0, 5399],
      [4499, 5399],
    ];
    for (const [cx, cy] of cornerCoords) {
      const idx: number = (cy * decodedWidth + cx) * 4;
      const alpha: number = decoded.data[idx + 3] ?? 255;
      assert.equal(
        alpha,
        0,
        `Expected corner pixel (${cx}, ${cy}) alpha === 0 (transparent), got ${alpha}`
      );
    }

    let nonTransparentPixels = 0;
    for (let i = 3; i < decoded.data.length; i += 4) {
      if (decoded.data[i] > 0) {
        nonTransparentPixels++;
      }
    }
    assert.ok(
      nonTransparentPixels > 1000,
      `Expected > 1000 rendered ink pixels, got ${nonTransparentPixels}`
    );

    // 4. Stored print master: with a database, the render is saved as a 4500x5400 Asset, linked
    //    to its design version as PRINT_MASTER and set on the PersonalizationVersion. (This check
    //    lived in the order-fulfilment test while print masters were rendered for an outside
    //    print provider. The renderer is unchanged. `renderAndStorePrintMaster` has no caller
    //    left in src/: it is kept for calligraphy. `api/print-master` and the digital download
    //    service call `generatePrintMasterPng`, which this function wraps.)
    resetHarnessState();
    process.env.DATABASE_URL = "postgresql://mock-unit-test";
    harnessState.personalizationVersions.set("pver-stored-master", {
      id: "pver-stored-master",
      printAssetId: null,
      styleSnapshot: null,
    });

    const stored = await renderAndStorePrintMaster(fixture, {
      ownerId: null,
      designVersionId: "dv-stored-master",
      personalizationVersionId: "pver-stored-master",
      persistAsset: true,
    });

    assert.equal(stored.width, PRINT_MASTER_WIDTH);
    assert.equal(stored.height, PRINT_MASTER_HEIGHT);
    assert.ok(stored.assetId, "a stored print master returns its Asset id");
    assert.ok(stored.objectKey);

    const storedAsset = harnessState.assets.get(stored.assetId ?? "");
    assert.ok(storedAsset, "the Asset row was created");
    assert.equal(storedAsset.width, 4500);
    assert.equal(storedAsset.height, 5400);
    assert.equal(storedAsset.mimeType, "image/png");
    assert.equal(storedAsset.visibility, "PRIVATE");
    assert.equal(storedAsset.sha256, stored.sha256);

    assert.equal(
      harnessState.personalizationVersions.get("pver-stored-master")?.printAssetId,
      stored.assetId
    );
    assert.deepEqual(harnessState.designVersionAssets, [
      {
        designVersionId: "dv-stored-master",
        assetId: stored.assetId,
        type: "PRINT_MASTER",
      },
    ]);
  } finally {
    if (savedDbUrl !== undefined) {
      process.env.DATABASE_URL = savedDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  }
});

test("T-406 & T-407 / TB-CALLI-008: Font licensing gate blocks Kokuryu & unverified VNI/HL/HY/Fz fonts before touching disk while allowing verified OFL fonts", async () => {
  const savedDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  FontRegistryService.resetMemoryStateForTests();

  try {
    assert.equal(DEFAULT_SEAL_FONT_FAMILY, "Ma Shan Zheng");

    // 1. Default seal font "Ma Shan Zheng" (OFL-1.1) covers "印"
    assert.equal(
      await FontRegistryService.hasGlyphCoverage("Ma Shan Zheng", "印"),
      true
    );
    assert.equal(
      await FontRegistryService.hasGlyphCoverage(
        "UTM ThuPhap Thien An",
        "Có Chí Thì Nên"
      ),
      true
    );
    assert.equal(
      await FontRegistryService.hasGlyphCoverage("Great Vibes", "印"),
      false
    );

    if (
      fs.existsSync(
        path.join(process.cwd(), ".quarantined-fonts", "VNI-Ong_do.ttf")
      )
    ) {
      assert.equal(
        await FontRegistryService.hasGlyphCoverage("VNI Ong do", "印", {
          allowUnlicensedInspection: true,
        }),
        false
      );
    }

    // 2. Rejects Kokuryu (Adobe web-only license: printExportAllowed === false)
    await assert.rejects(
      () => FontRegistryService.toggleActive("kokuryu", true),
      FontLicenseError
    );
    await assert.rejects(
      () => FontRegistryService.resolveFontBuffer("kokuryu"),
      FontLicenseError
    );

    // 3. Rejects unverified VNI / HL / HY / Fz archive fonts from activation & print rendering BEFORE touching disk
    for (const badArchive of [
      "vni-ong-do",
      "VNI-Thu_fap2.ttf",
      "HL-OngDo-Unicode.ttf",
      "HY-Thu_Phap_1.otf",
      "Fz_DucThuyThuPhap.ttf",
    ]) {
      await assert.rejects(
        () => FontRegistryService.toggleActive(badArchive, true),
        FontLicenseError
      );
      await assert.rejects(
        () => FontRegistryService.resolveFontBuffer(badArchive),
        FontLicenseError
      );
    }

    await assert.rejects(
      () =>
        generatePrintMasterPng({
          version: 1,
          placement: "front",
          color: "#121212",
          transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
          layers: [
            {
              id: "bad-vni",
              type: "calligraphy",
              text: "Thi Bút",
              fontFamily: "VNI Ong do",
              layout: "HORIZONTAL",
              colorHex: "#121212",
              zIndex: 10,
              opacity: 1,
              transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
            },
          ],
        }),
      FontLicenseError
    );

    // 4. Rejects missing glyph coverage instead of rendering .notdef tofu (TB-CALLI-003 / TB-CALLI-006)
    await assert.rejects(
      () =>
        generatePrintMasterPng({
          version: 1,
          placement: "front",
          color: "#121212",
          transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
          layers: [
            {
              id: "tofu-attempt",
              type: "calligraphy",
              text: "印",
              fontFamily: "Great Vibes",
              layout: "HORIZONTAL",
              colorHex: "#121212",
              zIndex: 10,
              opacity: 1,
              transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
            },
          ],
        }),
      GlyphCoverageError
    );

    // 5. Allows verified OFL fonts and excludes unlicensed fonts from active frontend list
    const enabledRes = await FontRegistryService.toggleActive(
      "ma-shan-zheng",
      true
    );
    assert.deepEqual(enabledRes, { id: "ma-shan-zheng", enabled: true });

    const activeFonts = await FontRegistryService.getActiveFrontendFonts();
    assert.ok(activeFonts.length > 0);
    for (const f of activeFonts) {
      assert.equal(isFontLicensedForPrint(f), true);
      assert.equal(f.webEmbedAllowed, true);
      assert.notEqual(f.id, "kokuryu");
      assert.notEqual(f.id, "vni-ong-do");
    }

    const preloaded = await FontRegistryService.preloadActiveFonts();
    assert.ok(preloaded.loaded.includes("ma-shan-zheng"));
  } finally {
    FontRegistryService.resetMemoryStateForTests();
    if (savedDbUrl !== undefined) {
      process.env.DATABASE_URL = savedDbUrl;
    }
  }
});

test("T-100: /api/print-master auth & schema gate enforces HMAC signature or Admin auth and Zod CompositionSchema validation", async () => {
  process.env.FULFILLMENT_SECRET_KEY =
    "test-fulfillment-hmac-secret-key-minimum-32chars!";

  const badBody = JSON.stringify({ layers: [] });

  // 1. Forged HMAC signature rejected with 401
  await assert.rejects(
    async () => {
      await authorizeAndParsePrintMasterRequest({
        rawBody: badBody,
        signatureHeader: "0".repeat(64),
        assertAdminFn: async () => {
          throw new Error(
            "Should not fall through to admin check on forged HMAC"
          );
        },
      });
    },
    (err: unknown) =>
      err instanceof PrintMasterHttpError && err.status === 401
  );

  // 2. Missing HMAC delegates strictly to assertAdminFn
  let adminCalled = false;
  await assert.rejects(
    async () => {
      await authorizeAndParsePrintMasterRequest({
        rawBody: badBody,
        signatureHeader: null,
        assertAdminFn: async () => {
          adminCalled = true;
          throw new PrintMasterHttpError(403, "Admin role required");
        },
      });
    },
    (err: unknown) =>
      err instanceof PrintMasterHttpError && err.status === 403
  );
  assert.equal(adminCalled, true);

  // 3. Valid HMAC signature, invalid CompositionSchema (empty layers) -> 400
  const validSig = computeHmacSha256Hex(
    badBody,
    process.env.FULFILLMENT_SECRET_KEY
  );
  await assert.rejects(
    async () => {
      await authorizeAndParsePrintMasterRequest({
        rawBody: badBody,
        signatureHeader: `sha256=${validSig}`,
        assertAdminFn: async () => {
          throw new Error(
            "Should not call admin check when valid HMAC provided"
          );
        },
      });
    },
    (err: unknown) =>
      err instanceof PrintMasterHttpError && err.status === 400
  );

  // 4. Valid HMAC signature + valid wrapped CompositionSchema -> parsed composition
  const goodBody = JSON.stringify({
    composition: {
      placement: "front",
      layers: [
        {
          id: "seal-only",
          type: "seal",
          sealText: "印",
          fontFamily: "Ma Shan Zheng",
          transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
        },
      ],
    },
  });
  const goodSig = computeHmacSha256Hex(
    goodBody,
    process.env.FULFILLMENT_SECRET_KEY
  );
  const parsed = await authorizeAndParsePrintMasterRequest({
    rawBody: goodBody,
    signatureHeader: goodSig,
    assertAdminFn: async () => {
      throw new Error("Should not call admin check");
    },
  });
  assert.equal(parsed.layers.length, 1);
  assert.equal(parsed.layers[0]?.type, "seal");
});

test("R-107: public/fonts is removed, assets/fonts holds only licensed fonts, next.config.ts narrows file tracing, and GET /api/fonts/[id] enforces webEmbedAllowed + enabled", async () => {
  FontRegistryService.resetMemoryStateForTests();

  try {
    // 1. public/fonts directory no longer exists (GET /fonts/HL-OngDo-Unicode.ttf is guaranteed 404)
    const publicFontsDir = path.join(process.cwd(), "public", "fonts");
    assert.equal(
      fs.existsSync(publicFontsDir),
      false,
      "public/fonts must not exist on disk"
    );

    // 2. assets/fonts contains verified fonts and zero unverified legacy archive files
    const assetsFontsDir = path.join(process.cwd(), "assets", "fonts");
    assert.equal(fs.existsSync(assetsFontsDir), true);
    const assetFiles = fs.readdirSync(assetsFontsDir);
    assert.ok(assetFiles.includes("UtmThuphapThienAn.ttf"));
    assert.ok(assetFiles.includes("MaShanZheng-Regular.ttf"));
    assert.ok(assetFiles.includes("ZhiMangXing-Regular.ttf"));
    assert.ok(assetFiles.includes("YujiBoku-Regular.ttf"));
    assert.ok(assetFiles.includes("NanumBrushScript-Regular.ttf"));
    for (const fileName of assetFiles) {
      assert.equal(
        isUnverifiedLegacyArchiveFile(fileName),
        false,
        `Unverified archive file "${fileName}" must not reside in assets/fonts`
      );
    }

    // 3. next.config.ts outputFileTracingIncludes traces ./assets/fonts/**/* ONLY into the 3 render
    //    routes and the admin keepsake editor (docs/KEEPSAKE_EDITOR_PLAN.md)
    const cfg = nextConfigModule.default;
    assert.deepEqual(cfg.outputFileTracingIncludes, {
      "/api/print-master": ["./assets/fonts/**/*"],
      "/api/download": ["./assets/fonts/**/*"],
      "/api/inngest": ["./assets/fonts/**/*"],
      "/adm/admin/keepsake-editor": ["./assets/fonts/**/*"],
      "/adm/admin/keepsake-editor/fonts/*": ["./assets/fonts/**/*"],
    });

    // 4. ClientCalligraphyRenderer sealFontUrl uses /api/fonts/* and never /fonts/*.ttf
    for (const [sealFontFamily, expectedUrl] of [
      ["Ma Shan Zheng", "/api/fonts/ma-shan-zheng"],
      ["UTM Thư Pháp Thiên Ân", "/api/fonts/utm-thuphap-thien-an"],
      ["Zhi Mang Xing", "/api/fonts/zhi-mang-xing"],
    ] as const) {
      const svg = generateInstantSvgString({
        text: "Thi Bút",
        hasSeal: true,
        sealFontFamily,
      });
      assert.equal(svg.includes(expectedUrl), true);
      assert.equal(/['"]\/fonts\//.test(svg), false);
    }

    // 5. GET /api/fonts/[id] serves ma-shan-zheng (200) with immutable cache header
    const allowedRes = await fontByIdGet(
      new Request("https://thibut.com/api/fonts/ma-shan-zheng"),
      { params: Promise.resolve({ id: "ma-shan-zheng" }) }
    );
    assert.equal(allowedRes.status, 200);
    assert.equal(allowedRes.headers.get("content-type"), "font/ttf");
    assert.equal(
      allowedRes.headers.get("cache-control"),
      "public, max-age=31536000, immutable"
    );
    const fontBytes = Buffer.from(await allowedRes.arrayBuffer());
    assert.ok(fontBytes.byteLength > 100_000);

    // 6. Rejects unapproved/web-only/legacy fonts with 403 and unknown fonts with 404
    for (const forbiddenId of [
      "kokuryu",
      "vni-ong-do",
      "HL-OngDo-Unicode.ttf",
      "Fz_DucThuyThuPhap.ttf",
    ]) {
      const res = await fontByIdGet(
        new Request(`https://thibut.com/api/fonts/${forbiddenId}`),
        { params: Promise.resolve({ id: forbiddenId }) }
      );
      assert.equal(
        res.status,
        403,
        `Expected 403 for unlicensed font "${forbiddenId}", got ${res.status}`
      );
    }

    const unknownRes = await fontByIdGet(
      new Request("https://thibut.com/api/fonts/nonexistent-brush-font"),
      { params: Promise.resolve({ id: "nonexistent-brush-font" }) }
    );
    assert.equal(unknownRes.status, 404);

    // Disabling an approved font makes GET /api/fonts/[id] return 403
    await FontRegistryService.toggleActive("ma-shan-zheng", false);
    const disabledRes = await fontByIdGet(
      new Request("https://thibut.com/api/fonts/ma-shan-zheng"),
      { params: Promise.resolve({ id: "ma-shan-zheng" }) }
    );
    assert.equal(disabledRes.status, 403);
  } finally {
    FontRegistryService.resetMemoryStateForTests();
  }
});

test("R-106: /api/backgrounds/generate persists AI backgrounds privately via UploadService (non-fal objectKey + real content sha256) and renders offline in generatePrintMasterPng", async () => {
  resetHarnessState();
  resetRateLimitStore();

  process.env.ANON_SESSION_SECRET =
    "r106-test-anon-session-secret-min-32chars!!";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  const originalFetch = globalThis.fetch;
  let createdObjectKey: string | undefined;

  try {
    harnessState.presets.set("sumi-mist", {
      id: "preset-sumi",
      key: "sumi-mist",
      name: "Sumi Mist",
      promptTemplate:
        "Japanese washi mist. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. {{userNote}}",
      defaultMood: "Serene",
      defaultPalette: "Ivory / Ink",
      defaultIntensity: "Subtle",
      enabled: true,
    });

    const upstreamJpeg = await sharp({
      create: {
        width: 640,
        height: 800,
        channels: 3,
        background: { r: 232, g: 226, b: 214 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    let fetchedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const targetUrl = typeof input === "string" ? input : input.toString();
      fetchedUrls.push(targetUrl);
      const copy = new Uint8Array(upstreamJpeg.byteLength);
      copy.set(upstreamJpeg);
      return new Response(copy.buffer, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(copy.byteLength),
        },
      });
    }) as typeof fetch;

    const genRes = await backgroundGeneratePost(
      new Request("https://thibut.com/api/backgrounds/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vercel-forwarded-for": "198.51.100.42",
        },
        body: JSON.stringify({
          presetKey: "sumi-mist",
          mood: "Serene",
          palette: "Ivory / Ink",
          intensity: "Subtle",
        }),
      })
    );

    assert.equal(genRes.status, 200);
    assert.deepEqual(fetchedUrls, ["https://v3.fal.media/files/test-ai-wash.jpg"]);

    const setCookie = genRes.headers.get("set-cookie") ?? "";
    const anonCookieMatch = setCookie.match(
      new RegExp(`${ANON_SESSION_COOKIE}=([^;]+)`)
    );
    assert.ok(anonCookieMatch, "Expected anonymous session cookie to be issued");
    const ownerCookieHeader = `${ANON_SESSION_COOKIE}=${anonCookieMatch[1]}`;

    const genJson = (await genRes.json()) as {
      success: boolean;
      url: string;
      assetId: string;
    };
    assert.equal(genJson.success, true);
    assert.equal(
      genJson.url,
      `/api/uploads/background?assetId=${encodeURIComponent(genJson.assetId)}`
    );

    const storedAsset = harnessState.assets.get(genJson.assetId);
    assert.ok(storedAsset, "Expected Asset record to be persisted");
    createdObjectKey = storedAsset.objectKey;

    assert.equal(storedAsset.objectKey.includes("fal.media"), false);
    assert.equal(
      storedAsset.objectKey.startsWith("local-private://ai-backgrounds/"),
      true
    );
    assert.equal(storedAsset.storageProvider, "local-private");
    assert.equal(storedAsset.visibility, "PRIVATE");

    // Verify sha256 is the genuine content digest of the sanitized stored bytes (NOT sha256(url))
    const urlHash = crypto
      .createHash("sha256")
      .update("https://v3.fal.media/files/test-ai-wash.jpg", "utf8")
      .digest("hex");
    assert.notEqual(storedAsset.sha256, urlHash);

    const diskPath = path.resolve(
      process.cwd(),
      ".local-private-uploads",
      storedAsset.objectKey.slice("local-private://".length)
    );
    const diskBytes = fs.readFileSync(diskPath);
    const actualContentHash = crypto
      .createHash("sha256")
      .update(diskBytes)
      .digest("hex");
    assert.equal(storedAsset.sha256, actualContentHash);

    // Owner can retrieve via GET /api/uploads/background; unauthenticated caller gets 403
    const proxyOk = await uploadBackgroundGet(
      new Request(
        `https://thibut.com/api/uploads/background?assetId=${encodeURIComponent(storedAsset.id)}`,
        { headers: { cookie: ownerCookieHeader } }
      )
    );
    assert.equal(proxyOk.status, 200);

    const proxyForbidden = await uploadBackgroundGet(
      new Request(
        `https://thibut.com/api/uploads/background?assetId=${encodeURIComponent(storedAsset.id)}`
      )
    );
    assert.equal(proxyForbidden.status, 403);

    // Disable network completely and prove generatePrintMasterPng composites the AI background offline!
    fetchedUrls = [];
    globalThis.fetch = (async () => {
      throw new Error("Offline test: outbound network fetch is disabled");
    }) as typeof fetch;

    const masterPng = await generatePrintMasterPng({
      version: 1,
      placement: "front",
      color: "#121212",
      transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      layers: [
        {
          id: "bg-layer",
          type: "asset",
          assetId: storedAsset.id,
          fillMode: "cover",
          zIndex: 1,
          opacity: 1,
          transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
        },
        {
          id: "cal-layer",
          type: "calligraphy",
          text: "Bình An",
          fontFamily: "UTM ThuPhap Thien An",
          layout: "HORIZONTAL",
          colorHex: "#121212",
          zIndex: 10,
          opacity: 1,
          transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
        },
      ],
    });

    assert.equal(fetchedUrls.length, 0);
    assert.equal(masterPng.readUInt32BE(16), 4500);
    assert.equal(masterPng.readUInt32BE(20), 5400);
    const phys = findPngPhysChunk(masterPng);
    assert.ok(phys);
    assert.equal(phys.ppuX, 11811);
    assert.equal(phys.crcValid, true);
  } finally {
    globalThis.fetch = originalFetch;
    removeLocalPrivateFileIfCreated(createdObjectKey);
  }
});

test("R-400: Render routes export nodejs + maxDuration=60, and 2nd GET /api/download streams cached PRINT_MASTER with 4500x5400 & pHYs=11811 without re-running generatePrintMasterPng", async () => {
  resetHarnessState();
  resetRateLimitStore();
  resetPrintMasterRenderCountForTests();

  assert.equal(printMasterRouteMod.runtime, "nodejs");
  assert.equal(printMasterRouteMod.maxDuration, 60);
  assert.equal(downloadRouteMod.runtime, "nodejs");
  assert.equal(downloadRouteMod.maxDuration, 60);
  assert.equal(
    (await import("@/app/api/backgrounds/generate/route")).runtime,
    "nodejs"
  );
  assert.equal(
    (await import("@/app/api/backgrounds/generate/route")).maxDuration,
    60
  );

  process.env.DOWNLOAD_TOKEN_SECRET =
    "r400-download-token-secret-minimum-32chars!!";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  let cachedObjectKey: string | undefined;

  try {
    const orderId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
    const orderItemId = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
    const pvId = "cccccccc-3333-4333-8333-cccccccccccc";

    harnessState.orders.set(orderId, {
      id: orderId,
      orderNumber: "TB-R400-CACHE",
      buyerId: "buyer-r400",
      anonymousSessionId: null,
      status: "PAID",
      paymentStatus: "SUCCEEDED",
    });

    harnessState.personalizationVersions.set(pvId, {
      id: pvId,
      printAssetId: null,
      styleSnapshot: {
        version: 1,
        placement: "front",
        color: "#121212",
        layers: [
          {
            id: "r400-cal",
            type: "calligraphy",
            text: "Phúc",
            fontFamily: "UTM ThuPhap Thien An",
            layout: "HORIZONTAL",
            colorHex: "#121212",
            zIndex: 10,
            opacity: 1,
            transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
          },
        ],
      },
    });

    harnessState.orderItems.set(orderItemId, {
      id: orderItemId,
      orderId,
      designVersionId: "dv-r400",
      personalizationVersionId: pvId,
    });

    const token = await signDownloadToken({ orderItemId, orderId });
    assert.equal(getPrintMasterRenderCount(), 0);

    // 1st download: renders Print Master once and caches it privately
    const firstRes = await downloadRouteMod.GET(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(token)}`
      )
    );
    assert.equal(firstRes.status, 200);
    assert.equal(getPrintMasterRenderCount(), 1);

    const firstBuf = Buffer.from(await firstRes.arrayBuffer());
    assert.equal(firstBuf.readUInt32BE(16), 4500);
    assert.equal(firstBuf.readUInt32BE(20), 5400);
    const firstPhys = findPngPhysChunk(firstBuf);
    assert.ok(firstPhys);
    assert.equal(firstPhys.ppuX, 11811);
    assert.equal(firstPhys.crcValid, true);

    const updatedPv = harnessState.personalizationVersions.get(pvId);
    assert.ok(updatedPv?.printAssetId, "Expected PersonalizationVersion.printAssetId to be populated");
    const cachedAsset = harnessState.assets.get(updatedPv.printAssetId);
    assert.ok(cachedAsset);
    assert.equal(cachedAsset.visibility, "PRIVATE");
    cachedObjectKey = cachedAsset.objectKey;

    // 2nd download: serves cached PRINT_MASTER WITHOUT calling generatePrintMasterPng again!
    const secondRes = await downloadRouteMod.GET(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(token)}`
      )
    );
    assert.equal(secondRes.status, 200);
    assert.equal(
      getPrintMasterRenderCount(),
      1,
      "2nd download must stream cached PRINT_MASTER without re-running generatePrintMasterPng"
    );

    const secondBuf = Buffer.from(await secondRes.arrayBuffer());
    assert.equal(secondBuf.readUInt32BE(16), 4500);
    assert.equal(secondBuf.readUInt32BE(20), 5400);
    assert.equal(secondBuf[25], 6);
    const secondPhys = findPngPhysChunk(secondBuf);
    assert.ok(secondPhys);
    assert.equal(secondPhys.ppuX, 11811);
    assert.equal(secondPhys.ppuY, 11811);
    assert.equal(secondPhys.unit, 1);
    assert.equal(secondPhys.crcValid, true);
  } finally {
    removeLocalPrivateFileIfCreated(cachedObjectKey);
  }
});
