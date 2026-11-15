import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATALOG } from "../src/config/catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Catalog from src/config/catalog.ts...");

  // 1. Ensure Fulfillment Provider exists
  const printful = await prisma.fulfillmentProviderRecord.upsert({
    where: { code: "PRINTFUL" },
    update: {},
    create: {
      code: "PRINTFUL",
      name: "Printful",
      active: true,
      priority: 1,
    },
  });

  // 2. Iterate over PRODUCT_CATALOG
  for (const [key, config] of Object.entries(PRODUCT_CATALOG)) {
    console.log(`Processing product: ${config.name}`);

    // Create or update CatalogProduct
    const slug = config.id.toLowerCase().replace(/\s+/g, "-");
    const product = await prisma.catalogProduct.upsert({
      where: { slug },
      update: {
        name: config.name,
        category: config.category,
        defaultMarkupMinor: BigInt(0),
      },
      create: {
        slug,
        name: config.name,
        category: config.category,
        defaultMarkupMinor: BigInt(0),
      },
    });

    // Create or update PrintArea
    if (config.printArea) {
      await prisma.printArea.upsert({
        where: {
          catalogProductId_placement: {
            catalogProductId: product.id,
            placement: "FRONT_CENTER",
          },
        },
        update: {
          schemaJson: config.printArea,
        },
        create: {
          catalogProductId: product.id,
          placement: "FRONT_CENTER",
          widthPx: 4500,
          heightPx: 5400,
          safeWidthPx: 4500,
          safeHeightPx: 5400,
          schemaJson: config.printArea,
        },
      });
    }

    // Handle Variants (Sizes + Colors)
    // We create a variant for each combination of size and color
    for (const color of config.colors) {
      // In this simple architecture, we'll store the mockup Asset directly
      // Since Asset requires sha256 and mimeType, we'll just create a dummy one or use the URL as objectKey
      const assetSlug = `mockup-${slug}-${color.id}`;
      const asset = await prisma.asset.upsert({
        where: { objectKey: color.mockup || "empty-mockup" },
        update: {},
        create: {
          objectKey: color.mockup || "empty-mockup",
          mimeType: "image/jpeg",
          sha256: assetSlug, // dummy sha256
        },
      });

      for (const size of config.sizes) {
        const variantSku = `${slug}-${color.id}-${size}`.toLowerCase();
        
        const variant = await prisma.catalogVariant.upsert({
          where: { sku: variantSku },
          update: {
            color: color.name,
            colorHex: color.hex,
            size: size,
            baseRetailMinor: BigInt(Math.round(config.price * 100)),
          },
          create: {
            productId: product.id,
            sku: variantSku,
            color: color.name,
            colorHex: color.hex,
            size: size,
            baseRetailMinor: BigInt(Math.round(config.price * 100)),
          },
        });

        // Ensure ProviderVariant exists
        await prisma.providerVariant.upsert({
          where: {
            providerId_catalogVariantId: {
              providerId: printful.id,
              catalogVariantId: variant.id,
            },
          },
          update: {},
          create: {
            providerId: printful.id,
            catalogVariantId: variant.id,
            externalProductId: "TBD", // Printful API would provide this
            externalVariantId: "TBD", // Printful API would provide this
            costMinor: BigInt(Math.round(config.price * 100 * 0.6)), // Dummy cost
            currency: "USD",
          },
        });
      }
    }
  }

  console.log("Catalog seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
