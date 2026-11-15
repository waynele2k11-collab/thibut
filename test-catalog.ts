import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const activeCount = await prisma.catalogProduct.count({ where: { status: "ACTIVE" } });
  console.log("Active count:", activeCount);
}
main().catch(console.error).finally(() => prisma.$disconnect());
