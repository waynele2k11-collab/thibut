import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const sysCreator = await prisma.creatorProfile.findFirst();
    const genericDesign = await prisma.design.findFirst();
    if (!sysCreator || !genericDesign) return;
    
    await prisma.cartItem.create({
      data: {
        cartId: 'some-cart-id',
        creatorId: sysCreator.id,
        designId: genericDesign.id,
        designVersionId: "1",
        catalogVariantId: 'some-variant',
        unitArtworkMinor: 0,
        unitPersonalizationMinor: 500,
        unitProductMinor: 2500,
      }
    });
  } catch(e: any) {
    console.error(e.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
