import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.galleryItem.deleteMany({});
  
  await prisma.galleryItem.createMany({
    data: [
      {
        slug: "david-tee",
        title: "David / 大衛 / Đại Vệ",
        sourceText: "David",
        tradition: "CHINESE_CALLIGRAPHY",
        artworkId: "art_david_001",
        artworkPreviewUrl: "https://thibut.com/placeholder-david.png", // will be replaced
        productionArtworkUrl: "https://thibut.com/placeholder-david.png",
        productType: "Premium Heavyweight Tee",
        productName: "Premium Heavyweight Tee",
        productImageUrl: "https://thibut.com/placeholder-tee-david.png",
        listedPriceCents: 4800,
        currency: "USD",
        requiresSize: true,
        requiresColor: true,
        defaultColor: "Black",
        availableSizes: ["S", "M", "L", "XL", "2XL"],
        availableColors: ["Black", "White", "Navy"],
        category: "NAME",
        productCategory: "TEE",
        published: true,
        purchasable: true
      },
      {
        slug: "co-chi-thi-nen",
        title: "Có Chí Thì Nên",
        sourceText: "Có Chí Thì Nên",
        tradition: "VIETNAMESE_THU_PHAP",
        artworkId: "art_cochi_001",
        artworkPreviewUrl: "https://thibut.com/placeholder-cochi.png",
        productionArtworkUrl: "https://thibut.com/placeholder-cochi.png",
        productType: "Canvas Wall Art",
        productName: "Canvas Wall Art",
        productImageUrl: "https://thibut.com/placeholder-canvas-cochi.png",
        listedPriceCents: 8500,
        currency: "USD",
        requiresSize: false,
        requiresColor: false,
        category: "POETRY",
        productCategory: "WALL_ART",
        published: true,
        purchasable: true
      }
    ]
  });
  console.log("Gallery seeded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
