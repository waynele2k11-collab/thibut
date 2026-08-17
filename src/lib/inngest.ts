/**
 * INNGEST CLIENT + PERSONALIZATION JOB PIPELINE
 * 
 * Async multi-step job for the full buyer personalization flow.
 * Step-level durability means failures retry from the failing step only.
 * 
 * Architecture per SYSTEM_ARCHITECTURE §40:
 *  1. Translate + interpret (GPT-4.1)
 *  2. Generate 6 calligraphy candidates (fal.ai FLUX 2 Pro)
 *  3. Store results + update session status → READY
 */

import { Inngest } from "inngest";
import { culturalIntelligence, type CulturalAnalysisInput } from "@/lib/ai/cultural-provider";
import { visualAI } from "@/lib/ai/visual-provider";
import { PrintfulProvider } from "@/lib/fulfillment/PrintfulProvider";
import prisma from "@/lib/prisma";

const printful = new PrintfulProvider();

// ── Inngest client singleton ──────────────────────────────────────────────────
export const inngest = new Inngest({
  id: "thibut",
  ...(process.env.INNGEST_EVENT_KEY ? { eventKey: process.env.INNGEST_EVENT_KEY } : {}),
});

// ── Event type definitions ────────────────────────────────────────────────────
export interface PersonalizationRequestedPayload {
  sessionId: string;
  inputText: string;
  targetLanguage: "Vietnamese" | "Japanese" | "Chinese" | "Korean";
  mode: "NAME" | "QUOTE" | "STORY" | "CREATOR_ART";
  stylePack: string;
  composition: string;
  creatorArtworkUrl?: string;
}

// ── Main Personalization Pipeline ─────────────────────────────────────────────
export const personalizationPipeline = inngest.createFunction(
  {
    id: "personalization-pipeline",
    name: "Personalization Pipeline",
    triggers: [{ event: "personalization/requested" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const data = event.data as PersonalizationRequestedPayload;
    const { sessionId, inputText, targetLanguage, mode, stylePack, composition } = data;

    // ── Step 1: Cultural Intelligence Analysis ────────────────────────────────
    const interpretation = await step.run("cultural-analysis", async () => {
      console.log(`[Pipeline] Step 1: Analyzing "${inputText}" → ${targetLanguage}`);

      const analysisInput: CulturalAnalysisInput = {
        inputText,
        targetLanguage,
        mode,
        requestedTypes:
          mode === "NAME"
            ? ["ORIGINAL", "PHONETIC", "SCRIPT_TRANSLITERATION", "CULTURAL"]
            : ["LITERAL", "NATURAL", "POETIC"],
      };

      if (!process.env.OPENAI_API_KEY) {
        console.warn("[Pipeline] OPENAI_API_KEY not set — using mock interpretation");
        return {
          interpretations: [
            {
              type: "NATURAL" as const,
              language: targetLanguage,
              text: inputText,
              romanization: undefined,
              meaning: `${inputText} (mock — add OPENAI_API_KEY to .env)`,
              confidence: 0.9,
              warning: undefined,
              recommended: true,
              recommendedStyles: [stylePack],
              culturalContext: "Mock response — configure OPENAI_API_KEY",
            },
          ],
          inputAnalysis: {
            detectedLanguage: "English",
            inputType: "PHRASE" as const,
            intent: "Mock",
            themes: [],
          },
        };
      }

      return culturalIntelligence.analyze(analysisInput);
    });

    // Use the recommended interpretation for generation
    const interps = interpretation.interpretations as Array<{
      type: string; language: string; text: string;
      romanization?: string; meaning: string; confidence: number;
      recommended: boolean; recommendedStyles?: string[];
    }>;
    const primary = interps.find((i) => i.recommended) ?? interps[0];

    // ── Step 2: Generate 6 Calligraphy Candidates ─────────────────────────────
    const candidates = await step.run("generate-candidates", async () => {
      console.log(`[Pipeline] Step 2: Generating candidates for "${primary.text}"`);
      return visualAI.generateCalligraphyCandidates({
        originalText: event.data.inputText,
        interpretedText: primary.text,
        romanization: primary.romanization,
        meaning: primary.meaning,
        culturalStyle: event.data.culturalStyle,
        textTreatment: event.data.textTreatment,
        stylePack: event.data.stylePack,
        targetLanguage: primary.language,
        creatorArtworkUrl: event.data.creatorArtworkUrl,
        variationSeed: 1000,
      }, 6);
    });

    // ── Step 3: Return structured result ──────────────────────────────────────
    await step.run("store-results", async () => {
      console.log(`[Pipeline] Step 3: ${(candidates as Array<unknown>).length} candidates ready for session ${sessionId}`);
      // In production: write to PersonalizationSession + PersonalizationCandidate records
      return { sessionId, status: "READY" };
    });

    return {
      sessionId,
      status: "READY",
      interpretations: interps,
      candidates: (candidates as Array<{ imageUrl: string; stylePack: string; composition: string; seed: number }>)
        .map((c, i) => ({ index: i, imageUrl: c.imageUrl, stylePack: c.stylePack, composition: c.composition, seed: c.seed })),
      primary,
    };
  }
);

// ── Helper to trigger the pipeline ───────────────────────────────────────────
export async function triggerPersonalizationPipeline(
  data: PersonalizationRequestedPayload
): Promise<string> {
  const result = await inngest.send({
    name: "personalization/requested",
    data,
  });
  // inngest.send returns { ids: string[] } in v3
  return (result as { ids: string[] }).ids?.[0] ?? "queued";
}

// ── Order Fulfillment Pipeline ────────────────────────────────────────────────
export const processOrderFulfillment = inngest.createFunction(
  {
    id: "process-order-fulfillment",
    name: "Process Order Fulfillment",
    triggers: [{ event: "order.placed" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: { event: any; step: any }) => {
    const { orderId } = event.data;

    // ── Step 1: Fetch Order Details ───────────────────────────────────────────
    const order = await step.run("fetch-order", async () => {
      const o = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              personalizationVersion: {
                include: { printAsset: true }
              }
            }
          },
          buyer: true,
        }
      });
      if (!o) throw new Error(`Order ${orderId} not found`);
      return o;
    });

    if (order.fulfillmentStatus !== "PENDING") {
      return { skipped: true, reason: "Order not in PENDING state" };
    }

    // ── Step 2: Push to Printful ──────────────────────────────────────────────
    const providerOrderId = await step.run("create-printful-order", async () => {
      const req = {
        externalId: order.orderNumber,
        recipient: {
          name: order.buyer.displayName || "Valued Customer",
          address1: "123 Art St", // Stubbed for MVP
          city: "San Francisco",
          stateCode: "CA",
          countryCode: "US",
          zip: "94105",
          email: order.buyer.email,
        },
        items: order.items.map((item: any) => ({
          variantId: item.catalogVariantId || "1", // Fallback variant
          quantity: item.quantity,
          files: [
            {
              url: item.personalizationVersion?.printAsset?.url || "https://example.com/fallback.png",
              placement: "front"
            }
          ]
        }))
      };

      try {
        const printfulOrder = await printful.createDraftOrder(req);
        // Immediately confirm it to trigger fulfillment
        await printful.confirmOrder(printfulOrder.id);
        return printfulOrder.id;
      } catch (err: any) {
        throw new Error(`Printful integration failed: ${err.message}`);
      }
    });

    // ── Step 3: Update Database ───────────────────────────────────────────────
    await step.run("update-order-status", async () => {
      await prisma.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: "PROCESSING" }
      });
    });

    return { success: true, providerOrderId };
  }
);

export async function triggerOrderFulfillment(orderId: string): Promise<string> {
  const result = await inngest.send({
    name: "order.placed",
    data: { orderId },
  });
  return (result as { ids: string[] }).ids?.[0] ?? "queued";
}
