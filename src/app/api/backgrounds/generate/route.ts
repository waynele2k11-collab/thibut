import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  enforceRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import {
  ANON_SESSION_COOKIE,
  SecurityConfigError,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import {
  BackgroundGenerationService,
  sanitizeBackgroundUserNote,
} from "@/lib/services/BackgroundGenerationService";
import {
  CreatorPolicyViolationError,
  PolicyGuard,
} from "@/lib/services/PolicyGuard";
import { createClient } from "@/utils/supabase/server";

const ANON_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

const MoodValues = [
  "Calm",
  "Mysterious",
  "Spiritual",
  "Dramatic",
  "Warm",
  "Serene",
  "Bold",
  "Minimal",
] as const;

const PaletteValues = [
  "Ivory / Ink",
  "Beige / Black",
  "Soft Gold",
  "Neutral",
  "Warm Ivory",
  "Sumi Wash",
  "Crimson / Ivory",
  "Charcoal / Gold",
] as const;

const IntensityValues = [
  "Minimal",
  "Subtle",
  "Medium",
  "Rich",
  "Strong",
] as const;

const BackgroundGenerateSchema = z
  .object({
    presetKey: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/i, "Invalid preset key"),
    mood: z.enum(MoodValues).optional(),
    palette: z.enum(PaletteValues).optional(),
    intensity: z.enum(IntensityValues).optional(),
    userNote: z.string().max(160).optional(),
    compositionId: z.string().uuid().optional(),
    designId: z.string().uuid().optional(),
  })
  .strict();

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
      select: { id: true, status: true },
    });
    if (byId && (!byId.status || byId.status === "ACTIVE")) {
      return byId.id;
    }

    if (user.email) {
      const byEmail = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, status: true },
      });
      if (byEmail && (!byEmail.status || byEmail.status === "ACTIVE")) {
        return byEmail.id;
      }
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

    const userId = await resolveAuthenticatedDbUserId();
    let anonymousSessionId: string | null = null;
    let newlyIssuedAnonToken: string | null = null;

    if (!userId) {
      const existingAnonToken = await getCookieValue(
        request,
        ANON_SESSION_COOKIE
      );
      if (existingAnonToken !== undefined) {
        const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
        if (!verifiedAnonId) {
          return NextResponse.json(
            { error: "Invalid or expired anonymous session" },
            { status: 401 }
          );
        }
        anonymousSessionId = verifiedAnonId;
      } else if (input.compositionId) {
        return NextResponse.json(
          { error: "Authentication or valid studio session required" },
          { status: 401 }
        );
      } else {
        const minted = await signAnonSessionToken(
          undefined,
          ANON_COOKIE_TTL_SECONDS
        );
        anonymousSessionId = minted.anonId;
        newlyIssuedAnonToken = minted.token;
      }
    }

    const actorKey = userId ?? `anon:${anonymousSessionId}`;
    enforceRateLimit({
      bucket: "background-generate-actor",
      key: actorKey,
      limit: 10,
      windowMs: 10 * 60_000,
    });

    let compositionDesignId: string | null = null;

    // Verify ownership of compositionId before generating/attaching background (T-401)
    if (input.compositionId) {
      const composition = await prisma.userComposition.findUnique({
        where: { id: input.compositionId },
        include: { session: true },
      });

      if (!composition) {
        return NextResponse.json(
          { error: "Composition not found" },
          { status: 404 }
        );
      }

      const ownsComposition = composition.userId
        ? userId !== null && composition.userId === userId
        : composition.session?.userId
          ? userId !== null && composition.session.userId === userId
          : Boolean(
              composition.session?.anonymousSessionId &&
                anonymousSessionId &&
                composition.session.anonymousSessionId === anonymousSessionId
            );

      if (!ownsComposition) {
        return NextResponse.json(
          { error: "Forbidden: composition belongs to a different caller" },
          { status: 403 }
        );
      }

      compositionDesignId = composition.session?.designId ?? null;
    }

    const effectiveDesignId = input.designId ?? compositionDesignId;
    if (effectiveDesignId) {
      await PolicyGuard.enforcePersonalizationContext({
        designId: effectiveDesignId,
        derivative: true,
      });
    }

    const safePromptNote = sanitizeBackgroundUserNote(input.userNote);

    const result = await BackgroundGenerationService.generatePresetBackground({
      presetKey: input.presetKey,
      mood: input.mood,
      palette: input.palette,
      intensity: input.intensity,
      userNote: safePromptNote || undefined,
      compositionId: input.compositionId,
    });

    if (result.errorCode === "PRESET_NOT_FOUND") {
      return NextResponse.json(
        { error: "Background preset not found or disabled" },
        { status: 404 }
      );
    }

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: "Failed to generate background scene" },
        { status: 502 }
      );
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(result.url, "utf8")
      .digest("hex");

    const asset = await prisma.asset.create({
      data: {
        objectKey: result.url,
        mimeType: "image/jpeg",
        sha256,
        storageProvider: "fal-ai",
        ownerId: userId,
        anonymousSessionId: userId ? null : anonymousSessionId,
        visibility: "PRIVATE",
      },
    });

    const generatedBg = await prisma.generatedBackground.create({
      data: {
        compositionId: input.compositionId ?? null,
        presetKey: input.presetKey,
        mood: input.mood ?? null,
        palette: input.palette ?? null,
        intensity: input.intensity ?? null,
        promptNote: safePromptNote || null,
        provider: "fal-ai",
        model: "flux/schnell",
        assetId: asset.id,
      },
    });

    if (input.compositionId) {
      await prisma.userComposition.update({
        where: { id: input.compositionId },
        data: {
          backgroundSourceType: "GENERATED",
          backgroundAssetId: asset.id,
        },
      });
    }

    const response = NextResponse.json({
      success: true,
      url: result.url,
      generatedBackgroundId: generatedBg.id,
      assetId: asset.id,
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
        { error: "Too many background generation requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
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
