"use client";

/**
 * /create/[sessionId] — Full Personalization Wizard
 * 
 * Step 1: Input (NAME / QUOTE / STORY) + Language selection
 * Step 2: Cultural interpretation selection (Literal / Natural / Poetic)
 * Step 3: Style Pack + Composition selection
 * Step 4: AI Candidate gallery → buyer picks one
 * Step 5: Product selector (size, color)  [→ checkout]
 */

import { useState, use, useEffect, useCallback } from "react";
import { ChevronRight, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CompositionEditor } from "@/components/create/CompositionEditor";

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = "NAME" | "QUOTE" | "STORY";
type CulturalStyle = "VIETNAMESE_THU_PHAP" | "JAPANESE_SHODO" | "CHINESE_CALLIGRAPHY" | "KOREAN_BRUSH";
type TextTreatment = "KEEP_ORIGINAL" | "TRANSLATE";
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const CULTURAL_STYLES: { id: CulturalStyle; label: string }[] = [
  { id: "VIETNAMESE_THU_PHAP", label: "Vietnamese" },
  { id: "JAPANESE_SHODO", label: "Japanese" },
  { id: "CHINESE_CALLIGRAPHY", label: "Chinese" },
  { id: "KOREAN_BRUSH", label: "Korean" },
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
  variationNote: string;
  seed: number;
}


const MODES: Mode[] = ["NAME", "QUOTE", "STORY"];
const STYLE_PACKS = [
  { id: "Classic", label: "Thi Bút Classic", desc: "Vietnamese poetic brush" },
  { id: "Shodō", label: "Shodō", desc: "Japanese brush calligraphy" },
  { id: "Ink", label: "Ink", desc: "Bold expressive strokes" },
  { id: "Zen", label: "Zen", desc: "Minimal & restrained" },
  { id: "Seal", label: "Seal", desc: "Red stamp chop style" },
  { id: "Modern", label: "Modern", desc: "Contemporary Asian type" },
  { id: "Luxury", label: "Luxury", desc: "Gold-accented elegance" },
  { id: "Street", label: "Street", desc: "Bold urban energy" },
  { id: "Minimal", label: "Minimal", desc: "Negative space focus" },
];
const COMPOSITIONS = [
  { id: "Vertical", label: "Vertical", desc: "Top-to-bottom scroll" },
  { id: "Centered", label: "Centered", desc: "Balanced center" },
  { id: "LeftChest", label: "Left Chest", desc: "Small logo placement" },
  { id: "FullBack", label: "Full Back", desc: "Statement back print" },
  { id: "Sleeve", label: "Sleeve", desc: "Vertical sleeve band" },
];

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: WizardStep; total: number }) {
  const labels = ["Input", "Interpret", "Style", "Preview", "Compose", "Product"];
  return (
    <div className="flex justify-center items-center gap-2 font-label-caps text-label-caps text-on-surface-variant mb-8 w-full max-w-5xl mx-auto">
      {labels.map((label, i) => {
        const step = (i + 1) as WizardStep;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <span key={label} className="flex items-center gap-2">
            <span className={`${isActive ? "text-primary font-bold border-b border-primary" : isDone ? "text-secondary" : ""}`}>
              {isDone ? <CheckCircle2 className="w-3 h-3 inline" /> : null} {label}
            </span>
            {i < total - 1 && <ChevronRight className="w-3 h-3 opacity-40" />}
          </span>
        );
      })}
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────────────────────
export default function CreatePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params); // Next.js 16: params is a Promise
  const [step, setStep] = useState<WizardStep>(1);

  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<Mode>("QUOTE");
  const [culturalStyle, setCulturalStyle] = useState<CulturalStyle>("VIETNAMESE_THU_PHAP");
  const [textTreatment, setTextTreatment] = useState<TextTreatment>("KEEP_ORIGINAL");
  
  const [detectedInputLang, setDetectedInputLang] = useState<string | null>(null);
  const [detectingLang, setDetectingLang] = useState(false);
  const [languageOverridden, setLanguageOverridden] = useState(false); // user manually picked

  // Step 2 state
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [selectedInterpretation, setSelectedInterpretation] = useState<Interpretation | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Step 3 state
  const [stylePack, setStylePack] = useState("Shodō");
  const [composition, setComposition] = useState("Centered");

  // Step 4 state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Step 5 state
  const [selectedProduct, setSelectedProduct] = useState("Premium Hoodie");
  const [compositionData, setCompositionData] = useState<any>(null);

  const searchParams = useSearchParams();

  // ── Read hero input from sessionStorage or query param on mount ─────────────
  useEffect(() => {
    // 1. Check URL query params first
    const textParam = searchParams.get("text");
    if (textParam) {
      setInputText(textParam);
      // Auto-switch to QUOTE or NAME depending on length or just leave as default QUOTE
      return; // if we found it in URL, skip sessionStorage
    }

    // 2. Fallback to sessionStorage
    const stored = sessionStorage.getItem(`session-${sessionId}`);
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      if (data.inputText) setInputText(data.inputText);
      if (data.mode)      setMode(data.mode as Mode);
      if (data.culturalStyle) setCulturalStyle(data.culturalStyle as CulturalStyle);
      sessionStorage.removeItem(`session-${sessionId}`); // consume once
    } catch { /* ignore */ }
  }, [sessionId, searchParams]);

  // ── Auto-detect language as user types (debounced 600ms) ────────────────────
  useEffect(() => {
    if (inputText.trim().length < 2) {
      setDetectedInputLang(null);
      return;
    }
    const timer = setTimeout(async () => {
      setDetectingLang(true);
      try {
        const res = await fetch("/api/personalization/detect-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: inputText.trim() }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setDetectedInputLang(data.detectedLanguage ?? null);
        // Auto-select suggested target only if user hasn't manually overridden
        if (!languageOverridden && data.suggestedTarget) {
          const matchingStyle = CULTURAL_STYLES.find(s => s.label === data.suggestedTarget);
          if (matchingStyle) setCulturalStyle(matchingStyle.id);
        }
      } catch { /* silent */ } finally {
        setDetectingLang(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [inputText, languageOverridden]);


  const handleAnalyze = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/personalization/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: text, culturalStyle, textTreatment, mode }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setInterpretations(data.interpretations ?? []);
      setSelectedInterpretation(data.interpretations?.find((i: Interpretation) => i.recommended) ?? data.interpretations?.[0] ?? null);
      setStep(2);
    } catch {
      setAnalyzeError("Could not analyze your text. Please try again.");
    } finally {
      setAnalyzeLoading(false);
    }
  }, [inputText, culturalStyle, textTreatment, mode]);

  async function handleGenerate() {
    if (!selectedInterpretation) return;
    setGenerateLoading(true);
    setGenerateError(null);
    setCandidates([]);
    try {
      const res = await fetch("/api/personalization/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          inputText: selectedInterpretation.text,
          culturalStyle,
          textTreatment,
          mode,
          stylePack,
          composition,
          selectedInterpretation,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Generation failed");
      }
      const data = await res.json();
      if (data.candidates) {
        setCandidates(data.candidates);
      }
    } catch (err: any) {
      setGenerateError(err.message || "Could not generate designs. Please try again.");
    } finally {
      setGenerateLoading(false);
    }
  }

  // ── Renders ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-background min-h-screen text-on-background font-body-md">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12">
        <StepIndicator current={step} total={6} />

        {/* ── STEP 1: Input ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto flex flex-col gap-8 w-full">
            <div>
              <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background mb-2">
                Tell Us Your Story
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Enter a name, quote, or personal story — we'll turn it into art.
              </p>
            </div>

            {/* Mode tabs */}
            <div className="flex p-1 bg-surface-container-highest">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-3 font-label-caps text-label-caps uppercase transition-all ${
                    mode === m ? "bg-background text-primary shadow-sm" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Input */}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                mode === "NAME" ? "Enter your name…"
                  : mode === "QUOTE" ? "Enter a quote or phrase…"
                  : "Share your story in a sentence or two…"
              }
              className="w-full border border-outline-variant bg-surface-container-lowest p-5 font-body-md text-body-md text-on-background placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-32 transition-colors"
            />

            {/* Cultural Style Selection */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Cultural Style</p>
                {detectingLang && (
                  <span className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <Loader2 className="w-3 h-3 animate-spin" /> detecting language…
                  </span>
                )}
                {detectedInputLang && !detectingLang && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-sm">
                    ✓ Detected: {detectedInputLang}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {CULTURAL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => { setCulturalStyle(style.id); setLanguageOverridden(true); }}
                    className={`px-5 py-2 border font-label-caps text-label-caps uppercase transition-all ${
                      culturalStyle === style.id
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text Treatment Selection */}
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-3">Text Treatment</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setTextTreatment("KEEP_ORIGINAL")}
                  className={`px-5 py-2 border font-label-caps text-label-caps uppercase transition-all ${
                    textTreatment === "KEEP_ORIGINAL"
                      ? "border-on-background bg-on-background text-background"
                      : "border-outline-variant text-on-surface-variant hover:border-on-background hover:text-on-background"
                  }`}
                >
                  KEEP ORIGINAL
                </button>
                <button
                  onClick={() => setTextTreatment("TRANSLATE")}
                  className={`px-5 py-2 border font-label-caps text-label-caps uppercase transition-all ${
                    textTreatment === "TRANSLATE"
                      ? "border-on-background bg-on-background text-background"
                      : "border-outline-variant text-on-surface-variant hover:border-on-background hover:text-on-background"
                  }`}
                >
                  TRANSLATE
                </button>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-3 leading-relaxed">
                {textTreatment === "KEEP_ORIGINAL" 
                  ? `Your text will remain unchanged and be rendered in a ${CULTURAL_STYLES.find(s => s.id === culturalStyle)?.label} calligraphy-inspired style.`
                  : `We'll help you choose a natural, literal, or poetic interpretation before creating the artwork.`}
              </p>
            </div>

            {/* Dynamic Preview Summary */}
            <div className="p-4 bg-surface-container-highest border border-outline-variant mt-2">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Your Direction</p>
              <p className="font-headline-md text-on-background mb-1">"{inputText || '...'}"</p>
              <p className="font-body-md text-on-surface-variant">
                {detectedInputLang || "English"} 
                {textTreatment === "TRANSLATE" ? " → " : " · "} 
                {CULTURAL_STYLES.find(s => s.id === culturalStyle)?.label} 
                {textTreatment === "KEEP_ORIGINAL" ? " (Original Text)" : " (Translation)"}
              </p>
            </div>

            {analyzeError && (
              <p className="text-error font-body-md text-sm">{analyzeError}</p>
            )}

            <button
              onClick={() => handleAnalyze()}
              disabled={!inputText.trim() || analyzeLoading}
              className="self-start bg-primary text-on-primary px-10 py-4 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {analyzeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {analyzeLoading ? "Interpreting…" : "CONTINUE →"}
            </button>
          </div>
        )}

        {/* ── STEP 2: Interpretation Selection ──────────────────────────────── */}
        {step === 2 && (
          <div className="max-w-5xl mx-auto flex flex-col gap-8 w-full">
            <div>
              <h1 className="font-headline-md text-headline-md text-on-background mb-2">Choose Your Interpretation</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                We found these culturally meaningful ways to express <strong>&ldquo;{inputText}&rdquo;</strong> in {CULTURAL_STYLES.find(s => s.id === culturalStyle)?.label}.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {interpretations.map((interp, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedInterpretation(interp)}
                  className={`relative p-6 border text-left flex flex-col gap-3 transition-all ${
                    selectedInterpretation?.type === interp.type
                      ? "border-primary bg-surface-container-highest"
                      : "border-outline-variant bg-surface-container-lowest hover:border-primary"
                  }`}
                >
                  {interp.recommended && (
                    <span className="absolute top-3 right-3 bg-primary text-on-primary font-label-caps text-label-caps text-[10px] uppercase px-2 py-0.5">
                      {interp.type === "SINO_VIETNAMESE" ? "Artistic Pick" : "Recommended"}
                    </span>
                  )}
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">{interp.type}</span>
                  <span className="text-4xl font-bold text-on-background leading-tight" style={{ fontFamily: "'Noto Serif JP', 'Noto Sans JP', serif" }}>
                    {interp.text}
                  </span>
                  {interp.romanization && (
                    <span className="font-body-md text-body-md text-on-surface-variant italic">{interp.romanization}</span>
                  )}
                  <span className="font-body-md text-body-md text-on-surface-variant">&ldquo;{interp.meaning}&rdquo;</span>
                  {interp.confidence < 0.8 && (
                    <span className="font-label-caps text-label-caps text-error text-[11px] uppercase">
                      ⚠ Confidence: {Math.round(interp.confidence * 100)}%
                    </span>
                  )}
                  {interp.warning && (
                    <span className="font-label-caps text-label-caps text-error text-[11px]">{interp.warning}</span>
                  )}
                  {interp.culturalContext && (
                    <span className="font-label-caps text-label-caps text-on-surface-variant text-[11px] border-t border-surface-variant pt-2 mt-1">
                      {interp.culturalContext}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 border border-outline-variant px-6 py-3 font-label-caps text-label-caps uppercase text-on-surface-variant hover:border-primary hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!selectedInterpretation}
                className="bg-primary text-on-primary px-10 py-3 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors disabled:opacity-40"
              >
                Choose Style →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Style + Composition ────────────────────────────────────── */}
        {step === 3 && (
          <div className="max-w-5xl mx-auto flex flex-col gap-10 w-full">
            <div>
              <h1 className="font-headline-md text-headline-md text-on-background mb-2">Choose Your Style</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Select a visual style and layout. Our AI will generate 6 unique designs for you to choose from.
              </p>
            </div>

            {/* Style Pack Grid */}
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-background mb-4">Style Pack</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {STYLE_PACKS.map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setStylePack(pack.id)}
                    className={`relative p-4 border flex flex-col items-start text-left transition-all ${
                      stylePack === pack.id
                        ? "border-primary bg-surface-container-highest"
                        : "border-outline-variant bg-surface-container-lowest hover:border-primary"
                    }`}
                  >
                    {stylePack === pack.id && <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                    <span className="font-body-md font-medium text-on-background text-sm">{pack.label}</span>
                    <span className="font-label-caps text-on-surface-variant text-[10px] mt-1 leading-tight">{pack.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Composition */}
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-background mb-4">Composition</h2>
              <div className="flex flex-wrap gap-3">
                {COMPOSITIONS.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => setComposition(comp.id)}
                    className={`px-5 py-2.5 border font-label-caps text-label-caps uppercase transition-all ${
                      composition === comp.id
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant text-on-surface-variant hover:border-primary"
                    }`}
                  >
                    {comp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 border border-outline-variant px-6 py-3 font-label-caps text-label-caps uppercase text-on-surface-variant hover:border-primary hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => { setStep(4); handleGenerate(); }}
                disabled={generateLoading}
                className="bg-primary text-on-primary px-10 py-3 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {generateLoading ? "Generating…" : "Generate My Designs →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Candidate Preview Gallery ─────────────────────────────── */}
        {step === 4 && (
          <div className="max-w-5xl mx-auto flex flex-col gap-8 w-full">
            <div>
              <h1 className="font-headline-md text-headline-md text-on-background mb-2">
                {generateLoading ? "Creating Your Designs…" : "Choose Your Favourite"}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {generateLoading
                  ? "Our AI is generating 6 unique brush variations for you."
                  : "Six interpretations of your selected style."}
              </p>
              {!generateLoading && candidates.length > 0 && candidates[0].stylePack === "Thi Bút Brush" && (
                <div className="mt-4 p-3 bg-[#fff8f0] border border-[#cc2222]/20 text-[#9b1c1c] text-sm">
                  <strong>Latin Compatibility Mode:</strong> Shodō is optimized for East Asian scripts. We have automatically applied <strong>Thi Bút Brush</strong> to render your Vietnamese text properly.
                </div>
              )}
              {generateError && (
                <div className="mt-4 p-3 bg-error-container text-on-error-container text-sm">
                  {generateError}
                </div>
              )}
            </div>

            {generateLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-surface-container animate-pulse flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-on-surface-variant animate-spin" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {candidates.map((c) => (
                  <div key={c.seed} className="flex flex-col items-center">
                    <button
                      onClick={() => setSelectedCandidate(c)}
                      className={`relative aspect-[3/4] overflow-hidden bg-[#faf8f5] w-full flex items-center justify-center transition-all ${
                        selectedCandidate?.seed === c.seed
                          ? "border border-black ring-1 ring-black"
                          : "border border-outline-variant hover:border-black/50"
                      }`}
                    >
                      {/* The artwork itself taking 70-80% */}
                      <div className="w-[80%] h-[80%] flex items-center justify-center">
                        <img 
                          src={c.imageUrl} 
                          alt={`Variation: ${c.variationNote}`} 
                          className="w-full h-full object-contain mix-blend-multiply pointer-events-none select-none" 
                          onContextMenu={(e) => e.preventDefault()} 
                          draggable={false} 
                        />
                      </div>
                      
                      {selectedCandidate?.seed === c.seed && (
                        <div className="absolute top-3 right-3 bg-[#cc2222] text-white rounded-sm p-0.5 shadow-sm">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                    <div className="mt-3 text-center">
                      <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">
                        REAL BRUSH ART
                      </span>
                      <p className="font-body-md text-xs font-medium text-on-background capitalize mt-0.5">
                        {c.variationNote}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!generateLoading && (
              <div className="sticky bottom-4 flex gap-4 bg-background/90 p-4 border border-outline-variant shadow-sm z-10">
                <button onClick={() => setStep(3)} className="flex items-center gap-2 px-6 py-3 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Style
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setStep(5)}
                  disabled={!selectedCandidate}
                  className="bg-primary text-on-primary px-10 py-3 font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors disabled:opacity-40"
                >
                  Make It Yours →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Composition Editor (Make It Yours) ──────────────────── */}
        {step === 5 && selectedCandidate && (
          <div className="max-w-6xl mx-auto flex flex-col gap-8 w-full">
            <div>
              <h1 className="font-headline-md text-headline-md text-on-background mb-2">
                Personalize Layout
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Upload a background, scale, rotate, and recolor your authentic calligraphy.
              </p>
            </div>

            <CompositionEditor 
              artworkUrl={selectedCandidate.imageUrl}
              onContinue={(data) => {
                console.log("Saving composition data:", data);
                setCompositionData(data);
                if (data.productMode === "product" && data.selectedProduct) {
                  // Map MVP product ID to actual name for checkout
                  const nameMap: Record<string, string> = {
                    hoodie: "Premium Hoodie",
                    poster: "Fine Art Poster",
                    tee: "Classic T-Shirt",
                  };
                  setSelectedProduct(nameMap[data.selectedProduct] || "Premium Hoodie");
                }
                setStep(6);
              }}
              onBack={() => setStep(4)}
            />
          </div>
        )}

        {/* ── STEP 6: Product selector ───────────────────────────────────────── */}
        {step === 6 && selectedCandidate && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 w-full">
            {/* Preview */}
            <div className="border border-surface-variant bg-surface-container-lowest p-8">
              <img 
                src={selectedCandidate.imageUrl} 
                alt="Your design" 
                className="w-full object-contain max-h-96 pointer-events-none select-none" 
                onContextMenu={(e) => e.preventDefault()} 
                draggable={false} 
              />
              <div className="mt-4 border-t border-surface-variant pt-4">
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Your Interpretation</p>
                {selectedInterpretation && (
                  <p className="font-headline-sm text-headline-sm text-on-background mt-1" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                    {selectedInterpretation.text}
                  </p>
                )}
                {selectedInterpretation?.romanization && (
                  <p className="font-body-md text-body-md text-on-surface-variant">{selectedInterpretation.romanization}</p>
                )}
              </div>
            </div>

            {/* Product picker */}
            <div className="flex flex-col gap-6">
              <h1 className="font-headline-md text-headline-md text-on-background">
                {compositionData?.productMode === "product" ? "Your Selected Product" : "Choose Your Product"}
              </h1>
              
              {compositionData?.productMode === "product" ? (
                <div className="flex flex-col gap-4">
                  <div className="border border-primary bg-primary/5 p-6 text-left">
                    <span className="font-body-md text-body-md font-medium text-on-background block">{selectedProduct}</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant mt-1 block">
                      ${{
                        "Premium Hoodie": 99.00,
                        "Classic T-Shirt": 45.00,
                        "Fine Art Poster": 25.00,
                      }[selectedProduct]?.toFixed(2) || "45.00"}
                    </span>
                  </div>
                  
                  {/* Mock Size Selector */}
                  {selectedProduct !== "Fine Art Poster" && (
                    <div>
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Select Size</p>
                      <div className="flex gap-2">
                        {["S", "M", "L", "XL"].map(size => (
                          <button key={size} className="w-12 h-12 border border-outline-variant hover:border-primary flex items-center justify-center font-label-caps">
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {["Digital Download (All 6)", "Premium Hoodie", "Classic T-Shirt", "Canvas Print", "Tote Bag", "Coffee Mug", "Poster"].map((product) => (
                    <button 
                      key={product} 
                      onClick={() => setSelectedProduct(product)}
                      className={`border p-4 text-left transition-colors ${
                        selectedProduct === product 
                          ? 'border-primary bg-primary/5' 
                          : 'border-outline-variant hover:border-primary'
                      }`}
                    >
                      <span className="font-body-md text-body-md font-medium text-on-background block">{product}</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant">
                        {product === "Digital Download (All 6)" ? "$9.99" : `$${{
                          "Premium Hoodie": 99.00,
                          "Classic T-Shirt": 45.00,
                          "Canvas Print": 49.00,
                          "Tote Bag": 29.00,
                          "Coffee Mug": 19.00,
                          "Poster": 25.00,
                        }[product]?.toFixed(2) || "45.00"}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Link
                href={`/checkout?candidate=${selectedCandidate.id}&product=${encodeURIComponent(selectedProduct)}`}
                className="w-full bg-primary text-on-primary py-4 font-label-caps text-label-caps uppercase text-center hover:bg-surface-tint transition-colors block mt-4"
              >
                Proceed to Checkout →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
