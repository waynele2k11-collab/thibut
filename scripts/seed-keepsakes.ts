/**
 * Seeds the Business Requirements v1.0 keepsake catalog: divisions, subcategories,
 * the in-house resin products with size variants, and the first catalog designs.
 *
 * Safe to re-run: existing rows are matched by slug / sku and administrator edits
 * to prices, status and multiplier are never overwritten.
 *
 *   npm run db:seed:keepsakes
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_DOUBLE_SIDED_MULTIPLIER_BPS,
  DIVISIONS,
  PLATFORM_CREATOR_SLUG,
  PLATFORM_CREATOR_USER_EMAIL,
  RESIN_KEEPSAKE_PRODUCT_SLUG,
  RESIN_TABLETOP_PRODUCT_SLUG,
  categorySlug,
} from "../src/lib/catalog/divisions";

const prisma = new PrismaClient();

// BRD §09 marks these prices illustrative. Outside production they seed as ACTIVE so the
// storefront can be exercised; in production they seed as DRAFT until an administrator
// publishes them after manufacturing validation (BRD §15 governance).
const INITIAL_PRODUCT_STATUS =
  process.env.NODE_ENV === "production" ? "DRAFT" : "ACTIVE";

const SIZE_VARIANTS = [
  { key: "small", size: "Small", baseRetailMinor: 4900n },
  { key: "medium", size: "Medium", baseRetailMinor: 9900n },
  { key: "large", size: "Large", baseRetailMinor: 14900n },
  { key: "extra-large", size: "Extra Large", baseRetailMinor: 24900n },
] as const;

const DESIGNS = [
  {
    slug: "wedding-tram-nam-hanh-phuc",
    title: "Trăm Năm Hạnh Phúc — Wedding Blessing",
    description:
      "A wedding couple in red áo dài with a blessing verse, apricot blossom, lotus and a double-happiness seal. The second image shows a matching reverse-side composition for double-sided pieces.",
    division: "personal",
    subcategory: "wedding-engagement",
    images: ["/keepsakes/wedding-blessing.webp", "/keepsakes/wedding-reverse.webp"],
  },
  {
    slug: "parents-nghia-me-cong-cha",
    title: "Nghĩa Mẹ · Công Cha — Parents Tribute",
    description:
      "Matching mother and father portraits with the folk verse honouring a mother's devotion and a father's labour, framed in orchid and blossom. Sold per piece; the image shows two.",
    division: "personal",
    subcategory: "parents-family",
    images: ["/keepsakes/parents-pair.webp"],
  },
] as const;

async function seedCategories() {
  for (const [divisionIndex, division] of DIVISIONS.entries()) {
    const root = await prisma.category.upsert({
      where: { slug: division.slug },
      update: {},
      create: {
        slug: division.slug,
        name: division.name,
        sortOrder: divisionIndex,
        active: true,
      },
    });
    for (const [subIndex, sub] of division.subcategories.entries()) {
      const slug = categorySlug(division.slug, sub.slug);
      await prisma.category.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name: sub.name,
          parentId: root.id,
          sortOrder: subIndex,
          active: true,
        },
      });
    }
  }
}

async function seedProducts() {
  const keepsake = await prisma.catalogProduct.upsert({
    where: { slug: RESIN_KEEPSAKE_PRODUCT_SLUG },
    update: {},
    create: {
      slug: RESIN_KEEPSAKE_PRODUCT_SLUG,
      name: "Crystal-Look Resin Keepsake — Rectangle",
      category: "keepsake",
      description:
        "Clear cast resin block with artwork printed on transparent film. Made to order.",
      status: INITIAL_PRODUCT_STATUS,
      fulfillmentMode: "IN_HOUSE",
      sidePricing: "MULTIPLIER",
      doubleSidedMultiplierBps: DEFAULT_DOUBLE_SIDED_MULTIPLIER_BPS,
    },
  });

  for (const variant of SIZE_VARIANTS) {
    const sku = `${RESIN_KEEPSAKE_PRODUCT_SLUG}-${variant.key}`;
    await prisma.catalogVariant.upsert({
      where: { sku },
      update: {},
      create: {
        productId: keepsake.id,
        sku,
        size: variant.size,
        baseRetailMinor: variant.baseRetailMinor,
        active: true,
      },
    });
  }

  // BRD §16: tabletops stay quotation-only until structurally validated.
  await prisma.catalogProduct.upsert({
    where: { slug: RESIN_TABLETOP_PRODUCT_SLUG },
    update: {},
    create: {
      slug: RESIN_TABLETOP_PRODUCT_SLUG,
      name: "Resin Tabletop",
      category: "tabletop",
      description: "Custom dimensions by quotation.",
      status: "QUOTE_ONLY",
      fulfillmentMode: "IN_HOUSE",
      sidePricing: "MULTIPLIER",
      doubleSidedMultiplierBps: DEFAULT_DOUBLE_SIDED_MULTIPLIER_BPS,
    },
  });

  return keepsake;
}

async function ensurePlatformCreator() {
  const existing = await prisma.creatorProfile.findUnique({
    where: { slug: PLATFORM_CREATOR_SLUG },
  });
  if (existing) return existing;

  const user = await prisma.user.upsert({
    where: { email: PLATFORM_CREATOR_USER_EMAIL },
    update: {},
    create: {
      email: PLATFORM_CREATOR_USER_EMAIL,
      name: "Thi Bút Studio",
      status: "ACTIVE",
    },
  });
  return prisma.creatorProfile.create({
    data: {
      userId: user.id,
      slug: PLATFORM_CREATOR_SLUG,
      displayName: "Thi Bút Studio",
      status: "ACTIVE",
    },
  });
}

async function seedDesigns(keepsakeProductId: string, creatorId: string) {
  for (const config of DESIGNS) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: categorySlug(config.division, config.subcategory) },
    });

    const design = await prisma.design.upsert({
      where: { slug: config.slug },
      update: {},
      create: {
        creatorId,
        slug: config.slug,
        title: config.title,
        description: config.description,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        categoryId: category.id,
        imageKind: "CONCEPT_RENDER",
        catalogImageUrls: [...config.images],
        publishedAt: new Date(),
      },
    });

    await prisma.designVersion.upsert({
      where: {
        designId_versionNumber: { designId: design.id, versionNumber: 1 },
      },
      update: {},
      create: { designId: design.id, versionNumber: 1 },
    });

    // Buy Now sells catalog artwork unchanged, so every personalization permission is off.
    await prisma.designPolicyVersion.upsert({
      where: {
        designId_versionNumber: { designId: design.id, versionNumber: 1 },
      },
      update: {},
      create: {
        designId: design.id,
        versionNumber: 1,
        allowName: false,
        allowQuote: false,
        allowTranslation: false,
        allowCalligraphy: false,
        allowBackgroundRemoval: false,
      },
    });

    // Platform-owned artwork: a zero-price licence so the listed price is the whole price.
    const licence = await prisma.licenseOffer.findFirst({
      where: { designId: design.id, type: "PERSONAL_PRODUCT" },
    });
    if (!licence) {
      await prisma.licenseOffer.create({
        data: {
          designId: design.id,
          type: "PERSONAL_PRODUCT",
          priceMinor: 0n,
          currency: "USD",
          active: true,
        },
      });
    }

    await prisma.designProduct.upsert({
      where: {
        designId_catalogProductId: {
          designId: design.id,
          catalogProductId: keepsakeProductId,
        },
      },
      update: {},
      create: {
        designId: design.id,
        catalogProductId: keepsakeProductId,
        active: true,
        defaultPlacement: "front",
      },
    });
  }
}

async function main() {
  await seedCategories();
  const keepsake = await seedProducts();
  const creator = await ensurePlatformCreator();
  await seedDesigns(keepsake.id, creator.id);
  console.log(
    `Keepsake catalog seeded: ${DIVISIONS.length} divisions, ${SIZE_VARIANTS.length} size variants, ${DESIGNS.length} designs (product status on first create: ${INITIAL_PRODUCT_STATUS}).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
