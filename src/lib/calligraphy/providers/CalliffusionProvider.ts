import {
  CalligraphyRendererProvider,
  CalligraphyRenderRequest,
  CalligraphyRenderResult,
  RendererCapabilities,
} from "../types";

/**
 * CalliffusionV2 Research Candidate Provider
 * 
 * Status: RESEARCH CANDIDATE (Not approved for commercial production)
 * Licensing: Code/Weights commercial verification pending.
 * Enforces TB-CALLI-008.
 */
export class CalliffusionProvider implements CalligraphyRendererProvider {
  public id = "calliffusion-v2-candidate";
  public name = "CalliffusionV2 Research Adapter";
  public version = "0.2.0-research";

  public async getCapabilities(): Promise<RendererCapabilities> {
    return {
      supportedScripts: ["HAN", "JAPANESE_MIXED"],
      supportsVectorSvg: false,
      supportsTransparentPng: true,
      supportsRealTimeStrokeSynthesis: false,
      maxBatchSize: 4,
      requiresGpu: true,
      commercialLicensingStatus: "RESEARCH_ONLY",
    };
  }

  public async validateAvailability(): Promise<boolean> {
    // Calliffusion is restricted to research/POC track and requires local GPU cluster or verified API
    return false;
  }

  public async generate(request: CalligraphyRenderRequest): Promise<CalligraphyRenderResult> {
    throw new Error(
      "CalliffusionV2 is currently under Research Evaluation (TB-CALLI-008). Production execution is gated until commercial license audit completes."
    );
  }
}
