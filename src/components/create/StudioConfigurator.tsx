"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Sparkles, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  Layers, 
  Feather, 
  CheckCircle2, 
  ArrowRight,
  Maximize2,
  RefreshCw,
  Info,
  Type
} from "lucide-react";
import { generateInstantSvgString, safeBase64Encode, safeBase64Decode } from "@/lib/calligraphy/ClientCalligraphyRenderer";

export type CulturalTradition = "VIETNAMESE_THU_PHAP";

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

export type InkPigment = string;

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
  fontName?: string;
  fontFileName?: string;
  layout: CompositionLayout;
  inkColor: InkPigment;
  hasSeal: boolean;
  sealStyle?: "IMPERIAL_RED" | "SQUARE_CHOP" | "NONE";
  sealText?: string;
  sealFontId?: string;
  flourish: "DRAGON" | "PHOENIX" | "FLYING_WHITE" | "NONE";
  advanced: {
    pressureMultiplier: number;
    dryBrushIntensity: number;
    letterSpacing: string;
    rotation: number;
    scale: number;
    translateX: number;
    translateY: number;
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

const TRADITIONS: { id: CulturalTradition; label: string; flag: string; native: string; desc: string; sample: string }[] = [
  { 
    id: "VIETNAMESE_THU_PHAP", 
    label: "Vietnamese Thư Pháp", 
    flag: "🇻🇳", 
    native: "Thư Pháp",
    desc: "Authentic Quốc Ngữ brush calligraphy with sweeping dragon ascenders.",
    sample: "Có Chí Thì Nên"
  },
];

const DEFAULT_TRADITION_FONTS: Record<CulturalTradition, { id: string; name: string; desc: string; badge: string }[]> = {
  VIETNAMESE_THU_PHAP: [
    { id: "utm-thuphap-thien-an", name: "UTM Thư Pháp Thiên Ân", desc: "Gold standard master dragon ascenders", badge: "Primary" },
    { id: "arizonia", name: "Phượng Vũ (Arizonia)", desc: "Delicate dancing phoenix curves", badge: "OFL" },
    { id: "great-vibes", name: "Long Vũ (Great Vibes)", desc: "Grand sweeping flourish loops", badge: "OFL" },
    { id: "kaushan-script", name: "Phi Bạch (Kaushan)", desc: "Raw horsehair dry brush texture", badge: "OFL" },
    { id: "caveat-brush", name: "Mực Nho (Caveat)", desc: "Heavy saturated sumi mass", badge: "OFL" },
    { id: "alex-brush", name: "Khí Phách (Alex)", desc: "Classic poetic fluid rhythm", badge: "OFL" },
  ],
};

const TREATMENTS: { id: WordTreatment; label: string; tag: string; desc: string }[] = [
  { 
    id: "KEEP_ORIGINAL", 
    label: "Write it exactly as I typed", 
    tag: "Exact Words", 
    desc: "Your name or phrase painted as-is — e.g. WAYNE or 'Never Give Up' — in authentic calligraphy brush strokes." 
  },
  { 
    id: "MATCH_SOUND", 
    label: "Spell it phonetically in Vietnamese", 
    tag: "Phonetic", 
    desc: "Your words are transliterated to sound the same when read in Vietnamese script." 
  },
  { 
    id: "TRANSLATE_MEANING", 
    label: "Find the Vietnamese meaning (AI)", 
    tag: "Deep Meaning", 
    desc: "AI finds the closest Vietnamese proverb or phrase that carries the same feeling as your words." 
  },
];

const STROKE_PRESETS: { id: StrokePreset; label: string; subtitle: string; icon: string }[] = [
  { id: "BOLD_BRUSH", label: "Bold Brush", subtitle: "Heavy sumi ink & deep pressure", icon: "💥" },
  { id: "FLOWING_INK", label: "Flowing Ink", subtitle: "Graceful dancing rhythm & loops", icon: "🌊" },
  { id: "DRY_BRUSH", label: "Dry Brush", subtitle: "Visible bristle texture & flying white", icon: "⚡" },
  { id: "CLASSICAL", label: "Classical", subtitle: "Authoritative balanced precision", icon: "🏛️" },
  { id: "FREE_SPIRIT", label: "Free Spirit", subtitle: "Wild expressive grass cursive", icon: "🍃" },
];

const VARIATION_PILLS: { id: VariationType; label: string; short: string; desc: string; icon: string }[] = [
  { id: "01_CONTROLLED", label: "01 Harmony", short: "01", desc: "Balanced classical harmony with dragon swash", icon: "🐉" },
  { id: "02_BOLD", label: "02 Bold Sumi", short: "02", desc: "Dense, heavy ink mass and saturated strokes", icon: "🖋️" },
  { id: "03_DRY_BRUSH", label: "03 Dry Brush", short: "03", desc: "Raw flying white (phi bạch / hihaku) texture", icon: "⚡" },
  { id: "04_EXPRESSIVE", label: "04 Phoenix", short: "04", desc: "Dancing curves with dynamic ink splatters", icon: "🦚" },
  { id: "05_MINIMAL", label: "05 Zen Minimal", short: "05", desc: "Clean hairline strokes with negative space", icon: "⭕" },
  { id: "06_SIGNATURE", label: "06 Imperial Seal", short: "06", desc: "Master signature with carved cinnabar red seal", icon: "🈴" },
];

const INK_PIGMENTS: { id: InkPigment; label: string; hex: string; desc: string }[] = [
  { id: "black", label: "Sumi Black", hex: "#121212", desc: "Traditional Pine Soot Ink" },
  { id: "white", label: "Pure White", hex: "#FFFFFF", desc: "Purest White Pigment" },
  { id: "vermilion", label: "Cinnabar Red", hex: "#B3261E", desc: "Imperial Vermilion" },
  { id: "gold", label: "Imperial Gold", hex: "#C5A059", desc: "Metallic Gold Pigment" },
  { id: "ivory", label: "Rice Paper Ivory", hex: "#F6F1E7", desc: "Raw Silk White" },
];

const SEAL_FONTS = [
  { id: "vni-ong-do", label: "Classic Seal", name: "VNI Ong do" },
  { id: "utm-thuphap-thien-an", label: "Brush Seal", name: "UTM Thư Pháp Thiên Ân" },
  { id: "vni-netbut", label: "Ancient Seal", name: "VNI Netbut" }
];

function recolorSvgString(svgDataUri: string, targetColor: InkPigment): string {
  if (!svgDataUri) return svgDataUri;
  const colorMap = {
    black: "#0B0B0B",
    white: "#FFFFFF",
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
        let svgString = safeBase64Decode(base64Content);
        svgString = svgString
          .replace(/fill="#[0-9a-fA-F]{6}"/gi, `fill="${targetHex}"`)
          .replace(/stroke="#[0-9a-fA-F]{6}"/gi, `stroke="${targetHex}"`);
        const encoded = safeBase64Encode(svgString);
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
    fontName: "UTM Thư Pháp Thiên Ân",
    fontFileName: "UtmThuphapThienAn.ttf",
    layout: "HORIZONTAL",
    inkColor: "black",
    hasSeal: false,
    sealStyle: "IMPERIAL_RED",
    sealText: "印",
    sealFontId: "vni-ong-do",
    flourish: "DRAGON",
    advanced: {
      pressureMultiplier: 1.0,
      dryBrushIntensity: 0.15,
      letterSpacing: "0.02em",
      rotation: 0,
      scale: 1.0,
      translateX: 0,
      translateY: 0,
    },
  });

  // UI State
  const [isAnalyzingMeaning, setIsAnalyzingMeaning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [traditionDropdownOpen, setTraditionDropdownOpen] = useState(false);
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);

  // 3-Step progressive UX
  const [currentStep, setCurrentStep] = useState(1); // 1=Words, 2=Style, 3=Product
  const [tooltip, setTooltip] = useState<string | null>(null);

  const STEPS = [
    { num: 1, label: "Your Words" },
    { num: 2, label: "Your Style" },
    { num: 3, label: "Product" },
  ];

  const canAdvanceStep1 = state.inputText.trim().length > 0;

  // Active Fonts loaded from registry
  const [activeFonts, setActiveFonts] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/fonts/active")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.fonts) && data.fonts.length > 0) {
          setActiveFonts(data.fonts);
        }
      })
      .catch(() => {});
  }, []);

  // Compute available fonts for active tradition (always guarantees full catalog)
  const currentTraditionFonts = useMemo(() => {
    const fallbackList = DEFAULT_TRADITION_FONTS[state.tradition] || DEFAULT_TRADITION_FONTS.VIETNAMESE_THU_PHAP;
    if (activeFonts.length > 0) {
      const fromServer = activeFonts.filter((f) => f.category === state.tradition);
      if (fromServer.length > 0) {
        const serverIds = new Set(fromServer.map((f) => f.id));
        return [
          ...fromServer.map((f) => ({
            id: f.id,
            name: f.name,
            desc: f.description || "Master calligraphy typeface",
            badge: "Verified",
          })),
          ...fallbackList.filter((f) => !serverIds.has(f.id)),
        ];
      }
    }
    return fallbackList;
  }, [activeFonts, state.tradition]);

  // ── Debounced text for SVG render (150ms) ───────────────────────────────────
  const [debouncedText, setDebouncedText] = useState(state.inputText);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(state.interpretation.text || state.inputText), 150);
    return () => clearTimeout(t);
  }, [state.inputText, state.interpretation.text]);

  // ── 0ms Instant Client Vector Renderer ──────────────────────────────────────
  const instantClientSvg = useMemo(() => {
    const colorMap: Record<string, string> = {
      black: "#0B0B0B",
      white: "#FFFFFF",
      vermilion: "#B3261E",
      gold: "#C5A059",
      ivory: "#F6F1E7",
    };
    return generateInstantSvgString({
      text: debouncedText || state.inputText,
      tradition: state.tradition,
      strokePreset: state.strokePreset,
      variationType: state.variationIndex,
      fontId: state.fontId,
      customFontFamily: state.fontName ? `'${state.fontName}', cursive` : undefined,
      customFontUrl: state.fontFileName ? `/fonts/${state.fontFileName}` : undefined,
      layout: state.layout,
      inkColor: colorMap[state.inkColor] || "#0B0B0B",
      hasSeal: state.hasSeal,
      sealText: state.sealText,
      sealFontFamily: SEAL_FONTS.find(f => f.id === state.sealFontId)?.name || 'VNI Ong do',
    });
  }, [
    debouncedText,
    state.inputText,
    state.tradition,
    state.strokePreset,
    state.variationIndex,
    state.fontId,
    state.fontName,
    state.fontFileName,
    state.layout,
    state.inkColor,
    state.hasSeal,
    state.sealText,
    state.sealFontId,
  ]);

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

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      setIsAnalyzingMeaning(true);
      fetch("/api/personalization/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: state.inputText,
          mode: "QUOTE",
          culturalStyle: state.tradition,
          textTreatment: state.treatment === "MATCH_SOUND" ? "PHONETIC" : "TRANSLATE",
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.interpretations) && data.interpretations.length > 0) {
            const best = data.interpretations.find((i: any) => i.recommended) || data.interpretations[0];
            setState((prev) => ({
              ...prev,
              interpretation: {
                text: best.text,
                romanization: best.romanization || best.text,
                meaning: best.meaning || best.text,
                culturalNote: best.warning || "AI Cultural Semantic Interpretation",
                type: best.type || "INTERPRETED",
              },
            }));
          }
        })
        .catch(() => {})
        .finally(() => setIsAnalyzingMeaning(false));
    }, 600); // 600ms debounce

    return () => clearTimeout(timeoutId);
  }, [state.inputText, state.tradition, state.treatment]);

  // Handle variation index switch locally
  const handleSelectVariation = (type: VariationType) => {
    setState((prev) => ({ ...prev, variationIndex: type }));
  };
  const displayArtworkUrl = instantClientSvg;

  const activeTraditionObj = TRADITIONS.find((t) => t.id === state.tradition) || TRADITIONS[0];
  const activeTreatmentObj = TREATMENTS.find((t) => t.id === state.treatment) || TREATMENTS[0];

  return (
    <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
      
      {/* ── LEFT COLUMN: Live Artwork Visualizer Stage (7 Cols) ─────────────── */}
      <div className="lg:col-span-7 flex flex-col gap-5 static lg:sticky lg:top-24 z-10">
        
        {/* Main Artwork Stage Box */}
        <div className="border border-surface-variant bg-[#FFFFFF] p-5 sm:p-7 rounded-2xl shadow-sm flex flex-col gap-5 relative overflow-hidden">
          
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EBE6DC] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#111111] flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-xs">
                {activeTraditionObj.label}
              </span>
              <span className="text-[#C7C6CA]">•</span>
              <span className="px-2.5 py-0.5 bg-[#F4EFE6] border border-[#E5E0D8] text-[#111111] rounded-md text-[11px] font-semibold">
                {activeTreatmentObj.tag}
              </span>
            </div>

            <span className="text-[11px] font-mono text-[#888580] hidden sm:inline">
              Vector 300 DPI · Lossless
            </span>
          </div>

          {/* Luxury Rice Paper Canvas Box */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] min-h-[260px] sm:min-h-[360px] flex items-center justify-center bg-[#FBF9F5] border border-[#E8E2D5] rounded-xl overflow-hidden shadow-inner group">
            
            {/* Subtle Corner Registration Marks (Editorial Gallery Style) */}
            <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#D8D2C5] pointer-events-none" />
            <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#D8D2C5] pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#D8D2C5] pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#D8D2C5] pointer-events-none" />

            {/* Subtle Studio Watermark */}
            <span className="absolute bottom-3.5 right-4 font-serif text-[11px] tracking-widest text-[#111111]/20 font-bold uppercase select-none pointer-events-none">
              THI BÚT STUDIO
            </span>

            {/* Loading Overlay */}
            {isAnalyzingMeaning && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FBF9F5]/70 backdrop-blur-[2px] transition-all">
                <RefreshCw className="w-6 h-6 text-[#111111] animate-spin mb-3" />
                <span className="text-[10px] font-label-caps uppercase tracking-widest text-[#111111] font-bold">
                  Translating...
                </span>
              </div>
            )}

            {/* Live Vector Artwork Rendering (Inline SVG to support @import fonts) */}
            <div
              className={`w-[86%] h-[86%] flex items-center justify-center select-none pointer-events-none transition-transform duration-200 [&>svg]:w-full [&>svg]:h-full ${isAnalyzingMeaning ? 'opacity-30 blur-sm' : 'opacity-100 blur-0'}`}
              style={{
                transform: `scale(${state.advanced.scale}) rotate(${state.advanced.rotation}deg)`,
                filter: state.inkColor === "ivory" ? "drop-shadow(0px 2px 6px rgba(0,0,0,0.45))" : undefined,
              }}
              onContextMenu={(e) => e.preventDefault()}
              dangerouslySetInnerHTML={{ __html: displayArtworkUrl }}
            />
          </div>

          {/* ── Style Variations Quick-Pills ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-label-caps uppercase text-[#46474A] font-bold tracking-wider">
                Try a Style
              </span>
              <span className="text-[11px] font-mono text-[#888580]">
                {state.variationIndex.replace(/^\d+_/, "").toLowerCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {VARIATION_PILLS.map((pill) => {
                const isActive = state.variationIndex === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => handleSelectVariation(pill.id)}
                    title={pill.desc}
                    className={`py-2.5 px-1.5 rounded-xl text-center transition-all flex flex-col items-center justify-center border relative ${
                      isActive
                        ? "bg-[#111111] text-white border-[#111111] font-bold shadow-md ring-2 ring-black/20 scale-[1.02]"
                        : "bg-white border-[#E0DBD1] hover:border-black/60 text-[#111111] hover:bg-[#FAF8F5]"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#B3261E] rounded-full ring-2 ring-white" />
                    )}
                    <span className="text-sm block">{pill.icon}</span>
                    <span className="text-[10px] truncate max-w-full font-bold block mt-0.5">
                      {pill.label.replace(/^\d+\s*/, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Ink Pigment Swatches ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-3.5 border-t border-[#EBE6DC]">
            <div>
              <span className="text-xs font-label-caps uppercase text-[#46474A] font-bold block">
                Ink Pigment
              </span>
              <span className="text-[11px] text-[#888580] font-mono">
                {INK_PIGMENTS.find((p) => p.id === state.inkColor)?.label}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {INK_PIGMENTS.map((p) => {
                const isSelected = state.inkColor === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setState((prev) => ({ ...prev, inkColor: p.id }))}
                    title={p.label}
                    className={`w-9 h-9 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                      isSelected 
                        ? "ring-2 ring-primary scale-110 shadow-md" 
                        : "hover:scale-105 opacity-85 border-[#C7C6CA]"
                    }`}
                    style={{ backgroundColor: p.hex }}
                  >
                    {isSelected && (
                      <span className={`w-2.5 h-2.5 rounded-full ${p.id === "black" ? "bg-white" : "bg-black"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Editorial Semantic Context Card ───────────────────────────────── */}
        <div className="border border-[#E5E0D8] bg-[#F4EFE6] p-4.5 rounded-2xl flex items-start gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#111111] text-white flex items-center justify-center flex-shrink-0 font-serif font-bold text-base shadow-sm">
            詩
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-[#111111] font-display-md">
                &ldquo;{state.interpretation.text}&rdquo;
              </span>
              {state.interpretation.romanization && state.interpretation.romanization !== state.interpretation.text && (
                <span className="text-xs text-[#66635D] font-mono">
                  [{state.interpretation.romanization}]
                </span>
              )}
            </div>
            <p className="text-xs text-[#55524C] leading-relaxed">
              {isAnalyzingMeaning ? "Analyzing cultural meaning & semantics..." : state.interpretation.meaning}
            </p>
          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: Studio Control Panel (5 Cols) ─────────────────────── */}
      <div className="lg:col-span-5 flex flex-col gap-0 bg-white border border-surface-variant rounded-2xl shadow-sm overflow-hidden">

        {/* ── Step Navigation Header ─────────────────────────────────────────── */}
        <div className="border-b border-[#EBE6DC] px-6 sm:px-7 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, i) => {
              const isActive = currentStep === step.num;
              const isDone = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => step.num <= currentStep || isDone ? setCurrentStep(step.num) : undefined}
                  className={`flex-1 flex flex-col items-center gap-1 pb-3 border-b-2 transition-all ${
                    isActive
                      ? "border-[#B3261E]"
                      : isDone
                      ? "border-[#111111] cursor-pointer"
                      : "border-transparent cursor-default"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    isActive ? "bg-[#B3261E] text-white" :
                    isDone ? "bg-[#111111] text-white" :
                    "bg-[#EAE5DC] text-[#888580]"
                  }`}>
                    {isDone ? "✓" : step.num}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isActive ? "text-[#B3261E]" : isDone ? "text-[#111111]" : "text-[#888580]"
                  }`}>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-6 p-6 sm:p-7">

        {/* ── STEP 1: YOUR WORDS ─────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider">
                Type your words
              </span>
              <span className="text-[11px] font-mono text-[#888580]">{state.inputText.length} chars</span>
            </div>

            {/* Example prompt chips */}
            <div className="flex flex-wrap gap-2">
              {["My Name", "Family Motto", "A Quote", "Tết Greeting"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setState((prev) => ({ ...prev, inputText: ex === "My Name" ? "" : ex === "Tết Greeting" ? "Chúc Mừng Năm Mới" : ex === "Family Motto" ? "Gia Đình Trên Hết" : "Never Give Up" }))}
                  className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#F4EFE6] text-[#111111] hover:bg-[#EAE5DC] transition-all border border-[#E5E0D8]"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Master Text Input Box */}
            <div className="relative">
              <input
                type="text"
                value={state.inputText}
                onChange={(e) => setState((prev) => ({ ...prev, inputText: e.target.value }))}
                placeholder="Type your name, phrase, or quote..."
                autoFocus
                className="w-full px-4 py-3.5 border-2 border-[#E0DBD1] rounded-xl text-base font-bold text-[#111111] bg-[#FAF8F5] focus:bg-white focus:border-black outline-none transition-all"
              />
            </div>

            {/* Treatment Options with tooltip */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-[11px] font-label-caps uppercase text-[#66635D] font-bold">How to render it</label>
                <button
                  onClick={() => setTooltip(tooltip === "treatment" ? null : "treatment")}
                  className="text-[#888580] hover:text-[#111111] transition-colors"
                  aria-label="What does this mean?"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              {tooltip === "treatment" && (
                <div className="mb-2 p-3 bg-[#F4EFE6] border border-[#E5E0D8] rounded-xl text-[11px] text-[#55524C] leading-relaxed">
                  <strong className="text-[#111111]">Tip:</strong> Vietnamese Thư Pháp looks best with original words. Use <em>Find the Vietnamese meaning</em> to add cultural depth — great for tattoos and wall art.
                </div>
              )}
              <div className="flex flex-col gap-2">
                {TREATMENTS.map((t) => {
                  const isSelected = state.treatment === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setState((prev) => ({ ...prev, treatment: t.id }))}
                      className={`p-3 rounded-xl text-left border transition-all active:scale-[0.99] flex items-start justify-between ${
                        isSelected
                          ? "border-black bg-[#111111] text-white shadow-sm"
                          : "border-[#E0DBD1] bg-[#FAF8F5] text-[#111111] hover:border-black/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{t.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            isSelected ? "bg-white/20 text-white" : "bg-[#EAE5DC] text-[#444]"
                          }`}>{t.tag}</span>
                        </div>
                        <span className={`text-[11px] block mt-0.5 leading-snug ${
                          isSelected ? "text-white/80" : "text-[#66635D]"
                        }`}>{t.desc}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#B3261E] flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Step Button */}
            <button
              onClick={() => canAdvanceStep1 && setCurrentStep(2)}
              disabled={!canAdvanceStep1}
              className="w-full bg-[#111111] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Next: Choose Your Style <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}


        {/* ── STEP 2: YOUR STYLE ─────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-5">
            {/* Font picker */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" /> Brush Style
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                  className="w-full px-4 py-3.5 border-2 border-[#E0DBD1] rounded-xl text-xs font-semibold text-[#111111] bg-white hover:border-black flex items-center justify-between transition-all shadow-sm"
                >
                  <div className="flex flex-col text-left">
                    <span
                      className="text-xl leading-tight"
                      style={{ fontFamily: `'${currentTraditionFonts.find((f) => f.id === state.fontId)?.name || "UTM ThuPhap Thien An"}', cursive` }}
                    >
                      {(state.inputText || "Thi Bút").slice(0, 22)}
                    </span>
                    <span className="text-[11px] text-[#66635D] mt-1">
                      {currentTraditionFonts.find((f) => f.id === state.fontId)?.name || currentTraditionFonts[0]?.name}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#888580] transition-transform ${fontDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {fontDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#D8D2C5] rounded-xl shadow-xl z-30 p-1.5 flex flex-col gap-1 max-h-[380px] overflow-y-auto">
                    {currentTraditionFonts.map((font) => {
                      const isSelected = state.fontId === font.id;
                      const previewText = (state.inputText || "Thi Bút").slice(0, 22);
                      return (
                        <button
                          key={font.id}
                          onClick={() => {
                            setState((prev) => ({ ...prev, fontId: font.id, fontName: font.name, fontFileName: (font as any).fileName || undefined }));
                            setFontDropdownOpen(false);
                          }}
                          className={`w-full p-3 rounded-lg text-left transition-all flex items-start justify-between border ${
                            isSelected ? "bg-[#F4EFE6] border-black shadow-sm" : "border-transparent hover:bg-[#FAF8F5]"
                          }`}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <span className="text-xl leading-tight text-[#111111] block truncate" style={{ fontFamily: `'${font.name}', cursive, serif` }}>
                              {previewText}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[11px] text-[#444]">{font.name}</span>
                              <span className="text-[9px] px-1.5 py-0.5 bg-[#EAE5DC] text-[#66635D] rounded font-mono">{font.badge}</span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#B3261E] flex-shrink-0 ml-2 mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Stroke Style */}
            <div>
              <label className="text-[11px] font-label-caps uppercase text-[#66635D] block mb-1.5 font-bold">Brush Pressure</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STROKE_PRESETS.map((s) => {
                  const isSelected = state.strokePreset === s.id;
                  return (
                    <button key={s.id} onClick={() => setState((prev) => ({ ...prev, strokePreset: s.id }))}
                      className={`py-2 px-2.5 rounded-lg border text-left text-xs transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                        isSelected ? "border-black bg-[#111111] text-white font-bold" : "border-[#E0DBD1] bg-white text-[#111111] hover:border-black/50"
                      }`}>
                      <span>{s.icon}</span><span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Composition Layout */}
            <div>
              <label className="text-[11px] font-label-caps uppercase text-[#66635D] block mb-1.5 font-bold">Layout</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "HORIZONTAL", label: "↔ Horizontal", desc: "Balanced modern line" },
                  { id: "VERTICAL", label: "⬍ Vertical Scroll", desc: "Hanging scroll format" },
                  { id: "EMBLEM", label: "⭕ Centered Emblem", desc: "Circular badge focus" },
                  { id: "FULL_BACK", label: "📜 Full Statement", desc: "Expansive layout" },
                ].map((layout) => {
                  const isSelected = state.layout === layout.id;
                  return (
                    <button key={layout.id} onClick={() => setState((prev) => ({ ...prev, layout: layout.id as CompositionLayout }))}
                      className={`p-3 border rounded-xl text-left text-xs transition-all active:scale-[0.98] ${
                        isSelected ? "border-black bg-[#F4EFE6] font-bold ring-1 ring-black shadow-sm" : "border-[#E0DBD1] bg-[#FAF8F5] hover:border-black/50 text-[#111111]"
                      }`}>
                      <span className="font-bold text-[#111111] block">{layout.label}</span>
                      <span className="text-[10px] text-[#888580] mt-0.5 block">{layout.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ink Color */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-label-caps uppercase text-[#46474A] font-bold block">Ink Color</span>
                <span className="text-[11px] text-[#888580] font-mono">{INK_PIGMENTS.find((p) => p.id === state.inkColor)?.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {INK_PIGMENTS.map((p) => {
                  const isSelected = state.inkColor === p.id;
                  return (
                    <button key={p.id} onClick={() => setState((prev) => ({ ...prev, inkColor: p.id }))} title={p.label}
                      className={`w-9 h-9 rounded-full border shadow-sm flex items-center justify-center transition-all active:scale-95 ${
                        isSelected ? "ring-2 ring-[#B3261E] scale-110 shadow-md" : "hover:scale-105 opacity-85 border-[#C7C6CA]"
                      }`} style={{ backgroundColor: p.hex }}>
                      {isSelected && <span className={`w-2.5 h-2.5 rounded-full ${p.id === "black" ? "bg-white" : "bg-black"}`} />}
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Style Variations */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-label-caps uppercase text-[#46474A] font-bold tracking-wider">Try a Style</span>
                <span className="text-[11px] font-mono text-[#888580]">{state.variationIndex.replace(/^\d+_/, "").toLowerCase()}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {VARIATION_PILLS.map((pill) => {
                  const isActive = state.variationIndex === pill.id;
                  return (
                    <button key={pill.id} onClick={() => handleSelectVariation(pill.id)} title={pill.desc}
                      className={`py-2.5 px-1.5 rounded-xl text-center transition-all active:scale-95 flex flex-col items-center justify-center border relative ${
                        isActive ? "bg-[#111111] text-white border-[#111111] font-bold shadow-md ring-2 ring-black/20 scale-[1.02]" : "bg-white border-[#E0DBD1] hover:border-black/60 text-[#111111] hover:bg-[#FAF8F5]"
                      }`}>
                      {isActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#B3261E] rounded-full ring-2 ring-white" />}
                      <span className="text-sm block">{pill.icon}</span>
                      <span className="text-[10px] truncate max-w-full font-bold block mt-0.5">{pill.label.replace(/^\d+\s*/, "")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step nav */}
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(1)}
                className="flex-1 py-2.5 border border-[#E0DBD1] text-[#111111] rounded-xl text-sm font-semibold hover:border-black transition-all active:scale-[0.98]">
                ← Back
              </button>
              <button onClick={() => setCurrentStep(3)}
                className="flex-[2] bg-[#111111] text-white py-2.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                Next: Choose Product <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}



        {/* ── STEP 3: PRODUCT ─────────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider block mb-1">Almost there!</span>
              <p className="text-[11px] text-[#66635D]">Your artwork is ready. Choose a product to put it on.</p>
            </div>

            {/* Artwork summary card */}
            <div className="flex items-center gap-3 p-3 bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl">
              <div
                className="w-14 h-14 rounded-lg border border-[#E0DBD1] bg-white flex items-center justify-center overflow-hidden shrink-0 [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: displayArtworkUrl }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#111111] truncate">&ldquo;{(state.interpretation.text || state.inputText).slice(0, 30)}&rdquo;</p>
                <p className="text-[11px] text-[#888580] font-mono mt-0.5">Vector 300 DPI · {INK_PIGMENTS.find(p => p.id === state.inkColor)?.label}</p>
              </div>
              <button onClick={() => setCurrentStep(2)} className="text-[11px] text-[#B3261E] font-semibold hover:underline shrink-0">Edit</button>
            </div>

            <button onClick={() => setCurrentStep(2)}
              className="w-full text-sm py-2.5 border border-[#E0DBD1] text-[#111111] rounded-xl font-semibold hover:border-black transition-all active:scale-[0.98]">
              ← Edit Style
            </button>
          </div>
        )}

        </div>{/* end inner flex col */}

        {/* ── Sticky CTA Bar (always visible, never scroll-buried) ──────────── */}
        <div className="sticky bottom-0 -mx-0 px-6 sm:px-7 pt-4 pb-5 bg-white border-t border-[#EBE6DC] rounded-b-2xl">
          {/* Mini artwork thumbnail + price hint */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-11 h-11 rounded-lg border border-[#E0DBD1] bg-[#FBF9F5] flex items-center justify-center overflow-hidden shrink-0 [&>svg]:w-full [&>svg]:h-full"
              dangerouslySetInnerHTML={{ __html: displayArtworkUrl }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#111111] truncate">
                &ldquo;{(state.interpretation.text || state.inputText).slice(0, 28)}&rdquo;
              </p>
              <p className="text-[10px] text-[#888580] font-mono">Vector 300 DPI · Print Ready</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-[#888580] font-mono">From</p>
              <p className="text-sm font-bold text-[#111111]">$34.99</p>
            </div>
          </div>

          <button
            onClick={() => {
              const encodedSvgUri = `data:image/svg+xml;base64,${safeBase64Encode(displayArtworkUrl)}`;
              onProceedToMerchandise(state, {
                id: `studio-candidate-${Date.now()}`,
                index: 1,
                imageUrl: encodedSvgUri,
                variationType: state.variationIndex,
                variationName: state.variationIndex,
                variationNote: "Studio Vector Master",
                seed: 42,
              });
            }}
            className="w-full bg-[#B3261E] text-white py-3.5 font-label-caps uppercase text-center hover:bg-[#9b1e17] active:scale-[0.99] transition-all rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-sm tracking-wider cursor-pointer"
          >
            <span>Choose a Product  →</span>
          </button>

          <p className="text-center text-[10px] text-[#888580] mt-2">
            Free shipping on orders over $75 · Ships in 5–7 days
          </p>
        </div>

      </div>

    </div>
  );
}
