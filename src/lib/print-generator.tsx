import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import prisma from "@/lib/prisma";
import {
  CompositionSchema,
  PRINT_MASTER_DPI,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_PIXELS_PER_METER,
  PRINT_MASTER_WIDTH,
  type CompositionLayer,
  type DesignComposition,
} from "@/lib/print/types";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  FontLicenseError,
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import {
  SecurityConfigError,
  verifyHmacSha256,
} from "@/lib/security/tokens";
import { deterministicUid, escapeXml } from "@/lib/security/xml";
import { z } from "zod";

export class GlyphCoverageError extends Error {
  constructor(fontFamily: string, text: string) {
    super(
      `Font "${fontFamily}" lacks required glyph coverage for requested text (${text.length} chars)`
    );
    this.name = "GlyphCoverageError";
  }
}

export class AssetResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetResolutionError";
  }
}

export class PrintMasterHttpError extends Error {
  public readonly status: 400 | 401 | 403 | 503;

  constructor(status: 400 | 401 | 403 | 503, message: string) {
    super(message);
    this.name = "PrintMasterHttpError";
    this.status = status;
  }
}

const PrintMasterRequestPayloadSchema = z.union([
  z.object({ composition: CompositionSchema }),
  CompositionSchema,
]);

/**
 * Pure request authenticator + Zod CompositionSchema parser for `/api/print-master` (T-100).
 * Accepts ONLY a valid `x-fulfillment-signature` HMAC-SHA256 OR an authenticated DB ADMIN session.
 */
export async function authorizeAndParsePrintMasterRequest(params: {
  rawBody: string;
  signatureHeader: string | null;
  assertAdminFn: () => Promise<unknown>;
}): Promise<DesignComposition> {
  const { rawBody, signatureHeader, assertAdminFn } = params;

  if (signatureHeader !== null) {
    let valid = false;
    try {
      valid = verifyHmacSha256(
        rawBody,
        signatureHeader,
        "FULFILLMENT_SECRET_KEY"
      );
    } catch (err: unknown) {
      if (err instanceof SecurityConfigError) {
        throw new PrintMasterHttpError(
          503,
          "Fulfillment signing key is not configured"
        );
      }
      throw err;
    }

    if (!valid) {
      throw new PrintMasterHttpError(401, "Invalid fulfillment signature");
    }
  } else {
    await assertAdminFn();
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    throw new PrintMasterHttpError(400, "Request body must be valid JSON");
  }

  const validated = PrintMasterRequestPayloadSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new PrintMasterHttpError(400, "Invalid print composition payload");
  }

  return "composition" in validated.data
    ? validated.data.composition
    : validated.data;
}

export interface PrintMasterArtifact {
  buffer: Buffer;
  sha256: string;
  width: typeof PRINT_MASTER_WIDTH;
  height: typeof PRINT_MASTER_HEIGHT;
  dpi: typeof PRINT_MASTER_DPI;
  assetId?: string;
  objectKey?: string;
}

export interface RenderAndStoreMeta {
  ownerId?: string | null;
  designVersionId?: string;
  personalizationVersionId?: string;
  persistAsset?: boolean;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// Safe print region leaving 6% margin so normalized [0,1] transforms stay inside canvas bounds
const SAFE_PAD_X = Math.round(PRINT_MASTER_WIDTH * 0.06); // 270px
const SAFE_PAD_Y = Math.round(PRINT_MASTER_HEIGHT * 0.06); // 324px
const SAFE_WIDTH = PRINT_MASTER_WIDTH - SAFE_PAD_X * 2; // 3960px
const SAFE_HEIGHT = PRINT_MASTER_HEIGHT - SAFE_PAD_Y * 2; // 4752px

const DEFAULT_ALLOWED_ASSET_HOST_SUFFIXES = [
  ".public.blob.vercel-storage.com",
  ".blob.vercel-storage.com",
  ".supabase.co",
];

const DEFAULT_ALLOWED_ASSET_HOSTS = new Set<string>([
  "storage.thibut.com",
  "fal.media",
  "v3.fal.media",
]);

// Precompute IEEE 802.3 CRC-32 lookup table for PNG chunk integrity
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Injects an authoritative PNG `pHYs` chunk (11811 px/m X & Y, unit=1 meter => 300 DPI)
 * immediately after `IHDR`, removing any pre-existing `pHYs` chunk, and verifies
 * 4500x5400 RGBA (colorType === 6) dimensions.
 */
export function injectPngPhysChunk300Dpi(pngBuffer: Buffer): Buffer {
  if (
    pngBuffer.length < 33 ||
    !pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE)
  ) {
    throw new Error("Invalid PNG buffer signature");
  }

  const ihdrLen = pngBuffer.readUInt32BE(8);
  const ihdrType = pngBuffer.subarray(12, 16).toString("ascii");
  if (ihdrType !== "IHDR" || ihdrLen < 13) {
    throw new Error("Malformed PNG IHDR chunk");
  }

  const width = pngBuffer.readUInt32BE(16);
  const height = pngBuffer.readUInt32BE(20);
  const colorType = pngBuffer[25];

  if (width !== PRINT_MASTER_WIDTH || height !== PRINT_MASTER_HEIGHT) {
    throw new Error(
      `Invalid Print Master dimensions ${width}x${height}; expected ${PRINT_MASTER_WIDTH}x${PRINT_MASTER_HEIGHT}`
    );
  }
  if (colorType !== 6) {
    throw new Error(
      `Invalid PNG colorType ${colorType}; expected 6 (RGBA with alpha channel)`
    );
  }

  // Build 21-byte pHYs chunk: length(4) + "pHYs"(4) + X(4) + Y(4) + unit(1) + crc(4)
  const physChunk = Buffer.alloc(21);
  physChunk.writeUInt32BE(9, 0);
  physChunk.write("pHYs", 4, 4, "ascii");
  physChunk.writeUInt32BE(PRINT_MASTER_PIXELS_PER_METER, 8);
  physChunk.writeUInt32BE(PRINT_MASTER_PIXELS_PER_METER, 12);
  physChunk.writeUInt8(1, 16); // 1 = meter
  const physCrc = crc32(physChunk.subarray(4, 17));
  physChunk.writeUInt32BE(physCrc, 17);

  // Walk existing PNG chunks to strip any pre-existing pHYs and splice ours right after IHDR
  const ihdrEnd = 8 + 12 + ihdrLen;
  const outputParts: Buffer[] = [pngBuffer.subarray(0, ihdrEnd), physChunk];

  let offset = ihdrEnd;
  while (offset + 8 <= pngBuffer.length) {
    const chunkLen = pngBuffer.readUInt32BE(offset);
    const chunkTotal = 12 + chunkLen;
    if (offset + chunkTotal > pngBuffer.length) {
      throw new Error("Truncated PNG chunk encountered");
    }
    const chunkType = pngBuffer
      .subarray(offset + 4, offset + 8)
      .toString("ascii");
    if (chunkType !== "pHYs") {
      outputParts.push(pngBuffer.subarray(offset, offset + chunkTotal));
    }
    offset += chunkTotal;
    if (chunkType === "IEND") break;
  }

  return Buffer.concat(outputParts);
}

interface PathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function measurePathDataBounds(pathDataList: string[]): PathBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const coordRegex = /-?\d+(?:\.\d+)?/g;
  for (const d of pathDataList) {
    const matches = d.match(coordRegex);
    if (!matches) continue;
    for (let i = 0; i + 1 < matches.length; i += 2) {
      const x = Number(matches[i]);
      const y = Number(matches[i + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  return { minX, minY, maxX, maxY };
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "0.0.0.0" ||
    lower === "[::1]" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }
  if (/^127\./.test(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function isAllowedRemoteAssetHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(lower)) return false;
  if (DEFAULT_ALLOWED_ASSET_HOSTS.has(lower)) return true;
  if (DEFAULT_ALLOWED_ASSET_HOST_SUFFIXES.some((s) => lower.endsWith(s))) {
    return true;
  }
  const extraRaw = process.env.ALLOWED_ASSET_HOSTS;
  if (extraRaw) {
    const extra = extraRaw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (extra.includes(lower)) return true;
  }
  return false;
}

async function resolveAssetDataUri(assetId: string): Promise<{
  dataUri: string;
  width: number;
  height: number;
}> {
  let asset: { objectKey: string; mimeType: string } | null = null;
  try {
    asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { objectKey: true, mimeType: true },
    });
  } catch {
    throw new AssetResolutionError(
      `Unable to resolve asset "${assetId}" from database`
    );
  }

  if (!asset || !asset.objectKey) {
    throw new AssetResolutionError(`Asset "${assetId}" not found`);
  }

  let rawBytes: Buffer;
  const objectKey = asset.objectKey.trim();

  if (objectKey.startsWith("/")) {
    const publicRoot = path.resolve(process.cwd(), "public");
    const candidatePath = path.resolve(publicRoot, objectKey.slice(1));
    if (!candidatePath.startsWith(publicRoot + path.sep)) {
      throw new AssetResolutionError("Asset objectKey failed path containment");
    }
    if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
      throw new AssetResolutionError("Local asset file is missing on disk");
    }
    rawBytes = fs.readFileSync(candidatePath);
  } else {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(objectKey);
    } catch {
      throw new AssetResolutionError("Asset objectKey is not a valid URL");
    }
    if (
      parsedUrl.protocol !== "https:" ||
      !isAllowedRemoteAssetHost(parsedUrl.hostname)
    ) {
      throw new AssetResolutionError(
        `Asset host "${parsedUrl.hostname}" is not permitted by SSRF allowlist`
      );
    }
    const res = await fetch(parsedUrl.toString(), {
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      throw new AssetResolutionError(
        `Remote asset fetch failed with HTTP ${res.status}`
      );
    }
    rawBytes = Buffer.from(await res.arrayBuffer());
  }

  // Normalize image through sharp to clean PNG RGBA buffer and extract dimensions
  const normalizedPng = await sharp(rawBytes).png().toBuffer();
  const metadata = await sharp(normalizedPng).metadata();
  const w = metadata.width ?? PRINT_MASTER_WIDTH;
  const h = metadata.height ?? PRINT_MASTER_HEIGHT;

  return {
    dataUri: `data:image/png;base64,${normalizedPng.toString("base64")}`,
    width: w,
    height: h,
  };
}

async function renderCalligraphyLayerSvg(
  layer: Extract<CompositionLayer, { type: "calligraphy" }>
): Promise<string> {
  const font = await FontRegistryService.parseOpenTypeFont(layer.fontFamily);
  const covered = await FontRegistryService.hasGlyphCoverage(
    layer.fontFamily,
    layer.text
  );
  if (!covered) {
    throw new GlyphCoverageError(layer.fontFamily, layer.text);
  }

  const trimmed = layer.text.trim();
  const isVertical = layer.layout === "VERTICAL";
  const isEmblem = layer.layout === "EMBLEM";
  const isFullBack = layer.layout === "FULL_BACK";

  const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(
    trimmed
  );
  const lines = isVertical
    ? isCJK
      ? Array.from(trimmed.replace(/\s+/g, ""))
      : trimmed.split(/\s+/).filter(Boolean)
    : trimmed.split(/\r?\n/).filter(Boolean);

  const baseFontSize = 600;
  const lineStep = baseFontSize * (isVertical ? 1.38 : 1.25);

  const pathStrings: string[] = [];
  lines.forEach((line, idx) => {
    const advance = font.getAdvanceWidth(line, baseFontSize);
    const glyphPath = font.getPath(
      line,
      -advance / 2,
      idx * lineStep,
      baseFontSize
    );
    const d = glyphPath.toPathData(2);
    if (d) {
      pathStrings.push(d);
    }
  });

  if (pathStrings.length === 0) {
    throw new GlyphCoverageError(layer.fontFamily, layer.text);
  }

  const bounds = measurePathDataBounds(pathStrings);
  const inkW = Math.max(bounds.maxX - bounds.minX, 1);
  const inkH = Math.max(bounds.maxY - bounds.minY, 1);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const targetMaxW = isVertical
    ? SAFE_WIDTH * 0.68
    : isEmblem
      ? SAFE_WIDTH * 0.52
      : isFullBack
        ? SAFE_WIDTH * 0.86
        : SAFE_WIDTH * 0.78;

  const targetMaxH = isVertical
    ? SAFE_HEIGHT * 0.72
    : isEmblem
      ? SAFE_WIDTH * 0.52
      : isFullBack
        ? SAFE_HEIGHT * 0.8
        : SAFE_HEIGHT * 0.58;

  const fitScale = Math.min(targetMaxW / inkW, targetMaxH / inkH);
  const finalScale = fitScale * layer.transform.scale;

  const anchorX = SAFE_PAD_X + layer.transform.x * SAFE_WIDTH;
  const anchorY = SAFE_PAD_Y + layer.transform.y * SAFE_HEIGHT;
  const color = escapeXml(layer.colorHex);
  const uid = deterministicUid(`${layer.id}|${trimmed}|${layer.layout}`, "cal");

  const emblemMarkup = isEmblem
    ? `<g id="${uid}-emblem">
         <circle cx="0" cy="0" r="${(SAFE_WIDTH * 0.31 * layer.transform.scale).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${(18 * layer.transform.scale).toFixed(2)}" stroke-dasharray="1400 95" stroke-linecap="round" opacity="0.82" />
         <circle cx="0" cy="0" r="${(SAFE_WIDTH * 0.29 * layer.transform.scale).toFixed(2)}" fill="none" stroke="${color}" stroke-width="${(9 * layer.transform.scale).toFixed(2)}" stroke-dasharray="48 36" stroke-linecap="round" opacity="0.45" />
       </g>`
    : "";

  const pathsMarkup = pathStrings
    .map(
      (d) =>
        `<path d="${d}" fill="${color}" stroke="${color}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />`
    )
    .join("");

  return `<g id="${uid}" opacity="${layer.opacity.toFixed(3)}" transform="translate(${anchorX.toFixed(2)}, ${anchorY.toFixed(2)}) rotate(${layer.transform.rotation.toFixed(2)})">
    ${emblemMarkup}
    <g transform="scale(${finalScale.toFixed(5)}) translate(${(-centerX).toFixed(2)}, ${(-centerY).toFixed(2)})">
      ${pathsMarkup}
    </g>
  </g>`;
}

async function renderSealLayerSvg(
  layer: Extract<CompositionLayer, { type: "seal" }>
): Promise<string> {
  const fontFamily = layer.fontFamily || DEFAULT_SEAL_FONT_FAMILY;
  const font = await FontRegistryService.parseOpenTypeFont(fontFamily);
  const covered = await FontRegistryService.hasGlyphCoverage(
    fontFamily,
    layer.sealText
  );
  if (!covered) {
    throw new GlyphCoverageError(fontFamily, layer.sealText);
  }

  const trimmed = layer.sealText.trim();
  const chars = Array.from(trimmed);
  const baseFontSize = 320;

  const pathStrings: string[] = [];
  if (chars.length <= 2) {
    chars.forEach((ch, idx) => {
      const adv = font.getAdvanceWidth(ch, baseFontSize);
      const p = font.getPath(
        ch,
        -adv / 2,
        idx * (baseFontSize * 1.05),
        baseFontSize
      );
      const d = p.toPathData(2);
      if (d) pathStrings.push(d);
    });
  } else {
    const adv = font.getAdvanceWidth(trimmed, baseFontSize);
    const p = font.getPath(trimmed, -adv / 2, 0, baseFontSize);
    const d = p.toPathData(2);
    if (d) pathStrings.push(d);
  }

  if (pathStrings.length === 0) {
    throw new GlyphCoverageError(fontFamily, layer.sealText);
  }

  const bounds = measurePathDataBounds(pathStrings);
  const inkW = Math.max(bounds.maxX - bounds.minX, 1);
  const inkH = Math.max(bounds.maxY - bounds.minY, 1);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  const baseStampSize = 420;
  const halfStamp = baseStampSize / 2;
  const innerInset = 22;
  const innerSize = baseStampSize - innerInset * 2;
  const glyphTargetBox = baseStampSize * 0.62;
  const glyphFitScale = Math.min(glyphTargetBox / inkW, glyphTargetBox / inkH);

  const anchorX = SAFE_PAD_X + layer.transform.x * SAFE_WIDTH;
  const anchorY = SAFE_PAD_Y + layer.transform.y * SAFE_HEIGHT;
  const sealColor = escapeXml(layer.colorHex);
  const uid = deterministicUid(`${layer.id}|${trimmed}`, "seal");

  const glyphPaths = pathStrings
    .map((d) => `<path d="${d}" fill="#FBF9F4" />`)
    .join("");

  return `<g id="${uid}" opacity="${layer.opacity.toFixed(3)}" transform="translate(${anchorX.toFixed(2)}, ${anchorY.toFixed(2)}) rotate(${layer.transform.rotation.toFixed(2)}) scale(${layer.transform.scale.toFixed(4)})">
    <rect x="${-halfStamp}" y="${-halfStamp}" width="${baseStampSize}" height="${baseStampSize}" rx="20" ry="20" fill="${sealColor}" />
    <rect x="${-halfStamp + innerInset}" y="${-halfStamp + innerInset}" width="${innerSize}" height="${innerSize}" rx="10" ry="10" fill="none" stroke="#FBF9F4" stroke-width="10" />
    <g transform="scale(${glyphFitScale.toFixed(5)}) translate(${(-centerX).toFixed(2)}, ${(-centerY).toFixed(2)})">
      ${glyphPaths}
    </g>
  </g>`;
}

async function renderAssetLayerSvg(
  layer: Extract<CompositionLayer, { type: "asset" }>
): Promise<string> {
  const resolved = await resolveAssetDataUri(layer.assetId);
  const anchorX = SAFE_PAD_X + layer.transform.x * SAFE_WIDTH;
  const anchorY = SAFE_PAD_Y + layer.transform.y * SAFE_HEIGHT;
  const boxW = SAFE_WIDTH * layer.transform.scale;
  const boxH = SAFE_HEIGHT * layer.transform.scale;
  const preserveAspectRatio =
    layer.fillMode === "cover" ? "xMidYMid slice" : "xMidYMid meet";
  const uid = deterministicUid(`${layer.id}|${layer.assetId}`, "ast");

  return `<g id="${uid}" opacity="${layer.opacity.toFixed(3)}" transform="translate(${anchorX.toFixed(2)}, ${anchorY.toFixed(2)}) rotate(${layer.transform.rotation.toFixed(2)})">
    <image href="${resolved.dataUri}" x="${(-boxW / 2).toFixed(2)}" y="${(-boxH / 2).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" preserveAspectRatio="${preserveAspectRatio}" />
  </g>`;
}

/**
 * Converts a legacy pre-Wave-1 composition JSON shape (if encountered on historical orders)
 * into a validated `DesignComposition` conforming to `CompositionSchema`.
 */
export function adaptLegacyComposition(raw: unknown): DesignComposition {
  const direct = CompositionSchema.safeParse(raw);
  if (direct.success) {
    return direct.data;
  }

  if (typeof raw === "object" && raw !== null && "layers" in raw) {
    const candidate = raw as Record<string, unknown>;
    if (Array.isArray(candidate.layers)) {
      const normalizedLayers = candidate.layers.map((item) => {
        if (typeof item !== "object" || item === null) return item;
        const l = item as Record<string, unknown>;
        if (
          l.type === "seal" &&
          (l.fontFamily === "VNI Ong do" || l.fontFamily === "vni-ong-do")
        ) {
          return { ...l, fontFamily: DEFAULT_SEAL_FONT_FAMILY };
        }
        return item;
      });
      return CompositionSchema.parse({
        ...candidate,
        layers: normalizedLayers,
      });
    }
  }

  return CompositionSchema.parse(raw);
}

/**
 * Deterministically renders a 4500x5400 px @ 300 DPI RGBA transparent Print Master PNG
 * from a server-validated `DesignComposition` (INV-013, T-301).
 *
 * - Strictly validates input against `CompositionSchema`
 * - Zero network font fetches (loads local licensed fonts via `FontRegistryService`)
 * - Outlines calligraphy & seal glyphs via `@shuding/opentype.js`
 * - Forces transparent RGBA background (`rgba(0, 0, 0, 0)`)
 * - Embeds exact 300 DPI `pHYs` chunk (`11811` px/m, unit=1)
 */
export async function generatePrintMasterPng(
  input: DesignComposition
): Promise<Buffer> {
  const composition = CompositionSchema.parse(input);

  const sortedLayers = [...composition.layers].sort(
    (a, b) => a.zIndex - b.zIndex
  );

  const renderedLayerMarkup: string[] = [];
  for (const layer of sortedLayers) {
    if (layer.type === "calligraphy") {
      renderedLayerMarkup.push(await renderCalligraphyLayerSvg(layer));
    } else if (layer.type === "seal") {
      renderedLayerMarkup.push(await renderSealLayerSvg(layer));
    } else if (layer.type === "asset") {
      renderedLayerMarkup.push(await renderAssetLayerSvg(layer));
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_MASTER_WIDTH}" height="${PRINT_MASTER_HEIGHT}" viewBox="0 0 ${PRINT_MASTER_WIDTH} ${PRINT_MASTER_HEIGHT}">
  ${renderedLayerMarkup.join("\n  ")}
</svg>`;

  const resvg = new Resvg(svg, {
    background: "rgba(0, 0, 0, 0)",
    fitTo: {
      mode: "original",
    },
  });

  const rawPng = resvg.render().asPng();
  return injectPngPhysChunk300Dpi(Buffer.from(rawPng));
}

/**
 * Backwards-compatible export used by `/api/download` and worker callers.
 */
export async function generatePrintMaster(
  composition: DesignComposition
): Promise<Buffer> {
  return generatePrintMasterPng(adaptLegacyComposition(composition));
}

/**
 * Renders the 4500x5400 @ 300 DPI Print Master, computes its SHA-256 digest,
 * uploads/registers it as an immutable derivative `Asset` (INV-001 — never overwriting originals),
 * and returns the rendered buffer + metadata.
 */
export async function renderAndStorePrintMaster(
  input: DesignComposition,
  meta?: RenderAndStoreMeta
): Promise<PrintMasterArtifact> {
  const buffer = await generatePrintMasterPng(input);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  let objectKey = `print-masters/${sha256}-${Date.now()}.png`;
  let storageProvider = "memory";

  if (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  ) {
    const { put } = await import("@vercel/blob");
    const uploaded = await put(objectKey, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/png",
    });
    objectKey = uploaded.url;
    storageProvider = "vercel-blob";
  }

  let assetId: string | undefined;
  const shouldPersist = meta?.persistAsset ?? Boolean(process.env.DATABASE_URL);

  if (shouldPersist && process.env.DATABASE_URL) {
    try {
      const createdAsset = await prisma.asset.create({
        data: {
          objectKey,
          mimeType: "image/png",
          sha256,
          width: PRINT_MASTER_WIDTH,
          height: PRINT_MASTER_HEIGHT,
          sizeBytes: buffer.length,
          storageProvider,
          ownerId: meta?.ownerId ?? null,
          visibility: "PRIVATE",
        },
      });
      assetId = createdAsset.id;

      if (meta?.designVersionId) {
        await prisma.designVersionAsset.create({
          data: {
            designVersionId: meta.designVersionId,
            assetId: createdAsset.id,
            type: "PRINT_MASTER",
          },
        });
      }

      if (meta?.personalizationVersionId) {
        await prisma.personalizationVersion.update({
          where: { id: meta.personalizationVersionId },
          data: { printAssetId: createdAsset.id },
        });
      }
    } catch {
      // Allow offline callers/tests to receive rendered buffer + sha256 when DB is unreachable
    }
  }

  return {
    buffer,
    sha256,
    width: PRINT_MASTER_WIDTH,
    height: PRINT_MASTER_HEIGHT,
    dpi: PRINT_MASTER_DPI,
    assetId,
    objectKey,
  };
}

export { FontLicenseError, FontNotFoundError };
