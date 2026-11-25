import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_WIDTH,
} from "@/lib/print/types";
import {
  adaptLegacyComposition,
  generatePrintMasterPng,
  injectPngPhysChunk300Dpi,
} from "@/lib/print-generator";
import {
  SecurityConfigError,
  TokenVerificationError,
  verifyDownloadToken,
} from "@/lib/security/tokens";
import { UploadService } from "@/lib/services/UploadService";

export const DownloadQuerySchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

export class DigitalDownloadHttpError extends Error {
  public readonly status: 400 | 401 | 403 | 404 | 422 | 503;

  constructor(
    status: 400 | 401 | 403 | 404 | 422 | 503,
    message: string
  ) {
    super(message);
    this.name = "DigitalDownloadHttpError";
    this.status = status;
  }
}

const ALLOWED_BLOB_HOST_SUFFIXES = [
  ".public.blob.vercel-storage.com",
  ".blob.vercel-storage.com",
];

const ALLOWED_BLOB_HOSTS = new Set<string>(["storage.thibut.com"]);

const LOCAL_PRIVATE_ROOT = path.resolve(process.cwd(), ".local-private-uploads");
const LOCAL_PRIVATE_PREFIX = "local-private://";

function isAllowedStoredAssetHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_BLOB_HOSTS.has(lower)) return true;
  return ALLOWED_BLOB_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

async function resolveStoredAssetBuffer(
  objectKey: string,
  storageProvider: string
): Promise<Buffer | null> {
  if (!objectKey || storageProvider === "memory") {
    return null;
  }

  const trimmed = objectKey.trim();
  let raw: Buffer | null = null;

  if (
    trimmed.startsWith(LOCAL_PRIVATE_PREFIX) ||
    storageProvider === "local-private"
  ) {
    raw = await UploadService.readPrivateLocalObject(trimmed);
  } else if (trimmed.startsWith("/")) {
    const publicRoot = path.resolve(process.cwd(), "public");
    const candidatePath = path.resolve(publicRoot, trimmed.slice(1));
    if (
      candidatePath.startsWith(publicRoot + path.sep) &&
      fs.existsSync(candidatePath) &&
      fs.statSync(candidatePath).isFile()
    ) {
      raw = fs.readFileSync(candidatePath);
    }
  } else if (trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const lowerHost = parsed.hostname.toLowerCase();
      if (parsed.protocol === "https:" && isAllowedStoredAssetHost(lowerHost)) {
        const headers: Record<string, string> = {};
        const blobToken =
          process.env.BLOB_READ_WRITE_TOKEN ||
          process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
        if (
          blobToken &&
          lowerHost.endsWith(".blob.vercel-storage.com") &&
          !lowerHost.endsWith(".public.blob.vercel-storage.com")
        ) {
          headers.Authorization = `Bearer ${blobToken}`;
        }
        const res = await fetch(parsed.toString(), {
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          raw = Buffer.from(await res.arrayBuffer());
        }
      }
    } catch {
      raw = null;
    }
  }

  if (!raw) {
    return null;
  }

  try {
    return injectPngPhysChunk300Dpi(raw);
  } catch {
    return null;
  }
}

async function storePrintMasterBytesPrivately(
  pngBuffer: Buffer,
  orderItemId: string
): Promise<{
  objectKey: string;
  storageProvider: "vercel-blob" | "local-private";
  sha256: string;
} | null> {
  const sha256 = crypto.createHash("sha256").update(pngBuffer).digest("hex");
  const safeItemId =
    orderItemId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48) || "item";
  const fileName = `master-${safeItemId}-${crypto.randomUUID()}.png`;

  const blobToken =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  if (blobToken) {
    try {
      const { put } = await import("@vercel/blob");
      const uploaded = await put(`print-masters/${fileName}`, pngBuffer, {
        access: "private",
        addRandomSuffix: true,
        contentType: "image/png",
        token: blobToken,
      });
      return {
        objectKey: uploaded.url,
        storageProvider: "vercel-blob",
        sha256,
      };
    } catch {
      if (process.env.NODE_ENV === "production") {
        return null;
      }
    }
  } else if (process.env.NODE_ENV === "production") {
    return null;
  }

  try {
    const targetDir = path.resolve(LOCAL_PRIVATE_ROOT, "print-masters");
    if (!targetDir.startsWith(LOCAL_PRIVATE_ROOT + path.sep)) {
      return null;
    }
    await fsp.mkdir(targetDir, { recursive: true });
    const targetPath = path.resolve(targetDir, fileName);
    if (!targetPath.startsWith(targetDir + path.sep)) {
      return null;
    }
    await fsp.writeFile(targetPath, pngBuffer);
    return {
      objectKey: `${LOCAL_PRIVATE_PREFIX}print-masters/${fileName}`,
      storageProvider: "local-private",
      sha256,
    };
  } catch {
    return null;
  }
}

export async function verifyDownloadRequestToken(
  rawToken: string | null
): Promise<{ orderItemId: string; orderId: string }> {
  const parsedQuery = DownloadQuerySchema.safeParse({ token: rawToken ?? "" });
  if (!parsedQuery.success) {
    throw new DigitalDownloadHttpError(400, "Missing download token");
  }

  try {
    return await verifyDownloadToken(parsedQuery.data.token);
  } catch (err: unknown) {
    if (err instanceof SecurityConfigError) {
      throw new DigitalDownloadHttpError(
        503,
        "Download verification is not configured"
      );
    }
    if (err instanceof TokenVerificationError) {
      throw new DigitalDownloadHttpError(
        401,
        "Invalid or expired download token"
      );
    }
    throw new DigitalDownloadHttpError(401, "Invalid download token");
  }
}

export async function resolveDigitalDownloadArtifact(claims: {
  orderItemId: string;
  orderId: string;
}): Promise<{ pngBuffer: Buffer; fileName: string }> {
  // Load strictly from OrderItem -> Order + frozen PersonalizationVersion (INV-003).
  // NEVER read mutable PersonalizationSession.compositionJson!
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: claims.orderItemId },
    include: {
      order: true,
      licenseGrant: true,
      personalizationVersion: {
        include: {
          printAsset: true,
        },
      },
    },
  });

  if (
    !orderItem ||
    !orderItem.order ||
    orderItem.order.id !== claims.orderId
  ) {
    throw new DigitalDownloadHttpError(404, "Order item not found");
  }

  const { order, personalizationVersion } = orderItem;
  const licenseGrant = (
    orderItem as unknown as {
      licenseGrant?: { revokedAt?: Date | null } | null;
    }
  ).licenseGrant;

  const allowedPaymentStatuses = new Set([
    "SUCCEEDED",
    "PARTIALLY_REFUNDED",
    "DISPUTED",
  ]);

  if (
    !allowedPaymentStatuses.has(order.paymentStatus) ||
    order.status === "PENDING_PAYMENT" ||
    order.status === "REFUNDED" ||
    order.status === "CANCELLED" ||
    Boolean(licenseGrant?.revokedAt)
  ) {
    throw new DigitalDownloadHttpError(
      403,
      "Order is not eligible for digital download"
    );
  }

  if (!personalizationVersion) {
    throw new DigitalDownloadHttpError(
      404,
      "Frozen personalization snapshot not found"
    );
  }

  let pngBuffer: Buffer | null = null;

  if (personalizationVersion.printAsset?.objectKey) {
    pngBuffer = await resolveStoredAssetBuffer(
      personalizationVersion.printAsset.objectKey,
      personalizationVersion.printAsset.storageProvider
    );
  }

  if (!pngBuffer) {
    let frozenComposition;
    try {
      frozenComposition = adaptLegacyComposition(
        personalizationVersion.styleSnapshot
      );
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        throw new DigitalDownloadHttpError(
          422,
          "Stored personalization snapshot is invalid"
        );
      }
      throw err;
    }

    pngBuffer = await generatePrintMasterPng(frozenComposition);

    const stored = await storePrintMasterBytesPrivately(
      pngBuffer,
      orderItem.id
    );

    const assetModel = (prisma as unknown as { asset?: { create?: unknown } })
      .asset;
    const pvModel = (
      prisma as unknown as { personalizationVersion?: { update?: unknown } }
    ).personalizationVersion;

    if (
      stored &&
      typeof assetModel?.create === "function" &&
      typeof pvModel?.update === "function"
    ) {
      try {
        const createdAsset = await prisma.asset.create({
          data: {
            objectKey: stored.objectKey,
            mimeType: "image/png",
            sha256: stored.sha256,
            width: PRINT_MASTER_WIDTH,
            height: PRINT_MASTER_HEIGHT,
            sizeBytes: pngBuffer.byteLength,
            storageProvider: stored.storageProvider,
            ownerId: order.buyerId ?? null,
            anonymousSessionId: order.buyerId
              ? null
              : (order.anonymousSessionId ?? null),
            visibility: "PRIVATE",
          },
        });

        const dvaModel = (
          prisma as unknown as {
            designVersionAsset?: { create?: unknown };
          }
        ).designVersionAsset;
        if (
          orderItem.designVersionId &&
          typeof dvaModel?.create === "function"
        ) {
          await prisma.designVersionAsset
            .create({
              data: {
                designVersionId: orderItem.designVersionId,
                assetId: createdAsset.id,
                type: "PRINT_MASTER",
              },
            })
            .catch(() => undefined);
        }

        await prisma.personalizationVersion.update({
          where: { id: personalizationVersion.id },
          data: { printAssetId: createdAsset.id },
        });
      } catch {
        // Best-effort cache write; still serve rendered Print Master to paid buyer
      }
    }
  }

  const safeOrderNumber = order.orderNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  return {
    pngBuffer,
    fileName: `ThiBut_Master_${safeOrderNumber}.png`,
  };
}
