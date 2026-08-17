import { CulturalInputType } from "@prisma/client";
import { CulturalResolver, InterpretationCandidate, InterpretationContext } from "./CulturalResolver";

export class NameTransliterationResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "PERSON_NAME" || context.inputType === "FAMILY_NAME";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    // TODO: Actually call AI or dictionary for real transliteration
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `${context.rawInput} (Transliterated)`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "TRANSLITERATION",
      meaning: `Transliteration of ${context.rawInput}`,
      confidence: 0.8,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}

export class SinoVietnameseResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return (context.inputType === "PERSON_NAME" || context.inputType === "FAMILY_NAME") &&
           (context.targetLanguage === "Vietnamese" || context.targetLanguage === "Chinese" || context.targetLanguage === "Japanese");
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Sino-Vietnamese of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "SINO_VIETNAMESE",
      meaning: `Sino-Vietnamese reading for ${context.rawInput}`,
      confidence: 0.7,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}

export class PhoneticResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "PERSON_NAME" || context.inputType === "FAMILY_NAME";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Phonetic of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "PHONETIC",
      meaning: `Phonetic pronunciation guide`,
      confidence: 0.9,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}
