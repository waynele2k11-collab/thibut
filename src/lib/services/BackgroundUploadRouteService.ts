import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import {
  MAX_UPLOAD_BYTES,
  UploadService,
} from "@/lib/services/UploadService";
import {
  ANON_COOKIE_TTL_SECONDS,
  getCookieValue,
} from "@/lib/services/personalization/sessionAuth";
import { assertAdminApi } from "@/utils/admin/auth";
import { getSessionUser } from "@/lib/auth/session";

const AssetIdQuerySchema = z.string().trim().min(1).max(128);

export class BackgroundUploadHttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BackgroundUploadHttpError";
    this.status = status;
  }
}

async function resolveUploadDbUserId(): Promise<string | null> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return null;
    }

    const byId = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (byId) return byId.id;

    if (user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }

    return null;
  } catch {
    return null;
  }
}

export interface BackgroundUploadCaller {
  ownerId: string | null;
  anonymousSessionId: string | null;
  newlyIssuedAnonToken: string | null;
  actorKey: string;
}

export async function resolveBackgroundUploadCaller(
  request: Request
): Promise<BackgroundUploadCaller> {
  const ownerId = await resolveUploadDbUserId();
  let anonymousSessionId: string | null = null;
  let newlyIssuedAnonToken: string | null = null;

  if (!ownerId) {
    const existingAnonToken = await getCookieValue(request, ANON_SESSION_COOKIE);
    if (existingAnonToken !== undefined) {
      const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
      if (!verifiedAnonId) {
        throw new BackgroundUploadHttpError(
          401,
          "Invalid or expired anonymous session"
        );
      }
      anonymousSessionId = verifiedAnonId;
    } else {
      const minted = await signAnonSessionToken(
        undefined,
        ANON_COOKIE_TTL_SECONDS
      );
      anonymousSessionId = minted.anonId;
      newlyIssuedAnonToken = minted.token;
    }
  }

  return {
    ownerId,
    anonymousSessionId,
    newlyIssuedAnonToken,
    actorKey: ownerId ?? `anon:${anonymousSessionId}`,
  };
}

export async function processBackgroundUploadFormData(
  formData: FormData,
  caller: { ownerId: string | null; anonymousSessionId: string | null }
) {
  const fileEntry = formData.get("file");

  if (!(fileEntry instanceof Blob) || fileEntry.size === 0) {
    throw new BackgroundUploadHttpError(400, "No file provided");
  }

  if (fileEntry.size > MAX_UPLOAD_BYTES) {
    throw new BackgroundUploadHttpError(400, "File exceeds 10MB size limit");
  }

  const originalName =
    fileEntry instanceof File ? fileEntry.name : "background";
  const result = await UploadService.uploadBackgroundImage(
    fileEntry,
    originalName,
    caller.ownerId
  );

  if (
    !result.success ||
    !result.objectKey ||
    !result.mimeType ||
    !result.sha256 ||
    !result.storageProvider
  ) {
    const status = result.statusCode ?? 500;
    const safeError =
      status === 400
        ? (result.error ?? "Invalid image file")
        : "Failed to store uploaded image";
    throw new BackgroundUploadHttpError(status, safeError);
  }

  const asset = await prisma.asset.create({
    data: {
      objectKey: result.objectKey,
      mimeType: result.mimeType,
      sha256: result.sha256,
      width: result.width ?? null,
      height: result.height ?? null,
      sizeBytes: result.sizeBytes ?? null,
      storageProvider: result.storageProvider,
      ownerId: caller.ownerId,
      anonymousSessionId: caller.ownerId ? null : caller.anonymousSessionId,
      visibility: "PRIVATE",
    },
  });

  return {
    success: true,
    assetId: asset.id,
    url: `/api/uploads/background?assetId=${encodeURIComponent(asset.id)}`,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
  };
}

export async function retrieveAuthorizedBackgroundAsset(request: Request): Promise<{
  buffer: ArrayBuffer;
  byteLength: number;
  mimeType: string;
}> {
  const { searchParams } = new URL(request.url);
  const parsedId = AssetIdQuerySchema.safeParse(searchParams.get("assetId"));
  if (!parsedId.success) {
    throw new BackgroundUploadHttpError(400, "Invalid asset ID");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: parsedId.data },
  });

  if (!asset) {
    throw new BackgroundUploadHttpError(404, "Asset not found");
  }

  const currentUserId = await resolveUploadDbUserId();
  const rawAnonCookie = await getCookieValue(request, ANON_SESSION_COOKIE);
  const verifiedAnonId = rawAnonCookie
    ? await verifyAnonSessionToken(rawAnonCookie)
    : null;

  let authorized = false;
  if (asset.visibility === "PUBLIC") {
    authorized = true;
  } else if (asset.ownerId && currentUserId === asset.ownerId) {
    authorized = true;
  } else if (
    !asset.ownerId &&
    asset.anonymousSessionId &&
    verifiedAnonId === asset.anonymousSessionId
  ) {
    authorized = true;
  } else {
    try {
      await assertAdminApi();
      authorized = true;
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    throw new BackgroundUploadHttpError(403, "Forbidden");
  }

  let payloadBytes: Uint8Array | null = null;

  if (
    asset.storageProvider === "local-private" ||
    asset.objectKey.startsWith("local-private://")
  ) {
    const localBuffer = await UploadService.readPrivateLocalObject(
      asset.objectKey
    );
    if (localBuffer) {
      payloadBytes = new Uint8Array(localBuffer);
    }
  } else if (asset.storageProvider === "vercel-blob") {
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(asset.objectKey);
    } catch {
      parsedUrl = null;
    }
    if (
      parsedUrl &&
      parsedUrl.protocol === "https:" &&
      parsedUrl.hostname.toLowerCase().endsWith(".blob.vercel-storage.com")
    ) {
      const lowerHost = parsedUrl.hostname.toLowerCase();
      const blobToken =
        process.env.BLOB_READ_WRITE_TOKEN ||
        process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
      const headers: Record<string, string> = {};
      if (blobToken && !lowerHost.endsWith(".public.blob.vercel-storage.com")) {
        headers.Authorization = `Bearer ${blobToken}`;
      }
      const upstream = await fetch(parsedUrl.toString(), {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (upstream.ok) {
        payloadBytes = new Uint8Array(await upstream.arrayBuffer());
      }
    }
  }

  if (!payloadBytes) {
    throw new BackgroundUploadHttpError(404, "Asset unavailable");
  }

  const bodyCopy = new Uint8Array(payloadBytes.byteLength);
  bodyCopy.set(payloadBytes);

  return {
    buffer: bodyCopy.buffer,
    byteLength: bodyCopy.byteLength,
    mimeType: asset.mimeType,
  };
}
