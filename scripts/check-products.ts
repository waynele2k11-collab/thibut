import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.catalogProduct.findMany({
    where: { status: 'ACTIVE' },
    select: { name: true }
  });
  console.log('Active products:', products.map(p => p.name));
}

main().then(() => console.log('Done')).catch(console.error);
