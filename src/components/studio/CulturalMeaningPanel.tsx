"use client";

import { BookOpen, Loader2 } from "lucide-react";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import { resolveScriptLang } from "@/lib/studio/fontPairing";
import type { StudioStep } from "@/lib/studio/studioStore";

export interface CulturalInsight {
  renderedText: string;
  romanization: string | null;
  meaning: string | null;
  warning: string | null;
  typeLabel: string;
}

export function CulturalMeaningBar({
  insight,
  tradition,
  isAnalyzing,
  activeStep,
  onJumpToMeaning,
}: {
  insight: CulturalInsight;
  tradition: ScriptCategory;
  isAnalyzing: boolean;
  activeStep: StudioStep;
  onJumpToMeaning: () => void;
}) {
  const scriptLang = resolveScriptLang(tradition);

  return (
    <aside
      aria-label="Cultural Meaning and Romanization"
      className="flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 lg:py-3.5 bg-surface-container-lowest border-t border-surface-variant shrink-0"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <BookOpen
          className="w-4 h-4 text-secondary shrink-0 hidden sm:block"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              Artwork Meaning · {insight.typeLabel}
            </span>
            {isAnalyzing && (
              <span className="inline-flex items-center gap-1 font-label-caps text-[10px] uppercase text-secondary">
                <Loader2
                  className="w-3 h-3 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Analyzing
              </span>
            )}
          </div>
          <p className="font-body-md text-xs sm:text-sm text-on-background truncate">
            <span lang={scriptLang} className="font-semibold">
              &ldquo;{insight.renderedText}&rdquo;
            </span>
            {insight.romanization ? (
              <span className="text-on-surface-variant">
                {" "}
                · {insight.romanization}
              </span>
            ) : null}
            {insight.meaning ? (
              <span className="text-on-surface-variant italic">
                {" "}
                — {insight.meaning}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {activeStep !== "MEANING" && (
        <button
          type="button"
          onClick={onJumpToMeaning}
          className="shrink-0 font-label-caps text-[10px] uppercase text-secondary hover:underline cursor-pointer"
        >
          Edit Words
        </button>
      )}
    </aside>
  );
}
