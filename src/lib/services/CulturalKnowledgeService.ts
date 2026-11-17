import "server-only";
import type {
  CulturalInputType,
  InterpretationType,
  KnowledgeSource,
  Prisma,
  VerificationStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";

export class CulturalKnowledgeService {
  /**
   * Normalizes cultural input for deterministic cache lookups.
   */
  public static normalizeInput(input: string): string {
    return input
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  /**
   * Looks up verified/generated knowledge in the database cache.
   * Prioritizes HUMAN_VERIFIED -> AUTO_VALIDATED -> GENERATED.
   * Never returns REJECTED, DEPRECATED, or MOCK entries.
   */
  public static async lookup(
    rawInput: string,
    inputType: CulturalInputType,
    targetLanguage: string,
    transformationType?: InterpretationType,
    sourceLanguage?: string,
    engineVersion?: string
  ) {
    const normalized = this.normalizeInput(rawInput);

    const whereClause: Prisma.PhraseKnowledgeWhereInput = {
      normalizedInput: normalized,
      inputType,
      targetLanguage,
      verificationStatus: {
        in: ["HUMAN_VERIFIED", "AUTO_VALIDATED", "GENERATED"],
      },
      source: {
        not: "MOCK",
      },
    };

    if (transformationType) {
      whereClause.interpretationType = transformationType;
    }
    if (sourceLanguage) {
      whereClause.sourceLanguage = sourceLanguage;
    }
    if (engineVersion) {
      whereClause.engineVersion = engineVersion;
    }

    const results = await prisma.phraseKnowledge.findMany({
      where: whereClause,
    });

    if (results.length === 0) {
      return null;
    }

    const priority: Record<VerificationStatus, number> = {
      HUMAN_VERIFIED: 1,
      AUTO_VALIDATED: 2,
      GENERATED: 3,
      REJECTED: 99,
      DEPRECATED: 99,
    };

    return [...results].sort(
      (a, b) => priority[a.verificationStatus] - priority[b.verificationStatus]
    );
  }

  /**
   * Stores a server-generated authoritative interpretation into `PhraseKnowledge`.
   * Must NEVER be called with raw unverified client-supplied interpretation text (TB-CALLI-001).
   */
  public static async storeGenerated(params: {
    rawInput: string;
    inputType: CulturalInputType;
    sourceLanguage?: string;
    targetLanguage: string;
    interpretationType: InterpretationType;
    renderedText: string;
    romanization?: string;
    meaning?: string;
    explanation?: string;
    confidence?: number;
    engineVersion?: string;
    verificationStatus?: VerificationStatus;
    source?: KnowledgeSource;
  }) {
    const normalizedInput = this.normalizeInput(params.rawInput);
    const engineVersion = params.engineVersion || "CULTURAL_ENGINE_V2";

    const existing = await prisma.phraseKnowledge.findFirst({
      where: {
        normalizedInput,
        inputType: params.inputType,
        targetLanguage: params.targetLanguage,
        interpretationType: params.interpretationType,
        renderedText: params.renderedText,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.phraseKnowledge.create({
      data: {
        normalizedInput,
        displayInput: params.rawInput.trim(),
        inputType: params.inputType,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        interpretationType: params.interpretationType,
        renderedText: params.renderedText,
        romanization: params.romanization,
        meaning: params.meaning,
        explanation: params.explanation,
        confidence: params.confidence,
        engineVersion,
        verificationStatus: params.verificationStatus || "GENERATED",
        source: params.source || "AI",
      },
    });
  }

  public static async recordUsage(id: string) {
    return prisma.phraseKnowledge.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  public static async reject(id: string) {
    return prisma.phraseKnowledge.update({
      where: { id },
      data: { verificationStatus: "REJECTED" },
    });
  }
}
