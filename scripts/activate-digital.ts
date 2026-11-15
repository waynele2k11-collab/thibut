import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const prod = await prisma.catalogProduct.update({
    where: { id: 'acee8e26-04d2-48fb-9a7e-2708d9e9699e' },
    data: { 
      status: 'ACTIVE',
      category: 'digital',
      name: 'Digital Download (All 6)',
    }
  });
  
  await prisma.catalogVariant.updateMany({
    where: { productId: prod.id },
    data: {
      active: true,
      baseRetailMinor: 999
    }
  });
  console.log('Updated:', prod);
}
main();
