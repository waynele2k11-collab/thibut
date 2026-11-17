import "server-only";
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
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { PolicyGuard } from "@/lib/services/PolicyGuard";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export const AnalyzeRequestSchema = z
  .object({
    sessionId: z
      .string()
      .uuid()
      .refine((id) => id !== NIL_UUID, "Nil session ID is not permitted")
      .optional(),
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

export type AnalyzeInput = z.infer<typeof AnalyzeRequestSchema>;

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

export async function executePersonalizationAnalyze(
  input: AnalyzeInput,
  caller: { userId: string | null; anonymousSessionId: string | null }
) {
  let reusableSession: {
    id: string;
    designId: string | null;
    designVersionId: string | null;
  } | null = null;

  if (input.sessionId) {
    const existing = await prisma.personalizationSession.findUnique({
      where: { id: input.sessionId },
    });
    if (existing && existing.status !== "CHECKED_OUT") {
      const ownsByUser = Boolean(
        caller.userId && existing.userId === caller.userId
      );
      const ownsByAnon = Boolean(
        caller.anonymousSessionId &&
          existing.anonymousSessionId === caller.anonymousSessionId
      );
      if (ownsByUser || ownsByAnon) {
        reusableSession = {
          id: existing.id,
          designId: existing.designId,
          designVersionId: existing.designVersionId,
        };
      }
    }
  }

  const effectiveDesignId =
    input.designId ?? reusableSession?.designId ?? undefined;
  const effectiveDesignVersionId =
    input.designVersionId ?? reusableSession?.designVersionId ?? undefined;

  // Enforce creator artwork permission policy when designId is attached (T-409, INV-010, INV-012)
  await PolicyGuard.enforcePersonalizationContext({
    designId: effectiveDesignId,
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

  const interpretationCreates = interpretations.map((i) => ({
    type: i.type,
    language: i.language,
    text: i.text,
    romanization: i.romanization ?? null,
    meaning: i.meaning ?? null,
    confidence: i.confidence ?? null,
    warning: i.warning ?? null,
    recommended: i.recommended,
  }));

  const canUpdateInPlace =
    Boolean(reusableSession) &&
    typeof (prisma.personalizationSession as { update?: unknown }).update ===
      "function" &&
    typeof (prisma.interpretation as { deleteMany?: unknown } | undefined)
      ?.deleteMany === "function";

  let session: {
    id: string;
    interpretations: Array<{
      id: string;
      sessionId: string;
      type: InterpretationType;
      language: string;
      text: string;
      romanization: string | null;
      meaning: string | null;
      confidence: number | null;
      warning: string | null;
      recommended: boolean;
      createdAt: Date;
    }>;
  };

  if (canUpdateInPlace && reusableSession) {
    await prisma.interpretation.deleteMany({
      where: { sessionId: reusableSession.id },
    });
    session = await prisma.personalizationSession.update({
      where: { id: reusableSession.id },
      data: {
        designId: effectiveDesignId ?? null,
        designVersionId: effectiveDesignVersionId ?? null,
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
          create: interpretationCreates,
        },
      },
      include: { interpretations: true },
    });
  } else {
    session = await prisma.personalizationSession.create({
      data: {
        userId: caller.userId,
        anonymousSessionId: caller.userId ? null : caller.anonymousSessionId,
        designId: effectiveDesignId ?? null,
        designVersionId: effectiveDesignVersionId ?? null,
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
          create: interpretationCreates,
        },
      },
      include: { interpretations: true },
    });
  }

  return {
    sessionId: session.id,
    dbSessionId: session.id,
    interpretations: session.interpretations,
    inputAnalysis: {
      detectedLanguage,
      inputType,
    },
  };
}
