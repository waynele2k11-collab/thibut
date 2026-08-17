import prisma from "@/lib/prisma";
import { 
  CulturalInputType, 
  InterpretationType, 
  VerificationStatus, 
  KnowledgeSource 
} from "@prisma/client";

export class CulturalKnowledgeService {
  /**
   * Normalizes the cultural input for consistent cache lookups.
   * e.g., "  David " -> "david"
   */
  public static normalizeInput(input: string): string {
    return input
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(); // Case-fold for matching where linguistically safe
  }

  /**
   * Look up existing knowledge in the cache.
   * Prioritizes HUMAN_VERIFIED over AUTO_VALIDATED over GENERATED.
   * Never returns REJECTED or DEPRECATED.
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

    const whereClause: any = {
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

    if (transformationType) whereClause.interpretationType = transformationType;
    if (sourceLanguage) whereClause.sourceLanguage = sourceLanguage;
    if (engineVersion) whereClause.engineVersion = engineVersion;

    const results = await prisma.phraseKnowledge.findMany({
      where: whereClause,
      orderBy: [
        // Prisma doesn't support ENUM sorting out of the box natively by priority like this easily,
        // so we fetch the valid ones and sort them in JS. Or we could just use a simple sort.
        // We'll fetch them all and sort them in memory since there won't be that many hits for a single word.
      ],
    });

    if (results.length === 0) return null;

    // Sort by VerificationStatus priority: HUMAN_VERIFIED (1) -> AUTO_VALIDATED (2) -> GENERATED (3)
    const priority = {
      HUMAN_VERIFIED: 1,
      AUTO_VALIDATED: 2,
      GENERATED: 3,
      REJECTED: 99,
      DEPRECATED: 99,
    };

    const sorted = results.sort((a, b) => priority[a.verificationStatus] - priority[b.verificationStatus]);

    return sorted; // Returns all valid interpretations found
  }

  /**
   * Store a newly generated interpretation into the cache.
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
  }) {
    const normalizedInput = this.normalizeInput(params.rawInput);

    // Prevent duplicate entries for the exact same interpretation logic.
    const existing = await prisma.phraseKnowledge.findFirst({
      where: {
        normalizedInput,
        inputType: params.inputType,
        targetLanguage: params.targetLanguage,
        interpretationType: params.interpretationType,
        sourceLanguage: params.sourceLanguage,
        engineVersion: params.engineVersion || "CULTURAL_ENGINE_V1",
        renderedText: params.renderedText,
      },
    });

    if (existing) {
      return existing; // Already exists
    }

    return await prisma.phraseKnowledge.create({
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
        engineVersion: params.engineVersion || "CULTURAL_ENGINE_V1",
        verificationStatus: params.verificationStatus || "GENERATED",
        source: "AI",
      },
    });
  }

  /**
   * Record a usage of a specific knowledge entry.
   */
  public static async recordUsage(id: string) {
    return await prisma.phraseKnowledge.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Admin: Reject a knowledge entry.
   */
  public static async reject(id: string) {
    return await prisma.phraseKnowledge.update({
      where: { id },
      data: { verificationStatus: "REJECTED" },
    });
  }
}
