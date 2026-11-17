import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { MOCK_PRODUCTS } from "@/components/studio/ProductSelectionModal";
import type { WordTreatment } from "@/components/studio/StudioInspector";
import { StudioOnboardingModal } from "@/components/studio/StudioOnboardingModal";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import { getActiveProductsForStudio } from "@/lib/fulfillment/getActiveProducts";
import { CompositionSchema, type DesignComposition } from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { createClient } from "@/utils/supabase/server";

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
  }>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);

  let products = await getActiveProductsForStudio();
  if (!products || products.length === 0) {
    products = MOCK_PRODUCTS;
  }

  let verifiedSessionId: string | undefined;
  let initialComposition: DesignComposition | null = null;
  let initialLocked = false;
  let dbInputText: string | undefined;
  let dbTradition: ScriptCategory | undefined;

  const parsedSessionId = SessionUuidSchema.safeParse(sessionId);
  if (parsedSessionId.success) {
    verifiedSessionId = parsedSessionId.data;

    const cookieStore = await cookies();
    const anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );

    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user?.id) {
        userId = data.user.id;
      }
    } catch {
      userId = null;
    }

    const existing = await prisma.personalizationSession.findUnique({
      where: { id: parsedSessionId.data },
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
      } else {
        // Do not expose or bind another visitor's session ID
        verifiedSessionId = undefined;
      }
    }
  }

  const initialText = query.text?.trim() || dbInputText;
  const initialTradition =
    query.tradition && VALID_TRADITIONS.has(query.tradition as ScriptCategory)
      ? (query.tradition as ScriptCategory)
      : (dbTradition ?? "VIETNAMESE_THU_PHAP");
  const initialTreatment =
    query.treatment && VALID_TREATMENTS.has(query.treatment as WordTreatment)
      ? (query.treatment as WordTreatment)
      : "KEEP_ORIGINAL";

  return (
    <div className="w-full h-full bg-background relative">
      <StudioOnboardingModal />
      <StudioWorkspace
        isAdmin={false}
        products={products}
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
