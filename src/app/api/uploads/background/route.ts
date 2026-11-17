import { NextResponse } from "next/server";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { SecurityConfigError } from "@/lib/security/tokens";
import {
  BackgroundUploadHttpError,
  processBackgroundUploadFormData,
  resolveBackgroundUploadCaller,
  retrieveAuthorizedBackgroundAsset,
} from "@/lib/services/BackgroundUploadRouteService";
import { attachAnonCookieIfNeeded } from "@/lib/services/personalization/sessionAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromHeaders(request.headers);
    await enforceDistributedRateLimit({
      bucket: "upload-background-ip",
      key: clientIp,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const caller = await resolveBackgroundUploadCaller(request);

    await enforceDistributedRateLimit({
      bucket: "upload-background-actor",
      key: caller.actorKey,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const formData = await request.formData();
    const payload = await processBackgroundUploadFormData(formData, caller);

    return attachAnonCookieIfNeeded(
      NextResponse.json(payload),
      caller.newlyIssuedAnonToken
    );
  } catch (error: unknown) {
    if (error instanceof BackgroundUploadHttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

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
    const { buffer, byteLength, mimeType } =
      await retrieveAuthorizedBackgroundAsset(request);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error: unknown) {
    if (error instanceof BackgroundUploadHttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

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
