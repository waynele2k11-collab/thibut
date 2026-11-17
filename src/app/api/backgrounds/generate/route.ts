import { NextResponse } from "next/server";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { SecurityConfigError } from "@/lib/security/tokens";
import {
  BackgroundGenerateSchema,
  BackgroundRouteHttpError,
  executeBackgroundGeneration,
  resolveBackgroundCaller,
} from "@/lib/services/BackgroundRouteService";
import { CreatorPolicyViolationError } from "@/lib/services/PolicyGuard";
import { attachAnonCookieIfNeeded } from "@/lib/services/personalization/sessionAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromHeaders(request.headers);
    await enforceDistributedRateLimit({
      bucket: "background-generate-ip",
      key: clientIp,
      limit: 12,
      windowMs: 10 * 60_000,
    });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const parsedBody = BackgroundGenerateSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid background generation request" },
        { status: 400 }
      );
    }
    const input = parsedBody.data;

    const caller = await resolveBackgroundCaller(request, input.compositionId);

    await enforceDistributedRateLimit({
      bucket: "background-generate-actor",
      key: caller.actorKey,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    const payload = await executeBackgroundGeneration(input, caller);
    return attachAnonCookieIfNeeded(
      NextResponse.json(payload),
      caller.newlyIssuedAnonToken
    );
  } catch (error: unknown) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error:
            "Too many background generation requests. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }

    if (error instanceof BackgroundRouteHttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof CreatorPolicyViolationError) {
      return NextResponse.json(
        { error: error.message, permission: error.permission },
        { status: error.status }
      );
    }

    if (error instanceof SecurityConfigError) {
      console.error("[/api/backgrounds/generate] Security configuration error");
      return NextResponse.json(
        { error: "Session authentication unavailable" },
        { status: 503 }
      );
    }

    console.error(
      "[/api/backgrounds/generate] Unexpected error:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to generate background" },
      { status: 500 }
    );
  }
}
