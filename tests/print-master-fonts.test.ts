import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { PNG } from "pngjs";
import {
  CompositionSchema,
  PRINT_MASTER_DPI,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_PIXELS_PER_METER,
  PRINT_MASTER_WIDTH,
} from "@/lib/print/types";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  FontLicenseError,
  FontRegistryService,
  isFontLicensedForPrint,
} from "@/lib/fonts/FontRegistryService";
import {
  GlyphCoverageError,
  PrintMasterHttpError,
  authorizeAndParsePrintMasterRequest,
  generatePrintMasterPng,
  renderAndStorePrintMaster,
} from "@/lib/print-generator";
import { computeHmacSha256Hex } from "@/lib/security/tokens";

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

test("T-301 / INV-013: generatePrintMasterPng renders 4500x5400 RGBA transparent PNG @ 300 DPI (pHYs=11811)", async () => {
  // Ensure fast offline fallback in sandboxed unit tests
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
    assert.equal(colorType, 6, "PNG must be colorType 6 (RGBA with alpha channel)");

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
  } finally {
    if (savedDbUrl !== undefined) {
      process.env.DATABASE_URL = savedDbUrl;
    }
  }
});

test("T-406 & T-407 / TB-CALLI-008: Font licensing gate blocks Kokuryu & unverified VNI fonts while allowing verified OFL fonts and Ma Shan Zheng seal coverage", async () => {
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
      await FontRegistryService.hasGlyphCoverage("UTM ThuPhap Thien An", "Có Chí Thì Nên"),
      true
    );

    // Legacy VNI font lacks "印" glyph coverage
    assert.equal(
      await FontRegistryService.hasGlyphCoverage("VNI Ong do", "印", {
        allowUnlicensedInspection: true,
      }),
      false
    );

    // 2. Rejects Kokuryu (Adobe web-only license: printExportAllowed === false)
    await assert.rejects(
      () => FontRegistryService.toggleActive("kokuryu", true),
      FontLicenseError
    );
    await assert.rejects(
      () => FontRegistryService.resolveFontBuffer("kokuryu"),
      FontLicenseError
    );

    // 3. Rejects unverified VNI / HL / HY archive fonts from activation & print rendering
    await assert.rejects(
      () => FontRegistryService.toggleActive("vni-ong-do", true),
      FontLicenseError
    );
    await assert.rejects(
      () => FontRegistryService.toggleActive("VNI-Thu_fap2.ttf", true),
      FontLicenseError
    );
    await assert.rejects(
      () => FontRegistryService.resolveFontBuffer("VNI Ong do"),
      FontLicenseError
    );

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
    const enabledRes = await FontRegistryService.toggleActive("ma-shan-zheng", true);
    assert.deepEqual(enabledRes, { id: "ma-shan-zheng", enabled: true });

    const activeFonts = await FontRegistryService.getActiveFrontendFonts();
    assert.ok(activeFonts.length > 0);
    for (const f of activeFonts) {
      assert.equal(isFontLicensedForPrint(f), true);
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
          throw new Error("Should not fall through to admin check on forged HMAC");
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
          throw new Error("Should not call admin check when valid HMAC provided");
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
