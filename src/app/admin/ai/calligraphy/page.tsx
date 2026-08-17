"use client";

import { useState, useEffect } from "react";
import { 
  Palette, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Loader2, 
  Layers, 
  Cpu, 
  Lock, 
  Eye, 
  ThumbsUp, 
  ThumbsDown,
  RefreshCw
} from "lucide-react";
import { BenchmarkMetrics, CalligraphyCandidate } from "@/lib/calligraphy/types";

export default function AdminCalligraphyDiagnosticsPage() {
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<BenchmarkMetrics[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CalligraphyCandidate | null>(null);
  const [humanReviewStatus, setHumanReviewStatus] = useState<Record<string, "APPROVED" | "REJECTED">>({});
  const [humanNotes, setHumanNotes] = useState<Record<string, string>>({});

  const providers = [
    {
      id: "deterministic-brush-v1",
      name: "Thi Bút Deterministic Brush Engine",
      version: "1.0.0-poc",
      status: "APPROVED",
      statusColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      licensing: "Proprietary / Public Fonts Verified",
      supports: "Han, Japanese Kana/Kanji, Hangul, Vietnamese Latin, English Latin",
      tech: "SVG Stroke Dynamics, Bristle Filter Synthesis, Organic Noise Map",
    },
    {
      id: "structure-guided-ai-v1",
      name: "Structure-Conditioned AI Brush Engine",
      version: "0.1.0-poc",
      status: "POC / EVALUATION",
      statusColor: "text-amber-600 bg-amber-50 border-amber-200",
      licensing: "Proprietary Vision API",
      supports: "Multi-script skeleton conditioning",
      tech: "Glyph Mask Projection & Stroke Inpainting",
    },
    {
      id: "calliffusion-v2-candidate",
      name: "CalliffusionV2 Research Adapter",
      version: "0.2.0-research",
      status: "RESEARCH ONLY (GATED)",
      statusColor: "text-rose-600 bg-rose-50 border-rose-200",
      licensing: "Research Candidate (Commercial Rights Unverified)",
      supports: "Han, Japanese (Evaluation Track)",
      tech: "Latent Diffusion Model with Glyph Guidance",
    },
  ];

  const handleRunBenchmark = async () => {
    setRunningBenchmark(true);
    try {
      const res = await fetch("/api/admin/calligraphy/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samplesPerCase: 6 }),
      });
      const data = await res.json();
      if (data.results) {
        setBenchmarkMetrics(data.results);
        if (data.results[0]?.candidates?.[0]) {
          setSelectedCandidate(data.results[0].candidates[0]);
        }
      }
    } catch (err) {
      console.error("Benchmark error:", err);
    } finally {
      setRunningBenchmark(false);
    }
  };

  useEffect(() => {
    handleRunBenchmark();
  }, []);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#111111] text-[#F6F1E7] text-xs font-mono uppercase tracking-widest rounded-full mb-3">
            <Palette className="w-3.5 h-3.5 text-[#B3261E]" />
            Controlled Brush Rendering Track (v0.1)
          </div>
          <h1 className="font-display-md text-3xl font-bold text-[#111111]">
            Calligraphy Renderer Diagnostics & Review
          </h1>
          <p className="text-sm text-[#77756F]">
            Evaluate deterministic stroke synthesizers, validate character fidelity, and review candidate outputs.
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={runningBenchmark}
          className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-6 py-3 rounded-lg text-xs font-mono uppercase tracking-widest hover:bg-[#8e1f18] transition-colors disabled:opacity-50 shadow-sm"
        >
          {runningBenchmark ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Benchmark Suite...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run 4-Language Benchmark
            </>
          )}
        </button>
      </div>

      {/* 1. Provider Registry & Licensing Gate */}
      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6 shadow-sm">
        <h2 className="font-serif text-lg font-bold text-[#111111] mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-[#B3261E]" />
          Calligraphy Renderer Provider Matrix (TB-CALLI-007 / TB-CALLI-008)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {providers.map((p) => (
            <div key={p.id} className="p-5 bg-white border border-[#E5E0D8] rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-[#111111]">{p.name}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${p.statusColor}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-[#77756F] mb-3">Version: {p.version}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="text-[#111111]"><strong>Licensing:</strong> {p.licensing}</div>
                  <div className="text-[#77756F]"><strong>Scripts:</strong> {p.supports}</div>
                  <div className="text-[#77756F]"><strong>Architecture:</strong> {p.tech}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Live Benchmark Suite Metrics */}
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-bold text-[#111111] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#0A9E48]" />
          Automated Test Matrix Benchmark Results
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {benchmarkMetrics.map((m) => (
            <div key={m.id} className="p-5 bg-white border border-[#E5E0D8] rounded-xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs text-[#B3261E] font-bold">{m.script}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                  {m.passRate}% Pass
                </span>
              </div>
              <div>
                <div className="text-2xl font-serif font-bold text-[#111111]">{m.authoritativeText}</div>
                <div className="text-xs text-[#77756F]">{m.testCaseName}</div>
              </div>
              <div className="pt-3 border-t border-[#E5E0D8] grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[#77756F] block">Diacritics:</span>
                  <span className="font-bold text-emerald-600">{m.diacriticFidelityScore}%</span>
                </div>
                <div>
                  <span className="text-[#77756F] block">Avg Latency:</span>
                  <span className="font-bold text-[#111111]">{m.avgLatencyMs}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Side-by-Side Candidate Review Inspector */}
      <div className="bg-white border border-[#E5E0D8] rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <h2 className="font-serif text-lg font-bold text-[#111111] flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#B3261E]" />
            Side-by-Side Candidate Review & Human Gate
          </h2>
          <span className="text-xs font-mono text-[#77756F]">Select a sample to inspect character structure</span>
        </div>

        {/* Thumbnail Selector */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {benchmarkMetrics.flatMap((m) => m.candidates).map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCandidate(c)}
              className={`p-3 rounded-lg border text-left flex-shrink-0 w-36 transition-all ${
                selectedCandidate?.id === c.id
                  ? "border-[#B3261E] bg-[#B3261E]/5 ring-1 ring-[#B3261E]"
                  : "border-[#E5E0D8] bg-[#FCFAF6] hover:border-[#77756F]"
              }`}
            >
              <div className="text-sm font-serif font-bold text-[#111111] truncate">{c.authoritativeText}</div>
              <div className="text-[10px] font-mono text-[#B3261E] uppercase mt-1">{c.variationName}</div>
              <div className="text-[9px] text-[#77756F]">{c.validationStatus}</div>
            </button>
          ))}
        </div>

        {selectedCandidate && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-[#E5E0D8]">
            {/* Panel 1: Authoritative Text & Metadata */}
            <div className="p-5 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl space-y-4">
              <span className="font-mono text-xs text-[#77756F] uppercase tracking-wider block">
                1. Authoritative Linguistic Text
              </span>
              <div className="text-4xl font-serif font-bold text-[#111111] py-4 text-center border border-[#E5E0D8] bg-white rounded-lg">
                {selectedCandidate.authoritativeText}
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div><span className="text-[#77756F]">Variation Type:</span> {selectedCandidate.variationType}</div>
                <div><span className="text-[#77756F]">Provider:</span> {selectedCandidate.provider}</div>
                <div><span className="text-[#77756F]">Seed:</span> {selectedCandidate.seed}</div>
                <div><span className="text-[#77756F]">Latency:</span> {selectedCandidate.generationDurationMs}ms</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs font-mono">
                ✓ Character & Diacritic Validation: {selectedCandidate.validationStatus}
              </div>
            </div>

            {/* Panel 2: Structure Guide / Skeleton */}
            <div className="p-5 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl space-y-4">
              <span className="font-mono text-xs text-[#77756F] uppercase tracking-wider block">
                2. Structure / Skeleton Guide
              </span>
              <div className="aspect-square bg-white border border-[#E5E0D8] rounded-lg overflow-hidden flex items-center justify-center p-4">
                {selectedCandidate.structureGuideUrl && (
                  <img
                    src={selectedCandidate.structureGuideUrl}
                    alt="Structure Guide"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
              <p className="text-xs text-[#77756F]">
                High-contrast glyph contour enforcing mathematical stroke bounds.
              </p>
            </div>

            {/* Panel 3: Generated Calligraphy Art & Human Review */}
            <div className="p-5 bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs text-[#77756F] uppercase tracking-wider block mb-2">
                  3. Generated Brush Output
                </span>
                <div className="aspect-square bg-[#0B0B0B] border border-[#222222] rounded-lg overflow-hidden flex items-center justify-center p-4">
                  {selectedCandidate.previewAssetUrl && (
                    <img
                      src={selectedCandidate.previewAssetUrl}
                      alt="Generated Art"
                      className="max-h-full max-w-full object-contain filter invert"
                    />
                  )}
                </div>
              </div>

              {/* Human Review Gate */}
              <div className="space-y-3 pt-3 border-t border-[#E5E0D8]">
                <span className="text-xs font-mono uppercase tracking-wider text-[#111111] font-bold block">
                  Human Quality Review Gate
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHumanReviewStatus(prev => ({ ...prev, [selectedCandidate.id]: "APPROVED" }))}
                    className={`flex-1 py-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-colors ${
                      humanReviewStatus[selectedCandidate.id] === "APPROVED"
                        ? "bg-emerald-600 text-white"
                        : "bg-white border border-[#E5E0D8] text-[#111111] hover:bg-emerald-50"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => setHumanReviewStatus(prev => ({ ...prev, [selectedCandidate.id]: "REJECTED" }))}
                    className={`flex-1 py-2 text-xs font-mono rounded flex items-center justify-center gap-1.5 transition-colors ${
                      humanReviewStatus[selectedCandidate.id] === "REJECTED"
                        ? "bg-rose-600 text-white"
                        : "bg-white border border-[#E5E0D8] text-[#111111] hover:bg-rose-50"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
                {humanReviewStatus[selectedCandidate.id] && (
                  <p className="text-[11px] font-mono text-[#77756F] text-center">
                    Recorded: {humanReviewStatus[selectedCandidate.id]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
