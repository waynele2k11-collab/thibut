"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import {
  getFontPreviewUtilityClass,
  resolveScriptLang,
  type GalleryRemixContext,
  type StudioFontOption,
} from "@/lib/studio/fontPairing";
import type {
  CreationMode,
  WordTreatment,
} from "@/lib/studio/studioStore";
import type { CulturalCandidate } from "@/lib/studio/useStudioAnalysis";

const CREATION_MODES: ReadonlyArray<{
  value: CreationMode;
  label: string;
}> = [
  { value: "QUOTE", label: "My Quote" },
  { value: "NAME", label: "My Name" },
  { value: "STORY", label: "My Story" },
];

const INSPIRATION_CHIPS: ReadonlyArray<{
  label: string;
  text: string;
  tradition: ScriptCategory;
  treatment: WordTreatment;
  mode: CreationMode;
  lang?: "vi";
}> = [
  {
    label: "Có Chí Thì Nên",
    text: "Có Chí Thì Nên",
    tradition: "VIETNAMESE_THU_PHAP",
    treatment: "KEEP_ORIGINAL",
    mode: "QUOTE",
    lang: "vi",
  },
  {
    label: "Never Give Up → 七転八起",
    text: "Never Give Up",
    tradition: "JAPANESE_SHODO",
    treatment: "TRANSLATE_MEANING",
    mode: "QUOTE",
  },
  {
    label: "Inner Stillness",
    text: "Inner Stillness",
    tradition: "CHINESE_CALLIGRAPHY",
    treatment: "TRANSLATE_MEANING",
    mode: "QUOTE",
  },
  {
    label: "Eternal Hope (Hangul)",
    text: "Eternal Hope",
    tradition: "KOREAN_BRUSH",
    treatment: "TRANSLATE_MEANING",
    mode: "QUOTE",
  },
  {
    label: "Bình An",
    text: "Bình An",
    tradition: "VIETNAMESE_THU_PHAP",
    treatment: "KEEP_ORIGINAL",
    mode: "QUOTE",
    lang: "vi",
  },
];

const TRADITION_CARDS: ReadonlyArray<{
  value: ScriptCategory;
  title: string;
  nativeBadge: string;
  lang: "vi" | "ja" | "zh" | "ko";
  subtitle: string;
}> = [
  {
    value: "VIETNAMESE_THU_PHAP",
    title: "Vietnamese Thư Pháp",
    nativeBadge: "Tâm",
    lang: "vi",
    subtitle: "Sweeping dragon strokes",
  },
  {
    value: "JAPANESE_SHODO",
    title: "Japanese Shodō",
    nativeBadge: "書道",
    lang: "ja",
    subtitle: "Zen Kanji & Kana",
  },
  {
    value: "CHINESE_CALLIGRAPHY",
    title: "Chinese Shūfǎ",
    nativeBadge: "書法",
    lang: "zh",
    subtitle: "Classical Hanzi idioms",
  },
  {
    value: "KOREAN_BRUSH",
    title: "Korean Seoye",
    nativeBadge: "서예",
    lang: "ko",
    subtitle: "Expressive Hangul",
  },
];

export interface StepMeaningPanelProps {
  locked: boolean;
  galleryRemix: GalleryRemixContext | null;
  creationMode: CreationMode;
  onChangeCreationMode: (mode: CreationMode) => void;
  inputText: string;
  onChangeInputText: (text: string) => void;
  tradition: ScriptCategory;
  onChangeTradition: (tradition: ScriptCategory) => void;
  treatment: WordTreatment;
  onChangeTreatment: (treatment: WordTreatment) => void;
  candidates: CulturalCandidate[];
  selectedCandidate: CulturalCandidate | null;
  onSelectCandidate: (id: string) => void;
  isAnalyzing: boolean;
  activeFontOption?: StudioFontOption;
  onApplyInspiration: (preset: {
    text: string;
    tradition: ScriptCategory;
    treatment: WordTreatment;
    mode: CreationMode;
  }) => void;
}

export function StepMeaningPanel({
  locked,
  galleryRemix,
  creationMode,
  onChangeCreationMode,
  inputText,
  onChangeInputText,
  tradition,
  onChangeTradition,
  treatment,
  onChangeTreatment,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  isAnalyzing,
  activeFontOption,
  onApplyInspiration,
}: StepMeaningPanelProps) {
  const scriptLang = resolveScriptLang(tradition);
  const previewFontClass = activeFontOption
    ? getFontPreviewUtilityClass(activeFontOption)
    : "font-headline-md";

  const isNonLatinTradition =
    tradition === "JAPANESE_SHODO" ||
    tradition === "CHINESE_CALLIGRAPHY" ||
    tradition === "KOREAN_BRUSH";
  const looksAsciiPhrase = /^[A-Za-z0-9\s.,'"!?-]+$/.test(inputText.trim());
  const showCulturalNudge =
    isNonLatinTradition &&
    looksAsciiPhrase &&
    inputText.trim().length > 0 &&
    treatment === "KEEP_ORIGINAL";

  return (
    <div className="space-y-6">
      {galleryRemix && (
        <Card className="p-4 bg-surface-container-lowest border-secondary/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="seal" className="mb-2">
                Gallery Remix
              </Badge>
              <p className="font-body-md text-sm font-semibold text-on-background">
                Personalizing &ldquo;{galleryRemix.title}&rdquo;
              </p>
              <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                Replace the words with your own name or phrase while keeping this artwork&apos;s tradition and medium.
              </p>
            </div>
          </div>
        </Card>
      )}

      <section aria-label="Creation mode">
        <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
          What Are You Creating?
        </span>
        <div
          role="radiogroup"
          aria-label="Creation intent"
          className="grid grid-cols-3 gap-2"
        >
          {CREATION_MODES.map((item) => {
            const active =
              creationMode === item.value ||
              (creationMode === "CREATOR_ART" && item.value === "QUOTE");
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked}
                onClick={() => onChangeCreationMode(item.value)}
                className={`min-h-11 px-3 py-2 rounded-lg border font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  active
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:border-outline hover:text-on-background"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor="studio-canvas-words"
            className="font-label-caps text-label-caps uppercase text-on-surface-variant"
          >
            {creationMode === "NAME"
              ? "Your Name or Initials"
              : creationMode === "STORY"
                ? "Your Story or Dedication"
                : "Your Phrase or Proverb"}
          </label>
          <span className="font-body-md text-xs text-on-surface-variant">
            {inputText.length}/200
          </span>
        </div>

        <Input
          id="studio-canvas-words"
          type="text"
          disabled={locked}
          maxLength={200}
          value={inputText}
          onChange={(e) => onChangeInputText(e.target.value)}
          lang={tradition === "VIETNAMESE_THU_PHAP" ? "vi" : undefined}
          className="font-headline-sm text-base h-12 bg-surface-container-lowest"
          placeholder={
            creationMode === "NAME"
              ? "e.g., Minh Tâm, David, Sakura..."
              : "Enter a name, proverb, or meaningful phrase..."
          }
        />

        <div
          className="mt-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap"
          aria-label="Curated phrase prompts"
        >
          {INSPIRATION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={locked}
              lang={chip.lang}
              onClick={() => onApplyInspiration(chip)}
              className="shrink-0 whitespace-nowrap min-h-9 px-3 py-1.5 rounded-full sm:rounded border border-surface-variant bg-surface-container-lowest text-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
          Calligraphy Tradition
        </span>
        <div
          role="radiogroup"
          aria-label="Calligraphy tradition"
          className="grid grid-cols-2 gap-2.5"
        >
          {TRADITION_CARDS.map((card) => {
            const selected = tradition === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked}
                onClick={() => onChangeTradition(card.value)}
                className={`min-w-0 p-3 rounded-lg border text-left transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  selected
                    ? "bg-surface-container-lowest border-2 border-primary"
                    : "bg-surface-container-lowest border-surface-variant hover:border-outline"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    lang={card.lang}
                    className="font-headline-sm text-lg text-primary leading-none"
                  >
                    {card.nativeBadge}
                  </span>
                  {selected && (
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="font-body-md text-xs font-semibold text-on-background">
                  {card.title}
                </div>
                <div className="font-body-md text-[11px] text-on-surface-variant mt-0.5">
                  {card.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Cultural Interpretation Mode
          </span>
          {isAnalyzing && (
            <span className="inline-flex items-center gap-1.5 font-label-caps text-[10px] uppercase text-secondary">
              <Loader2
                className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Analyzing
            </span>
          )}
        </div>

        <Tabs
          value={treatment}
          onValueChange={(next) => {
            if (locked) return;
            if (
              next === "KEEP_ORIGINAL" ||
              next === "MATCH_SOUND" ||
              next === "TRANSLATE_MEANING"
            ) {
              onChangeTreatment(next);
            }
          }}
        >
          <TabsList aria-label="Cultural interpretation mode" className="w-full grid grid-cols-3">
            <TabsTrigger value="KEEP_ORIGINAL" disabled={locked} className="px-2 min-h-11">
              Exact
            </TabsTrigger>
            <TabsTrigger value="MATCH_SOUND" disabled={locked} className="px-2 min-h-11">
              Phonetic
            </TabsTrigger>
            <TabsTrigger value="TRANSLATE_MEANING" disabled={locked} className="px-2 min-h-11">
              Meaning
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {showCulturalNudge && (
          <div className="mt-3 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant flex items-center justify-between gap-3">
            <p className="font-body-md text-xs text-on-surface-variant">
              Want authentic idioms or script characters for{" "}
              <strong className="text-on-background">&ldquo;{inputText.trim()}&rdquo;</strong>?
            </p>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                onChangeTreatment(
                  creationMode === "NAME" ? "MATCH_SOUND" : "TRANSLATE_MEANING"
                )
              }
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-on-primary hover:bg-secondary hover:text-on-secondary font-label-caps text-[11px] uppercase transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Interpret
            </button>
          </div>
        )}
      </section>

      <section aria-label="Cultural Intelligence options">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            {candidates.length > 1
              ? `Select Nuance (${candidates.length} Options)`
              : "Active Phrase Preview"}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Cultural interpretation candidates"
          className="space-y-3"
        >
          {candidates.map((candidate) => {
            const isSelected = selectedCandidate?.id === candidate.id;
            return (
              <button
                key={candidate.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={locked}
                onClick={() => onSelectCandidate(candidate.id)}
                className={`w-full text-left rounded-lg p-4 transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary relative ${
                  isSelected
                    ? "bg-surface-container-lowest border-2 border-primary"
                    : "bg-surface-container-lowest border border-surface-variant hover:border-outline"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={isSelected ? "secondary" : "outline"}>
                      {candidate.typeLabel}
                    </Badge>
                    {candidate.recommended && candidates.length > 1 && (
                      <Badge variant="default">Recommended</Badge>
                    )}
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary text-on-primary"
                        : "border-outline-variant"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                  </span>
                </div>

                <div className="py-3 px-4 rounded bg-surface-container-low border border-surface-variant/70 text-center mb-3">
                  <span
                    lang={scriptLang}
                    className={`${previewFontClass} text-2xl text-primary leading-snug break-words`}
                  >
                    {candidate.text}
                  </span>
                </div>

                {candidate.romanization && (
                  <p className="font-headline-sm text-base text-primary mb-0.5">
                    {candidate.romanization}
                  </p>
                )}

                {candidate.meaning && (
                  <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                    {candidate.meaning}
                  </p>
                )}

                {candidate.warning && (
                  <p className="font-body-md text-[11px] text-secondary mt-2 pt-2 border-t border-surface-variant">
                    {candidate.warning}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
