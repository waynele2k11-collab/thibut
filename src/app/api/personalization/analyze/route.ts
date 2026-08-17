import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { interpretationEngine } from "@/lib/ai/InterpretationEngine";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { InterpretationContext } from "@/lib/ai/resolvers/CulturalResolver";
import { culturalIntelligence } from "@/lib/ai/cultural-provider";

const RequestSchema = z.object({
  inputText: z.string().min(1).max(500),
  culturalStyle: z.enum(["VIETNAMESE_THU_PHAP", "JAPANESE_SHODO", "CHINESE_CALLIGRAPHY", "KOREAN_BRUSH"]),
  textTreatment: z.enum(["KEEP_ORIGINAL", "TRANSLATE"]),
  mode: z.enum(["NAME", "QUOTE", "STORY", "CREATOR_ART"]),
  detectedInputLanguage: z.string().optional(),
});
type AnalyzeInput = z.infer<typeof RequestSchema>;

const STYLE_TO_LANG: Record<string, string> = {
  VIETNAMESE_THU_PHAP: "Vietnamese",
  JAPANESE_SHODO: "Japanese",
  CHINESE_CALLIGRAPHY: "Chinese",
  KOREAN_BRUSH: "Korean",
};

export async function POST(req: NextRequest) {
  let input: AnalyzeInput;
  try {
    input = RequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const inputType = interpretationEngine.classifyInput(input.inputText);
    const targetLang = input.textTreatment === "TRANSLATE" ? STYLE_TO_LANG[input.culturalStyle] : null;
    
    let interpretations: any[] = [];
    
    if (input.textTreatment === "KEEP_ORIGINAL") {
      interpretations = [{
        type: "ORIGINAL",
        language: input.detectedInputLanguage || "English",
        text: input.inputText,
        meaning: "Original Text",
        confidence: 1.0,
        warning: "This phrase will remain in its original language.",
        recommended: true,
      }];
    } else {
      const context: InterpretationContext = {
        rawInput: input.inputText,
        normalizedInput: CulturalKnowledgeService.normalizeInput(input.inputText),
        inputType,
        sourceLanguage: input.detectedInputLanguage,
        targetLanguage: targetLang!,
      };
      
      const cached = await CulturalKnowledgeService.lookup(input.inputText, inputType, targetLang!);
      
      if (cached && cached.length > 0) {
        interpretations = cached.map(c => ({
          type: c.interpretationType,
          language: c.targetLanguage,
          text: c.renderedText,
          romanization: c.romanization,
          meaning: c.meaning,
          confidence: c.confidence,
          warning: c.explanation,
          recommended: false,
        }));
        if (interpretations.length > 0) {
          interpretations[0].recommended = true;
        }
      } else {
        const result = await culturalIntelligence.analyze({
          inputText: input.inputText,
          targetLanguage: targetLang as "Vietnamese" | "Japanese" | "Chinese" | "Korean",
          mode: input.mode as "NAME" | "QUOTE" | "STORY" | "CREATOR_ART",
          detectedInputLanguage: input.detectedInputLanguage,
        });
        
        interpretations = result.interpretations;
      }
    }

    const session = await prisma.personalizationSession.create({
      data: {
        mode: input.mode as any,
        inputText: input.inputText,
        inputLanguage: input.detectedInputLanguage,
        targetLanguage: targetLang,
        culturalStyle: input.culturalStyle as any,
        textTreatment: input.textTreatment as any,
        status: "READY",
        intent: { inputType },
        interpretations: {
          create: interpretations.map(i => ({
            type: i.type,
            language: i.language,
            text: i.text,
            romanization: i.romanization,
            meaning: i.meaning,
            confidence: i.confidence,
            warning: i.warning,
            recommended: i.recommended,
          }))
        }
      },
      include: { interpretations: true }
    });

    return NextResponse.json({
      interpretations: session.interpretations,
      inputAnalysis: {
        detectedLanguage: input.detectedInputLanguage || "Unknown",
        inputType,
      },
      dbSessionId: session.id
    });
  } catch (err: any) {
    console.error("[/api/personalization/analyze]", err);
    return NextResponse.json({ error: err.message || "Internal server error", stack: err.stack }, { status: 500 });
  }
}
