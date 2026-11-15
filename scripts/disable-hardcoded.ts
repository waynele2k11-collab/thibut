import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.catalogProduct.findMany({
    include: {
      variants: {
        include: {
          providerVariants: true
        }
      }
    }
  });

  for (const p of products) {
    let hasProvider = false;
    for (const v of p.variants) {
      if (v.providerVariants.length > 0) {
        hasProvider = true;
      }
    }

    if (!hasProvider) {
      console.log(`Disabling hardcoded product: ${p.name}`);
      await prisma.catalogProduct.update({
        where: { id: p.id },
        data: { status: 'INACTIVE' }
      });
    }
  }
}

main().then(() => console.log('Done')).catch(console.error);
