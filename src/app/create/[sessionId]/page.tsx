import type { Metadata } from "next";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import { CompositionSchema, type DesignComposition } from "@/lib/print/types";
import {
  loadStudioSharedCatalog,
  resolveStudioCallerIdentity,
} from "@/lib/studio/loadStudioEntryContext";
import type { WordTreatment } from "@/lib/studio/studioStore";
import {
  formatInterpretationBadgeLabel,
  type CulturalCandidate,
} from "@/lib/studio/useStudioAnalysis";

export const metadata: Metadata = {
  title: "Personalization Session — Calligraphy Studio",
  description:
    "Customize your calligraphy brush strokes, cultural interpretation, and merchandise placement.",
  robots: { index: false, follow: false },
};

const SessionUuidSchema = z
  .string()
  .uuid()
  .refine((id) => id !== "00000000-0000-0000-0000-000000000000");

const VALID_TRADITIONS = new Set<ScriptCategory>([
  "VIETNAMESE_THU_PHAP",
  "JAPANESE_SHODO",
  "CHINESE_CALLIGRAPHY",
  "KOREAN_BRUSH",
]);

const VALID_TREATMENTS = new Set<WordTreatment>([
  "KEEP_ORIGINAL",
  "MATCH_SOUND",
  "TRANSLATE_MEANING",
]);

export default async function CreateSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{
    text?: string;
    tradition?: string;
    treatment?: string;
    galleryId?: string;
  }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);

  const [{ products, availableFonts, galleryRemix }, { userId, anonId }] =
    await Promise.all([
      loadStudioSharedCatalog(query.galleryId),
      resolveStudioCallerIdentity(),
    ]);

  let verifiedSessionId: string | undefined;
  let initialComposition: DesignComposition | null = null;
  let initialLocked = false;
  let dbInputText: string | undefined;
  let dbTradition: ScriptCategory | undefined;
  let initialCandidates: CulturalCandidate[] | undefined;

  const parsedSessionId = SessionUuidSchema.safeParse(sessionId);
  if (parsedSessionId.success) {
    verifiedSessionId = parsedSessionId.data;

    const existing = await prisma.personalizationSession.findUnique({
      where: { id: parsedSessionId.data },
      include: { interpretations: true },
    });

    if (existing) {
      const ownsByUser = Boolean(userId && existing.userId === userId);
      const ownsByAnon = Boolean(
        anonId && existing.anonymousSessionId === anonId
      );
      if (ownsByUser || ownsByAnon) {
        initialLocked = existing.status === "CHECKED_OUT";
        dbInputText = existing.inputText;
        if (VALID_TRADITIONS.has(existing.culturalStyle as ScriptCategory)) {
          dbTradition = existing.culturalStyle as ScriptCategory;
        }
        const parsedComp = CompositionSchema.safeParse(
          existing.compositionJson
        );
        if (parsedComp.success) {
          initialComposition = parsedComp.data;
        }
        if (existing.interpretations && existing.interpretations.length > 0) {
          initialCandidates = existing.interpretations.map((item) => ({
            id: item.id,
            type: item.type,
            typeLabel: formatInterpretationBadgeLabel(item.type),
            language: item.language,
            text: item.text,
            romanization: item.romanization ?? null,
            meaning: item.meaning ?? null,
            warning: item.warning ?? null,
            recommended: item.recommended,
          }));
        }
      } else {
        verifiedSessionId = undefined;
      }
    }
  }

  const initialText =
    query.text?.trim() ||
    galleryRemix?.sourceText ||
    dbInputText;

  const initialTradition =
    query.tradition && VALID_TRADITIONS.has(query.tradition as ScriptCategory)
      ? (query.tradition as ScriptCategory)
      : (galleryRemix?.tradition ?? dbTradition ?? "VIETNAMESE_THU_PHAP");

  const initialTreatment =
    query.treatment && VALID_TREATMENTS.has(query.treatment as WordTreatment)
      ? (query.treatment as WordTreatment)
      : "KEEP_ORIGINAL";

  return (
    <div className="w-full h-full bg-background relative">
      <StudioWorkspace
        isAdmin={false}
        products={products}
        availableFonts={availableFonts}
        galleryRemix={galleryRemix}
        initialCandidates={initialCandidates}
        sessionId={verifiedSessionId}
        initialText={initialText}
        initialTradition={initialTradition}
        initialTreatment={initialTreatment}
        initialComposition={initialComposition}
        initialLocked={initialLocked}
      />
    </div>
  );
}
