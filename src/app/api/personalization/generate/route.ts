import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { DesignCacheService } from "@/lib/services/DesignCacheService";

const RequestSchema = z.object({
  inputText: z.string().min(1).max(500),
  culturalStyle: z.string(),
  textTreatment: z.enum(["KEEP_ORIGINAL", "TRANSLATE"]),
  targetLanguage: z.string().nullable().optional(),
  mode: z.enum(["NAME", "QUOTE", "STORY", "CREATOR_ART"]),
  stylePack: z.string().min(1),
  composition: z.string().min(1),
  creatorArtworkUrl: z.string().url().optional(),
  selectedInterpretation: z.any().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = RequestSchema.parse(body);

    if (!process.env.INNGEST_EVENT_KEY) {
      console.warn("[/api/personalization/generate] INNGEST_EVENT_KEY not set — running inline");
      const { visualAI } = await import("@/lib/ai/visual-provider");
      
      let primary = input.selectedInterpretation;
      
      let mappedInputType: any = "WORD";
      if (input.mode === "NAME") mappedInputType = "PERSON_NAME";
      if (input.mode === "QUOTE") mappedInputType = "QUOTE";
      if (input.mode === "STORY") mappedInputType = "PHRASE";
      
      if (!primary) {
        primary = {
          type: "ORIGINAL",
          language: input.targetLanguage || "English",
          text: input.inputText,
          meaning: "Original text",
          confidence: 1.0
        };
      }

      const phraseKnowledge = await CulturalKnowledgeService.storeGenerated({
        rawInput: input.inputText,
        inputType: mappedInputType,
        targetLanguage: primary.language || "English",
        interpretationType: primary.type as any,
        renderedText: primary.text,
        romanization: primary.romanization,
        meaning: primary.meaning,
        confidence: primary.confidence,
      });

      const cachedDesign = await DesignCacheService.findReusableDesign({
        phraseKnowledgeId: phraseKnowledge.id,
        stylePackId: input.stylePack,
        rendererVersion: "V1",
      });

      let candidates: any[] = [];
      
      if (cachedDesign && cachedDesign.variations && cachedDesign.variations.length >= 6) {
        console.log("[generate] CACHE HIT: Found 6 existing variations");
        candidates = cachedDesign.variations.map((v) => ({
          id: v.id,
          index: v.variationIndex,
          imageUrl: v.assetId,
          stylePack: input.stylePack,
          variationNote: v.variationNote,
          provider: v.provider,
          seed: v.variationIndex
        }));
      } else {
        console.log("[generate] CACHE MISS: Generating new brush variations");
        const rawCandidates = await visualAI.generateCalligraphyCandidates({
          originalText: input.inputText,
          interpretedText: primary.text,
          romanization: primary.romanization,
          meaning: primary.meaning,
          culturalStyle: input.culturalStyle,
          textTreatment: input.textTreatment,
          stylePack: input.stylePack,
          targetLanguage: primary.language,
          creatorArtworkUrl: input.creatorArtworkUrl,
          variationSeed: 1000,
        });

        const newDesign = await DesignCacheService.storeRenderedDesign({
          phraseKnowledgeId: phraseKnowledge.id,
          stylePackId: input.stylePack,
          rendererVersion: "V1",
          variations: rawCandidates.map((c: any, i: number) => ({
            variationIndex: i + 1,
            assetId: c.imageUrl,
            variationNote: c.variationNote,
            provider: c.provider,
            renderedText: input.inputText,
            status: "READY"
          }))
        });

        candidates = newDesign.variations.map((v: any) => ({
          id: v.id,
          index: v.variationIndex,
          imageUrl: v.assetId,
          stylePack: input.stylePack,
          variationNote: v.variationNote,
          provider: v.provider,
          seed: v.variationIndex
        }));
      }

      const session = await prisma.personalizationSession.findFirst({
        where: { inputText: input.inputText },
        orderBy: { createdAt: "desc" },
      });

      if (session) {
        await prisma.personalizationSession.update({
          where: { id: session.id },
          data: {
            status: "DRAFT",
          },
        });
      }

      return NextResponse.json({ candidates, message: "Candidates generated synchronously" });
    }

    return NextResponse.json({ message: "Generation job queued successfully" });
  } catch (err) {
    console.error("[/api/personalization/generate]", err);
    return NextResponse.json({ error: "Failed to queue generation" }, { status: 500 });
  }
}
