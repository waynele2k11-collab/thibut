import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.providerVariant.findMany({});
  console.log('Provider Variants:', p.length);
}
main();
