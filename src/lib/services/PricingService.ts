import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import { FulfillmentProvider } from "../fulfillment/types";

export class PricingService {
  private provider: FulfillmentProvider;

  constructor() {
    this.provider = new PrintfulProvider();
  }

  /**
   * Builds an authoritative, frozen price quote for checkout.
   */
  public async generatePriceQuote(params: {
    cartId: string;
    items: Array<{
      catalogVariantId: string;
      quantity: number;
    }>;
    shippingAddress: {
      address1: string;
      city: string;
      countryCode: string;
      stateCode?: string;
      zip: string;
    };
  }) {
    // 1. Fetch live shipping rates from Printful
    // We need to resolve CatalogVariant -> ProviderVariant to get external IDs
    const providerVariants = await prisma.providerVariant.findMany({
      where: {
        catalogVariantId: { in: params.items.map(i => i.catalogVariantId) },
        provider: { code: "PRINTFUL" }
      }
    });

    if (providerVariants.length !== params.items.length) {
      throw new Error("Some items in the cart are not mapped to Printful variants.");
    }

    const shippingRates = await this.provider.getShippingRates({
      variantIds: providerVariants.map(pv => pv.externalVariantId),
      quantities: params.items.map(i => i.quantity),
      recipient: params.shippingAddress
    });

    if (shippingRates.length === 0) {
      throw new Error("No shipping rates available for this destination.");
    }

    // Select the cheapest standard rate for this automated quote
    const standardRate = shippingRates.sort((a, b) => Number(a.rateMinor) - Number(b.rateMinor))[0];

    // 2. Calculate Subtotal (Thi But Retail Price)
    const catalogVariants = await prisma.catalogVariant.findMany({
      where: { id: { in: params.items.map(i => i.catalogVariantId) } }
    });

    let productSubtotalMinor = BigInt(0);
    params.items.forEach(item => {
      const v = catalogVariants.find(cv => cv.id === item.catalogVariantId);
      if (v) {
        productSubtotalMinor += v.baseRetailMinor * BigInt(item.quantity);
      }
    });

    // We assume Artwork/Personalization fees are included in baseRetailMinor for the MVP,
    // but the DB schema supports separating them.
    const artworkMinor = BigInt(0);
    const personalizationMinor = BigInt(0);
    
    // Simplistic Tax 0% for MVP
    const taxMinor = BigInt(0);
    
    const totalMinor = productSubtotalMinor + standardRate.rateMinor + taxMinor;

    // 3. Freeze the quote in the DB
    // Expiration: 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    return await prisma.priceQuote.create({
      data: {
        cartId: params.cartId,
        currency: "USD",
        subtotalMinor: productSubtotalMinor,
        artworkMinor,
        personalizationMinor,
        productMinor: productSubtotalMinor,
        shippingMinor: standardRate.rateMinor,
        taxMinor,
        discountMinor: 0,
        totalMinor,
        expiresAt,
      }
    });
  }
}
