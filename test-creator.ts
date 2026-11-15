import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const creator = await prisma.creatorProfile.findFirst();
  console.log("Creator:", creator);
}
main().catch(console.error).finally(() => prisma.$disconnect());
