import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CalligraphyService,
  ProviderLicenseError,
  ProviderUnavailableError,
} from "@/lib/calligraphy/CalligraphyService";
import { UnsupportedScriptError } from "@/lib/calligraphy/ScriptDetector";
import {
  FontLicenseError,
  FontNotFoundError,
} from "@/lib/fonts/FontRegistryService";
import { inngest } from "@/lib/inngest";
import prisma from "@/lib/prisma";
import {
  enforceRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";
import {
  ANON_SESSION_COOKIE,
  SecurityConfigError,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import {
  CreatorPolicyViolationError,
  PolicyGuard,
} from "@/lib/services/PolicyGuard";
import { createClient } from "@/utils/supabase/server";

const CompositionOptionValues = [
  "Vertical",
  "Horizontal",
  "Centered",
  "LeftChest",
  "Emblem",
  "FullBack",
] as const;

const ProviderIdValues = [
  "deterministic-brush-v1",
  "structure-guided-ai-v1",
  "calliffusion-v2-candidate",
] as const;

/**
 * Strict generation payload schema (T-105, T-401, TB-CALLI-001).
 * Rejects any client-supplied `selectedInterpretation`, `inputText`, or `authoritativeText`.
 */
const GenerateRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    interpretationId: z.string().uuid(),
    stylePack: z.string().trim().min(1).max(80),
    composition: z.enum(CompositionOptionValues).default("Horizontal"),
    providerId: z.enum(ProviderIdValues).optional(),
    designId: z.string().uuid().optional(),
    creatorArtworkUrl: z.string().url().optional(),
    asyncQueue: z.boolean().optional().default(false),
    aiRestyle: z.boolean().optional(),
    recolor: z.boolean().optional(),
    crop: z.boolean().optional(),
    removeBackground: z.boolean().optional(),
    commercialUse: z.boolean().optional(),
    modelTraining: z.boolean().optional(),
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

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIpFromHeaders(req.headers);
    enforceRateLimit({
      bucket: "personalization-generate-ip",
      key: clientIp,
      limit: 20,
      windowMs: 60_000,
    });

    const userId = await resolveAuthenticatedDbUserId();
    let anonymousSessionId: string | null = null;

    if (!userId) {
      const existingAnonToken = await getCookieValue(req, ANON_SESSION_COOKIE);
      if (!existingAnonToken) {
        return NextResponse.json(
          { error: "Authentication or valid studio session required" },
          { status: 401 }
        );
      }
      const verifiedAnonId = await verifyAnonSessionToken(existingAnonToken);
      if (!verifiedAnonId) {
        return NextResponse.json(
          { error: "Invalid or expired anonymous session" },
          { status: 401 }
        );
      }
      anonymousSessionId = verifiedAnonId;
    }

    const actorKey = userId ?? `anon:${anonymousSessionId}`;
    enforceRateLimit({
      bucket: "personalization-generate-actor",
      key: actorKey,
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
    const input = parsedBody.data;

    // 1. Load PersonalizationSession strictly by UUID and verify caller ownership (T-401)
    const session = await prisma.personalizationSession.findUnique({
      where: { id: input.sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Personalization session not found" },
        { status: 404 }
      );
    }

    const ownsSession = session.userId
      ? userId !== null && session.userId === userId
      : Boolean(
          session.anonymousSessionId &&
            anonymousSessionId &&
            session.anonymousSessionId === anonymousSessionId
        );

    if (!ownsSession) {
      return NextResponse.json(
        { error: "Forbidden: session belongs to a different caller" },
        { status: 403 }
      );
    }

    if (
      input.designId &&
      session.designId &&
      input.designId !== session.designId
    ) {
      return NextResponse.json(
        { error: "Requested designId conflicts with session designId" },
        { status: 400 }
      );
    }

    const effectiveDesignId = input.designId ?? session.designId ?? null;

    // 2. Enforce Creator Policy Guard (T-409, INV-010, INV-012)
    await PolicyGuard.enforcePersonalizationContext({
      designId: effectiveDesignId,
      mode: session.mode,
      textTreatment: session.textTreatment ?? undefined,
      hasCalligraphy: true,
      aiRestyle: Boolean(input.aiRestyle || input.creatorArtworkUrl),
      derivative: Boolean(input.aiRestyle || input.creatorArtworkUrl),
      recolor: input.recolor,
      crop: input.crop,
      removeBackground: input.removeBackground,
      commercialUse: input.commercialUse,
      modelTraining: input.modelTraining,
    });

    // 3. Load Authoritative Interpretation from DB (TB-CALLI-001 — NEVER trust client text)
    const interpretation = await prisma.interpretation.findUnique({
      where: { id: input.interpretationId },
    });

    if (!interpretation || interpretation.sessionId !== session.id) {
      return NextResponse.json(
        { error: "Authoritative interpretation not found for session" },
        { status: 404 }
      );
    }

    // 4. Async Inngest Queue Path (when requested and INNGEST_EVENT_KEY is configured)
    if (input.asyncQueue && Boolean(process.env.INNGEST_EVENT_KEY)) {
      const sendResult = await inngest.send({
        name: "personalization/requested",
        data: {
          sessionId: session.id,
          interpretationId: interpretation.id,
          designId: effectiveDesignId ?? undefined,
          stylePack: input.stylePack,
          composition: input.composition,
          creatorArtworkUrl: input.creatorArtworkUrl,
          aiRestyle: Boolean(input.aiRestyle || input.creatorArtworkUrl),
        },
      });

      await prisma.personalizationSession.update({
        where: { id: session.id },
        data: {
          selectedInterpretationId: interpretation.id,
          status: "GENERATING",
        },
      });

      const eventIds =
        typeof sendResult === "object" &&
        sendResult !== null &&
        "ids" in sendResult &&
        Array.isArray((sendResult as { ids?: unknown }).ids)
          ? ((sendResult as { ids: string[] }).ids ?? [])
          : [];

      return NextResponse.json(
        {
          queued: true,
          sessionId: session.id,
          interpretationId: interpretation.id,
          eventIds,
          message: "Generation job queued successfully",
        },
        { status: 202 }
      );
    }

    // 5. Resolve existing server-verified PhraseKnowledge ID (NEVER store client text!)
    const existingKnowledge = await prisma.phraseKnowledge.findFirst({
      where: {
        normalizedInput: CulturalKnowledgeService.normalizeInput(
          session.inputText
        ),
        targetLanguage: interpretation.language,
        interpretationType: interpretation.type,
        renderedText: interpretation.text,
      },
      select: { id: true },
    });

    const phraseKnowledgeId = existingKnowledge?.id ?? interpretation.id;

    // 6. Controlled Calligraphy Rendering Pipeline
    const renderResult = await CalligraphyService.renderCalligraphy({
      phraseKnowledgeId,
      authoritativeText: interpretation.text,
      targetLanguage: interpretation.language,
      stylePackId: input.stylePack,
      orientationPreference:
        input.composition === "Vertical" ? "VERTICAL" : "HORIZONTAL",
      variationCount: 6,
      providerId: input.providerId,
    });

    await prisma.personalizationSession.update({
      where: { id: session.id },
      data: {
        selectedInterpretationId: interpretation.id,
        status: "READY",
      },
    });

    const candidates = renderResult.candidates.map((c, i) => ({
      id: c.id,
      index: i + 1,
      imageUrl: c.previewAssetUrl,
      stylePack: c.stylePackId,
      variationType: c.variationType,
      variationName: c.variationName,
      variationNote: c.variationNote,
      provider: c.provider,
      modelVersion: c.modelVersion,
      seed: c.seed,
      validationStatus: c.validationStatus,
    }));

    return NextResponse.json({
      sessionId: session.id,
      interpretationId: interpretation.id,
      rendererVersion: renderResult.rendererVersion,
      script: renderResult.script,
      candidates,
      cacheHit: renderResult.cacheHit,
      durationMs: renderResult.durationMs,
      message: "Candidates generated via Controlled Calligraphy Renderer",
    });
  } catch (err: unknown) {
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
