import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { assertAdminApi } from "@/utils/admin/auth";
import {
  ANON_SESSION_COOKIE,
  SecurityConfigError,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import {
  enforceRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import {
  MAX_UPLOAD_BYTES,
  UploadService,
} from "@/lib/services/UploadService";

const ANON_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;
const AssetIdQuerySchema = z.string().trim().min(1).max(128);

function readCookieFromRequestHeader(
  request: Request,
  cookieName: string
): string | undefined {
  const rawHeader = request.headers.get("cookie");
  if (!rawHeader) return undefined;
  for (const part of rawHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === cookieName) {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    }
  }
  return undefined;
}

async function getCookieValue(
  request: Request,
  cookieName: string
): Promise<string | undefined> {
  const fromHeader = readCookieFromRequestHeader(request, cookieName);
  if (fromHeader !== undefined) {
    return fromHeader;
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(cookieName)?.value;
  } catch {
    return undefined;
  }
}

async function resolveAuthenticatedDbUserId(): Promise<string | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
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

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromHeaders(request.headers);
    enforceRateLimit({
      bucket: "upload-background-ip",
      key: clientIp,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const ownerId = await resolveAuthenticatedDbUserId();
    let anonymousSessionId: string | null = null;
    let newlyIssuedAnonToken: string | null = null;

    if (!ownerId) {
      const existingAnonToken = await getCookieValue(request, ANON_SESSION_COOKIE);
      if (existingAnonToken !== undefined) {
        const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
        if (!verifiedAnonId) {
          return NextResponse.json(
            { error: "Invalid or expired anonymous session" },
            { status: 401 }
          );
        }
        anonymousSessionId = verifiedAnonId;
      } else {
        const minted = await signAnonSessionToken(undefined, ANON_COOKIE_TTL_SECONDS);
        anonymousSessionId = minted.anonId;
        newlyIssuedAnonToken = minted.token;
      }
    }

    const actorKey = ownerId ?? `anon:${anonymousSessionId}`;
    enforceRateLimit({
      bucket: "upload-background-actor",
      key: actorKey,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof Blob) || fileEntry.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (fileEntry.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10MB size limit" },
        { status: 400 }
      );
    }

    const originalName = fileEntry instanceof File ? fileEntry.name : "background";
    const result = await UploadService.uploadBackgroundImage(
      fileEntry,
      originalName,
      ownerId
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
          ? result.error ?? "Invalid image file"
          : "Failed to store uploaded image";
      return NextResponse.json({ error: safeError }, { status });
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
        ownerId,
        anonymousSessionId: ownerId ? null : anonymousSessionId,
        visibility: "PRIVATE",
      },
    });

    const response = NextResponse.json({
      success: true,
      assetId: asset.id,
      url: `/api/uploads/background?assetId=${encodeURIComponent(asset.id)}`,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
    });

    if (newlyIssuedAnonToken) {
      response.cookies.set(ANON_SESSION_COOKIE, newlyIssuedAnonToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ANON_COOKIE_TTL_SECONDS,
        path: "/",
      });
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many upload requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    if (error instanceof SecurityConfigError) {
      console.error("[UploadBackground] Security configuration error");
      return NextResponse.json(
        { error: "Upload authentication unavailable" },
        { status: 503 }
      );
    }

    console.error(
      "[UploadBackground] Unexpected error:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to process image upload" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedId = AssetIdQuerySchema.safeParse(searchParams.get("assetId"));
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({
      where: { id: parsedId.data },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const currentUserId = await resolveAuthenticatedDbUserId();
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let payloadBytes: Uint8Array | null = null;

    if (asset.storageProvider === "local-private") {
      const localBuffer = await UploadService.readPrivateLocalObject(asset.objectKey);
      if (localBuffer) {
        payloadBytes = new Uint8Array(localBuffer);
      }
    } else if (asset.storageProvider === "vercel-blob") {
      const blobToken =
        process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        const upstream = await fetch(asset.objectKey, {
          headers: { Authorization: `Bearer ${blobToken}` },
        });
        if (upstream.ok) {
          payloadBytes = new Uint8Array(await upstream.arrayBuffer());
        }
      }
    }

    if (!payloadBytes) {
      return NextResponse.json({ error: "Asset unavailable" }, { status: 404 });
    }

    const bodyCopy = new Uint8Array(payloadBytes.byteLength);
    bodyCopy.set(payloadBytes);

    return new NextResponse(bodyCopy.buffer, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bodyCopy.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error: unknown) {
    console.error(
      "[UploadBackground GET] Error:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to retrieve asset" },
      { status: 500 }
    );
  }
}
