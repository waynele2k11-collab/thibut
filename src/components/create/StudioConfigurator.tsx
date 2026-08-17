"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Sparkles, 
  Check, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Sliders, 
  Layers, 
  Compass, 
  Feather,
  CheckCircle2,
  ArrowRight
} from "lucide-react";

export type CulturalTradition = 
  | "VIETNAMESE_THU_PHAP" 
  | "JAPANESE_SHODO" 
  | "CHINESE_CALLIGRAPHY" 
  | "KOREAN_BRUSH";

export type WordTreatment = 
  | "KEEP_ORIGINAL" 
  | "MATCH_SOUND" 
  | "TRANSLATE_MEANING";

export type StrokePreset = 
  | "BOLD_BRUSH" 
  | "FLOWING_INK" 
  | "DRY_BRUSH" 
  | "CLASSICAL" 
  | "FREE_SPIRIT";

export type VariationType = 
  | "01_CONTROLLED" 
  | "02_BOLD" 
  | "03_DRY_BRUSH" 
  | "04_EXPRESSIVE" 
  | "05_MINIMAL" 
  | "06_SIGNATURE";

export type CompositionLayout = 
  | "HORIZONTAL" 
  | "VERTICAL" 
  | "EMBLEM" 
  | "FULL_BACK";

export type InkPigment = "black" | "vermilion" | "gold" | "ivory";

export interface StudioState {
  inputText: string;
  tradition: CulturalTradition;
  treatment: WordTreatment;
  interpretation: {
    text: string;
    romanization?: string;
    meaning?: string;
    culturalNote?: string;
    type?: string;
  };
  strokePreset: StrokePreset;
  variationIndex: VariationType;
  fontId: string;
  layout: CompositionLayout;
  inkColor: InkPigment;
  hasSeal: boolean;
  sealStyle?: "IMPERIAL_RED" | "SQUARE_CHOP" | "NONE";
  flourish: "DRAGON" | "PHOENIX" | "FLYING_WHITE" | "NONE";
  advanced: {
    pressureMultiplier: number;
    dryBrushIntensity: number;
    letterSpacing: string;
    rotation: number;
    scale: number;
  };
}

interface CandidateVariation {
  id: string;
  index: number;
  imageUrl: string;
  variationType: VariationType;
  variationName: string;
  variationNote: string;
  seed: number;
}

interface StudioConfiguratorProps {
  initialSessionId: string;
  initialText?: string;
  initialTradition?: CulturalTradition;
  onProceedToMerchandise: (state: StudioState, activeCandidate: CandidateVariation) => void;
}

const TRADITIONS: { id: CulturalTradition; label: string; flag: string; desc: string; defaultSample: string }[] = [
  { 
    id: "VIETNAMESE_THU_PHAP", 
    label: "Vietnamese Thư Pháp", 
    flag: "🇻🇳", 
    desc: "Authentic Quốc Ngữ brush calligraphy with sweeping dragon ascenders.",
    defaultSample: "Có Chí Thì Nên"
  },
  { 
    id: "JAPANESE_SHODO", 
    label: "Japanese Shodō", 
    flag: "🇯🇵", 
    desc: "Classical Sumi-e brushwork (Kanji / Hiragana / Katakana).",
    defaultSample: "七転八起"
  },
  { 
    id: "CHINESE_CALLIGRAPHY", 
    label: "Chinese Shūfǎ", 
    flag: "🇨🇳", 
    desc: "Traditional Hanzi brush scripts (Grass, Regular, Running).",
    defaultSample: "天道酬勤"
  },
  { 
    id: "KOREAN_BRUSH", 
    label: "Korean Seoye", 
    flag: "🇰🇷", 
    desc: "Dynamic Hangul brush dynamics and ancient stone-rubbing script.",
    defaultSample: "영원한 사랑"
  },
];

const TREATMENTS: { id: WordTreatment; label: string; tag: string; desc: string }[] = [
  { 
    id: "KEEP_ORIGINAL", 
    label: "Keep My Words", 
    tag: "Exact Phrasing", 
    desc: "Render your exact words (e.g. WAYNE or Có Chí Thì Nên) in authentic Asian brush aesthetic." 
  },
  { 
    id: "MATCH_SOUND", 
    label: "Match the Sound", 
    tag: "Phonetic", 
    desc: "Transliterate names and foreign words phonetically into cultural script characters." 
  },
  { 
    id: "TRANSLATE_MEANING", 
    label: "Translate the Meaning", 
    tag: "Deep Meaning", 
    desc: "AI transforms the philosophical meaning of your quote into a timeless cultural proverb." 
  },
];

const STROKE_PRESETS: { id: StrokePreset; label: string; subtitle: string; icon: string }[] = [
  { id: "BOLD_BRUSH", label: "Bold Brush", subtitle: "Heavy sumi ink & deep pressure", icon: "💥" },
  { id: "FLOWING_INK", label: "Flowing Ink", subtitle: "Graceful dancing rhythm & loops", icon: "🌊" },
  { id: "DRY_BRUSH", label: "Dry Brush", subtitle: "Visible bristle texture & flying white", icon: "⚡" },
  { id: "CLASSICAL", label: "Classical", subtitle: "Authoritative balanced precision", icon: "🏛️" },
  { id: "FREE_SPIRIT", label: "Free Spirit", subtitle: "Wild expressive grass cursive", icon: "🍃" },
];

const VARIATION_PILLS: { id: VariationType; label: string; short: string; desc: string }[] = [
  { id: "01_CONTROLLED", label: "01 Harmony", short: "01", desc: "Balanced classical harmony with dragon swash" },
  { id: "02_BOLD", label: "02 Bold Sumi", short: "02", desc: "Dense, heavy ink mass and saturated strokes" },
  { id: "03_DRY_BRUSH", label: "03 Dry Brush", short: "03", desc: "Raw flying white (phi bạch / hihaku) texture" },
  { id: "04_EXPRESSIVE", label: "04 Phoenix", short: "04", desc: "Dancing curves with dynamic ink splatters" },
  { id: "05_MINIMAL", label: "05 Zen Minimal", short: "05", desc: "Clean hairline strokes with negative space" },
  { id: "06_SIGNATURE", label: "06 Imperial Seal", short: "06", desc: "Master signature with carved cinnabar red seal" },
];

const INK_PIGMENTS: { id: InkPigment; label: string; hex: string; desc: string }[] = [
  { id: "black", label: "Sumi Black", hex: "#0B0B0B", desc: "Traditional Pine Soot Ink" },
  { id: "vermilion", label: "Cinnabar Red", hex: "#B3261E", desc: "Imperial Vermilion" },
  { id: "gold", label: "Imperial Gold", hex: "#C5A059", desc: "Metallic Gold Pigment" },
  { id: "ivory", label: "Rice Paper Ivory", hex: "#F6F1E7", desc: "Raw Silk White" },
];

function recolorSvgString(svgDataUri: string, targetColor: InkPigment): string {
  if (!svgDataUri) return svgDataUri;
  const colorMap = {
    black: "#0B0B0B",
    vermilion: "#B3261E",
    gold: "#C5A059",
    ivory: "#F6F1E7",
  };
  const targetHex = colorMap[targetColor] || "#0B0B0B";

  if (svgDataUri.startsWith("data:image/svg+xml")) {
    const isBase64 = svgDataUri.includes(";base64,");
    if (isBase64) {
      try {
        const base64Content = svgDataUri.split(";base64,")[1];
        let svgString = typeof window !== "undefined" ? atob(base64Content) : "";
        svgString = svgString
          .replace(/fill="#[0-9a-fA-F]{6}"/gi, `fill="${targetHex}"`)
          .replace(/stroke="#[0-9a-fA-F]{6}"/gi, `stroke="${targetHex}"`);
        const encoded = typeof window !== "undefined" ? btoa(svgString) : "";
        return `data:image/svg+xml;base64,${encoded}`;
      } catch {
        return svgDataUri;
      }
    } else {
      const encodedHex = encodeURIComponent(targetHex);
      return svgDataUri
        .replaceAll("#0B0B0B", targetHex)
        .replaceAll("#0b0b0b", targetHex)
        .replaceAll("#111111", targetHex)
        .replaceAll("%230B0B0B", encodedHex)
        .replaceAll("%230b0b0b", encodedHex)
        .replaceAll("%23111111", encodedHex);
    }
  }
  return svgDataUri;
}

export function StudioConfigurator({
  initialSessionId,
  initialText = "Có Chí Thì Nên",
  initialTradition = "VIETNAMESE_THU_PHAP",
  onProceedToMerchandise,
}: StudioConfiguratorProps) {
  // ── Canonical Studio State ───────────────────────────────────────────────────
  const [state, setState] = useState<StudioState>({
    inputText: initialText,
    tradition: initialTradition,
    treatment: "KEEP_ORIGINAL",
    interpretation: {
      text: initialText,
      romanization: initialText,
      meaning: "Where there is a will, there is a way.",
      culturalNote: "Master Vietnamese Thư Pháp vector composition.",
      type: "ORIGINAL",
    },
    strokePreset: "BOLD_BRUSH",
    variationIndex: "01_CONTROLLED",
    fontId: "utm-thuphap-thien-an",
    layout: "HORIZONTAL",
    inkColor: "black",
    hasSeal: true,
    sealStyle: "IMPERIAL_RED",
    flourish: "DRAGON",
    advanced: {
      pressureMultiplier: 1.0,
      dryBrushIntensity: 0.15,
      letterSpacing: "0.02em",
      rotation: 0,
      scale: 1.0,
    },
  });

  // UI States
  const [candidates, setCandidates] = useState<CandidateVariation[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateVariation | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isAnalyzingMeaning, setIsAnalyzingMeaning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Active Fonts loaded from registry
  const [activeFonts, setActiveFonts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/fonts/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.fonts)) {
          setActiveFonts(data.fonts);
        }
      })
      .catch(() => {});
  }, []);

  // ── Two-Tier Engine: Trigger Cultural AI Analysis when text or treatment changes ──
  useEffect(() => {
    if (!state.inputText.trim()) return;

    if (state.treatment === "KEEP_ORIGINAL") {
      setState((prev) => ({
        ...prev,
        interpretation: {
          text: prev.inputText,
          romanization: prev.inputText,
          meaning: prev.tradition === "VIETNAMESE_THU_PHAP" 
            ? "Original Vietnamese phrase in authentic Thư Pháp brush aesthetic."
            : "Original words preserved in cultural brush typography.",
          culturalNote: "Authentic controlled brush vector engine.",
          type: "ORIGINAL",
        },
      }));
      return;
    }

    // Call Cultural AI Engine
    setIsAnalyzingMeaning(true);
    fetch("/api/personalization/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phrase: state.inputText,
        mode: "QUOTE",
        culturalTradition: state.tradition,
        textTreatment: state.treatment === "MATCH_SOUND" ? "TRANSLITERATE" : "TRANSLATE_MEANING",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.interpretations) && data.interpretations.length > 0) {
          const first = data.interpretations[0];
          setState((prev) => ({
            ...prev,
            interpretation: {
              text: first.text,
              romanization: first.romanization || first.text,
              meaning: first.meaning || first.text,
              culturalNote: first.culturalNote || "AI Cultural Semantic Interpretation",
              type: first.type || "INTERPRETED",
            },
          }));
        }
      })
      .catch(() => {})
      .finally(() => setIsAnalyzingMeaning(false));
  }, [state.inputText, state.tradition, state.treatment]);

  // ── Deterministic Studio Engine: Render 6 Variations on visual changes ─────────
  const renderRequestIdRef = useRef(0);

  useEffect(() => {
    const currentReq = ++renderRequestIdRef.current;
    const textToRender = state.interpretation.text || state.inputText;
    if (!textToRender.trim()) return;

    setIsRendering(true);

    fetch("/api/personalization/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputText: state.inputText,
        culturalStyle: state.tradition,
        textTreatment: state.treatment === "KEEP_ORIGINAL" ? "KEEP_ORIGINAL" : "TRANSLATE",
        mode: "QUOTE",
        stylePack: state.fontId || state.strokePreset,
        composition: state.layout === "VERTICAL" ? "Vertical" : "Centered",
        selectedInterpretation: {
          text: textToRender,
          romanization: state.interpretation.romanization,
          meaning: state.interpretation.meaning,
          language: state.tradition === "VIETNAMESE_THU_PHAP" ? "Vietnamese" 
            : state.tradition === "JAPANESE_SHODO" ? "Japanese"
            : state.tradition === "CHINESE_CALLIGRAPHY" ? "Chinese" : "Korean",
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (currentReq !== renderRequestIdRef.current) return; // ignore stale responses

        if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
          setCandidates(data.candidates);
          
          // Match active variation index
          const matching = data.candidates.find((c: CandidateVariation) => c.variationType === state.variationIndex) || data.candidates[0];
          setActiveCandidate(matching);
        }
      })
      .catch((err) => {
        console.error("Error generating calligraphy:", err);
      })
      .finally(() => {
        if (currentReq === renderRequestIdRef.current) {
          setIsRendering(false);
        }
      });
  }, [
    state.inputText,
    state.tradition,
    state.treatment,
    state.interpretation.text,
    state.strokePreset,
    state.fontId,
    state.layout,
  ]);

  // Handle variation index switch locally
  const handleSelectVariation = (type: VariationType) => {
    setState((prev) => ({ ...prev, variationIndex: type }));
    const match = candidates.find((c) => c.variationType === type);
    if (match) {
      setActiveCandidate(match);
    }
  };

  // Recolor active candidate SVG locally on ink color changes
  const displayArtworkUrl = useMemo(() => {
    if (!activeCandidate?.imageUrl) return "";
    return recolorSvgString(activeCandidate.imageUrl, state.inkColor);
  }, [activeCandidate?.imageUrl, state.inkColor]);

  // Available fonts for selected tradition
  const filteredFonts = useMemo(() => {
    return activeFonts.filter((f) => f.category === state.tradition);
  }, [activeFonts, state.tradition]);

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start pb-16">
      
      {/* ── LEFT COLUMN: Live Artwork Stage & Variation Presets (7 Cols) ─────── */}
      <div className="lg:col-span-7 flex flex-col gap-5 static lg:sticky lg:top-24 z-10">
        
        {/* Main Artwork Stage */}
        <div className="border border-surface-variant bg-surface-container-lowest p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col gap-4 sm:gap-5">
          
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-surface-variant text-xs">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-bold text-on-background flex items-center gap-1 font-label-caps uppercase text-[11px] sm:text-xs">
                {TRADITIONS.find((t) => t.id === state.tradition)?.flag} {TRADITIONS.find((t) => t.id === state.tradition)?.label}
              </span>
              <span className="text-on-surface-variant text-[10px] hidden sm:inline">•</span>
              <span className="px-2 py-0.5 bg-[#F4EFE6] border border-[#E5E0D8] text-[#111111] rounded text-[10px] sm:text-[11px] font-medium">
                {TREATMENTS.find((t) => t.id === state.treatment)?.label}
              </span>
            </div>

            {isRendering && (
              <span className="text-[11px] text-[#B3261E] font-medium flex items-center gap-1 animate-pulse font-mono flex-shrink-0">
                <Sparkles className="w-3 h-3" /> Rendering...
              </span>
            )}
          </div>

          {/* SVG Canvas Box */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] min-h-[240px] sm:min-h-[340px] flex items-center justify-center bg-[#FAF8F5] border border-[#EBE6DC] rounded-xl overflow-hidden shadow-inner group">
            {displayArtworkUrl ? (
              <img
                src={displayArtworkUrl}
                alt={state.interpretation.text}
                className="max-h-[88%] max-w-[88%] object-contain select-none pointer-events-none transition-transform duration-200"
                style={{
                  transform: `scale(${state.advanced.scale}) rotate(${state.advanced.rotation}deg)`,
                  filter: state.inkColor === "ivory" ? "drop-shadow(0px 2px 5px rgba(0,0,0,0.4))" : undefined,
                }}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-on-surface-variant p-4 text-center">
                <Feather className="w-7 h-7 opacity-40 animate-bounce" />
                <span className="text-xs font-mono">Synthesizing calligraphy brush strokes...</span>
              </div>
            )}
          </div>

          {/* ── 01–06 Variation Preset Quick-Pills (Prominent) ───────────────── */}
          <div>
            <span className="text-[10px] sm:text-[11px] font-label-caps uppercase text-on-surface-variant font-bold tracking-wider block mb-2">
              Variation Presets (Click to Experiment)
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2">
              {VARIATION_PILLS.map((pill) => {
                const isActive = state.variationIndex === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => handleSelectVariation(pill.id)}
                    title={pill.desc}
                    className={`py-2 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center border ${
                      isActive
                        ? "bg-black text-white border-black font-bold shadow-md ring-2 ring-black/20"
                        : "bg-white border-outline-variant hover:border-black/50 text-on-background"
                    }`}
                  >
                    <span className="text-[11px] font-mono font-bold block">{pill.short}</span>
                    <span className="text-[9px] sm:text-[10px] truncate max-w-full font-medium block">
                      {pill.label.replace(/^\d+\s*/, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Ink Pigments Quick Selector ──────────────────────────────────── */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-variant">
            <span className="text-xs font-label-caps uppercase text-on-surface-variant font-bold">
              Ink Pigment
            </span>
            <div className="flex items-center gap-2.5">
              {INK_PIGMENTS.map((p) => {
                const isSelected = state.inkColor === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setState((prev) => ({ ...prev, inkColor: p.id }))}
                    title={p.label}
                    className={`w-8 h-8 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                      isSelected ? "ring-2 ring-primary scale-110" : "hover:scale-105 opacity-80"
                    }`}
                    style={{ backgroundColor: p.hex }}
                  >
                    {isSelected && (
                      <span className={`w-2 h-2 rounded-full ${p.id === "black" ? "bg-white" : "bg-black"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Compact Semantic Meaning Card ─────────────────────────────────── */}
        <div className="border border-surface-variant bg-[#F4EFE6]/60 p-4 rounded-xl flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center flex-shrink-0 font-serif font-bold text-sm">
            詩
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#111111] font-display-md">
                &ldquo;{state.interpretation.text}&rdquo;
              </span>
              {state.interpretation.romanization && state.interpretation.romanization !== state.interpretation.text && (
                <span className="text-xs text-on-surface-variant font-mono">
                  ({state.interpretation.romanization})
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {isAnalyzingMeaning ? "Analyzing cultural meaning..." : state.interpretation.meaning}
            </p>
          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: Studio Control Panel (4 Sections) (5 Cols) ─────────── */}
      <div className="lg:col-span-5 flex flex-col gap-6 bg-white p-6 border border-surface-variant rounded-2xl shadow-sm">
        
        {/* Panel Header */}
        <div>
          <h1 className="font-headline-md text-xl font-bold text-on-background">
            Studio Controls
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Configure your master typography, tradition, and stroke aesthetics.
          </p>
        </div>

        {/* ── SECTION 1: YOUR WORDS ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 pb-5 border-b border-surface-variant">
          <div className="flex items-center justify-between">
            <span className="text-xs font-label-caps uppercase text-on-surface-variant font-bold tracking-wider">
              1. Your Words
            </span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              {state.inputText.length}/100
            </span>
          </div>

          {/* Master Text Input */}
          <input
            type="text"
            value={state.inputText}
            onChange={(e) => setState((prev) => ({ ...prev, inputText: e.target.value }))}
            placeholder="Type your phrase or name..."
            className="w-full px-4 py-3 border border-outline-variant rounded-xl text-base font-bold text-on-background bg-[#FAF8F5] focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />

          {/* Tradition Dropdown */}
          <div>
            <label className="text-[11px] font-label-caps uppercase text-on-surface-variant block mb-1 font-semibold">
              Cultural Tradition
            </label>
            <select
              value={state.tradition}
              onChange={(e) => {
                const trad = e.target.value as CulturalTradition;
                setState((prev) => ({
                  ...prev,
                  tradition: trad,
                  fontId: trad === "VIETNAMESE_THU_PHAP" ? "utm-thuphap-thien-an" 
                    : trad === "JAPANESE_SHODO" ? "yuji-boku"
                    : trad === "CHINESE_CALLIGRAPHY" ? "long-cang" : "nanum-brush-script",
                }));
              }}
              className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-xs font-semibold text-on-background bg-white focus:border-primary outline-none cursor-pointer"
            >
              {TRADITIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag} {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Treatment Dropdown */}
          <div>
            <label className="text-[11px] font-label-caps uppercase text-on-surface-variant block mb-1 font-semibold">
              How Should Thi Bút Treat Your Words?
            </label>
            <select
              value={state.treatment}
              onChange={(e) => setState((prev) => ({ ...prev, treatment: e.target.value as WordTreatment }))}
              className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl text-xs font-semibold text-on-background bg-white focus:border-primary outline-none cursor-pointer"
            >
              {TREATMENTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} — {t.desc.substring(0, 48)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── SECTION 2: CHOOSE YOUR STROKE ─────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 pb-5 border-b border-surface-variant">
          <span className="text-xs font-label-caps uppercase text-on-surface-variant font-bold tracking-wider">
            2. Choose Your Stroke
          </span>
          <div className="grid grid-cols-2 gap-2">
            {STROKE_PRESETS.map((s) => {
              const isSelected = state.strokePreset === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setState((prev) => ({ ...prev, strokePreset: s.id }))}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-outline-variant hover:border-primary/50 bg-[#FAF8F5]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-on-background">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-snug">
                    {s.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: COMPOSITION ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 pb-5 border-b border-surface-variant">
          <span className="text-xs font-label-caps uppercase text-on-surface-variant font-bold tracking-wider">
            3. Composition Layout
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "HORIZONTAL", label: "↔ Horizontal", desc: "Modern balanced banner" },
              { id: "VERTICAL", label: "⬍ Vertical Scroll", desc: "Hanging scroll format" },
              { id: "EMBLEM", label: "⭕ Centered Emblem", desc: "Circular badge focus" },
              { id: "FULL_BACK", label: "📜 Full Statement", desc: "Expansive layout" },
            ].map((layout) => {
              const isSelected = state.layout === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => setState((prev) => ({ ...prev, layout: layout.id as CompositionLayout }))}
                  className={`p-2.5 border rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 font-bold ring-1 ring-primary"
                      : "border-outline-variant bg-[#FAF8F5] hover:border-primary"
                  }`}
                >
                  <span className="block font-semibold text-on-background">{layout.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 4: DETAILS & ACCENTS ──────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 pb-2">
          <span className="text-xs font-label-caps uppercase text-on-surface-variant font-bold tracking-wider">
            4. Finishing Details
          </span>

          <div className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-outline-variant rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-base">🈴</span>
              <div>
                <span className="text-xs font-bold text-on-background block">Imperial Cinnabar Seal</span>
                <span className="text-[10px] text-on-surface-variant">Authentic Red Stamp (Ấn Triện Son 詩筆)</span>
              </div>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, hasSeal: !prev.hasSeal }))}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                state.hasSeal ? "bg-[#B3261E] text-white" : "bg-surface-variant text-on-surface-variant"
              }`}
            >
              {state.hasSeal ? "ON" : "OFF"}
            </button>
          </div>

          {/* Collapsible Advanced Styling */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 text-xs font-label-caps uppercase text-on-surface-variant font-bold hover:text-black transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Advanced Styling
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-2 p-4 bg-[#FAF8F5] border border-outline-variant rounded-xl flex flex-col gap-3 text-xs">
                {/* Specific Font Override */}
                {filteredFonts.length > 0 && (
                  <div>
                    <label className="text-[10px] font-label-caps uppercase text-on-surface-variant block mb-1 font-bold">
                      Typography Font Override
                    </label>
                    <select
                      value={state.fontId}
                      onChange={(e) => setState((prev) => ({ ...prev, fontId: e.target.value }))}
                      className="w-full p-2 border border-outline-variant rounded-lg bg-white outline-none cursor-pointer"
                    >
                      {filteredFonts.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Scale & Rotation Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-label-caps uppercase text-on-surface-variant block mb-1 font-bold">
                      Artwork Scale ({state.advanced.scale.toFixed(2)}x)
                    </label>
                    <input
                      type="range"
                      min="0.6"
                      max="1.4"
                      step="0.05"
                      value={state.advanced.scale}
                      onChange={(e) => setState((prev) => ({
                        ...prev,
                        advanced: { ...prev.advanced, scale: parseFloat(e.target.value) }
                      }))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-label-caps uppercase text-on-surface-variant block mb-1 font-bold">
                      Rotation ({state.advanced.rotation}°)
                    </label>
                    <input
                      type="range"
                      min="-25"
                      max="25"
                      step="1"
                      value={state.advanced.rotation}
                      onChange={(e) => setState((prev) => ({
                        ...prev,
                        advanced: { ...prev.advanced, rotation: parseInt(e.target.value) }
                      }))}
                      className="w-full accent-black cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Primary CTA Button ────────────────────────────────────────────── */}
        <button
          onClick={() => {
            if (activeCandidate) {
              onProceedToMerchandise(state, activeCandidate);
            }
          }}
          disabled={!activeCandidate || isRendering}
          className="w-full bg-primary text-on-primary py-4 font-label-caps uppercase text-center hover:bg-surface-tint transition-all rounded-xl font-bold shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          <span>Preview on Products</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>

    </div>
  );
}
