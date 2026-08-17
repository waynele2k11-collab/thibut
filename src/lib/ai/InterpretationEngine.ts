import { CulturalInputType } from "@prisma/client";
import { CulturalResolver, InterpretationCandidate, InterpretationContext } from "./resolvers/CulturalResolver";
import { NameTransliterationResolver, PhoneticResolver, SinoVietnameseResolver } from "./resolvers/NameResolver";
import { IdiomResolver, LiteralTranslationResolver, NaturalTranslationResolver, PoeticInterpretationResolver } from "./resolvers/PhraseResolver";

export class InterpretationEngine {
  private resolvers: CulturalResolver[] = [
    new NameTransliterationResolver(),
    new PhoneticResolver(),
    new SinoVietnameseResolver(),
    new NaturalTranslationResolver(),
    new LiteralTranslationResolver(),
    new PoeticInterpretationResolver(),
    new IdiomResolver(),
  ];

  /**
   * Step 1: Deterministic / structured classification
   */
  public classifyInput(rawInput: string): CulturalInputType {
    const tokens = rawInput.trim().split(/\s+/);
    
    // Very naive heuristic for MVP:
    // If it's 1-3 words and capitalized, it's probably a name
    const notNameWords = ["Never", "Give", "Up", "The", "A", "An", "Is", "Are"];
    const isName = tokens.length <= 3 && 
                   tokens.every(t => /^[A-Z]/.test(t)) && 
                   !tokens.some(t => notNameWords.includes(t));

    if (isName) {
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
   * Step 3: Transformation-specific resolver routing
   */
  public async resolveCandidates(context: InterpretationContext): Promise<InterpretationCandidate[]> {
    const candidates: InterpretationCandidate[] = [];

    // Route to all applicable resolvers
    for (const resolver of this.resolvers) {
      if (resolver.supports(context)) {
        try {
          const resolved = await resolver.resolve(context);
          
          // Step 4: Relevance validation
          for (const cand of resolved) {
            if (this.validateRelevance(context, cand)) {
              candidates.push(cand);
            }
          }
        } catch (err) {
          console.error(`Resolver failed for ${context.rawInput}`, err);
        }
      }
    }

    return candidates;
  }

  /**
   * Step 4: Validation
   * Relevance validation to ensure we don't return "Never Give Up" for "David"
   */
  public validateRelevance(context: InterpretationContext, candidate: InterpretationCandidate): boolean {
    if (context.inputType === "PERSON_NAME" || context.inputType === "FAMILY_NAME") {
      if (["NATURAL", "POETIC", "IDIOMATIC", "LITERAL"].includes(candidate.transformationType)) {
        // Reject phrases for names unless explicitly asked to translate meaning
        return false;
      }
    }
    return true;
  }
}

export const interpretationEngine = new InterpretationEngine();
