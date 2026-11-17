import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATALOG } from "../src/config/catalog";
import {
  DEFAULT_LICENSE_ROYALTY_MINOR,
  DEFAULT_PERSONALIZATION_FEE_MINOR,
} from "../src/lib/pricing/quote";

const prisma = new PrismaClient();

const BACKGROUND_PRESETS = [
  {
    key: "zen-ivory",
    name: "Zen Ivory",
    category: "Zen",
    description: "A soft, warm ivory paper texture with subtle natural grain.",
    promptTemplate:
      "Create an elegant editorial background for East Asian calligraphy presentation. Style: Zen minimalist paper. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Soft, warm ivory paper texture with subtle natural grain. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Calm",
    defaultPalette: "Ivory / Ink",
    defaultIntensity: "Minimal",
    sortOrder: 1,
    enabled: true,
  },
  {
    key: "sumi-mist",
    name: "Sumi Mist",
    category: "Abstract",
    description: "Atmospheric ink wash clouds dissipating in negative space.",
    promptTemplate:
      "Create an elegant editorial background for East Asian calligraphy presentation. Style: Sumi-e ink wash mist. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Atmospheric ink wash clouds dissipating in negative space. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Mysterious",
    defaultPalette: "Beige / Black",
    defaultIntensity: "Medium",
    sortOrder: 2,
    enabled: true,
  },
  {
    key: "bamboo-shadow",
    name: "Bamboo Shadow",
    category: "Nature",
    description:
      "Soft silhouettes of bamboo leaves cast against a paper screen.",
    promptTemplate:
      "Create an elegant editorial background for East Asian calligraphy presentation. Style: Bamboo shadows on shoji screen. Mood: {{mood}}. Palette: {{palette}}. Intensity: {{intensity}}. Soft silhouettes of bamboo leaves cast against a paper screen. Keep composition minimal and suitable for overlaid calligraphy. Do not include readable text, signage, or calligraphy characters. Leave clean visual space for central artwork. {{userNote}}",
    defaultMood: "Spiritual",
    defaultPalette: "Soft Gold",
    defaultIntensity: "Minimal",
    sortOrder: 3,
    enabled: true,
  },
] as const;

const CREATOR_PLANS = [
  {
    code: "FREE" as const,
    name: "Artisan Free",
    activeDesignLimit: 25,
    monthlyAICredits: 50,
    priceMinor: 0n,
  },
  {
    code: "CREATOR" as const,
    name: "Creator Lineage",
    activeDesignLimit: 100,
    monthlyAICredits: 300,
    priceMinor: 1900n,
  },
  {
    code: "CREATOR_PLUS" as const,
    name: "Master Calligrapher",
    activeDesignLimit: 500,
    monthlyAICredits: 1000,
    priceMinor: 4900n,
  },
  {
    code: "STUDIO" as const,
    name: "Archival Studio",
    activeDesignLimit: 2500,
    monthlyAICredits: 5000,
    priceMinor: 12900n,
  },
] as const;

async function main() {
  console.log("Seeding Thi Bút roles, creator plans, background presets, and catalog...");

  for (const role of [
    { code: "BUYER", name: "Buyer" },
    { code: "CREATOR", name: "Creator" },
    { code: "ADMIN", name: "Administrator" },
  ]) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const plan of CREATOR_PLANS) {
    await prisma.creatorPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        activeDesignLimit: plan.activeDesignLimit,
        monthlyAICredits: plan.monthlyAICredits,
        priceMinor: plan.priceMinor,
        active: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        activeDesignLimit: plan.activeDesignLimit,
        monthlyAICredits: plan.monthlyAICredits,
        priceMinor: plan.priceMinor,
        currency: "USD",
        active: true,
      },
    });
  }

  for (const preset of BACKGROUND_PRESETS) {
    await prisma.backgroundPreset.upsert({
      where: { key: preset.key },
      update: preset,
      create: preset,
    });
  }

  const printful = await prisma.fulfillmentProviderRecord.upsert({
    where: { code: "PRINTFUL" },
    update: { active: true },
    create: {
      code: "PRINTFUL",
      name: "Printful",
      active: true,
      priority: 1,
    },
  });

  const feeBundleMinor =
    DEFAULT_LICENSE_ROYALTY_MINOR + DEFAULT_PERSONALIZATION_FEE_MINOR;

  for (const config of Object.values(PRODUCT_CATALOG)) {
    if (config.category === "digital") {
      continue;
    }

    const totalMinor = BigInt(config.priceMinor);
    const baseRetailMinor =
      totalMinor > feeBundleMinor ? totalMinor - feeBundleMinor : 1999n;
    const costMinor = baseRetailMinor / 2n > 0n ? baseRetailMinor / 2n : 950n;

    const slug = config.id
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const product = await prisma.catalogProduct.upsert({
      where: { slug },
      update: {
        name: config.name,
        category: config.category,
        status: "ACTIVE",
        defaultMarkupMinor: 0n,
      },
      create: {
        slug,
        name: config.name,
        category: config.category,
        status: "ACTIVE",
        defaultMarkupMinor: 0n,
      },
    });

    if (config.printArea) {
      await prisma.printArea.upsert({
        where: {
          catalogProductId_placement: {
            catalogProductId: product.id,
            placement: "FRONT_CENTER",
          },
        },
        update: { schemaJson: config.printArea },
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

    for (const color of config.colors) {
      const objectKey = color.mockup || "/mockups/blank_hoodie.jpg";
      const asset = await prisma.asset.upsert({
        where: { objectKey },
        update: {},
        create: {
          objectKey,
          mimeType: "image/jpeg",
          sha256: `mockup-${slug}-${color.id}`,
          visibility: "PUBLIC",
        },
      });

      for (const size of config.sizes) {
        const cleanSize = size
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const variantSku = `${slug}-${color.id}-${cleanSize}`;

        const variant = await prisma.catalogVariant.upsert({
          where: { sku: variantSku },
          update: {
            color: color.name,
            colorHex: color.hex,
            size,
            baseRetailMinor,
            active: true,
          },
          create: {
            productId: product.id,
            sku: variantSku,
            color: color.name,
            colorHex: color.hex,
            size,
            baseRetailMinor,
            active: true,
          },
        });

        await prisma.providerVariant.upsert({
          where: {
            providerId_catalogVariantId: {
              providerId: printful.id,
              catalogVariantId: variant.id,
            },
          },
          update: {
            costMinor,
            currency: "USD",
            active: true,
          },
          create: {
            providerId: printful.id,
            catalogVariantId: variant.id,
            externalProductId: `seed-${slug}`,
            externalVariantId: `seed-${variantSku}`,
            costMinor,
            currency: "USD",
            active: true,
          },
        });

        await prisma.productMockup.upsert({
          where: { id: `mockup-${variant.id}` },
          update: { assetId: asset.id },
          create: {
            id: `mockup-${variant.id}`,
            catalogVariantId: variant.id,
            assetId: asset.id,
            provider: "PRINTFUL",
            status: "READY",
          },
        });
      }
    }
  }

  console.log("Production defaults & catalog seeded cleanly with BigInt pricing.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
