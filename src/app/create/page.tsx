import type { Metadata } from "next";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import {
  loadStudioSharedCatalog,
  resolveStudioCallerIdentity,
} from "@/lib/studio/loadStudioEntryContext";
import type { WordTreatment } from "@/lib/studio/studioStore";

export const metadata: Metadata = {
  title: "Personalization Studio — Create Custom Calligraphy",
  description:
    "Transform your name, quote, or story into authentic Vietnamese, Japanese, Chinese, or Korean calligraphy in the Thi Bút Studio.",
};

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

export default async function CreateIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    text?: string;
    tradition?: string;
    treatment?: string;
    galleryId?: string;
  }>;
}) {
  const query = await searchParams;
  const { userId, anonId } = await resolveStudioCallerIdentity();

  const forwarded = new URLSearchParams();
  if (query.text) forwarded.set("text", query.text);
  if (query.tradition) forwarded.set("tradition", query.tradition);
  if (query.treatment) forwarded.set("treatment", query.treatment);
  if (query.galleryId) forwarded.set("galleryId", query.galleryId);
  const querySuffix = forwarded.toString() ? `?${forwarded.toString()}` : "";

  let existingDraftSessionId: string | null = null;
  if (userId || anonId) {
    try {
      const draft = await prisma.personalizationSession.findFirst({
        where: userId
          ? { userId, status: "DRAFT" }
          : { anonymousSessionId: anonId, userId: null, status: "DRAFT" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (draft?.id) {
        existingDraftSessionId = draft.id;
      }
    } catch {
      existingDraftSessionId = null;
    }
  }

  if (existingDraftSessionId) {
    redirect(`/create/${existingDraftSessionId}${querySuffix}`);
  }

  const { products, availableFonts, galleryRemix } =
    await loadStudioSharedCatalog(query.galleryId);

  const initialText = query.text?.trim() || galleryRemix?.sourceText;
  const initialTradition =
    query.tradition && VALID_TRADITIONS.has(query.tradition as ScriptCategory)
      ? (query.tradition as ScriptCategory)
      : (galleryRemix?.tradition ?? "VIETNAMESE_THU_PHAP");
  const initialTreatment =
    query.treatment && VALID_TREATMENTS.has(query.treatment as WordTreatment)
      ? (query.treatment as WordTreatment)
      : "KEEP_ORIGINAL";

  return (
    <div className="w-full h-full bg-background relative">
      <StudioWorkspace
        isAdmin={false}
        shouldSyncSessionUrl={true}
        products={products}
        availableFonts={availableFonts}
        galleryRemix={galleryRemix}
        initialText={initialText}
        initialTradition={initialTradition}
        initialTreatment={initialTreatment}
      />
    </div>
  );
}
