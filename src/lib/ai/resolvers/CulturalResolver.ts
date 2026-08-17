import { CulturalInputType, InterpretationType, KnowledgeSource, VerificationStatus } from "@prisma/client";

export interface InterpretationContext {
  rawInput: string;
  normalizedInput: string;
  inputType: CulturalInputType;
  sourceLanguage?: string;
  targetLanguage: string;
  transformationMode?: InterpretationType;
}

export interface InterpretationCandidate {
  id: string; // usually generated locally
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

export interface InterpretationProvenance {
  source: KnowledgeSource;
  engineVersion?: string;
  knowledgeId?: string;
}

export interface CulturalResolver {
  supports(context: InterpretationContext): boolean;
  resolve(context: InterpretationContext): Promise<InterpretationCandidate[]>;
}
