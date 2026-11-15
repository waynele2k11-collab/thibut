import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.galleryItem.updateMany({
    where: { slug: "david-tee" },
    data: { productImageUrl: "/mockups/model-male.jpg" }
  });
  
  await prisma.galleryItem.updateMany({
    where: { slug: "co-chi-thi-nen" },
    data: { productImageUrl: "/mockups/fine-art-poster.jpg" }
  });
  console.log("Gallery images updated.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
