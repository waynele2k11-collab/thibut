import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import { FulfillmentProvider } from "./FulfillmentProvider";
import { calculatePricing } from "../pricing/engine";

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
   * Syncs the entire Printful Store into the local database
   */
  public async syncEntireStore() {
    const providerRecord = await this.getProviderRecord();
    const storeData = await this.provider.getStoreProducts();
    const products = storeData.result || [];

    for (const p of products) {
      console.log(`[CatalogSyncService] Processing Store Product: ${p.id} - ${p.name}`);
      
      const detailsData = await this.provider.getProductDetails(p.id);
      const details = detailsData.result;
      if (!details || !details.sync_variants) continue;

      // Upsert the core product
      const catalogProduct = await prisma.catalogProduct.upsert({
        where: { slug: `product-${p.id}` },
        update: { name: p.name },
        create: {
          slug: `product-${p.id}`,
          name: p.name,
          category: "apparel", // default
          status: "ACTIVE", 
          defaultMarkupMinor: BigInt(2500),
        }
      });

      for (const v of details.sync_variants) {
        // Upsert variant
        // Attempt to find fulfillment cost; fallback to 0 to prevent NaN if missing
        const fulfillmentCostMinor = v.price ? Math.round(parseFloat(v.price) * 100) : 0;
        const retailPriceMinor = fulfillmentCostMinor > 0 ? calculatePricing(fulfillmentCostMinor).galleryPriceMinor : Math.round(parseFloat(v.retail_price || "0") * 100);

        const catalogVariant = await prisma.catalogVariant.upsert({
          where: { sku: v.sku || `TB-${v.id}` },
          update: {
            color: v.color || v.name.split(" - ")[1] || "Default",
            size: v.size || "Standard",
            baseRetailMinor: BigInt(retailPriceMinor)
          },
          create: {
            productId: catalogProduct.id,
            sku: v.sku || `TB-${v.id}`,
            color: v.color || v.name.split(" - ")[1] || "Default",
            size: v.size || "Standard",
            baseRetailMinor: BigInt(retailPriceMinor),
            active: true
          }
        });

        // Map ProviderVariant
        await prisma.providerVariant.upsert({
          where: { 
            providerId_catalogVariantId: {
              providerId: providerRecord.id,
              catalogVariantId: catalogVariant.id
            }
          },
          update: {
            costMinor: priceMinor, // We just use retail for now
            lastSyncedAt: new Date(),
          },
          create: {
            providerId: providerRecord.id,
            catalogVariantId: catalogVariant.id,
            externalProductId: p.id.toString(),
            externalVariantId: v.id.toString(),
            costMinor: BigInt(priceMinor),
            currency: v.currency || "USD",
            active: true,
            lastSyncedAt: new Date(),
          }
        });

        // Store Mockup Image
        const mockupUrl = v.files?.find((f: any) => f.type === "preview")?.preview_url || p.thumbnail_url;
        if (mockupUrl) {
          const assetSlug = `mockup-${catalogVariant.sku}`;
          const asset = await prisma.asset.upsert({
            where: { objectKey: mockupUrl },
            update: {},
            create: {
              objectKey: mockupUrl,
              mimeType: "image/jpeg",
              sha256: assetSlug,
            }
          });
          
          await prisma.productMockup.upsert({
            where: { id: `mockup-${catalogVariant.id}` },
            update: { assetId: asset.id },
            create: {
              id: `mockup-${catalogVariant.id}`,
              catalogVariantId: catalogVariant.id,
              assetId: asset.id,
              provider: "PRINTFUL"
            }
          });
        }
      }
    }
  }

  /**
   * Imports a specific base product directly from the Printful Catalog,
   * generates blank mockups using the Mockup Generator API, and maps it.
   */
  public async importCatalogProduct(catalogProductId: number, category: string, slug: string, defaultRetailPriceMinor: number) {
    const providerRecord = await this.getProviderRecord();
    
    console.log(`[CatalogSyncService] Fetching catalog details for product ${catalogProductId}`);
    const detailsData = await this.provider.getCatalogProductDetails(catalogProductId);
    const productData = detailsData.result.product;
    const variantsData = detailsData.result.variants;
    
    if (!productData || !variantsData || variantsData.length === 0) {
      throw new Error(`Product ${catalogProductId} not found or has no variants.`);
    }

    // 1. Create canonical product
    const catalogProduct = await prisma.catalogProduct.upsert({
      where: { slug: slug },
      update: { name: productData.title },
      create: {
        slug: slug,
        name: productData.title,
        category: category,
        status: "ACTIVE",
        defaultMarkupMinor: BigInt(2500),
      }
    });

    console.log(`[CatalogSyncService] Upserted product: ${catalogProduct.name}`);

    // Filter to only unisex/common variants to avoid 500 variants per product (simplified for MVP)
    const validVariants = variantsData; 
    const variantIdsToMockup: number[] = [];

    // 2. Create Variants
    for (const v of validVariants) {
      variantIdsToMockup.push(v.id);
      
      const priceMinor = Math.round(parseFloat(v.price) * 100);
      const pricing = calculatePricing(priceMinor);
      const retailMinor = priceMinor > 0 ? pricing.galleryPriceMinor : defaultRetailPriceMinor;

      const catalogVariant = await prisma.catalogVariant.upsert({
        where: { sku: `TB-CAT-${v.id}` },
        update: {
          color: v.color || v.name.split(" - ")[1] || "Default",
          size: v.size || "Standard",
        },
        create: {
          productId: catalogProduct.id,
          sku: `TB-CAT-${v.id}`,
          color: v.color || v.name.split(" - ")[1] || "Default",
          colorHex: v.colorHex || null,
          size: v.size || "Standard",
          baseRetailMinor: BigInt(retailMinor),
          active: true
        }
      });

      await prisma.providerVariant.upsert({
        where: { 
          providerId_catalogVariantId: {
            providerId: providerRecord.id,
            catalogVariantId: catalogVariant.id
          }
        },
        update: {
          costMinor: priceMinor,
          lastSyncedAt: new Date(),
        },
        create: {
          providerId: providerRecord.id,
          catalogVariantId: catalogVariant.id,
          externalProductId: catalogProductId.toString(),
          externalVariantId: v.id.toString(),
          costMinor: BigInt(priceMinor),
          currency: "USD",
          active: true,
          lastSyncedAt: new Date(),
        }
      });

      // 3. Store Mockup Asset directly from Catalog Variant image
      const mockupUrl = v.image || productData.image;
      if (mockupUrl) {
        const assetSlug = `mockup-${catalogProductId}-${v.id}`;
        const asset = await prisma.asset.upsert({
          where: { objectKey: mockupUrl },
          update: {},
          create: {
            objectKey: mockupUrl,
            mimeType: "image/jpeg",
            sha256: assetSlug,
          }
        });
        
        await prisma.productMockup.upsert({
          where: { id: `mockup-${catalogVariant.id}` },
          update: { assetId: asset.id },
          create: {
            id: `mockup-${catalogVariant.id}`,
            catalogVariantId: catalogVariant.id,
            assetId: asset.id,
            provider: "PRINTFUL"
          }
        });
      }
    }

    console.log(`[CatalogSyncService] Successfully imported ${productData.title}!`);
    return catalogProduct;
  }
}
