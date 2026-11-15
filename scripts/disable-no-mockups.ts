import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.catalogProduct.findMany({
    include: {
      variants: {
        include: {
          mockups: true
        }
      }
    }
  });

  for (const p of products) {
    let hasMockups = false;
    for (const v of p.variants) {
      if (v.mockups && v.mockups.length > 0) {
        hasMockups = true;
      }
    }

    if (!hasMockups) {
      console.log(`Disabling product because it has no mockups: ${p.name}`);
      await prisma.catalogProduct.update({
        where: { id: p.id },
        data: { status: 'INACTIVE' }
      });
    }
  }
}

main().then(() => console.log('Done')).catch(console.error);
