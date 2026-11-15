import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.catalogProduct.findMany();
  console.log(prods.map(p => ({ id: p.id, name: p.name, status: p.status, category: p.category })));
}
main();
