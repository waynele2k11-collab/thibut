import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import { FulfillmentProvider } from "../fulfillment/types";

export class MockupService {
  private provider: FulfillmentProvider;

  constructor() {
    this.provider = new PrintfulProvider();
  }

  /**
   * Retrieves an existing cached mockup or initiates a new provider task.
   */
  public async getOrGenerateMockup(params: {
    personalizationVersionId?: string;
    catalogVariantId: string;
    providerVariantId: string; // The specific external ID Printful needs
    assetUrl: string;          // The public URL of the PrintMaster/Design asset
    placement: string;         // e.g. "front"
  }) {
    // 1. Check if we already successfully generated this mockup
    const existing = await prisma.productMockup.findFirst({
      where: {
        personalizationVersionId: params.personalizationVersionId || null,
        catalogVariantId: params.catalogVariantId,
        provider: "PRINTFUL",
      }
    });

    if (existing) {
      return existing; // Cache HIT
    }

    // 2. Cache MISS - Trigger Printful Mockup Generation Task
    const mockupJob = await this.provider.generateMockups({
      variantId: params.providerVariantId,
      placement: params.placement,
      assetUrl: params.assetUrl,
    });

    // 3. Store the pending task. 
    // The webhook (Phase 7/15) will listen for 'mockup_task_finished',
    // download the image, create a Thi But Asset, and update this ProductMockup status to READY.
    return await prisma.productMockup.create({
      data: {
        personalizationVersionId: params.personalizationVersionId,
        catalogVariantId: params.catalogVariantId,
        assetId: "PENDING_ASSET_ID", // Will be replaced upon webhook completion
        provider: "PRINTFUL",
        status: "PENDING",
        // We could store the externalTaskId here if we extended the Prisma schema,
        // but for now, the webhook can match based on personalizationVersionId or catalogVariantId
      }
    });
  }
}
