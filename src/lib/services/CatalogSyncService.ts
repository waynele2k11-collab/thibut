import "server-only";
import prisma from "@/lib/prisma";
import { PrintfulProvider } from "../fulfillment/PrintfulProvider";
import type { FulfillmentProvider } from "../fulfillment/types";
import {
  PricingValidationError,
  parseUsdDecimalToMinor,
  roundUpTo99Minor,
} from "../pricing/quote";

export class CatalogSyncService {
  private provider: FulfillmentProvider;

  constructor(provider?: FulfillmentProvider) {
    this.provider = provider ?? new PrintfulProvider();
  }

  /**
   * Discovers and registers the internal provider record for Printful if missing.
   */
  private async getProviderRecord() {
    return prisma.fulfillmentProviderRecord.upsert({
      where: { code: "PRINTFUL" },
      update: {},
      create: {
        code: "PRINTFUL",
        name: "Printful",
        priority: 1,
        active: true,
      },
    });
  }

  /**
   * Syncs the entire Printful Store into the local database using atomic per-product transactions and BigInt math.
   */
  public async syncEntireStore(): Promise<void> {
    const providerRecord = await this.getProviderRecord();
    const storeData = await this.provider.getStoreProducts();
    const products = storeData.result ?? [];

    for (const p of products) {
      const detailsData = await this.provider.getProductDetails(p.id);
      const details = detailsData.result;
      if (!details?.sync_variants || details.sync_variants.length === 0) {
        continue;
      }

      const syncVariants = details.sync_variants;

      await prisma.$transaction(async (tx) => {
        const catalogProduct = await tx.catalogProduct.upsert({
          where: { slug: `product-${String(p.id)}` },
          update: { name: p.name },
          create: {
            slug: `product-${String(p.id)}`,
            name: p.name,
            category: "apparel",
            status: "ACTIVE",
            defaultMarkupMinor: 0n,
          },
        });

        for (const v of syncVariants) {
          const fulfillmentCostMinor =
            v.price !== null && v.price !== undefined && String(v.price).trim() !== ""
              ? parseUsdDecimalToMinor(v.price)
              : 0n;

          const fallbackRetailMinor =
            v.retail_price !== null &&
            v.retail_price !== undefined &&
            String(v.retail_price).trim() !== ""
              ? parseUsdDecimalToMinor(v.retail_price)
              : 0n;

          const retailPriceMinor =
            fulfillmentCostMinor > 0n
              ? roundUpTo99Minor(fulfillmentCostMinor * 2n)
              : fallbackRetailMinor;

          if (retailPriceMinor <= 0n || fulfillmentCostMinor < 0n) {
            continue;
          }

          const colorLabel =
            v.color || v.name.split(" - ")[1]?.trim() || "Default";
          const sizeLabel = v.size || "Standard";
          const sku = v.sku || `TB-${String(v.id)}`;

          const catalogVariant = await tx.catalogVariant.upsert({
            where: { sku },
            update: {
              color: colorLabel,
              size: sizeLabel,
              baseRetailMinor: retailPriceMinor,
            },
            create: {
              productId: catalogProduct.id,
              sku,
              color: colorLabel,
              size: sizeLabel,
              baseRetailMinor: retailPriceMinor,
              active: true,
            },
          });

          const providerCostMinor =
            fulfillmentCostMinor > 0n ? fulfillmentCostMinor : retailPriceMinor;

          await tx.providerVariant.upsert({
            where: {
              providerId_catalogVariantId: {
                providerId: providerRecord.id,
                catalogVariantId: catalogVariant.id,
              },
            },
            update: {
              costMinor: providerCostMinor,
              currency: (v.currency || "USD").toUpperCase(),
              lastSyncedAt: new Date(),
            },
            create: {
              providerId: providerRecord.id,
              catalogVariantId: catalogVariant.id,
              externalProductId: String(p.id),
              externalVariantId: String(v.id),
              costMinor: providerCostMinor,
              currency: (v.currency || "USD").toUpperCase(),
              active: true,
              lastSyncedAt: new Date(),
            },
          });

          const previewFile = v.files?.find((f) => f.type === "preview");
          const mockupUrl = previewFile?.preview_url || p.thumbnail_url || null;
          if (mockupUrl) {
            const assetSlug = `mockup-${catalogVariant.sku}`;
            const asset = await tx.asset.upsert({
              where: { objectKey: mockupUrl },
              update: {},
              create: {
                objectKey: mockupUrl,
                mimeType: "image/jpeg",
                sha256: assetSlug,
              },
            });

            await tx.productMockup.upsert({
              where: { id: `mockup-${catalogVariant.id}` },
              update: { assetId: asset.id },
              create: {
                id: `mockup-${catalogVariant.id}`,
                catalogVariantId: catalogVariant.id,
                assetId: asset.id,
                provider: "PRINTFUL",
              },
            });
          }
        }
      });
    }
  }

  /**
   * Imports a specific base product from Printful Catalog using pure BigInt pricing
   * and an atomic Prisma transaction (refreshes baseRetailMinor on re-import).
   */
  public async importCatalogProduct(
    catalogProductId: number,
    category: string,
    slug: string
  ) {
    const providerRecord = await this.getProviderRecord();

    const detailsData = await this.provider.getCatalogProductDetails(catalogProductId);
    const productData = detailsData.result?.product;
    const variantsData = detailsData.result?.variants;

    if (!productData || !variantsData || variantsData.length === 0) {
      throw new Error(`Product ${catalogProductId} not found or has no variants.`);
    }

    const pricedVariants = variantsData.flatMap((v) => {
      const costMinor = parseUsdDecimalToMinor(v.price);
      if (costMinor <= 0n) {
        return [];
      }
      return [
        {
          raw: v,
          costMinor,
          retailMinor: roundUpTo99Minor(costMinor * 2n),
        },
      ];
    });

    if (pricedVariants.length === 0) {
      throw new PricingValidationError(
        "INVALID_COST",
        `Product ${catalogProductId} has no variants with valid positive cost.`
      );
    }

    return prisma.$transaction(async (tx) => {
      const catalogProduct = await tx.catalogProduct.upsert({
        where: { slug },
        update: {
          name: productData.title,
          category,
        },
        create: {
          slug,
          name: productData.title,
          category,
          status: "ACTIVE",
          defaultMarkupMinor: 0n,
        },
      });

      for (const { raw: v, costMinor, retailMinor } of pricedVariants) {
        const colorLabel =
          v.color || v.name.split(" - ")[1]?.trim() || "Default";
        const colorHex = v.color_code || v.colorHex || null;
        const sizeLabel = v.size || "Standard";
        const sku = `TB-CAT-${v.id}`;

        const catalogVariant = await tx.catalogVariant.upsert({
          where: { sku },
          update: {
            color: colorLabel,
            colorHex,
            size: sizeLabel,
            baseRetailMinor: retailMinor,
            active: v.in_stock !== false,
          },
          create: {
            productId: catalogProduct.id,
            sku,
            color: colorLabel,
            colorHex,
            size: sizeLabel,
            baseRetailMinor: retailMinor,
            active: v.in_stock !== false,
          },
        });

        await tx.providerVariant.upsert({
          where: {
            providerId_catalogVariantId: {
              providerId: providerRecord.id,
              catalogVariantId: catalogVariant.id,
            },
          },
          update: {
            costMinor,
            currency: "USD",
            active: v.in_stock !== false,
            lastSyncedAt: new Date(),
          },
          create: {
            providerId: providerRecord.id,
            catalogVariantId: catalogVariant.id,
            externalProductId: String(catalogProductId),
            externalVariantId: String(v.id),
            costMinor,
            currency: "USD",
            active: v.in_stock !== false,
            lastSyncedAt: new Date(),
          },
        });

        const mockupUrl = v.image || productData.image || null;
        if (mockupUrl) {
          const assetSlug = `mockup-${catalogProductId}-${v.id}`;
          const asset = await tx.asset.upsert({
            where: { objectKey: mockupUrl },
            update: {},
            create: {
              objectKey: mockupUrl,
              mimeType: "image/jpeg",
              sha256: assetSlug,
            },
          });

          await tx.productMockup.upsert({
            where: { id: `mockup-${catalogVariant.id}` },
            update: { assetId: asset.id },
            create: {
              id: `mockup-${catalogVariant.id}`,
              catalogVariantId: catalogVariant.id,
              assetId: asset.id,
              provider: "PRINTFUL",
            },
          });
        }
      }

      return catalogProduct;
    });
  }
}
