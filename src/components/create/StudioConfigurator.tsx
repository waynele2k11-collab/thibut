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
  Info
} from "lucide-react";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";

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

const TRADITIONS: { id: CulturalTradition; label: string; flag: string; native: string; desc: string; sample: string }[] = [
  { 
    id: "VIETNAMESE_THU_PHAP", 
    label: "Vietnamese Thư Pháp", 
    flag: "🇻🇳", 
    native: "Thư Pháp",
    desc: "Authentic Quốc Ngữ brush calligraphy with sweeping dragon ascenders.",
    sample: "Có Chí Thì Nên"
  },
  { 
    id: "JAPANESE_SHODO", 
    label: "Japanese Shodō", 
    flag: "🇯🇵", 
    native: "書道",
    desc: "Classical Sumi-e brushwork (Kanji / Hiragana / Katakana).",
    sample: "七転八起"
  },
  { 
    id: "CHINESE_CALLIGRAPHY", 
    label: "Chinese Shūfǎ", 
    flag: "🇨🇳", 
    native: "書法",
    desc: "Traditional Hanzi brush scripts (Grass, Regular, Running).",
    sample: "天道酬勤"
  },
  { 
    id: "KOREAN_BRUSH", 
    label: "Korean Seoye", 
    flag: "🇰🇷", 
    native: "서예",
    desc: "Dynamic Hangul stroke dynamics and ancient stone-rubbing script.",
    sample: "영원한 사랑"
  },
];

const TREATMENTS: { id: WordTreatment; label: string; tag: string; desc: string }[] = [
  { 
    id: "KEEP_ORIGINAL", 
    label: "Keep My Words", 
    tag: "Exact Words", 
    desc: "Render your exact words (e.g. WAYNE or Có Chí Thì Nên) in authentic Asian brush aesthetic." 
  },
  { 
    id: "MATCH_SOUND", 
    label: "Match the Sound", 
    tag: "Phonetic", 
    desc: "Transliterate names and words phonetically into cultural script characters." 
  },
  { 
    id: "TRANSLATE_MEANING", 
    label: "Translate the Meaning", 
    tag: "Deep Meaning", 
    desc: "AI transforms the philosophical meaning into a timeless cultural proverb." 
  },
];

const STROKE_PRESETS: { id: StrokePreset; label: string; subtitle: string; icon: string; glyph: string }[] = [
  { id: "BOLD_BRUSH", label: "Bold Brush", subtitle: "Heavy sumi ink & deep pressure", icon: "💥", glyph: "大" },
  { id: "FLOWING_INK", label: "Flowing Ink", subtitle: "Graceful dancing rhythm & loops", icon: "🌊", glyph: "水" },
  { id: "DRY_BRUSH", label: "Dry Brush", subtitle: "Visible bristle texture & flying white", icon: "⚡", glyph: "飛" },
  { id: "CLASSICAL", label: "Classical", subtitle: "Authoritative balanced precision", icon: "🏛️", glyph: "正" },
  { id: "FREE_SPIRIT", label: "Free Spirit", subtitle: "Wild expressive grass cursive", icon: "🍃", glyph: "草" },
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

  // UI State
  const [candidates, setCandidates] = useState<CandidateVariation[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<CandidateVariation | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isAnalyzingMeaning, setIsAnalyzingMeaning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [traditionDropdownOpen, setTraditionDropdownOpen] = useState(false);

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

  // ── Instant Client-Side Fallback SVG (0ms Latency on every stroke) ────────────
  const instantClientSvg = useMemo(() => {
    const colorMap = {
      black: "#0B0B0B",
      vermilion: "#B3261E",
      gold: "#C5A059",
      ivory: "#F6F1E7",
    };
    return generateInstantSvgUri({
      text: state.interpretation.text || state.inputText,
      tradition: state.tradition,
      strokePreset: state.strokePreset,
      variationType: state.variationIndex,
      layout: state.layout,
      inkColor: colorMap[state.inkColor] || "#0B0B0B",
      hasSeal: state.hasSeal,
    });
  }, [
    state.inputText,
    state.interpretation.text,
    state.tradition,
    state.strokePreset,
    state.variationIndex,
    state.layout,
    state.inkColor,
    state.hasSeal,
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

  // ── Deterministic Studio Engine: Server-side rendering in background ───────────
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

  // Recolor active candidate SVG locally on ink color changes, fallback to instant client SVG
  const displayArtworkUrl = useMemo(() => {
    if (activeCandidate?.imageUrl) {
      return recolorSvgString(activeCandidate.imageUrl, state.inkColor);
    }
    return instantClientSvg;
  }, [activeCandidate?.imageUrl, state.inkColor, instantClientSvg]);

  // Available fonts for selected tradition
  const filteredFonts = useMemo(() => {
    return activeFonts.filter((f) => f.category === state.tradition);
  }, [activeFonts, state.tradition]);

  const activeTraditionObj = TRADITIONS.find((t) => t.id === state.tradition) || TRADITIONS[0];
  const activeTreatmentObj = TREATMENTS.find((t) => t.id === state.treatment) || TREATMENTS[0];

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
      
      {/* ── LEFT COLUMN: Live Artwork Visualizer Stage (7 Cols) ─────────────── */}
      <div className="lg:col-span-7 flex flex-col gap-5 static lg:sticky lg:top-24 z-10">
        
        {/* Main Artwork Stage Box */}
        <div className="border border-surface-variant bg-[#FFFFFF] p-5 sm:p-7 rounded-2xl shadow-sm flex flex-col gap-5 relative overflow-hidden">
          
          {/* Stage Top Bar */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EBE6DC] text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#111111] flex items-center gap-1.5 font-label-caps uppercase tracking-wider text-xs">
                {activeTraditionObj.flag} {activeTraditionObj.label}
              </span>
              <span className="text-[#C7C6CA]">•</span>
              <span className="px-2.5 py-0.5 bg-[#F4EFE6] border border-[#E5E0D8] text-[#111111] rounded-md text-[11px] font-semibold">
                {activeTreatmentObj.tag}
              </span>
            </div>

            {isRendering ? (
              <span className="text-xs text-[#B3261E] font-semibold flex items-center gap-1.5 animate-pulse font-mono flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" /> Refining Vector...
              </span>
            ) : (
              <span className="text-[11px] font-mono text-[#888580] hidden sm:inline">
                Vector 300 DPI · Lossless
              </span>
            )}
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

            {/* Live Vector Artwork Rendering */}
            <img
              src={displayArtworkUrl}
              alt={state.interpretation.text}
              className="max-h-[86%] max-w-[86%] object-contain select-none pointer-events-none transition-transform duration-200"
              style={{
                transform: `scale(${state.advanced.scale}) rotate(${state.advanced.rotation}deg)`,
                filter: state.inkColor === "ivory" ? "drop-shadow(0px 2px 6px rgba(0,0,0,0.45))" : undefined,
              }}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          </div>

          {/* ── 01–06 Variation Preset Quick-Pills (Prominent with Micro-Icons) ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-label-caps uppercase text-[#46474A] font-bold tracking-wider">
                Variation Presets (Click to Experiment)
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
      <div className="lg:col-span-5 flex flex-col gap-6 bg-white p-6 sm:p-7 border border-surface-variant rounded-2xl shadow-sm">
        
        {/* Panel Header */}
        <div className="border-b border-[#EBE6DC] pb-4">
          <h1 className="font-headline-md text-xl font-bold text-[#111111]">
            Studio Controls
          </h1>
          <p className="text-xs text-[#66635D] mt-0.5">
            Personalize your words, stroke aesthetics, and layout in real-time.
          </p>
        </div>

        {/* ── SECTION 1: YOUR WORDS ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 pb-5 border-b border-[#EBE6DC]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider">
              1. Your Words
            </span>
            <span className="text-[11px] font-mono text-[#888580]">
              {state.inputText.length} chars
            </span>
          </div>

          {/* Master Text Input Box */}
          <div className="relative">
            <input
              type="text"
              value={state.inputText}
              onChange={(e) => setState((prev) => ({ ...prev, inputText: e.target.value }))}
              placeholder="Type your phrase, name, or quote..."
              className="w-full px-4 py-3.5 border-2 border-[#E0DBD1] rounded-xl text-base font-bold text-[#111111] bg-[#FAF8F5] focus:bg-white focus:border-black outline-none transition-all"
            />
          </div>

          {/* Custom Tradition Selector Card */}
          <div>
            <label className="text-[11px] font-label-caps uppercase text-[#66635D] block mb-1.5 font-bold">
              Cultural Tradition
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setTraditionDropdownOpen(!traditionDropdownOpen)}
                className="w-full px-4 py-3 border border-[#E0DBD1] rounded-xl text-xs font-semibold text-[#111111] bg-white hover:border-black flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{activeTraditionObj.flag}</span>
                  <span className="font-bold text-sm">{activeTraditionObj.label}</span>
                  <span className="text-[11px] text-[#888580] font-serif font-normal">({activeTraditionObj.native})</span>
                </div>
                <ChevronDown className="w-4 h-4 text-[#888580]" />
              </button>

              {traditionDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#D8D2C5] rounded-xl shadow-xl z-30 p-1.5 flex flex-col gap-1">
                  {TRADITIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setState((prev) => ({
                          ...prev,
                          tradition: t.id,
                          fontId: t.id === "VIETNAMESE_THU_PHAP" ? "utm-thuphap-thien-an" 
                            : t.id === "JAPANESE_SHODO" ? "yuji-boku"
                            : t.id === "CHINESE_CALLIGRAPHY" ? "long-cang" : "nanum-brush-script",
                        }));
                        setTraditionDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between ${
                        state.tradition === t.id ? "bg-[#F4EFE6] font-bold text-black" : "hover:bg-[#FAF8F5] text-[#444]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t.flag}</span>
                        <span>{t.label}</span>
                        <span className="text-[11px] text-[#888580] font-serif font-normal">({t.native})</span>
                      </div>
                      {state.tradition === t.id && <Check className="w-4 h-4 text-[#B3261E]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Treatment Options (3 Explicit Buttons) */}
          <div>
            <label className="text-[11px] font-label-caps uppercase text-[#66635D] block mb-1.5 font-bold">
              How Should Thi Bút Treat Your Words?
            </label>
            <div className="flex flex-col gap-2">
              {TREATMENTS.map((t) => {
                const isSelected = state.treatment === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setState((prev) => ({ ...prev, treatment: t.id }))}
                    className={`p-3 rounded-xl text-left border transition-all flex items-start justify-between ${
                      isSelected
                        ? "border-black bg-[#111111] text-white shadow-sm"
                        : "border-[#E0DBD1] bg-[#FAF8F5] text-[#111111] hover:border-black/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{t.label}</span>
                        <span className={`text-[10px] px-2 py-0.2 rounded font-mono ${
                          isSelected ? "bg-white/20 text-white" : "bg-[#EAE5DC] text-[#444]"
                        }`}>
                          {t.tag}
                        </span>
                      </div>
                      <span className={`text-[11px] block mt-0.5 leading-snug ${
                        isSelected ? "text-white/80" : "text-[#66635D]"
                      }`}>
                        {t.desc}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#B3261E] flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: CHOOSE YOUR STROKE (With Live Option Previews) ─────── */}
        <div className="flex flex-col gap-3.5 pb-5 border-b border-[#EBE6DC]">
          <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider">
            2. Choose Your Stroke (Live Style Options)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STROKE_PRESETS.map((s) => {
              const isSelected = state.strokePreset === s.id;
              // Generate live micro-preview for this stroke card
              const microPreviewSvg = generateInstantSvgUri({
                text: (state.inputText || "Thi Bút").split(/\s+/)[0] || "Thi",
                tradition: state.tradition,
                strokePreset: s.id,
                variationType: "01_CONTROLLED",
                layout: "HORIZONTAL",
                inkColor: isSelected ? "#111111" : "#444444",
                hasSeal: false,
              });

              return (
                <button
                  key={s.id}
                  onClick={() => setState((prev) => ({ ...prev, strokePreset: s.id }))}
                  className={`p-3 rounded-xl text-left border transition-all relative overflow-hidden flex flex-col justify-between min-h-[92px] ${
                    isSelected
                      ? "border-black bg-[#F4EFE6] ring-1 ring-black shadow-sm"
                      : "border-[#E0DBD1] hover:border-black/50 bg-[#FAF8F5]"
                  }`}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#111111]">
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#B3261E]" />}
                  </div>

                  {/* Micro Stroke Artwork Preview */}
                  <div className="w-full h-7 mt-1.5 flex items-center justify-start overflow-hidden opacity-85">
                    <img
                      src={microPreviewSvg}
                      alt={s.label}
                      className="h-full object-contain pointer-events-none select-none"
                    />
                  </div>

                  <span className="text-[10px] text-[#66635D] block mt-1 leading-snug">
                    {s.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: COMPOSITION (With Blueprint Diagrams) ──────────────── */}
        <div className="flex flex-col gap-3 pb-5 border-b border-[#EBE6DC]">
          <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider">
            3. Composition Layout
          </span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "HORIZONTAL", label: "↔ Horizontal", desc: "Balanced modern line", visual: "───" },
              { id: "VERTICAL", label: "⬍ Vertical Scroll", desc: "Hanging scroll format", visual: "│\n│" },
              { id: "EMBLEM", label: "⭕ Centered Emblem", desc: "Circular badge focus", visual: "◉" },
              { id: "FULL_BACK", label: "📜 Full Statement", desc: "Expansive layout", visual: "▓▓" },
            ].map((layout) => {
              const isSelected = state.layout === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => setState((prev) => ({ ...prev, layout: layout.id as CompositionLayout }))}
                  className={`p-3 border rounded-xl text-left text-xs transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-black bg-[#F4EFE6] font-bold ring-1 ring-black shadow-sm"
                      : "border-[#E0DBD1] bg-[#FAF8F5] hover:border-black/50 text-[#111111]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111111]">{layout.label}</span>
                    <span className="font-mono text-xs opacity-50 font-bold">{layout.visual}</span>
                  </div>
                  <span className="text-[10px] text-[#66635D] block mt-1">{layout.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 4: DETAILS & ACCENTS ──────────────────────────────────── */}
        <div className="flex flex-col gap-3.5 pb-2">
          <span className="text-xs font-label-caps uppercase text-[#111111] font-bold tracking-wider">
            4. Finishing Details
          </span>

          {/* Imperial Seal Toggle Card */}
          <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#E0DBD1] rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xl">🈴</span>
              <div>
                <span className="text-xs font-bold text-[#111111] block">Imperial Cinnabar Seal</span>
                <span className="text-[11px] text-[#66635D]">Authentic Red Chop (Ấn Triện Son 詩筆)</span>
              </div>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, hasSeal: !prev.hasSeal }))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                state.hasSeal ? "bg-[#B3261E] text-white" : "bg-[#E5E0D8] text-[#66635D]"
              }`}
            >
              {state.hasSeal ? "ON" : "OFF"}
            </button>
          </div>

          {/* Collapsible Advanced Fine-Tuning Drawer */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 text-xs font-label-caps uppercase text-[#66635D] font-bold hover:text-black transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Advanced Styling ▾
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-2 p-4 bg-[#FAF8F5] border border-[#E0DBD1] rounded-xl flex flex-col gap-3.5 text-xs">
                {/* Specific Font Override */}
                {filteredFonts.length > 0 && (
                  <div>
                    <label className="text-[10px] font-label-caps uppercase text-[#66635D] block mb-1 font-bold">
                      Typography Font Override
                    </label>
                    <select
                      value={state.fontId}
                      onChange={(e) => setState((prev) => ({ ...prev, fontId: e.target.value }))}
                      className="w-full p-2.5 border border-[#E0DBD1] rounded-lg bg-white outline-none cursor-pointer text-xs font-medium"
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
                    <label className="text-[10px] font-label-caps uppercase text-[#66635D] block mb-1 font-bold">
                      Scale ({state.advanced.scale.toFixed(2)}x)
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
                    <label className="text-[10px] font-label-caps uppercase text-[#66635D] block mb-1 font-bold">
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

        {/* ── Primary Action CTA ────────────────────────────────────────────── */}
        <button
          onClick={() => {
            const candidateToUse = activeCandidate || candidates[0] || {
              id: `studio-candidate-${Date.now()}`,
              index: 1,
              imageUrl: displayArtworkUrl || "",
              variationType: state.variationIndex,
              variationName: state.variationIndex,
              variationNote: "Studio Vector Master",
              seed: 42,
            };
            onProceedToMerchandise(state, {
              ...candidateToUse,
              imageUrl: displayArtworkUrl || candidateToUse.imageUrl,
            });
          }}
          className="w-full bg-[#111111] text-white py-4 font-label-caps uppercase text-center hover:bg-black transition-all rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-sm tracking-wider cursor-pointer active:scale-[0.99]"
        >
          <span>Preview on Products</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>

    </div>
  );
}
