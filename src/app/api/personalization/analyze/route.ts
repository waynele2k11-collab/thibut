import { NextRequest, NextResponse } from "next/server";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { SecurityConfigError } from "@/lib/security/tokens";
import { CreatorPolicyViolationError } from "@/lib/services/PolicyGuard";
import {
  AnalyzeRequestSchema,
  executePersonalizationAnalyze,
} from "@/lib/services/personalization/analyzeService";
import {
  attachAnonCookieIfNeeded,
  PersonalizationAuthError,
  resolveOrMintAnonSession,
} from "@/lib/services/personalization/sessionAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveOrMintAnonSession({
      request: req,
      onBeforeMint: async () => {
        const preMintIp = getClientIpFromHeaders(req.headers);
        await enforceDistributedRateLimit({
          bucket: "personalization-analyze-ip",
          key: preMintIp,
          limit: 30,
          windowMs: 60_000,
        });
      },
    });

    if (!caller.newlyIssuedAnonToken) {
      const clientIp = getClientIpFromHeaders(
        req.headers,
        caller.userId ?? caller.anonymousSessionId
      );
      await enforceDistributedRateLimit({
        bucket: "personalization-analyze-ip",
        key: clientIp,
        limit: 30,
        windowMs: 60_000,
      });
    }

    await enforceDistributedRateLimit({
      bucket: "personalization-analyze-actor",
      key: caller.actorKey,
      limit: 25,
      windowMs: 60_000,
    });

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const parsedBody = AnalyzeRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid personalization analyze request" },
        { status: 400 }
      );
    }

    const result = await executePersonalizationAnalyze(parsedBody.data, caller);
    return attachAnonCookieIfNeeded(
      NextResponse.json(result),
      caller.newlyIssuedAnonToken
    );
  } catch (err: unknown) {
    if (err instanceof PersonalizationAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many analysis requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }

    if (err instanceof CreatorPolicyViolationError) {
      return NextResponse.json(
        { error: err.message, permission: err.permission },
        { status: err.status }
      );
    }

    if (err instanceof SecurityConfigError) {
      console.error(
        "[/api/personalization/analyze] Security configuration error"
      );
      return NextResponse.json(
        { error: "Session authentication unavailable" },
        { status: 503 }
      );
    }

    console.error(
      "[/api/personalization/analyze] Unexpected error:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to analyze personalization input" },
      { status: 500 }
    );
  }
}
