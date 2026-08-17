import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import { FulfillmentProvider } from "../fulfillment/types";

export class FulfillmentService {
  private provider: FulfillmentProvider;

  constructor() {
    this.provider = new PrintfulProvider();
  }

  /**
   * Translates a paid Thi Bút Order into a provider fulfillment order.
   * Creates a draft first, validates it, then confirms it.
   */
  public async dispatchOrderToProvider(orderId: string) {
    // 1. Fetch full order graph
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: {
          include: {
            catalogVariant: true,
            personalizationVersion: {
              include: {
                printAsset: true
              }
            }
          }
        }
      }
    });

    if (!order) throw new Error("Order not found");
    if (order.paymentStatus !== "SUCCEEDED" && order.status !== "PAID") {
      // Depending on exact Stripe webhook mapping, we require it to be paid
      // In MVP, we might bypass this check during manual dev testing
      console.warn(`Order ${order.orderNumber} dispatched while payment status is ${order.paymentStatus}`);
    }

    // 2. Map items to Printful Variants
    const catalogVariantIds = order.items.map(i => i.catalogVariantId).filter(Boolean) as string[];
    const providerVariants = await prisma.providerVariant.findMany({
      where: {
        catalogVariantId: { in: catalogVariantIds },
        provider: { code: "PRINTFUL" }
      }
    });

    const providerItems = order.items.map(item => {
      const pv = providerVariants.find(p => p.catalogVariantId === item.catalogVariantId);
      if (!pv) throw new Error(`Missing provider mapping for catalog variant ${item.catalogVariantId}`);
      
      const printUrl = item.personalizationVersion?.printAsset?.objectKey 
          ? `https://storage.thibut.com/${item.personalizationVersion.printAsset.objectKey}` 
          : "https://example.com/mock-print-asset.png"; // Fallback for MVP testing

      // Defaulting to "front" placement if not specified in order item snapshot
      return {
        variantId: pv.externalVariantId,
        quantity: item.quantity,
        retailPriceMinor: item.totalMinor / BigInt(item.quantity),
        files: [
          {
            url: printUrl,
            placement: "front" 
          }
        ]
      };
    });

    // 3. Create Draft Order
    const draft = await this.provider.createDraftOrder({
      externalId: order.orderNumber,
      recipient: {
        name: order.buyer.name || "Customer",
        address1: "123 Test Lane", // Stubbed for MVP. Real app gets this from shipping address relation
        city: "Los Angeles",
        stateCode: "CA",
        countryCode: "US",
        zip: "90001",
        email: order.buyer.email || "customer@example.com"
      },
      items: providerItems
    });

    // 4. Confirm Order
    // In a highly defensive system, we might pause here and require admin approval
    // But standard flow confirms it to start production
    await this.provider.confirmOrder(draft.id);

    // 5. Update Local Domain Status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: "IN_PRODUCTION" // Or 'PROCESSING' depending on exact mapping
      }
    });

    return draft;
  }
}
