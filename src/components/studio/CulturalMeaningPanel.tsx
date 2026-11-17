"use client";

import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";

export interface CulturalInsight {
  renderedText: string;
  romanization: string | null;
  meaning: string | null;
  warning: string | null;
  typeLabel: string;
}

function resolveScriptLang(tradition: ScriptCategory): string | undefined {
  switch (tradition) {
    case "VIETNAMESE_THU_PHAP":
      return "vi";
    case "JAPANESE_SHODO":
      return "ja";
    case "CHINESE_CALLIGRAPHY":
      return "zh";
    case "KOREAN_BRUSH":
      return "ko";
    default:
      return undefined;
  }
}

export function CulturalMeaningBar({
  insight,
  tradition,
  isAnalyzing,
  activeSessionId,
  isAdmin,
  isLocked,
}: {
  insight: CulturalInsight;
  tradition: ScriptCategory;
  isAnalyzing: boolean;
  activeSessionId?: string;
  isAdmin: boolean;
  isLocked: boolean;
}) {
  const scriptLang = resolveScriptLang(tradition);

  return (
    <aside
      aria-label="Cultural Meaning and Romanization"
      className="hidden lg:flex items-center justify-between gap-6 px-8 py-4 bg-surface-container-lowest border-t border-surface-variant shrink-0"
    >
      <div className="flex items-start gap-3 min-w-0">
        <BookOpen
          className="w-4 h-4 text-secondary shrink-0 mt-1"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              Cultural Meaning &amp; Romanization ({insight.typeLabel})
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
          <p className="font-body-md text-sm text-on-background mt-0.5 truncate">
            <span lang={scriptLang} className="font-medium">
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
          {insight.warning && (
            <p className="text-xs text-error mt-0.5">{insight.warning}</p>
          )}
        </div>
      </div>

      {activeSessionId && !isAdmin && !isLocked && (
        <Link
          href={`/checkout?sessionId=${encodeURIComponent(activeSessionId)}&digital=true`}
          className="shrink-0 font-label-caps text-[11px] uppercase text-secondary hover:underline"
        >
          Buy 300 DPI Digital Master
        </Link>
      )}
    </aside>
  );
}

export function MobileCulturalMeaningSummary({
  insight,
  tradition,
}: {
  insight: CulturalInsight;
  tradition: ScriptCategory;
}) {
  const scriptLang = resolveScriptLang(tradition);

  return (
    <div className="px-6 pt-2 pb-3 border-b border-surface-variant bg-surface-container-lowest">
      <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
        Cultural Meaning ({insight.typeLabel})
      </p>
      <p className="text-xs text-on-background mt-0.5">
        <strong lang={scriptLang}>{insight.renderedText}</strong>
        {insight.romanization ? ` · ${insight.romanization}` : ""}
        {insight.meaning ? ` — ${insight.meaning}` : ""}
      </p>
    </div>
  );
}
