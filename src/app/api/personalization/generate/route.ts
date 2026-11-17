import { NextRequest, NextResponse } from "next/server";
import {
  ProviderLicenseError,
  ProviderUnavailableError,
} from "@/lib/calligraphy/CalligraphyService";
import { UnsupportedScriptError } from "@/lib/calligraphy/ScriptDetector";
import {
  FontLicenseError,
  FontNotFoundError,
} from "@/lib/fonts/FontRegistryService";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import { SecurityConfigError } from "@/lib/security/tokens";
import { CreatorPolicyViolationError } from "@/lib/services/PolicyGuard";
import {
  executePersonalizationGenerate,
  GenerateRequestSchema,
  PersonalizationGenerateHttpError,
} from "@/lib/services/personalization/generateService";
import {
  PersonalizationAuthError,
  requireStudioCaller,
} from "@/lib/services/personalization/sessionAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const caller = await requireStudioCaller(req);

    const clientIp = getClientIpFromHeaders(
      req.headers,
      caller.userId ?? caller.anonymousSessionId
    );
    await enforceDistributedRateLimit({
      bucket: "personalization-generate-ip",
      key: clientIp,
      limit: 20,
      windowMs: 60_000,
    });

    await enforceDistributedRateLimit({
      bucket: "personalization-generate-actor",
      key: caller.actorKey,
      limit: 15,
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

    const parsedBody = GenerateRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid personalization generation request" },
        { status: 400 }
      );
    }

    const result = await executePersonalizationGenerate(
      parsedBody.data,
      caller
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (err: unknown) {
    if (err instanceof PersonalizationAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof PersonalizationGenerateHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many generation requests. Please try again shortly." },
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

    if (err instanceof ProviderLicenseError) {
      return NextResponse.json(
        { error: "Requested calligraphy provider is not commercially licensed" },
        { status: err.status }
      );
    }

    if (err instanceof FontLicenseError) {
      return NextResponse.json(
        { error: "Requested calligraphy font is not commercially licensed" },
        { status: 403 }
      );
    }

    if (err instanceof UnsupportedScriptError) {
      return NextResponse.json(
        { error: "Unsupported script for calligraphy rendering" },
        { status: 400 }
      );
    }

    if (err instanceof FontNotFoundError) {
      return NextResponse.json(
        { error: "Requested calligraphy font was not found" },
        { status: 404 }
      );
    }

    if (
      err instanceof ProviderUnavailableError ||
      err instanceof SecurityConfigError
    ) {
      return NextResponse.json(
        { error: "Calligraphy generation service temporarily unavailable" },
        { status: 503 }
      );
    }

    console.error(
      "[/api/personalization/generate] Unexpected error:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to generate calligraphy candidates" },
      { status: 500 }
    );
  }
}
