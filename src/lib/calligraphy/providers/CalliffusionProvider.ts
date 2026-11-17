import type {
  CalligraphyRenderResult,
  CalligraphyRendererProvider,
  CommercialLicensingStatus,
  RendererCapabilities,
} from "../types";

/**
 * CalliffusionV2 Research Candidate Provider
 *
 * Status: RESEARCH_ONLY (Not approved for commercial production)
 * Enforces TB-CALLI-008.
 */
export class CalliffusionProvider implements CalligraphyRendererProvider {
  public readonly id = "calliffusion-v2-candidate";
  public readonly name = "CalliffusionV2 Research Adapter";
  public readonly version = "0.2.0-research";
  public readonly commercialLicensingStatus: CommercialLicensingStatus =
    "RESEARCH_ONLY";

  public async getCapabilities(): Promise<RendererCapabilities> {
    return {
      supportedScripts: ["HAN", "JAPANESE_MIXED"],
      supportsVectorSvg: false,
      supportsTransparentPng: true,
      supportsRealTimeStrokeSynthesis: false,
      maxBatchSize: 4,
      requiresGpu: true,
      commercialLicensingStatus: this.commercialLicensingStatus,
    };
  }

  public async validateAvailability(): Promise<boolean> {
    return false;
  }

  public async generate(): Promise<CalligraphyRenderResult> {
    throw new Error(
      "CalliffusionV2 is restricted to Research Evaluation (TB-CALLI-008). Commercial execution is gated until license verification completes."
    );
  }
}
