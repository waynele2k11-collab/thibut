import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_DIMENSION = 8192;

export type SniffedImageFormat = "png" | "jpeg" | "webp";

export class UploadValidationError extends Error {
  public readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface SanitizedImageResult {
  buffer: Buffer;
  mimeType: "image/png" | "image/webp";
  extension: ".png" | ".webp";
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
}

export interface StoredUploadResult {
  success: boolean;
  url: string | null;
  objectKey?: string;
  storageProvider?: "vercel-blob" | "local-private";
  mimeType?: "image/png" | "image/webp";
  sha256?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  statusCode?: 400 | 500 | 503;
  error?: string;
}

/**
 * Inspects leading magic bytes of an image buffer (PNG, JPEG, WEBP).
 * Never trusts client-supplied Content-Type or filename extension.
 */
export function sniffImageMagicBytes(bytes: Uint8Array): SniffedImageFormat | null {
  if (bytes.byteLength < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

/**
 * Validates magic bytes, dimensions, and size, then decodes and re-encodes
 * pixel data from scratch via `sharp` to strip EXIF/metadata and neutralize polyglots.
 * Extension is chosen strictly server-side (`.png` or `.webp`).
 */
export async function validateAndSanitizeImage(
  input: Buffer | Uint8Array | ArrayBuffer,
  options?: {
    maxBytes?: number;
    maxDimension?: number;
    preferredOutput?: "webp" | "png";
  }
): Promise<SanitizedImageResult> {
  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxDimension = options?.maxDimension ?? MAX_IMAGE_DIMENSION;

  const rawBuffer = Buffer.isBuffer(input)
    ? input
    : input instanceof Uint8Array
      ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
      : Buffer.from(input);

  if (rawBuffer.byteLength === 0) {
    throw new UploadValidationError("Uploaded file is empty");
  }

  if (rawBuffer.byteLength > maxBytes) {
    throw new UploadValidationError("File exceeds 10MB size limit");
  }

  const sniffed = sniffImageMagicBytes(rawBuffer);
  if (!sniffed) {
    throw new UploadValidationError(
      "Invalid image signature. Only genuine PNG, JPEG, and WEBP images are allowed."
    );
  }

  const maxPixels = maxDimension * maxDimension;

  let metadata: Metadata;
  try {
    metadata = await sharp(rawBuffer, {
      limitInputPixels: maxPixels,
      failOn: "error",
    }).metadata();
  } catch {
    throw new UploadValidationError("Invalid or corrupted image file");
  }

  if (
    !metadata.format ||
    metadata.format !== sniffed ||
    !metadata.width ||
    !metadata.height ||
    metadata.width < 1 ||
    metadata.height < 1
  ) {
    throw new UploadValidationError("Invalid image structure or mismatched format");
  }

  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    throw new UploadValidationError(
      `Image dimensions exceed maximum allowed (${maxDimension}x${maxDimension}px)`
    );
  }

  const outputFormat: "png" | "webp" =
    options?.preferredOutput ??
    (sniffed === "png" || Boolean(metadata.hasAlpha) ? "png" : "webp");

  try {
    const pipeline = sharp(rawBuffer, {
      limitInputPixels: maxPixels,
      failOn: "error",
    }).rotate();

    const encoded =
      outputFormat === "png"
        ? await pipeline
            .png({ compressionLevel: 9 })
            .toBuffer({ resolveWithObject: true })
        : await pipeline
            .webp({ quality: 90 })
            .toBuffer({ resolveWithObject: true });

    if (encoded.data.byteLength > maxBytes) {
      throw new UploadValidationError("Processed image exceeds 10MB size limit");
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(encoded.data)
      .digest("hex");

    return {
      buffer: encoded.data,
      mimeType: outputFormat === "png" ? "image/png" : "image/webp",
      extension: outputFormat === "png" ? ".png" : ".webp",
      width: encoded.info.width,
      height: encoded.info.height,
      sizeBytes: encoded.data.byteLength,
      sha256,
    };
  } catch (err: unknown) {
    if (err instanceof UploadValidationError) {
      throw err;
    }
    throw new UploadValidationError("Failed to decode image pixels safely");
  }
}

const LOCAL_PRIVATE_ROOT = path.resolve(process.cwd(), ".local-private-uploads");
const LOCAL_PRIVATE_PREFIX = "local-private://";

function sanitizeFolderSegment(folder: string): string {
  const cleaned = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || "uploads";
}

async function toRawBuffer(file: File | Blob | Buffer | Uint8Array): Promise<Buffer> {
  if (Buffer.isBuffer(file)) {
    return file;
  }
  if (file instanceof Uint8Array) {
    return Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("File exceeds 10MB size limit");
  }
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export class UploadService {
  static readonly MAX_UPLOAD_BYTES = MAX_UPLOAD_BYTES;
  static readonly MAX_IMAGE_DIMENSION = MAX_IMAGE_DIMENSION;
  static readonly sniffImageMagicBytes = sniffImageMagicBytes;
  static readonly validateAndSanitizeImage = validateAndSanitizeImage;

  /**
   * Validates, re-encodes, and stores an image privately (INV-014).
   * Never uses `access: "public"` and never writes inside `public/uploads/`.
   */
  static async uploadImage(
    file: File | Blob | Buffer | Uint8Array,
    filename = "upload",
    folder = "uploads"
  ): Promise<StoredUploadResult> {
    void filename;
    let sanitized: SanitizedImageResult;
    try {
      const inputBuffer = await toRawBuffer(file);
      sanitized = await validateAndSanitizeImage(inputBuffer);
    } catch (err: unknown) {
      if (err instanceof UploadValidationError) {
        return {
          success: false,
          url: null,
          statusCode: 400,
          error: err.message,
        };
      }
      return {
        success: false,
        url: null,
        statusCode: 400,
        error: "Invalid image upload",
      };
    }

    const safeFolder = sanitizeFolderSegment(folder);
    const serverFileName = `${crypto.randomUUID()}${sanitized.extension}`;
    const blobToken =
      process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`${safeFolder}/${serverFileName}`, sanitized.buffer, {
          access: "private",
          addRandomSuffix: true,
          contentType: sanitized.mimeType,
          token: blobToken,
        });

        return {
          success: true,
          url: blob.url,
          objectKey: blob.url,
          storageProvider: "vercel-blob",
          mimeType: sanitized.mimeType,
          sha256: sanitized.sha256,
          width: sanitized.width,
          height: sanitized.height,
          sizeBytes: sanitized.sizeBytes,
        };
      } catch (err: unknown) {
        console.error(
          "[UploadService] Private Blob upload failed:",
          err instanceof Error ? err.name : "UnknownError"
        );
        if (process.env.NODE_ENV === "production") {
          return {
            success: false,
            url: null,
            statusCode: 503,
            error: "Private object storage unavailable",
          };
        }
      }
    } else if (process.env.NODE_ENV === "production") {
      // Production MUST NOT fall back to local filesystem
      return {
        success: false,
        url: null,
        statusCode: 503,
        error: "Private object storage is not configured",
      };
    }

    // Development / test fallback: store strictly outside `public/`
    try {
      const targetDir = path.resolve(LOCAL_PRIVATE_ROOT, safeFolder);
      if (!targetDir.startsWith(LOCAL_PRIVATE_ROOT + path.sep)) {
        throw new Error("Invalid upload directory");
      }
      await fs.mkdir(targetDir, { recursive: true });

      const targetPath = path.resolve(targetDir, serverFileName);
      if (!targetPath.startsWith(targetDir + path.sep)) {
        throw new Error("Invalid upload file path");
      }

      await fs.writeFile(targetPath, sanitized.buffer);
      const objectKey = `${LOCAL_PRIVATE_PREFIX}${safeFolder}/${serverFileName}`;

      return {
        success: true,
        url: objectKey,
        objectKey,
        storageProvider: "local-private",
        mimeType: sanitized.mimeType,
        sha256: sanitized.sha256,
        width: sanitized.width,
        height: sanitized.height,
        sizeBytes: sanitized.sizeBytes,
      };
    } catch (err: unknown) {
      console.error(
        "[UploadService] Private local storage error:",
        err instanceof Error ? err.name : "UnknownError"
      );
      return {
        success: false,
        url: null,
        statusCode: 500,
        error: "Failed to persist uploaded image",
      };
    }
  }

  /**
   * Stores a user-uploaded background image privately (INV-014).
   */
  static async uploadBackgroundImage(
    file: File | Blob | Buffer | Uint8Array,
    filename = "background",
    userId: string | null = null
  ): Promise<StoredUploadResult> {
    void userId;
    return UploadService.uploadImage(file, filename, "backgrounds");
  }

  /**
   * Reads a locally stored private upload in non-production environments
   * after the caller has already verified Asset ownership.
   */
  static async readPrivateLocalObject(objectKey: string): Promise<Buffer | null> {
    if (!objectKey.startsWith(LOCAL_PRIVATE_PREFIX)) {
      return null;
    }
    const relativePart = objectKey.slice(LOCAL_PRIVATE_PREFIX.length);
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/.test(relativePart)) {
      return null;
    }
    const resolved = path.resolve(LOCAL_PRIVATE_ROOT, relativePart);
    if (!resolved.startsWith(LOCAL_PRIVATE_ROOT + path.sep)) {
      return null;
    }
    try {
      return await fs.readFile(resolved);
    } catch {
      return null;
    }
  }
}
