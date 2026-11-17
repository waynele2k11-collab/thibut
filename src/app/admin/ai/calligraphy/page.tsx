"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Cpu,
  Eye,
  Loader2,
  Palette,
  Play,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type {
  BenchmarkMetrics,
  CalligraphyCandidate,
} from "@/lib/calligraphy/types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminCalligraphyDiagnosticsPage() {
  const [runningBenchmark, setRunningBenchmark] = useState(true);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<BenchmarkMetrics[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CalligraphyCandidate | null>(null);
  const [humanReviewStatus, setHumanReviewStatus] = useState<
    Record<string, "APPROVED" | "REJECTED">
  >({});

  const providers: ReadonlyArray<{
    id: string;
    name: string;
    version: string;
    status: string;
    badgeVariant: BadgeVariant;
    licensing: string;
    supports: string;
    tech: string;
  }> = [
    {
      id: "deterministic-brush-v1",
      name: "Thi Bút Deterministic Brush Engine",
      version: "1.0.0-poc",
      status: "APPROVED",
      badgeVariant: "default",
      licensing: "Proprietary / Public Fonts Verified",
      supports:
        "Han, Japanese Kana/Kanji, Hangul, Vietnamese Latin, English Latin",
      tech: "SVG Stroke Dynamics, Bristle Filter Synthesis, Organic Noise Map",
    },
    {
      id: "structure-guided-ai-v1",
      name: "Structure-Conditioned AI Brush Engine",
      version: "0.1.0-poc",
      status: "POC / EVALUATION",
      badgeVariant: "secondary",
      licensing: "Proprietary Vision API",
      supports: "Multi-script skeleton conditioning",
      tech: "Glyph Mask Projection & Stroke Inpainting",
    },
    {
      id: "calliffusion-v2-candidate",
      name: "CalliffusionV2 Research Adapter",
      version: "0.2.0-research",
      status: "RESEARCH ONLY (GATED)",
      badgeVariant: "error",
      licensing: "Research Candidate (Commercial Rights Unverified)",
      supports: "Han, Japanese (Evaluation Track)",
      tech: "Latent Diffusion Model with Glyph Guidance",
    },
  ];

  const fetchBenchmarkResults = useCallback(async () => {
    const res = await fetch("/api/admin/calligraphy/benchmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samplesPerCase: 6 }),
    });
    const data: { results?: BenchmarkMetrics[] } = await res.json();
    return data.results;
  }, []);

  const handleRunBenchmark = async () => {
    setRunningBenchmark(true);
    try {
      const results = await fetchBenchmarkResults();
      if (results) {
        setBenchmarkMetrics(results);
        if (results[0]?.candidates?.[0]) {
          setSelectedCandidate(results[0].candidates[0]);
        }
      }
    } catch (err) {
      console.error("[AdminCalligraphy] Benchmark error:", err);
    } finally {
      setRunningBenchmark(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchBenchmarkResults()
      .then((results) => {
        if (!cancelled && results) {
          setBenchmarkMetrics(results);
          if (results[0]?.candidates?.[0]) {
            setSelectedCandidate(results[0].candidates[0]);
          }
        }
      })
      .catch((err) => {
        console.error("[AdminCalligraphy] Benchmark error:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setRunningBenchmark(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchBenchmarkResults]);

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Badge variant="seal" className="mb-3 gap-1.5">
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            Controlled Brush Rendering Track (v0.1)
          </Badge>
          <h1 className="font-headline-md text-headline-md text-primary">
            Calligraphy Renderer Diagnostics &amp; Review
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant mt-1">
            Evaluate deterministic stroke synthesizers, validate character fidelity, and review candidate outputs.
          </p>
        </div>

        <Button onClick={handleRunBenchmark} disabled={runningBenchmark}>
          {runningBenchmark ? (
            <>
              <Loader2
                className="w-4 h-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Running Benchmark Suite...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" aria-hidden="true" />
              Run 4-Language Benchmark
            </>
          )}
        </Button>
      </div>

      <Card className="p-6">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-secondary" aria-hidden="true" />
          Calligraphy Renderer Provider Matrix (TB-CALLI-007 / TB-CALLI-008)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {providers.map((p) => (
            <div
              key={p.id}
              className="p-5 bg-surface-container-low border border-surface-variant rounded-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="font-label-caps text-label-caps text-primary">
                    {p.name}
                  </span>
                  <Badge variant={p.badgeVariant}>{p.status}</Badge>
                </div>
                <p className="font-body-md text-xs text-on-surface-variant mb-3">
                  Version: {p.version}
                </p>
                <div className="space-y-1.5 font-body-md text-xs">
                  <div className="text-on-surface">
                    <strong>Licensing:</strong> {p.licensing}
                  </div>
                  <div className="text-on-surface-variant">
                    <strong>Scripts:</strong> {p.supports}
                  </div>
                  <div className="text-on-surface-variant">
                    <strong>Architecture:</strong> {p.tech}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          Automated Test Matrix Benchmark Results
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {benchmarkMetrics.map((m) => (
            <Card key={m.id} className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-label-caps text-label-caps text-secondary">
                  {m.script}
                </span>
                <Badge variant="secondary">{m.passRate}% Pass</Badge>
              </div>
              <div>
                <div className="font-headline-sm text-headline-sm text-primary">
                  {m.authoritativeText}
                </div>
                <div className="font-body-md text-xs text-on-surface-variant">
                  {m.testCaseName}
                </div>
              </div>
              <div className="pt-3 border-t border-surface-variant grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-on-surface-variant block">
                    Diacritics:
                  </span>
                  <span className="font-bold text-primary">
                    {m.diacriticFidelityScore}%
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">
                    Avg Latency:
                  </span>
                  <span className="font-bold text-on-surface">
                    {m.avgLatencyMs}ms
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <h2 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <Eye className="w-5 h-5 text-secondary" aria-hidden="true" />
            Side-by-Side Candidate Review &amp; Human Gate
          </h2>
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
            Select a sample to inspect character structure
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {benchmarkMetrics
            .flatMap((m) => m.candidates)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCandidate(c)}
                className={`p-3 rounded-lg border text-left shrink-0 w-36 transition-colors motion-reduce:transition-none ${
                  selectedCandidate?.id === c.id
                    ? "border-secondary bg-secondary/5 ring-1 ring-secondary"
                    : "border-surface-variant bg-surface-container-low hover:border-outline"
                }`}
              >
                <div className="font-headline-sm text-sm text-primary truncate">
                  {c.authoritativeText}
                </div>
                <div className="font-label-caps text-[10px] text-secondary uppercase mt-1">
                  {c.variationName}
                </div>
                <div className="font-body-md text-[10px] text-on-surface-variant">
                  {c.validationStatus}
                </div>
              </button>
            ))}
        </div>

        {selectedCandidate && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-surface-variant">
            <div className="p-5 bg-surface-container-low border border-surface-variant rounded-lg space-y-4">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                1. Authoritative Linguistic Text
              </span>
              <div className="font-headline-md text-headline-md text-primary py-4 text-center border border-surface-variant bg-surface-container-lowest rounded-lg">
                {selectedCandidate.authoritativeText}
              </div>
              <div className="space-y-2 text-xs font-mono text-on-surface">
                <div>
                  <span className="text-on-surface-variant">Variation Type:</span>{" "}
                  {selectedCandidate.variationType}
                </div>
                <div>
                  <span className="text-on-surface-variant">Provider:</span>{" "}
                  {selectedCandidate.provider}
                </div>
                <div>
                  <span className="text-on-surface-variant">Seed:</span>{" "}
                  {selectedCandidate.seed}
                </div>
                <div>
                  <span className="text-on-surface-variant">Latency:</span>{" "}
                  {selectedCandidate.generationDurationMs}ms
                </div>
              </div>
              <div className="p-3 bg-surface-container-lowest border border-surface-variant rounded text-on-surface text-xs font-mono">
                Character &amp; Diacritic Validation:{" "}
                {selectedCandidate.validationStatus}
              </div>
            </div>

            <div className="p-5 bg-surface-container-low border border-surface-variant rounded-lg space-y-4">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                2. Structure / Skeleton Guide
              </span>
              <div className="aspect-square bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden flex items-center justify-center p-4">
                {selectedCandidate.structureGuideUrl && (
                  <Image
                    src={selectedCandidate.structureGuideUrl}
                    alt="Structure Guide"
                    width={512}
                    height={512}
                    unoptimized
                    className="max-h-full max-w-full w-auto h-auto object-contain"
                  />
                )}
              </div>
              <p className="font-body-md text-xs text-on-surface-variant">
                High-contrast glyph contour enforcing mathematical stroke bounds.
              </p>
            </div>

            <div className="p-5 bg-surface-container-low border border-surface-variant rounded-lg space-y-4 flex flex-col justify-between">
              <div>
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  3. Generated Brush Output
                </span>
                <div className="aspect-square bg-tertiary-container border border-outline/30 rounded-lg overflow-hidden flex items-center justify-center p-4">
                  {selectedCandidate.previewAssetUrl && (
                    <Image
                      src={selectedCandidate.previewAssetUrl}
                      alt="Generated Art"
                      width={512}
                      height={512}
                      unoptimized
                      className="max-h-full max-w-full w-auto h-auto object-contain invert"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-surface-variant">
                <span className="font-label-caps text-label-caps uppercase text-primary block">
                  Human Quality Review Gate
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      humanReviewStatus[selectedCandidate.id] === "APPROVED"
                        ? "primary"
                        : "outline"
                    }
                    onClick={() =>
                      setHumanReviewStatus((prev) => ({
                        ...prev,
                        [selectedCandidate.id]: "APPROVED",
                      }))
                    }
                    className="flex-1"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      humanReviewStatus[selectedCandidate.id] === "REJECTED"
                        ? "destructive"
                        : "outline"
                    }
                    onClick={() =>
                      setHumanReviewStatus((prev) => ({
                        ...prev,
                        [selectedCandidate.id]: "REJECTED",
                      }))
                    }
                    className="flex-1"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
                    Reject
                  </Button>
                </div>
                {humanReviewStatus[selectedCandidate.id] && (
                  <p className="font-label-caps text-label-caps text-on-surface-variant text-center">
                    Recorded: {humanReviewStatus[selectedCandidate.id]}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
