"use client";

/**
 * /create/[sessionId] — Thi Bút Studio 2.0 (Streamlined 3-Stage Experience)
 * 
 * Stage 1: Express & Style (Prompt + Cultural Meaning + Style Pack in one unified view)
 * Stage 2: Pick Your Brush (6 genuine brush variations with 1-click auto-advance)
 * Stage 3: Interactive Product Studio & 1-Click Buy (Live canvas mockup + product size/color + checkout)
 */

import { useState, use, useEffect, useCallback } from "react";
import { 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles, 
  Palette, 
  ShoppingBag, 
  Sliders, 
  RotateCw, 
  ZoomIn, 
  ZoomOut,
  ShieldCheck
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "NAME" | "QUOTE" | "STORY";
type CulturalStyle = "VIETNAMESE_THU_PHAP" | "JAPANESE_SHODO" | "CHINESE_CALLIGRAPHY" | "KOREAN_BRUSH";
type TextTreatment = "KEEP_ORIGINAL" | "TRANSLATE";
type StudioStage = 1 | 2 | 3;

const CULTURAL_STYLES: { id: CulturalStyle; label: string; flag: string; tradition: string }[] = [
  { id: "VIETNAMESE_THU_PHAP", label: "Vietnamese", flag: "🇻🇳", tradition: "Thư Pháp chữ Quốc Ngữ" },
  { id: "JAPANESE_SHODO", label: "Japanese", flag: "🇯🇵", tradition: "Shodō (書道)" },
  { id: "CHINESE_CALLIGRAPHY", label: "Chinese", flag: "🇨🇳", tradition: "Shūfǎ (書法)" },
  { id: "KOREAN_BRUSH", label: "Korean", flag: "🇰🇷", tradition: "Seoye (書藝)" },
];

const STYLE_PACKS = [
  { id: "Thi Bút Classic", label: "Thi Bút Classic", desc: "Vietnamese poetic brush & flourishes", badge: "Most Popular" },
  { id: "Shodō", label: "Shodō", desc: "Japanese brush calligraphy & sumi ink", badge: "Traditional" },
  { id: "Ink", label: "Bold Ink", desc: "Heavy pressure & authoritative strokes", badge: "Expressive" },
  { id: "Zen", label: "Zen Minimal", desc: "Delicate touch & open negative space", badge: "Minimal" },
  { id: "Seal", label: "Imperial Seal", desc: "Red cinnabar seal chop composition", badge: "Artistic" },
];

const QUICK_PROMPTS = [
  "David",
  "Peace",
  "Có chí thì nên",
  "Never Give Up",
  "Trí Tuệ",
  "Love & Harmony",
];

const PRODUCTS = [
  { id: "Premium Hoodie", name: "Premium Heavyweight Hoodie", price: 99.0, mockup: "/mockups/blank_hoodie.jpg" },
  { id: "Classic T-Shirt", name: "Classic Streetwear Tee", price: 45.0, mockup: "/mockups/model-male.jpg" },
  { id: "Fine Art Poster", name: "Fine Art Museum Scroll", price: 25.0, mockup: "/mockups/fine-art-poster.jpg" },
  { id: "Digital Download", name: "300 DPI Master Digital Pack", price: 9.99, mockup: "" },
];

interface Interpretation {
  type: string;
  language: string;
  text: string;
  romanization?: string;
  meaning: string;
  confidence: number;
  warning?: string | null;
  recommended: boolean;
  recommendedStyles?: string[];
  culturalContext?: string;
}

interface Candidate {
  id: string;
  index: number;
  imageUrl: string;
  stylePack: string;
  variationType?: string;
  variationName?: string;
  variationNote: string;
  seed: number;
}

export default function CreatePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();

  // ── Stage State ─────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<StudioStage>(1);

  // ── Stage 1 State ───────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<Mode>("QUOTE");
  const [culturalStyle, setCulturalStyle] = useState<CulturalStyle>("VIETNAMESE_THU_PHAP");
  const [textTreatment, setTextTreatment] = useState<TextTreatment>("KEEP_ORIGINAL");
  const [stylePack, setStylePack] = useState("Thi Bút Classic");
  
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [selectedInterpretation, setSelectedInterpretation] = useState<Interpretation | null>(null);
  const [interpretLoading, setInterpretLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ── Stage 2 State (Candidates) ──────────────────────────────────────────────
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // ── Stage 3 State (Studio & Product) ────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState("Premium Hoodie");
  const [selectedSize, setSelectedSize] = useState("L");
  const [selectedColor, setSelectedColor] = useState("black");
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [canvasRotation, setCanvasRotation] = useState(0);

  // ── Read hero input from URL search params on mount ─────────────────────────
  useEffect(() => {
    const textParam = searchParams.get("text");
    if (textParam) {
      setInputText(textParam);
    }
  }, [searchParams]);

  // ── Debounced Cultural Interpretation Fetcher ───────────────────────────────
  useEffect(() => {
    const text = inputText.trim();
    if (!text) {
      setInterpretations([]);
      setSelectedInterpretation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setInterpretLoading(true);
      try {
        const res = await fetch("/api/personalization/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inputText: text, culturalStyle, textTreatment, mode }),
        });
        if (res.ok) {
          const data = await res.json();
          const items = data.interpretations ?? [];
          setInterpretations(items);
          const rec = items.find((i: Interpretation) => i.recommended) || items[0] || null;
          setSelectedInterpretation(rec);
        }
      } catch (err) {
        console.warn("Auto-interpretation warning:", err);
      } finally {
        setInterpretLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [inputText, culturalStyle, textTreatment, mode]);

  // ── Generate Master Candidates (Transition from Stage 1 -> 2) ───────────────
  const handleGenerate = async () => {
    const text = inputText.trim();
    if (!text) return;

    setGenerateLoading(true);
    setGenerateError(null);
    setCandidates([]);

    const primaryInterpretation = selectedInterpretation || {
      type: textTreatment === "KEEP_ORIGINAL" ? "ORIGINAL" : "NATURAL",
      language: culturalStyle === "VIETNAMESE_THU_PHAP" ? "Vietnamese" : culturalStyle === "JAPANESE_SHODO" ? "Japanese" : "English",
      text: text,
      meaning: "Original expression",
      confidence: 1.0,
      recommended: true,
    };

    try {
      const res = await fetch("/api/personalization/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          inputText: primaryInterpretation.text,
          culturalStyle,
          textTreatment,
          mode,
          stylePack,
          composition: "Centered",
          selectedInterpretation: primaryInterpretation,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to generate designs");
      }

      const data = await res.json();
      if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
        setSelectedCandidate(data.candidates[0]);
        setStage(2); // Auto-advance to Stage 2
      } else {
        throw new Error("No candidates returned. Please try again.");
      }
    } catch (err: any) {
      setGenerateError(err.message || "Could not generate calligraphy. Please try again.");
    } finally {
      setGenerateLoading(false);
    }
  };

  // ── Select Candidate (1-Click Advance from Stage 2 -> 3) ─────────────────────
  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setStage(3); // Auto-advance to Stage 3 Interactive Studio
  };

  return (
    <div className="bg-[#FCFAF6] min-h-screen text-[#111111] font-body">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* ── Top Progress Tracker (3 Stages) ──────────────────────────────── */}
        <div className="flex justify-center items-center gap-3 sm:gap-6 mb-10">
          {[
            { num: 1, title: "1. Create & Style" },
            { num: 2, title: "2. Pick Your Brush" },
            { num: 3, title: "3. Studio & Order" },
          ].map((s) => {
            const isActive = stage === s.num;
            const isCompleted = stage > s.num;
            return (
              <button
                key={s.num}
                onClick={() => {
                  if (s.num < stage || (s.num === 2 && candidates.length > 0) || (s.num === 3 && selectedCandidate)) {
                    setStage(s.num as StudioStage);
                  }
                }}
                disabled={s.num > stage && (s.num === 2 ? candidates.length === 0 : !selectedCandidate)}
                className={`flex items-center gap-2 text-xs sm:text-sm font-mono uppercase tracking-wider transition-all ${
                  isActive
                    ? "text-[#B3261E] font-bold border-b-2 border-[#B3261E] pb-1"
                    : isCompleted
                    ? "text-emerald-700 hover:text-[#111111]"
                    : "text-[#A09D96] opacity-60 cursor-not-allowed"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : null}
                {s.title}
                {s.num < 3 && <ChevronRight className="w-3.5 h-3.5 text-[#E5E0D8] hidden sm:inline ml-2" />}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 1: Create & Style (Unified Input, Meaning, and Style Pack)
        ═══════════════════════════════════════════════════════════════════════ */}
        {stage === 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#111111] text-[#F6F1E7] text-xs font-mono uppercase tracking-widest rounded-full mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#B3261E]" />
                Thi Bút Studio 2.0
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#111111]">
                Express Your Words in Art
              </h1>
              <p className="text-sm sm:text-base text-[#77756F] max-w-lg mx-auto">
                Transform any name, quote, or phrase into authentic Asian brush calligraphy.
              </p>
            </div>

            {/* Input & Prompt Card */}
            <div className="bg-white border border-[#E5E0D8] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#77756F] mb-2 font-bold">
                  Your Name, Word, or Phrase
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g. David, Peace, Có chí thì nên..."
                    className="w-full text-xl sm:text-2xl font-serif px-5 py-4 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-[#B3261E] focus:ring-1 focus:ring-[#B3261E] transition-all"
                  />
                  {interpretLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 text-[#B3261E] animate-spin" />
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs text-[#77756F] font-mono">Suggestions:</span>
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setInputText(p)}
                      className="px-2.5 py-1 text-xs bg-[#F4EFE6] text-[#4A4844] rounded-md hover:bg-[#B3261E] hover:text-white transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cultural Tradition Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#77756F] mb-3 font-bold">
                  Select Cultural Calligraphy Tradition
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CULTURAL_STYLES.map((cs) => {
                    const isSelected = culturalStyle === cs.id;
                    return (
                      <button
                        key={cs.id}
                        type="button"
                        onClick={() => setCulturalStyle(cs.id)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "border-[#B3261E] bg-[#B3261E]/5 ring-1 ring-[#B3261E]"
                            : "border-[#E5E0D8] bg-[#FCFAF6] hover:border-[#77756F]"
                        }`}
                      >
                        <div className="text-2xl mb-2">{cs.flag}</div>
                        <div>
                          <div className="font-serif font-bold text-sm text-[#111111]">{cs.label}</div>
                          <div className="text-[11px] text-[#77756F] font-mono truncate">{cs.tradition}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cultural Meaning & Transliteration (When Available) */}
              {interpretations.length > 0 && (
                <div className="p-4 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#B3261E] font-bold">
                      Cultural Interpretation & Meaning
                    </span>
                    <span className="text-xs text-[#77756F]">Select representation</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {interpretations.map((interp, idx) => {
                      const isSel = selectedInterpretation?.text === interp.text;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedInterpretation(interp)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSel
                              ? "border-[#B3261E] bg-white ring-1 ring-[#B3261E]"
                              : "border-[#E5E0D8] bg-white hover:border-[#77756F]"
                          }`}
                        >
                          <div className="text-xs font-mono text-[#77756F] uppercase">{interp.type}</div>
                          <div className="text-lg font-serif font-bold text-[#111111] mt-0.5">{interp.text}</div>
                          {interp.romanization && (
                            <div className="text-xs text-[#77756F] italic">{interp.romanization}</div>
                          )}
                          <div className="text-xs text-[#4A4844] mt-1 line-clamp-1">&ldquo;{interp.meaning}&rdquo;</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Style Pack Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#77756F] mb-3 font-bold">
                  Select Calligraphy Brush Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {STYLE_PACKS.map((sp) => {
                    const isSelected = stylePack === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setStylePack(sp.id)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? "border-[#B3261E] bg-[#B3261E]/5 ring-1 ring-[#B3261E]"
                            : "border-[#E5E0D8] bg-[#FCFAF6] hover:border-[#77756F]"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#EAE4DA] text-[#4A4844] rounded">
                            {sp.badge}
                          </span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#B3261E]" />}
                        </div>
                        <div>
                          <div className="font-serif font-bold text-sm text-[#111111]">{sp.label}</div>
                          <div className="text-[11px] text-[#77756F] mt-1 leading-tight">{sp.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Display */}
              {generateError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl">
                  {generateError}
                </div>
              )}

              {/* Primary Action */}
              <button
                onClick={handleGenerate}
                disabled={generateLoading || !inputText.trim()}
                className="w-full py-4 bg-[#B3261E] hover:bg-[#8e1f18] text-white rounded-xl font-mono text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {generateLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating 6 Real Brush Variations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate 6 Brush Variations →
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 2: Choose Your Brush Masterpiece (6 Variations Gallery)
        ═══════════════════════════════════════════════════════════════════════ */}
        {stage === 2 && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="font-serif text-3xl font-bold text-[#111111]">
                  Pick Your Master Brush Dynamic
                </h1>
                <p className="text-sm text-[#77756F]">
                  Click your favorite stroke energy to instantly customize and purchase.
                </p>
              </div>
              <button
                onClick={() => setStage(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E5E0D8] rounded-lg text-xs font-mono uppercase text-[#4A4844] hover:border-[#111111]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Edit Words & Style
              </button>
            </div>

            {/* 6 Variations Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((c) => {
                const isSelected = selectedCandidate?.seed === c.seed;
                return (
                  <div
                    key={c.seed}
                    onClick={() => handleSelectCandidate(c)}
                    className={`group cursor-pointer bg-white border rounded-2xl p-6 transition-all duration-300 flex flex-col justify-between hover:shadow-lg ${
                      isSelected
                        ? "border-[#B3261E] ring-2 ring-[#B3261E] bg-[#FCFAF6]"
                        : "border-[#E5E0D8] hover:border-[#77756F]"
                    }`}
                  >
                    {/* Artwork Preview (Large & High Scale) */}
                    <div className="aspect-[4/3] bg-[#FAF8F5] border border-[#EAE4DA] rounded-xl flex items-center justify-center p-6 overflow-hidden relative group-hover:scale-[1.02] transition-transform">
                      <img
                        src={c.imageUrl}
                        alt={c.variationNote}
                        className="max-h-full max-w-full object-contain pointer-events-none select-none"
                        onContextMenu={(e) => e.preventDefault()}
                        draggable={false}
                      />
                      {isSelected && (
                        <div className="absolute top-3 right-3 bg-[#B3261E] text-white p-1 rounded-full shadow">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Metadata & 1-Click CTA */}
                    <div className="mt-4 pt-3 border-t border-[#E5E0D8] flex justify-between items-center">
                      <div>
                        <div className="text-xs font-mono uppercase font-bold text-[#B3261E]">
                          {c.variationName || "Brush Masterpiece"}
                        </div>
                        <div className="text-xs text-[#77756F] line-clamp-1 mt-0.5">
                          {c.variationNote}
                        </div>
                      </div>
                      <span className="text-xs font-mono uppercase bg-[#111111] text-white px-3 py-1.5 rounded-lg group-hover:bg-[#B3261E] transition-colors">
                        Select →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            STAGE 3: Interactive Product Studio & 1-Click Order
        ═══════════════════════════════════════════════════════════════════════ */}
        {stage === 3 && selectedCandidate && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="font-serif text-3xl font-bold text-[#111111]">
                  Personalize & Order
                </h1>
                <p className="text-sm text-[#77756F]">
                  Adjust positioning, choose your garment or scroll, and proceed to checkout.
                </p>
              </div>
              <button
                onClick={() => setStage(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E5E0D8] rounded-lg text-xs font-mono uppercase text-[#4A4844] hover:border-[#111111]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Change Brush Dynamic
              </button>
            </div>

            {/* Split Screen Studio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left: Interactive Canvas (7 cols) */}
              <div className="lg:col-span-7 bg-white border border-[#E5E0D8] rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#77756F] font-bold">
                    Live Product Preview Canvas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCanvasScale((s) => Math.max(0.7, s - 0.1))}
                      className="p-1.5 bg-[#F4EFE6] hover:bg-[#EAE4DA] rounded text-[#4A4844]"
                      title="Scale down"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-[#77756F] w-12 text-center">
                      {Math.round(canvasScale * 100)}%
                    </span>
                    <button
                      onClick={() => setCanvasScale((s) => Math.min(1.5, s + 0.1))}
                      className="p-1.5 bg-[#F4EFE6] hover:bg-[#EAE4DA] rounded text-[#4A4844]"
                      title="Scale up"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Canvas Box */}
                <div className="aspect-square bg-[#FAF8F5] border border-[#EAE4DA] rounded-xl relative overflow-hidden flex items-center justify-center p-8">
                  {/* Mockup Background */}
                  {selectedProduct !== "Digital Download" && (
                    <img
                      src={PRODUCTS.find((p) => p.id === selectedProduct)?.mockup || "/mockups/blank_hoodie.jpg"}
                      alt="Product Mockup"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none opacity-90"
                    />
                  )}

                  {/* Artwork Layer */}
                  <motion.div
                    style={{
                      scale: canvasScale,
                      rotate: canvasRotation,
                    }}
                    className="relative z-10 w-[75%] h-[75%] flex items-center justify-center"
                  >
                    <img
                      src={selectedCandidate.imageUrl}
                      alt="Your Calligraphy Artwork"
                      className={`max-h-full max-w-full object-contain pointer-events-none select-none ${
                        selectedProduct !== "Digital Download" ? "mix-blend-multiply" : ""
                      }`}
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </motion.div>
                </div>

                {/* Artwork Origin Badge */}
                <div className="p-4 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl flex justify-between items-center text-xs font-mono">
                  <div>
                    <span className="text-[#77756F] block">Validated Text:</span>
                    <span className="font-bold text-[#111111]">{inputText}</span>
                  </div>
                  <div>
                    <span className="text-[#77756F] block">Brush Dynamic:</span>
                    <span className="font-bold text-[#B3261E]">{selectedCandidate.variationName}</span>
                  </div>
                  <div>
                    <span className="text-[#77756F] block">Tradition:</span>
                    <span className="font-bold text-[#111111]">
                      {CULTURAL_STYLES.find((c) => c.id === culturalStyle)?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Product Selection & Direct 1-Click Order (5 cols) */}
              <div className="lg:col-span-5 bg-white border border-[#E5E0D8] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#77756F] mb-3 font-bold">
                    1. Choose Merchandise
                  </label>
                  <div className="space-y-2">
                    {PRODUCTS.map((prod) => {
                      const isSel = selectedProduct === prod.id;
                      return (
                        <button
                          key={prod.id}
                          onClick={() => setSelectedProduct(prod.id)}
                          className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                            isSel
                              ? "border-[#B3261E] bg-[#B3261E]/5 ring-1 ring-[#B3261E]"
                              : "border-[#E5E0D8] bg-[#FCFAF6] hover:border-[#77756F]"
                          }`}
                        >
                          <div>
                            <div className="font-serif font-bold text-sm text-[#111111]">{prod.name}</div>
                            <div className="text-xs text-[#77756F]">Premium museum quality finish</div>
                          </div>
                          <div className="font-mono text-sm font-bold text-[#111111]">
                            ${prod.price.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sizing (For Apparel) */}
                {selectedProduct !== "Fine Art Poster" && selectedProduct !== "Digital Download" && (
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#77756F] mb-2 font-bold">
                      2. Select Size
                    </label>
                    <div className="flex gap-2">
                      {["S", "M", "L", "XL", "2XL"].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setSelectedSize(sz)}
                          className={`flex-1 py-2.5 rounded-lg border font-mono text-xs font-bold transition-all ${
                            selectedSize === sz
                              ? "border-[#111111] bg-[#111111] text-white"
                              : "border-[#E5E0D8] bg-[#FCFAF6] text-[#111111] hover:border-[#77756F]"
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guarantee & Sizing Trust Badge */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-800 text-xs">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Printful Master Guarantee (TB-CALLI-001)
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-700">
                    Rendered at 4500×5400 px @ 300 DPI vector fidelity. Backed by full print master certification.
                  </p>
                </div>

                {/* Direct Checkout CTA */}
                <Link
                  href={`/checkout?candidate=${selectedCandidate.id}&product=${encodeURIComponent(selectedProduct)}`}
                  className="w-full py-4 bg-[#B3261E] hover:bg-[#8e1f18] text-white rounded-xl font-mono text-sm uppercase tracking-widest text-center transition-all shadow-md block flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Proceed to Checkout (${PRODUCTS.find((p) => p.id === selectedProduct)?.price.toFixed(2)}) →
                </Link>
              </div>

            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
