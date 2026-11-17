"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import type { CulturalInsight } from "@/components/studio/CulturalMeaningPanel";
import type { CreationMode, WordTreatment } from "./studioStore";

export interface CulturalCandidate {
  id: string;
  type: string;
  typeLabel: string;
  language: string;
  text: string;
  romanization: string | null;
  meaning: string | null;
  warning: string | null;
  recommended: boolean;
}

const AnalyzeResponseSchema = z.object({
  sessionId: z.string().optional(),
  interpretations: z
    .array(
      z.object({
        id: z.string().optional(),
        type: z.string(),
        language: z.string().optional(),
        text: z.string(),
        romanization: z.string().nullable().optional(),
        meaning: z.string().nullable().optional(),
        warning: z.string().nullable().optional(),
        recommended: z.boolean().optional(),
      })
    )
    .default([]),
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatInterpretationBadgeLabel(rawType: string): string {
  const upper = rawType.trim().toUpperCase();
  switch (upper) {
    case "ORIGINAL":
      return "Exact Original";
    case "IDIOMATIC":
      return "Idiomatic";
    case "POETIC":
      return "Poetic / Philosophical";
    case "NATURAL":
      return "Natural Expression";
    case "LITERAL":
      return "Literal";
    case "PHONETIC":
    case "TRANSLITERATION":
    case "SCRIPT_ADAPTATION":
      return "Phonetic Sound";
    case "SINO_VIETNAMESE":
      return "Sino-Vietnamese (Hán-Việt)";
    default:
      return rawType.replace(/_/g, " ");
  }
}

export function useStudioAnalysis(
  inputText: string,
  tradition: ScriptCategory,
  treatment: WordTreatment,
  options?: {
    activeSessionId?: string;
    creationMode?: CreationMode;
    selectedInterpretationId?: string | null;
    initialCandidates?: CulturalCandidate[];
  }
): {
  renderedText: string;
  culturalInsight: CulturalInsight;
  candidates: CulturalCandidate[];
  selectedCandidate: CulturalCandidate | null;
  isAnalyzing: boolean;
} {
  const activeSessionId = options?.activeSessionId;
  const creationMode = options?.creationMode ?? "QUOTE";
  const selectedInterpretationId = options?.selectedInterpretationId ?? null;
  const initialCandidates = options?.initialCandidates;

  const cleanInput = inputText.trim();
  const currentInsightKey = `${cleanInput}|${tradition}|${treatment}|${creationMode}`;

  const [analyzedResult, setAnalyzedResult] = useState<{
    key: string;
    candidates: CulturalCandidate[];
  } | null>(() =>
    initialCandidates && initialCandidates.length > 0 && cleanInput
      ? { key: currentInsightKey, candidates: initialCandidates }
      : null
  );
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);

  const candidates = useMemo<CulturalCandidate[]>(() => {
    if (!cleanInput) return [];
    if (analyzedResult && analyzedResult.key === currentInsightKey) {
      return analyzedResult.candidates;
    }
    if (treatment === "KEEP_ORIGINAL") {
      return [
        {
          id: "local-original",
          type: "ORIGINAL",
          typeLabel: "Exact Original",
          language: "Original",
          text: cleanInput,
          romanization: null,
          meaning:
            cleanInput === "Có Chí Thì Nên"
              ? "Perseverance turns aspiration into mastery."
              : "Preserves your exact words and spelling on the brush canvas.",
          warning: null,
          recommended: true,
        },
      ];
    }
    return [];
  }, [analyzedResult, cleanInput, currentInsightKey, treatment]);

  const selectedCandidate = useMemo<CulturalCandidate | null>(() => {
    if (candidates.length === 0) return null;
    if (selectedInterpretationId) {
      const explicit = candidates.find((c) => c.id === selectedInterpretationId);
      if (explicit) return explicit;
    }
    return candidates.find((c) => c.recommended) ?? candidates[0] ?? null;
  }, [candidates, selectedInterpretationId]);

  const renderedText = !cleanInput
    ? "Thi Bút"
    : treatment === "KEEP_ORIGINAL"
      ? cleanInput
      : (selectedCandidate?.text.trim() || cleanInput);

  const culturalInsight: CulturalInsight = !cleanInput
    ? {
        renderedText: "Thi Bút",
        romanization: null,
        meaning: "Enter a word or phrase to see its cultural interpretation.",
        warning: null,
        typeLabel: "Studio Default",
      }
    : selectedCandidate
      ? {
          renderedText: selectedCandidate.text,
          romanization: selectedCandidate.romanization,
          meaning: selectedCandidate.meaning,
          warning: selectedCandidate.warning,
          typeLabel: selectedCandidate.typeLabel,
        }
      : {
          renderedText: cleanInput,
          romanization: null,
          meaning:
            cleanInput === "Có Chí Thì Nên"
              ? "Perseverance turns aspiration into mastery."
              : null,
          warning: null,
          typeLabel:
            treatment === "KEEP_ORIGINAL" ? "Exact Original" : "Analyzing Nuance",
        };

  const isAnalyzing = Boolean(cleanInput) && analyzingKey === currentInsightKey;

  useEffect(() => {
    if (!cleanInput) return;

    const apiTreatment =
      treatment === "MATCH_SOUND"
        ? "PHONETIC"
        : treatment === "TRANSLATE_MEANING"
          ? "TRANSLATE"
          : "KEEP_ORIGINAL";

    const resolvedMode: CreationMode =
      creationMode === "CREATOR_ART"
        ? "CREATOR_ART"
        : creationMode === "STORY"
          ? "STORY"
          : creationMode === "NAME" || !cleanInput.includes(" ")
            ? "NAME"
            : "QUOTE";

    const validSessionId =
      activeSessionId && UUID_REGEX.test(activeSessionId)
        ? activeSessionId
        : undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAnalyzingKey(currentInsightKey);
      try {
        const res = await fetch("/api/personalization/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(validSessionId ? { sessionId: validSessionId } : {}),
            inputText: cleanInput,
            culturalStyle: tradition,
            textTreatment: apiTreatment,
            mode: resolvedMode,
          }),
          signal: controller.signal,
        });
        if (!res.ok) return;

        const rawJson: unknown = await res.json();
        const parsed = AnalyzeResponseSchema.safeParse(rawJson);
        if (!parsed.success || parsed.data.interpretations.length === 0) return;

        const mapped: CulturalCandidate[] = parsed.data.interpretations.map(
          (item, index) => ({
            id: item.id || `${item.type}-${index}`,
            type: item.type,
            typeLabel: formatInterpretationBadgeLabel(item.type),
            language: item.language || "Target Script",
            text: item.text.trim() || cleanInput,
            romanization: item.romanization ?? null,
            meaning: item.meaning ?? null,
            warning: item.warning ?? null,
            recommended: Boolean(item.recommended),
          })
        );

        setAnalyzedResult({
          key: currentInsightKey,
          candidates: mapped,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setAnalyzingKey((prev) =>
            prev === currentInsightKey ? null : prev
          );
        }
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeSessionId,
    cleanInput,
    creationMode,
    currentInsightKey,
    tradition,
    treatment,
  ]);

  return {
    renderedText,
    culturalInsight,
    candidates,
    selectedCandidate,
    isAnalyzing,
  };
}
