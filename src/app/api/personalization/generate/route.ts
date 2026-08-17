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

      // ── Controlled Calligraphy Rendering Pipeline (v0.1) ──
      const { CalligraphyService } = await import("@/lib/calligraphy/CalligraphyService");
      
      const renderResult = await CalligraphyService.renderCalligraphy({
        phraseKnowledgeId: phraseKnowledge.id,
        authoritativeText: primary.text,
        targetLanguage: primary.language,
        stylePackId: input.stylePack,
        orientationPreference: input.composition === "Vertical" ? "VERTICAL" : "HORIZONTAL",
        variationCount: 6,
      });

      const candidates = renderResult.candidates.map((c, i) => ({
        id: c.id,
        index: i + 1,
        imageUrl: c.previewAssetUrl,
        stylePack: c.stylePackId,
        variationType: c.variationType,
        variationName: c.variationName,
        variationNote: c.variationNote,
        provider: c.provider,
        seed: c.seed,
        validationStatus: c.validationStatus,
      }));

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

      return NextResponse.json({
        candidates,
        cacheHit: renderResult.cacheHit,
        durationMs: renderResult.durationMs,
        message: "Candidates generated via Controlled Calligraphy Renderer",
      });
    }

    return NextResponse.json({ message: "Generation job queued successfully" });
  } catch (err) {
    console.error("[/api/personalization/generate]", err);
    return NextResponse.json({ error: "Failed to queue generation" }, { status: 500 });
  }
}
