import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import { FulfillmentProvider } from "../fulfillment/types";

export class CatalogSyncService {
  private provider: FulfillmentProvider;

  constructor() {
    this.provider = new PrintfulProvider();
  }

  /**
   * Discovers and registers the internal provider record for Printful if missing.
   */
  private async getProviderRecord() {
    return await prisma.fulfillmentProviderRecord.upsert({
      where: { code: "PRINTFUL" },
      update: {},
      create: {
        code: "PRINTFUL",
        name: "Printful",
        priority: 1,
        active: true,
      }
    });
  }

  /**
   * Core syncing mechanism to ingest a Printful product and its variants.
   * This is intended to be called intentionally by the Admin, not indiscriminately
   * for the entire Printful catalog.
   */
  public async importProduct(externalProductId: string, customCategory: string) {
    const providerRecord = await this.getProviderRecord();

    // The current PrintfulProvider implementation fetches ALL products.
    // In a real scenario, you might just fetch the specific variants directly.
    const variants = await this.provider.getVariants(externalProductId);
    
    if (variants.length === 0) {
      throw new Error(`No variants found for Product ${externalProductId}`);
    }

    // Use the first variant's details as the base for the CatalogProduct
    const baseVariant = variants[0];

    // Create the canonical Thi Bút Catalog Product
    const catalogProduct = await prisma.catalogProduct.upsert({
      where: { slug: `product-${externalProductId}` },
      update: {},
      create: {
        slug: `product-${externalProductId}`,
        name: baseVariant.name.split(" - ")[0] || "Imported Product",
        category: customCategory,
        status: "DRAFT", // Admin must explicitly activate it and set markups
        defaultMarkupMinor: 2500, // Default $25 markup
      }
    });

    // Map each external variant to a Thi Bút CatalogVariant and link them via ProviderVariant
    for (const v of variants) {
      // 1. Create CatalogVariant (The abstract Thi But representation)
      const catalogVariant = await prisma.catalogVariant.upsert({
        where: { sku: `TB-${v.sku}` },
        update: {
          baseRetailMinor: v.priceMinor + catalogProduct.defaultMarkupMinor
        },
        create: {
          productId: catalogProduct.id,
          sku: `TB-${v.sku}`,
          color: v.color,
          size: v.size,
          active: false, // Don't expose all 30 colors automatically
          baseRetailMinor: v.priceMinor + catalogProduct.defaultMarkupMinor,
        }
      });

      // 2. Create the exact mapping to Printful (ProviderVariant)
      await prisma.providerVariant.upsert({
        where: { 
          providerId_catalogVariantId: {
            providerId: providerRecord.id,
            catalogVariantId: catalogVariant.id
          }
        },
        update: {
          costMinor: v.priceMinor,
          lastSyncedAt: new Date(),
          active: v.inStock
        },
        create: {
          providerId: providerRecord.id,
          catalogVariantId: catalogVariant.id,
          externalProductId: externalProductId,
          externalVariantId: v.id,
          costMinor: v.priceMinor,
          currency: v.currency,
          active: v.inStock,
          lastSyncedAt: new Date(),
        }
      });
    }

    return catalogProduct;
  }
}
