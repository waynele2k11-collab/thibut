import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const vars = await prisma.catalogVariant.findMany({ 
    where: { colorHex: { not: null } },
    take: 10 
  });
  console.log(vars.map(v => ({ color: v.color, hex: v.colorHex })));
}
main();
