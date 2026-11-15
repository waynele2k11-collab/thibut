import { PrismaClient } from "@prisma/client";
import { generateInstantSvgString, safeBase64Encode } from "../lib/calligraphy/ClientCalligraphyRenderer";

const prisma = new PrismaClient();

const POPULAR_NAMES = [
  "Sarah", "Michael", "David", "Emily", "Jessica", 
  "Daniel", "Matthew", "Amanda", "Joshua", "Nicole",
  "James", "Jennifer", "Robert", "Elizabeth", "John",
  "William", "Mary", "Christopher", "Ashley", "Joseph"
];

const COLORS = [
  "#0B0B0B", // Ink Black
  "#1A2A3A", // Indigo
  "#3A1A1A", // Oxblood
  "#0B1A0B", // Pine
  "#2A1A3A", // Plum
  "#8B0000", // Crimson (traditional seal color for text)
  "#00008B", // Deep Blue
];

async function seedGalleryNames() {
  console.log("Fetching active products...");
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: { 
      variants: { 
        take: 1,
        include: {
          mockups: {
            include: { asset: true }
          }
        }
      } 
    }
  });

  if (products.length === 0) {
    console.error("No active products found! Sync and enable products first.");
    return;
  }

  console.log(`Found ${products.length} active products. Generating 20 gallery items...`);

  // Delete existing generated names if re-running
  await prisma.galleryItem.deleteMany({
    where: {
      slug: { startsWith: "name-vertical-" }
    }
  });

  let productIndex = 0;

  for (const name of POPULAR_NAMES) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const product = products[productIndex % products.length];
    productIndex++;

    const svgString = generateInstantSvgString({
      text: name,
      tradition: "VIETNAMESE_THU_PHAP",
      strokePreset: "BOLD_BRUSH",
      variationType: "01_CONTROLLED",
      fontId: "utm-thuphap-thien-an",
      layout: "VERTICAL",
      inkColor: color,
      hasSeal: true
    });

    const base64Uri = `data:image/svg+xml;base64,${safeBase64Encode(svgString)}`;

    // Calculate 10% discount
    const baseRetailMinor = product.variants.length > 0 ? Number(product.variants[0].baseRetailMinor) : 3669;
    const discountedPriceCents = Math.round(baseRetailMinor * 0.9);

    const slug = `name-vertical-${name.toLowerCase()}`;

    const imageUrl = product.variants[0]?.mockups[0]?.asset?.objectKey || "/mockups/model-male.jpg";

    await prisma.galleryItem.create({
      data: {
        slug,
        title: `"${name}" in Thiên Ân`,
        subtitle: "Vertical Brush Calligraphy",
        description: `Your name "${name}" beautifully rendered in the traditional Vietnamese UTM Thư Pháp Thiên Ân font, flowing vertically.`,
        sourceText: name,
        sourceLanguage: "English",
        tradition: "VIETNAMESE_THU_PHAP",
        artworkId: "generated-vector",
        artworkPreviewUrl: base64Uri,
        productionArtworkUrl: base64Uri, // in reality, printful webhook will generate higher res if needed
        productType: product.category,
        productCategory: product.category,
        productName: product.name,
        productImageUrl: imageUrl,
        listedPriceCents: discountedPriceCents,
        currency: "USD",
        requiresSize: product.category === "apparel",
        category: "NAME",
        published: true
      }
    });

    console.log(`Created Gallery Item: ${name} mapped to ${product.name} ($${(discountedPriceCents/100).toFixed(2)})`);
  }

  console.log("Seeding complete!");
}

seedGalleryNames().catch(console.error).finally(() => prisma.$disconnect());
