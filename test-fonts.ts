import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const fonts = await prisma.font.findMany();
  console.log(fonts);
}
main();
