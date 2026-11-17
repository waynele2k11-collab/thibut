import "server-only";
import { z } from "zod";
import { CalligraphyService } from "@/lib/calligraphy/CalligraphyService";
import { inngest } from "@/lib/inngest";
import prisma from "@/lib/prisma";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { PolicyGuard } from "@/lib/services/PolicyGuard";

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
export const GenerateRequestSchema = z
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

export type GenerateInput = z.infer<typeof GenerateRequestSchema>;

export class PersonalizationGenerateHttpError extends Error {
  public readonly status: 400 | 403 | 404;

  constructor(status: 400 | 403 | 404, message: string) {
    super(message);
    this.name = "PersonalizationGenerateHttpError";
    this.status = status;
  }
}

export async function executePersonalizationGenerate(
  input: GenerateInput,
  caller: { userId: string | null; anonymousSessionId: string | null }
): Promise<{ status: 200 | 202; body: Record<string, unknown> }> {
  // 1. Load PersonalizationSession strictly by UUID and verify caller ownership (T-401)
  const session = await prisma.personalizationSession.findUnique({
    where: { id: input.sessionId },
  });

  if (!session) {
    throw new PersonalizationGenerateHttpError(
      404,
      "Personalization session not found"
    );
  }

  const ownsSession = session.userId
    ? caller.userId !== null && session.userId === caller.userId
    : Boolean(
        session.anonymousSessionId &&
          caller.anonymousSessionId &&
          session.anonymousSessionId === caller.anonymousSessionId
      );

  if (!ownsSession) {
    throw new PersonalizationGenerateHttpError(
      403,
      "Forbidden: session belongs to a different caller"
    );
  }

  if (
    input.designId &&
    session.designId &&
    input.designId !== session.designId
  ) {
    throw new PersonalizationGenerateHttpError(
      400,
      "Requested designId conflicts with session designId"
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
    throw new PersonalizationGenerateHttpError(
      404,
      "Authoritative interpretation not found for session"
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

    return {
      status: 202,
      body: {
        queued: true,
        sessionId: session.id,
        interpretationId: interpretation.id,
        eventIds,
        message: "Generation job queued successfully",
      },
    };
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

  return {
    status: 200,
    body: {
      sessionId: session.id,
      interpretationId: interpretation.id,
      rendererVersion: renderResult.rendererVersion,
      script: renderResult.script,
      candidates,
      cacheHit: renderResult.cacheHit,
      durationMs: renderResult.durationMs,
      message: "Candidates generated via Controlled Calligraphy Renderer",
    },
  };
}
