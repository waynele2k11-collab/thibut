/**
 * THI BÚT CONTROLLED CALLIGRAPHY RENDERER TYPES
 * Version 0.1 — Controlled Brush Rendering Research Track
 * 
 * Enforces TB-CALLI-001 through TB-CALLI-010.
 */

export type ScriptType =
  | "HAN"               // Chinese / Hán-Nôm (e.g. 大衛, 阮, 陳)
  | "JAPANESE_MIXED"    // Kanji + Hiragana / Katakana (e.g. 諦めない, 七転八起, マイケル)
  | "KOREAN_HANGUL"     // Korean Hangul (e.g. 세라)
  | "VIETNAMESE_LATIN"  // Vietnamese Latin with tone marks and compound diacritics (e.g. Có chí thì nên, Sức Mạnh)
  | "ENGLISH_LATIN"     // Latin alphabet (e.g. Never Give Up, David)
  | "UNKNOWN";

export type ScriptCompatibility = "NATIVE" | "ADAPTED" | "UNSUPPORTED";

export interface StylePackCapability {
  script: ScriptType;
  compatibility: ScriptCompatibility;
  rendererStrategy: string;
}

export type RendererType =
  | "DETERMINISTIC_BRUSH"
  | "STRUCTURE_GUIDED_AI"
  | "VECTOR_BRUSH"
  | "RESEARCH_CANDIDATE";

export interface StylePack {
  id: string;
  name: string;
  rendererType: RendererType;
  supportedScripts: StylePackCapability[];
  rendererConfig?: Record<string, unknown>;
  active: boolean;
  version: string;
}

export type BrushVariationType =
  | "01_CONTROLLED"   // Balanced strokes and restrained sumi ink
  | "02_BOLD"         // Heavy pressure and strong ink mass
  | "03_DRY_BRUSH"    // Visible texture and broken dry edges
  | "04_EXPRESSIVE"   // High energy and fluid gestural movement
  | "05_MINIMAL"      // Light pressure and generous negative space
  | "06_SIGNATURE";   // Balanced composition with authentic seal treatment

export interface VariationStrategyConfig {
  type: BrushVariationType;
  name: string;
  description: string;
  pressureMultiplier: number;
  dryBrushIntensity: number;
  energyFactor: number;
  inkBleed: number;
  includeSeal: boolean;
}

export type ValidationStatus = "PENDING" | "PASS" | "FAIL" | "REVIEW";
export type HumanReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "UNSURE";

export interface CalligraphyRenderRequest {
  phraseKnowledgeId: string;
  authoritativeText: string;
  script: ScriptType;
  language: string;
  stylePackId: string;
  variationCount: number;
  orientationPreference?: "AUTO" | "VERTICAL" | "HORIZONTAL";
  rendererVersion: string;
  seed?: number;
}

export interface CalligraphyCandidate {
  id: string;
  variationType: BrushVariationType;
  variationName: string;
  variationNote: string;
  authoritativeText: string;
  previewAssetUrl: string;
  productionSvg?: string;
  productionAssetUrl?: string;
  structureGuideUrl?: string;
  provider: string;
  model?: string;
  modelVersion?: string;
  stylePackId: string;
  seed: number;
  validationStatus: ValidationStatus;
  validationReasons: string[];
  humanReviewStatus?: HumanReviewStatus;
  humanReviewNotes?: string;
  generationDurationMs: number;
  createdAt: Date;
}

export interface CalligraphyRenderResult {
  phraseKnowledgeId: string;
  stylePackId: string;
  rendererVersion: string;
  candidates: CalligraphyCandidate[];
  durationMs: number;
  cacheHit: boolean;
}

export interface RendererCapabilities {
  supportedScripts: ScriptType[];
  supportsVectorSvg: boolean;
  supportsTransparentPng: boolean;
  supportsRealTimeStrokeSynthesis: boolean;
  maxBatchSize: number;
  requiresGpu: boolean;
  commercialLicensingStatus: "APPROVED" | "RESEARCH_ONLY" | "PROPRIETARY" | "UNVERIFIED";
}

export interface CalligraphyRendererProvider {
  id: string;
  name: string;
  version: string;
  getCapabilities(): Promise<RendererCapabilities>;
  generate(request: CalligraphyRenderRequest): Promise<CalligraphyRenderResult>;
  validateAvailability(): Promise<boolean>;
}

export interface BenchmarkMetrics {
  id: string;
  testCaseName: string;
  authoritativeText: string;
  script: ScriptType;
  stylePackId: string;
  provider: string;
  totalSamples: number;
  passCount: number;
  failCount: number;
  reviewCount: number;
  passRate: number;
  textFidelityScore: number;
  diacriticFidelityScore: number;
  visualQualityScore: number;
  styleFidelityScore: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  executedAt: Date;
  candidates: CalligraphyCandidate[];
}
