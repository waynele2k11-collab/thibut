import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { InterpretationType } from "@prisma/client";
import { z } from "zod";
import {
  interpretationEngine,
  type InterpretationContext,
} from "@/lib/ai/InterpretationEngine";
import {
  culturalIntelligence,
  InterpretationTypeValues,
  type CulturalInterpretationType,
  type SupportedTargetLanguage,
} from "@/lib/ai/cultural-provider";
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
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import {
  CreatorPolicyViolationError,
  PolicyGuard,
} from "@/lib/services/PolicyGuard";
import { createClient } from "@/utils/supabase/server";

const ANON_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30;

const AnalyzeRequestSchema = z
  .object({
    inputText: z.string().trim().min(1).max(500),
    culturalStyle: z.enum([
      "VIETNAMESE_THU_PHAP",
      "JAPANESE_SHODO",
      "CHINESE_CALLIGRAPHY",
      "KOREAN_BRUSH",
    ]),
    textTreatment: z.enum(["KEEP_ORIGINAL", "TRANSLATE", "PHONETIC"]),
    mode: z.enum(["NAME", "QUOTE", "STORY", "CREATOR_ART"]),
    detectedInputLanguage: z.string().trim().min(1).max(64).optional(),
    designId: z.string().uuid().optional(),
    designVersionId: z.string().uuid().optional(),
  })
  .strict();

type AnalyzeInput = z.infer<typeof AnalyzeRequestSchema>;

interface PreparedInterpretation {
  type: InterpretationType;
  language: string;
  text: string;
  romanization?: string | null;
  meaning?: string | null;
  confidence?: number | null;
  warning?: string | null;
  recommended: boolean;
}

const STYLE_TO_LANG: Readonly<
  Record<AnalyzeInput["culturalStyle"], SupportedTargetLanguage>
> = {
  VIETNAMESE_THU_PHAP: "Vietnamese",
  JAPANESE_SHODO: "Japanese",
  CHINESE_CALLIGRAPHY: "Chinese",
  KOREAN_BRUSH: "Korean",
};

const PHONETIC_TYPES: ReadonlySet<InterpretationType> = new Set([
  "PHONETIC",
  "TRANSLITERATION",
  "SCRIPT_ADAPTATION",
  "SINO_VIETNAMESE",
]);

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

function attachAnonCookieIfNeeded(
  response: NextResponse,
  token: string | null
): NextResponse {
  if (token) {
    response.cookies.set(ANON_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ANON_COOKIE_TTL_SECONDS,
      path: "/",
    });
  }
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIpFromHeaders(req.headers);
    enforceRateLimit({
      bucket: "personalization-analyze-ip",
      key: clientIp,
      limit: 30,
      windowMs: 60_000,
    });

    const userId = await resolveAuthenticatedDbUserId();
    let anonymousSessionId: string | null = null;
    let newlyIssuedAnonToken: string | null = null;

    if (!userId) {
      const existingAnonToken = await getCookieValue(req, ANON_SESSION_COOKIE);
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
      bucket: "personalization-analyze-actor",
      key: actorKey,
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
    const input = parsedBody.data;

    // Enforce creator artwork permission policy when designId is attached (T-409, INV-010, INV-012)
    await PolicyGuard.enforcePersonalizationContext({
      designId: input.designId,
      mode: input.mode,
      textTreatment: input.textTreatment,
      hasCalligraphy: true,
    });

    const inputType = interpretationEngine.classifyInput(input.inputText);
    const targetLang = STYLE_TO_LANG[input.culturalStyle];
    let detectedLanguage = input.detectedInputLanguage || "Unknown";

    const context: InterpretationContext = {
      rawInput: input.inputText,
      normalizedInput: CulturalKnowledgeService.normalizeInput(input.inputText),
      inputType,
      sourceLanguage: input.detectedInputLanguage,
      targetLanguage: targetLang,
    };

    let interpretations: PreparedInterpretation[] = [];

    if (input.textTreatment === "KEEP_ORIGINAL") {
      const originalLanguage = input.detectedInputLanguage || "English";
      const originalCandidate: PreparedInterpretation = {
        type: "ORIGINAL",
        language: originalLanguage,
        text: input.inputText,
        meaning: "Original text preserved verbatim.",
        confidence: 1.0,
        warning: "This phrase will remain in its original language.",
        recommended: true,
      };
      interpretations = [originalCandidate];

      await CulturalKnowledgeService.storeGenerated({
        rawInput: input.inputText,
        inputType,
        sourceLanguage: originalLanguage,
        targetLanguage: originalLanguage,
        interpretationType: "ORIGINAL",
        renderedText: input.inputText,
        meaning: originalCandidate.meaning ?? undefined,
        explanation: originalCandidate.warning ?? undefined,
        confidence: 1.0,
        verificationStatus: "AUTO_VALIDATED",
        source: "TRANSLITERATION_ENGINE",
      });
    } else {
      const cached = await CulturalKnowledgeService.lookup(
        input.inputText,
        inputType,
        targetLang
      );

      const filteredCached =
        cached && input.textTreatment === "PHONETIC"
          ? cached.filter((entry) =>
              PHONETIC_TYPES.has(entry.interpretationType)
            )
          : cached;

      if (filteredCached && filteredCached.length > 0) {
        interpretations = filteredCached.map((c, idx) => ({
          type: c.interpretationType,
          language: c.targetLanguage,
          text: c.renderedText,
          romanization: c.romanization,
          meaning: c.meaning,
          confidence: c.confidence,
          warning: c.explanation,
          recommended: idx === 0,
        }));
      } else {
        const requestedTypes: CulturalInterpretationType[] | undefined =
          input.textTreatment === "PHONETIC"
            ? [
                "PHONETIC",
                "TRANSLITERATION",
                "SCRIPT_ADAPTATION",
                "SINO_VIETNAMESE",
              ]
            : undefined;

        const result = await culturalIntelligence.analyze({
          inputText: input.inputText,
          targetLanguage: targetLang,
          mode: input.mode,
          detectedInputLanguage: input.detectedInputLanguage,
          requestedTypes,
        });

        detectedLanguage = result.inputAnalysis.detectedLanguage;

        const validSet = new Set<string>(InterpretationTypeValues);
        interpretations = result.interpretations
          .filter((item) => validSet.has(item.type))
          .map((item) => ({
            type: item.type as InterpretationType,
            language: item.language,
            text: item.text,
            romanization: item.romanization ?? null,
            meaning: item.meaning,
            confidence: item.confidence,
            warning: item.warning ?? null,
            recommended: item.recommended,
          }));

        if (interpretations.length === 0) {
          interpretations = [
            {
              type: "ORIGINAL",
              language: detectedLanguage,
              text: input.inputText,
              meaning: "Original text preserved verbatim.",
              confidence: 1.0,
              recommended: true,
            },
          ];
        }

        // Persist authoritative LLM interpretations in PhraseKnowledge (T-401, TB-CALLI-001)
        for (const interp of interpretations) {
          await CulturalKnowledgeService.storeGenerated({
            rawInput: input.inputText,
            inputType: context.inputType,
            sourceLanguage: detectedLanguage,
            targetLanguage: interp.language,
            interpretationType: interp.type,
            renderedText: interp.text,
            romanization: interp.romanization ?? undefined,
            meaning: interp.meaning ?? undefined,
            explanation: interp.warning ?? undefined,
            confidence: interp.confidence ?? undefined,
            verificationStatus: "GENERATED",
            source: "AI",
          });
        }
      }
    }

    const prismaTextTreatment =
      input.textTreatment === "KEEP_ORIGINAL" ? "KEEP_ORIGINAL" : "TRANSLATE";

    const session = await prisma.personalizationSession.create({
      data: {
        userId,
        anonymousSessionId: userId ? null : anonymousSessionId,
        designId: input.designId ?? null,
        designVersionId: input.designVersionId ?? null,
        mode: input.mode,
        inputText: input.inputText,
        inputLanguage: detectedLanguage,
        targetLanguage: targetLang,
        culturalStyle: input.culturalStyle,
        textTreatment: prismaTextTreatment,
        status: "READY",
        intent: {
          inputType,
          requestedTextTreatment: input.textTreatment,
        },
        interpretations: {
          create: interpretations.map((i) => ({
            type: i.type,
            language: i.language,
            text: i.text,
            romanization: i.romanization ?? null,
            meaning: i.meaning ?? null,
            confidence: i.confidence ?? null,
            warning: i.warning ?? null,
            recommended: i.recommended,
          })),
        },
      },
      include: { interpretations: true },
    });

    const response = NextResponse.json({
      sessionId: session.id,
      dbSessionId: session.id,
      interpretations: session.interpretations,
      inputAnalysis: {
        detectedLanguage,
        inputType,
      },
    });

    return attachAnonCookieIfNeeded(response, newlyIssuedAnonToken);
  } catch (err: unknown) {
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
      console.error("[/api/personalization/analyze] Security configuration error");
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
