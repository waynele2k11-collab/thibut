"use client";

import { Check, Info } from "lucide-react";
import type { StrokePresetOption } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import type { PlacementValue } from "@/lib/print/types";
import type { ProductMock } from "./ProductSelectionModal";

export type WordTreatment =
  | "KEEP_ORIGINAL"
  | "MATCH_SOUND"
  | "TRANSLATE_MEANING";

export type InkPigment =
  | "#121212"
  | "#FFFFFF"
  | "#B71032"
  | "#C5A059"
  | "#F6F1E7"
  | string;

export interface StudioInspectorProps {
  isAdmin: boolean;
  locked?: boolean;
  inputText: string;
  setInputText: (v: string) => void;
  tradition: ScriptCategory;
  setTradition: (v: ScriptCategory) => void;
  treatment: WordTreatment;
  setTreatment: (v: WordTreatment) => void;
  strokePreset: StrokePresetOption;
  setStrokePreset: (v: StrokePresetOption) => void;
  inkColor: InkPigment;
  setInkColor: (v: InkPigment) => void;
  hasSeal: boolean;
  setHasSeal: (v: boolean) => void;
  sealText: string;
  setSealText: (v: string) => void;
  sealFontFamily: string;
  setSealFontFamily: (v: string) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  placement: PlacementValue;
  setPlacement: (p: PlacementValue) => void;
  selectedProduct?: ProductMock;
  selectedVariantId?: string;
  onSelectVariant: (v: string) => void;
  onSelectProduct: () => void;
}

const PIGMENTS: ReadonlyArray<{
  name: string;
  hex: string;
  swatchClass: string;
  checkClass: string;
}> = [
  {
    name: "Sumi Black",
    hex: "#121212",
    swatchClass: "bg-[#121212]",
    checkClass: "text-white",
  },
  {
    name: "Pure White",
    hex: "#FFFFFF",
    swatchClass: "bg-white border border-surface-variant",
    checkClass: "text-on-background",
  },
  {
    name: "Cinnabar Red",
    hex: "#B71032",
    swatchClass: "bg-secondary",
    checkClass: "text-white",
  },
  {
    name: "Imperial Gold",
    hex: "#C5A059",
    swatchClass: "bg-[#C5A059]",
    checkClass: "text-white",
  },
  {
    name: "Rice Paper Ivory",
    hex: "#F6F1E7",
    swatchClass: "bg-[#F6F1E7] border border-surface-variant",
    checkClass: "text-on-background",
  },
];

const LICENSED_BRUSH_FONTS: ReadonlyArray<{
  id: string;
  label: string;
  type: string;
  sample: string;
}> = [
  {
    id: "UTM Thư Pháp Thiên Ân",
    label: "Thiên Ân",
    type: "Vietnamese Master",
    sample: "Tâm",
  },
  {
    id: "Kaushan Script",
    label: "Kaushan Brush",
    type: "Dry Expressive",
    sample: "Art",
  },
  {
    id: "Ma Shan Zheng",
    label: "Ma Shan Zheng",
    type: "East Asian Brush",
    sample: "道",
  },
  {
    id: "Yuji Syuku",
    label: "Yuji Syuku",
    type: "Shodō Classical",
    sample: "心",
  },
];

const LICENSED_SEAL_FONTS: ReadonlyArray<{
  label: string;
  name: string;
}> = [
  { label: "Ma Shan Zheng (Seal)", name: DEFAULT_SEAL_FONT_FAMILY },
  { label: "Thiên Ân Brush", name: "UTM Thư Pháp Thiên Ân" },
  { label: "Zhi Mang Xing", name: "Zhi Mang Xing" },
];

const TRADITIONS: ReadonlyArray<{
  value: ScriptCategory;
  label: string;
}> = [
  { value: "VIETNAMESE_THU_PHAP", label: "Vietnamese Thư Pháp" },
  { value: "JAPANESE_SHODO", label: "Japanese Shodō" },
  { value: "CHINESE_CALLIGRAPHY", label: "Chinese Brush" },
  { value: "KOREAN_BRUSH", label: "Korean Seoye" },
];

const STROKE_PRESETS: ReadonlyArray<{
  value: StrokePresetOption;
  label: string;
}> = [
  { value: "BOLD_BRUSH", label: "Bold" },
  { value: "FLOWING_INK", label: "Flowing" },
  { value: "DRY_BRUSH", label: "Dry" },
  { value: "CLASSICAL", label: "Classical" },
];

const PLACEMENTS: ReadonlyArray<{
  value: PlacementValue;
  label: string;
}> = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back (+$5)" },
  { value: "left_chest", label: "Left Chest" },
  { value: "both", label: "Both (+$9)" },
];

export function StudioInspector({
  locked = false,
  inputText,
  setInputText,
  tradition,
  setTradition,
  treatment,
  setTreatment,
  strokePreset,
  setStrokePreset,
  inkColor,
  setInkColor,
  hasSeal,
  setHasSeal,
  sealText,
  setSealText,
  sealFontFamily,
  setSealFontFamily,
  fontFamily,
  setFontFamily,
  placement,
  setPlacement,
  selectedProduct,
  selectedVariantId,
  onSelectVariant,
  onSelectProduct,
}: StudioInspectorProps) {
  return (
    <div className="w-full h-full bg-surface-container-low border-l border-surface-variant flex flex-col">
      <div className="p-6 border-b border-surface-variant">
        <h2 className="font-headline-sm text-headline-sm text-on-background">
          Creative Inspector
        </h2>
        <p className="font-body-md text-xs text-on-surface-variant mt-1">
          {locked
            ? "This session is locked after checkout."
            : "Refine script tradition, brush style, and pigment."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-7">
        {/* TEXT INPUT */}
        <section>
          <label
            htmlFor="studio-canvas-words"
            className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5"
          >
            Canvas Words
          </label>
          <input
            id="studio-canvas-words"
            type="text"
            disabled={locked}
            maxLength={200}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-variant text-on-background text-base font-headline-sm focus:border-primary focus:outline-none placeholder:text-outline disabled:opacity-60"
            placeholder="Enter a name, proverb, or phrase..."
          />
        </section>

        {/* CULTURAL TRADITION */}
        <section>
          <label
            htmlFor="studio-tradition-select"
            className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5"
          >
            Calligraphy Tradition
          </label>
          <select
            id="studio-tradition-select"
            disabled={locked}
            value={tradition}
            onChange={(e) => setTradition(e.target.value as ScriptCategory)}
            className="w-full px-3.5 py-2.5 bg-surface-container-lowest border border-surface-variant text-sm text-on-background focus:border-primary focus:outline-none disabled:opacity-60 cursor-pointer"
          >
            {TRADITIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </section>

        {/* AI INTENT - 3 Segment Switch (T-408) */}
        <section>
          <div className="font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5 flex items-center justify-between">
            <span>Translation Intent</span>
            <Info className="w-3.5 h-3.5 text-outline" />
          </div>

          <div className="grid grid-cols-3 gap-1 bg-surface-container p-1 border border-surface-variant text-xs">
            <button
              type="button"
              disabled={locked}
              onClick={() => setTreatment("KEEP_ORIGINAL")}
              className={`py-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                treatment === "KEEP_ORIGINAL"
                  ? "bg-surface-container-lowest text-on-background border border-surface-variant"
                  : "text-on-surface-variant hover:text-on-background"
              }`}
            >
              Exact Words
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setTreatment("MATCH_SOUND")}
              className={`py-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                treatment === "MATCH_SOUND"
                  ? "bg-surface-container-lowest text-on-background border border-surface-variant"
                  : "text-on-surface-variant hover:text-on-background"
              }`}
            >
              Phonetic
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => setTreatment("TRANSLATE_MEANING")}
              className={`py-2 font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                treatment === "TRANSLATE_MEANING"
                  ? "bg-surface-container-lowest text-on-background border border-surface-variant"
                  : "text-on-surface-variant hover:text-on-background"
              }`}
            >
              Meaning
            </button>
          </div>
        </section>

        {/* LICENSED FONT SELECTOR */}
        <section>
          <span className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5">
            Master Brush Font
          </span>
          <div className="grid grid-cols-2 gap-2">
            {LICENSED_BRUSH_FONTS.map((font) => {
              const isSelected = fontFamily === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setFontFamily(font.id)}
                  className={`p-3 text-left border transition-colors bg-surface-container-lowest cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-surface-variant hover:border-outline"
                  }`}
                >
                  <div className="font-headline-sm text-lg text-on-background leading-tight mb-1">
                    {font.sample}
                  </div>
                  <div className="text-[11px] font-medium text-on-background">
                    {font.label}
                  </div>
                  <div className="text-[10px] text-on-surface-variant">
                    {font.type}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* BRUSH STROKE PRESET */}
        <section>
          <span className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5">
            Stroke Pressure
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {STROKE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                disabled={locked}
                onClick={() => setStrokePreset(preset.value)}
                className={`py-2 px-1 text-xs border transition-colors cursor-pointer disabled:opacity-60 ${
                  strokePreset === preset.value
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:text-on-background"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {/* CHOP SEAL CUSTOMIZATION */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-label-caps text-[11px] uppercase text-on-surface-variant">
              Include Chop Seal
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hasSeal}
              disabled={locked}
              onClick={() => setHasSeal(!hasSeal)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer disabled:opacity-60 ${
                hasSeal ? "bg-secondary" : "bg-surface-container-highest"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                  hasSeal ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {hasSeal && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="studio-seal-text"
                  className="font-label-caps text-[10px] uppercase text-on-surface-variant block mb-1"
                >
                  Seal Glyph (Max 3)
                </label>
                <input
                  id="studio-seal-text"
                  type="text"
                  disabled={locked}
                  maxLength={3}
                  value={sealText}
                  onChange={(e) => setSealText(e.target.value)}
                  className="w-full px-2.5 py-2 border border-surface-variant text-sm font-medium text-on-background bg-surface-container-lowest focus:border-primary outline-none disabled:opacity-60"
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
                  onChange={(e) => setSealFontFamily(e.target.value)}
                  className="w-full px-2.5 py-2 border border-surface-variant text-sm text-on-background bg-surface-container-lowest cursor-pointer focus:border-primary outline-none disabled:opacity-60"
                >
                  {LICENSED_SEAL_FONTS.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* PIGMENT PALETTE */}
        <section>
          <span className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5">
            Ink Pigment
          </span>
          <div className="flex items-center gap-3">
            {PIGMENTS.map((pigment) => {
              const isSelected =
                inkColor.toUpperCase() === pigment.hex.toUpperCase();
              return (
                <button
                  key={pigment.name}
                  type="button"
                  disabled={locked}
                  onClick={() => setInkColor(pigment.hex)}
                  title={pigment.name}
                  aria-label={`Select ${pigment.name} pigment`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform cursor-pointer disabled:opacity-60 ${
                    pigment.swatchClass
                  } ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-primary ring-offset-surface-container-low scale-105"
                      : "hover:scale-105"
                  }`}
                >
                  {isSelected && (
                    <Check className={`w-4 h-4 ${pigment.checkClass}`} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* PRINT PLACEMENT */}
        <section>
          <span className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5">
            Print Placement
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {PLACEMENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={locked}
                onClick={() => setPlacement(item.value)}
                className={`py-2 px-2.5 text-xs border transition-colors cursor-pointer disabled:opacity-60 ${
                  placement === item.value
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-lowest text-on-surface-variant border-surface-variant hover:text-on-background"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* PRODUCT SELECTOR */}
        {selectedProduct && (
          <section className="pt-4 border-t border-surface-variant">
            <span className="block font-label-caps text-[11px] uppercase text-on-surface-variant mb-2.5">
              Merchandise
            </span>
            <div className="p-4 bg-primary text-on-primary flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 bg-surface-tint overflow-hidden flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-on-primary/75 truncate">
                    {selectedProduct.name}
                  </p>
                  <p className="text-sm font-semibold">
                    ${selectedProduct.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={locked}
                onClick={onSelectProduct}
                className="px-3 py-1.5 bg-surface-tint hover:bg-on-background border border-outline/40 text-xs uppercase font-label-caps transition-colors shrink-0 cursor-pointer disabled:opacity-60"
              >
                Change
              </button>
            </div>

            {selectedProduct.variants && selectedProduct.variants.length > 0 && (
              <div className="mt-3">
                <label
                  htmlFor="studio-variant-select"
                  className="sr-only"
                >
                  Select Color and Size
                </label>
                <select
                  id="studio-variant-select"
                  disabled={locked}
                  value={selectedVariantId || ""}
                  onChange={(e) => onSelectVariant(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-variant text-on-background text-sm px-3 py-2.5 outline-none focus:border-primary disabled:opacity-60 cursor-pointer"
                >
                  {selectedProduct.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.color || "Standard"}{" "}
                      {v.size ? `— Size ${v.size}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
