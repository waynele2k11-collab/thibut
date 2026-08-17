import { CulturalResolver, InterpretationCandidate, InterpretationContext } from "./CulturalResolver";

export class NaturalTranslationResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "PHRASE" || context.inputType === "QUOTE" || context.inputType === "IDIOM" || context.inputType === "WORD";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Natural translation of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "NATURAL",
      meaning: `Natural flow translation`,
      confidence: 0.85,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}

export class LiteralTranslationResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "PHRASE" || context.inputType === "QUOTE" || context.inputType === "IDIOM" || context.inputType === "WORD";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Literal translation of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "LITERAL",
      meaning: `Direct word-for-word translation`,
      confidence: 0.9,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}

export class PoeticInterpretationResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "PHRASE" || context.inputType === "QUOTE";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Poetic version of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "POETIC",
      meaning: `Elevated poetic rendition`,
      confidence: 0.7,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}

export class IdiomResolver implements CulturalResolver {
  supports(context: InterpretationContext): boolean {
    return context.inputType === "IDIOM" || context.inputType === "PHRASE";
  }

  async resolve(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    return [{
      id: crypto.randomUUID(),
      inputType: context.inputType,
      sourceText: context.rawInput,
      renderedText: `[Idiomatic equivalent of ${context.rawInput}]`,
      sourceLanguage: context.sourceLanguage || "English",
      targetLanguage: context.targetLanguage,
      transformationType: "IDIOMATIC",
      meaning: `Cultural idiom matching the meaning`,
      confidence: 0.75,
      verificationStatus: "GENERATED",
      provenance: { source: "AI", engineVersion: "CULTURAL_ENGINE_V2" },
    }];
  }
}
