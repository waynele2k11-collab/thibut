"use client";

import { useState } from "react";
import { AlertTriangle, Check, CircleDot, MoveHorizontal, MoveVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BackgroundLayerControls } from "./BackgroundLayerControls";
import type {
  StrokePresetOption,
  VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  CATEGORY_LABELS,
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import {
  BRUSH_EXPRESSION_PRESETS,
  getCanonicalStudioFontValue,
  getFontPreviewUtilityClass,
  getFontsForTradition,
  isSameStudioFont,
  resolveScriptLang,
  type StudioFontOption,
} from "@/lib/studio/fontPairing";
import type { GarmentInkContrastAdvice } from "@/lib/studio/garmentSwatches";
import { INK_SWATCHES } from "@/lib/studio/inkPalette";
import type {
  InkPigment,
  StudioLayoutMode,
  WordTreatment,
} from "@/lib/studio/studioStore";

const LICENSED_SEAL_FONTS: ReadonlyArray<{
  label: string;
  name: string;
}> = [
  { label: "Ma Shan Zheng (Seal)", name: DEFAULT_SEAL_FONT_FAMILY },
  { label: "Thiên Ân Brush", name: "UTM Thư Pháp Thiên Ân" },
  { label: "Zhi Mang Xing", name: "Zhi Mang Xing" },
];

const SEAL_STAMP_CHIPS: ReadonlyArray<{
  glyph: string;
  meaning: string;
  lang: "zh" | "vi";
}> = [
  { glyph: "印", meaning: "Seal", lang: "zh" },
  { glyph: "心", meaning: "Mind", lang: "zh" },
  { glyph: "福", meaning: "Blessing", lang: "zh" },
  { glyph: "道", meaning: "Way", lang: "zh" },
  { glyph: "Tâm", meaning: "Heart", lang: "vi" },
];

const ORIENTATION_OPTIONS: ReadonlyArray<{
  value: StudioLayoutMode;
  label: string;
  desc: string;
  icon: typeof MoveVertical;
}> = [
  {
    value: "VERTICAL",
    label: "Vertical",
    desc: "Scroll",
    icon: MoveVertical,
  },
  {
    value: "HORIZONTAL",
    label: "Horizontal",
    desc: "Banner",
    icon: MoveHorizontal,
  },
  {
    value: "EMBLEM",
    label: "Zen Emblem",
    desc: "Circle",
    icon: CircleDot,
  },
];

export interface StepBrushPanelProps {
  locked: boolean;
  renderedText: string;
  tradition: ScriptCategory;
  treatment: WordTreatment;
  availableFonts: readonly StudioFontOption[];
  fontFamily: string;
  onSelectFontFamily: (fontFamily: string) => void;
  strokePreset: StrokePresetOption;
  variationType: VariationTypeOption;
  onSelectExpression: (
    strokePreset: StrokePresetOption,
    variationType: VariationTypeOption
  ) => void;
  layoutMode: StudioLayoutMode;
  onChangeLayoutMode: (mode: StudioLayoutMode) => void;
  inkColor: InkPigment;
  onSelectInkColor: (hex: InkPigment) => void;
  contrastAdvice: GarmentInkContrastAdvice | null;
  hasSeal: boolean;
  onToggleSeal: (hasSeal: boolean) => void;
  sealText: string;
  onChangeSealText: (sealText: string) => void;
  sealFontFamily: string;
  onChangeSealFontFamily: (font: string) => void;
  backgroundAssetId?: string | null;
  backgroundFillMode?: "cover" | "contain";
  onChangeBackgroundAsset?: (assetId: string | null) => void;
  onChangeBackgroundFillMode?: (fillMode: "cover" | "contain") => void;
}

export function StepBrushPanel({
  locked,
  renderedText,
  tradition,
  treatment,
  availableFonts,
  fontFamily,
  onSelectFontFamily,
  strokePreset,
  variationType,
  onSelectExpression,
  layoutMode,
  onChangeLayoutMode,
  inkColor,
  onSelectInkColor,
  contrastAdvice,
  hasSeal,
  onToggleSeal,
  sealText,
  onChangeSealText,
  sealFontFamily,
  onChangeSealFontFamily,
  backgroundAssetId = null,
  backgroundFillMode = "contain",
  onChangeBackgroundAsset = () => {},
  onChangeBackgroundFillMode = () => {},
}: StepBrushPanelProps) {
  const [showGlobalLatin, setShowGlobalLatin] = useState(false);
  const canToggleGlobalLatin =
    tradition !== "VIETNAMESE_THU_PHAP" && treatment === "KEEP_ORIGINAL";
  const visibleFonts = getFontsForTradition(
    tradition,
    availableFonts,
    canToggleGlobalLatin && showGlobalLatin
  );
  const scriptLang = resolveScriptLang(tradition);
  const liveSample = (renderedText.trim() || "Thi Bút").slice(0, 18);

  const activePigment =
    INK_SWATCHES.find(
      (p) => p.hex.toUpperCase() === inkColor.trim().toUpperCase()
    ) ?? INK_SWATCHES[0];

  return (
    <div className="space-y-7">
      <section>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div>
            <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant">
              Master Brush Typeface
            </span>
            <span className="font-body-md text-xs text-on-surface-variant">
              {CATEGORY_LABELS[tradition]} · Commercial Print Verified
            </span>
          </div>
          {canToggleGlobalLatin && (
            <button
              type="button"
              disabled={locked}
              onClick={() => setShowGlobalLatin((prev) => !prev)}
              className="font-label-caps text-[10px] uppercase text-secondary hover:underline cursor-pointer"
            >
              {showGlobalLatin ? "Tradition Only" : "+ Latin Scripts"}
            </button>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label="Master brush font"
          className="grid grid-cols-2 gap-2.5"
        >
          {visibleFonts.map((font) => {
            const canonicalValue = getCanonicalStudioFontValue(font);
            const isSelected = isSameStudioFont(fontFamily, font);
            const previewClass = getFontPreviewUtilityClass(font);
            const cardLang = resolveScriptLang(font.category);

            return (
              <button
                key={font.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={locked}
                onClick={() => onSelectFontFamily(canonicalValue)}
                className={`p-3 text-left rounded-lg border transition-colors motion-reduce:transition-none bg-surface-container-lowest cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  isSelected
                    ? "border-2 border-primary"
                    : "border-surface-variant hover:border-outline"
                }`}
              >
                <div className="min-h-11 px-2 py-1.5 mb-2 rounded bg-surface-container-low flex items-center justify-between gap-1 overflow-hidden">
                  <span
                    lang={scriptLang || cardLang}
                    className={`${previewClass} text-xl text-primary leading-tight truncate`}
                  >
                    {liveSample}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <div className="font-body-md text-xs font-semibold text-on-background truncate">
                  {font.name}
                </div>
                <div className="font-body-md text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                  {font.categoryLabel}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
          Brush &amp; Ink Expression
        </span>
        <div
          role="radiogroup"
          aria-label="Brush stroke expression"
          className="space-y-2"
        >
          {BRUSH_EXPRESSION_PRESETS.map((preset) => {
            const isSelected =
              strokePreset === preset.strokePreset &&
              variationType === preset.variationType;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={locked}
                onClick={() =>
                  onSelectExpression(preset.strokePreset, preset.variationType)
                }
                className={`w-full p-3.5 rounded-lg border text-left transition-colors motion-reduce:transition-none bg-surface-container-lowest cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  isSelected
                    ? "border-2 border-primary"
                    : "border-surface-variant hover:border-outline"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-headline-sm text-base text-on-background">
                      {preset.title}
                    </span>
                    <span className="font-body-md text-xs text-on-surface-variant">
                      · {preset.subtitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {preset.badge && (
                      <Badge variant="seal">{preset.badge}</Badge>
                    )}
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary text-on-primary"
                          : "border-outline-variant"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                    </span>
                  </div>
                </div>
                <p className="font-body-md text-xs text-on-surface-variant mt-1">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2.5">
          Scroll Composition
        </span>
        <div
          role="radiogroup"
          aria-label="Scroll composition orientation"
          className="grid grid-cols-3 gap-2"
        >
          {ORIENTATION_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = layoutMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={locked}
                onClick={() => onChangeLayoutMode(opt.value)}
                className={`min-h-14 p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  active
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:border-outline hover:text-on-background"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="font-label-caps text-[10px] uppercase">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Ink Pigment
          </span>
          <span className="font-body-md text-xs font-medium text-on-background">
            {activePigment?.name ?? "Custom Ink"}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {INK_SWATCHES.map((pigment) => {
            const isSelected =
              inkColor.toUpperCase() === pigment.hex.toUpperCase();
            return (
              <button
                key={pigment.name}
                type="button"
                disabled={locked}
                onClick={() => onSelectInkColor(pigment.hex)}
                aria-label={`Select ${pigment.name} ink pigment`}
                aria-pressed={isSelected}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform motion-reduce:transition-none motion-reduce:transform-none cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                  pigment.swatchClass
                } ${
                  isSelected
                    ? "ring-2 ring-offset-2 ring-primary ring-offset-surface-container-low scale-105"
                    : "hover:scale-105"
                }`}
              >
                {isSelected && (
                  <Check
                    className={`w-4 h-4 ${pigment.checkClass}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {contrastAdvice && (
          <div className="mt-3 p-3 rounded-lg bg-surface-container-lowest border border-secondary/40 flex flex-col gap-2">
            <div className="flex items-start gap-2 text-xs text-on-background">
              <AlertTriangle
                className="w-4 h-4 text-secondary shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{contrastAdvice.message}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap pl-6">
              <button
                type="button"
                disabled={locked}
                onClick={() => onSelectInkColor(contrastAdvice.suggestedInkHex)}
                className="px-2.5 py-1 rounded bg-primary text-on-primary font-label-caps text-[10px] uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none cursor-pointer"
              >
                Switch to {contrastAdvice.suggestedInkName}
              </button>
              {contrastAdvice.secondaryInkHex && contrastAdvice.secondaryInkName && (
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    onSelectInkColor(contrastAdvice.secondaryInkHex!)
                  }
                  className="px-2.5 py-1 rounded border border-outline-variant bg-surface-container-low text-on-background font-label-caps text-[10px] uppercase hover:border-primary transition-colors motion-reduce:transition-none cursor-pointer"
                >
                  Try {contrastAdvice.secondaryInkName}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="pt-4 border-t border-surface-variant">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">
              Vermilion Chop Seal
            </span>
            <span className="font-body-md text-xs text-on-surface-variant">
              Traditional artisan stamp (Ấn Triện)
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hasSeal}
            aria-label="Include vermilion chop seal"
            disabled={locked}
            onClick={() => onToggleSeal(!hasSeal)}
            className={`w-11 h-6 rounded-full transition-colors motion-reduce:transition-none relative shrink-0 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              hasSeal ? "bg-secondary" : "bg-surface-container-highest"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-on-primary rounded-full transition-all motion-reduce:transition-none ${
                hasSeal ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {hasSeal && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="studio-seal-text"
                  className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1"
                >
                  Seal Glyph (Max 3)
                </label>
                <Input
                  id="studio-seal-text"
                  type="text"
                  disabled={locked}
                  maxLength={3}
                  value={sealText}
                  onChange={(e) => onChangeSealText(e.target.value)}
                  className="h-10 px-2.5 py-2 text-sm bg-surface-container-lowest"
                />
              </div>
              <div>
                <label
                  htmlFor="studio-seal-font"
                  className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1"
                >
                  Seal Script
                </label>
                <select
                  id="studio-seal-font"
                  disabled={locked}
                  value={sealFontFamily}
                  onChange={(e) => onChangeSealFontFamily(e.target.value)}
                  className="w-full h-10 px-2.5 py-2 rounded border border-outline-variant text-sm text-on-surface bg-surface-container-lowest cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-60"
                >
                  {LICENSED_SEAL_FONTS.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {SEAL_STAMP_CHIPS.map((stamp) => (
                <button
                  key={stamp.glyph}
                  type="button"
                  disabled={locked}
                  lang={stamp.lang}
                  onClick={() => onChangeSealText(stamp.glyph)}
                  className={`min-h-8 px-2.5 py-1 rounded border text-xs transition-colors motion-reduce:transition-none cursor-pointer ${
                    sealText === stamp.glyph
                      ? "bg-secondary text-on-secondary border-secondary"
                      : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:border-primary hover:text-primary"
                  }`}
                >
                  {stamp.glyph} · {stamp.meaning}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <BackgroundLayerControls
        locked={locked}
        backgroundAssetId={backgroundAssetId}
        backgroundFillMode={backgroundFillMode}
        onChangeBackgroundAsset={onChangeBackgroundAsset}
        onChangeBackgroundFillMode={onChangeBackgroundFillMode}
      />
    </div>
  );
}
