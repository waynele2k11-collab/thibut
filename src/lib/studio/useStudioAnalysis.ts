"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import type { CulturalInsight } from "@/components/studio/CulturalMeaningPanel";
import type { WordTreatment } from "@/components/studio/StudioInspector";

const AnalyzeResponseSchema = z.object({
  interpretations: z
    .array(
      z.object({
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

export function useStudioAnalysis(
  inputText: string,
  tradition: ScriptCategory,
  treatment: WordTreatment
): {
  renderedText: string;
  culturalInsight: CulturalInsight;
  isAnalyzing: boolean;
} {
  const [analyzedResult, setAnalyzedResult] = useState<{
    key: string;
    insight: CulturalInsight;
  } | null>(null);
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);

  const cleanInput = inputText.trim();
  const currentInsightKey = `${cleanInput}|${tradition}|${treatment}`;
  const matchedInsight =
    analyzedResult && analyzedResult.key === currentInsightKey
      ? analyzedResult.insight
      : null;

  const renderedText = !cleanInput
    ? "Thi Bút"
    : treatment === "KEEP_ORIGINAL"
      ? cleanInput
      : (matchedInsight?.renderedText ?? cleanInput);

  const culturalInsight: CulturalInsight = !cleanInput
    ? {
        renderedText: "Thi Bút",
        romanization: null,
        meaning: "Enter a word or phrase to see its cultural interpretation.",
        warning: null,
        typeLabel: "Studio Default",
      }
    : (matchedInsight ?? {
        renderedText: cleanInput,
        romanization: null,
        meaning:
          cleanInput === "Có Chí Thì Nên"
            ? "Perseverance turns aspiration into mastery."
            : null,
        warning: null,
        typeLabel:
          treatment === "KEEP_ORIGINAL" ? "Original Phrase" : "Interpreting",
      });

  const isAnalyzing = Boolean(cleanInput) && analyzingKey === currentInsightKey;

  useEffect(() => {
    if (!cleanInput) return;

    const apiTreatment =
      treatment === "MATCH_SOUND"
        ? "PHONETIC"
        : treatment === "TRANSLATE_MEANING"
          ? "TRANSLATE"
          : "KEEP_ORIGINAL";

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAnalyzingKey(currentInsightKey);
      try {
        const res = await fetch("/api/personalization/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText: cleanInput,
            culturalStyle: tradition,
            textTreatment: apiTreatment,
            mode: cleanInput.includes(" ") ? "QUOTE" : "NAME",
          }),
          signal: controller.signal,
        });
        if (!res.ok) return;

        const rawJson: unknown = await res.json();
        const parsed = AnalyzeResponseSchema.safeParse(rawJson);
        if (!parsed.success || parsed.data.interpretations.length === 0) return;

        const list = parsed.data.interpretations;
        const preferred = list.find((item) => item.recommended) ?? list[0]!;
        setAnalyzedResult({
          key: currentInsightKey,
          insight: {
            renderedText: preferred.text.trim() || cleanInput,
            romanization: preferred.romanization ?? null,
            meaning: preferred.meaning ?? null,
            warning: preferred.warning ?? null,
            typeLabel: preferred.type.replace(/_/g, " "),
          },
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
  }, [cleanInput, currentInsightKey, tradition, treatment]);

  return { renderedText, culturalInsight, isAnalyzing };
}
