/**
 * POST /api/personalization/detect-language
 *
 * Fast lightweight language detection for Step 1 input fields.
 * Uses deterministic script heuristics first, Gemini (15s timeout + Zod schema) as fallback.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { SecurityConfigError } from "@/lib/security/tokens";
import { CreatorPolicyViolationError } from "@/lib/services/PolicyGuard";
import {
  DetectLanguageRequestSchema,
  executeDetectLanguage,
} from "@/lib/services/personalization/detectLanguageService";
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
          bucket: "detect-language-ip",
          key: preMintIp,
          limit: 40,
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
        bucket: "detect-language-ip",
        key: clientIp,
        limit: 40,
        windowMs: 60_000,
      });
    }

    await enforceDistributedRateLimit({
      bucket: "detect-language-actor",
      key: caller.actorKey,
      limit: 35,
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

    const parsedBody = DetectLanguageRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await executeDetectLanguage(parsedBody.data);
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
        {
          error:
            "Too many language detection requests. Please try again shortly.",
        },
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
      console.error("[detect-language] Security configuration error");
      return NextResponse.json(
        { error: "Session authentication unavailable" },
        { status: 503 }
      );
    }

    console.error(
      "[detect-language] Unexpected error:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to detect language" },
      { status: 500 }
    );
  }
}
