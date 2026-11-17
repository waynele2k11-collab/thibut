import "server-only";
import type {
  CulturalInputType,
  InterpretationType,
  KnowledgeSource,
  VerificationStatus,
} from "@prisma/client";

export interface InterpretationContext {
  rawInput: string;
  normalizedInput: string;
  inputType: CulturalInputType;
  sourceLanguage?: string;
  targetLanguage: string;
  transformationMode?: InterpretationType;
}

export interface InterpretationProvenance {
  source: KnowledgeSource;
  engineVersion?: string;
  knowledgeId?: string;
}

export interface InterpretationCandidate {
  id: string;
  inputType: CulturalInputType;
  sourceText: string;
  renderedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  transformationType: InterpretationType;
  romanization?: string;
  meaning?: string;
  explanation?: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  provenance: InterpretationProvenance;
}

const COMMON_NON_NAME_WORDS = new Set([
  "Never",
  "Give",
  "Up",
  "The",
  "A",
  "An",
  "Is",
  "Are",
  "Always",
  "Stay",
  "Strong",
  "Forever",
  "Eternal",
  "Love",
  "Peace",
]);

export class InterpretationEngine {
  /**
   * Deterministic structural classification of raw user text into `CulturalInputType`.
   */
  public classifyInput(rawInput: string): CulturalInputType {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      return "UNKNOWN";
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    const isLikelyName =
      tokens.length >= 1 &&
      tokens.length <= 3 &&
      tokens.every((t) => /^[A-ZÀ-Ỹ][a-zà-ỹ'-]*$/.test(t)) &&
      !tokens.some((t) => COMMON_NON_NAME_WORDS.has(t));

    if (isLikelyName) {
      return "PERSON_NAME";
    }

    if (tokens.length > 5) {
      return "QUOTE";
    }

    if (tokens.length >= 2) {
      return "PHRASE";
    }

    return "WORD";
  }

  /**
   * Relevance guard ensuring phrase-only transformations are not misapplied to person names.
   */
  public validateRelevance(
    context: InterpretationContext,
    candidate: InterpretationCandidate
  ): boolean {
    if (
      context.inputType === "PERSON_NAME" ||
      context.inputType === "FAMILY_NAME"
    ) {
      if (
        candidate.transformationType === "NATURAL" ||
        candidate.transformationType === "POETIC" ||
        candidate.transformationType === "IDIOMATIC" ||
        candidate.transformationType === "LITERAL"
      ) {
        return false;
      }
    }
    return true;
  }
}

export const interpretationEngine = new InterpretationEngine();
