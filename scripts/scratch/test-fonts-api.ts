import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const fonts = await prisma.font.findMany({ where: { enabled: true } });
  console.log(fonts);
}
main();
