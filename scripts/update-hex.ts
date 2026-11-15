import { PrismaClient } from '@prisma/client';
import { PrintfulProvider } from '../src/lib/fulfillment/PrintfulProvider';

const prisma = new PrismaClient();
const provider = new PrintfulProvider();

async function main() {
  const products = await prisma.catalogProduct.findMany({
    where: { status: 'ACTIVE' },
    include: {
      variants: {
        include: { providerVariants: true }
      }
    }
  });

  for (const p of products) {
    if (p.variants.length === 0 || p.variants[0].providerVariants.length === 0) continue;
    const externalId = p.variants[0].providerVariants[0].externalProductId;
    
    console.log(`Fetching Printful variants for ${p.name} (ID: ${externalId})`);
    try {
      const printfulVariants = await provider.getVariants(externalId);
      
      for (const v of p.variants) {
        const pv = v.providerVariants[0];
        const matchingPrintful = printfulVariants.find(pv2 => pv2.id === pv.externalVariantId);
        if (matchingPrintful && matchingPrintful.colorHex) {
          await prisma.catalogVariant.update({
            where: { id: v.id },
            data: { colorHex: matchingPrintful.colorHex }
          });
        }
      }
      console.log(`Updated hex codes for ${p.name}`);
    } catch (e) {
      console.error(`Failed to update ${p.name}`, e);
    }
  }
}

main().then(() => console.log('Done')).catch(console.error);
