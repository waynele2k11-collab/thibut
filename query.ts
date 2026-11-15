import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const products = await prisma.catalogProduct.findMany({
    include: { variants: true },
    take: 5
  })
  console.dir(products, { depth: null })
}
main()
