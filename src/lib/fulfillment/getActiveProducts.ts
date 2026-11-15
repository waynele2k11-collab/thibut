import prisma from "@/lib/prisma";
import { ProductMock } from "@/components/studio/ProductSelectionModal";

export async function getActiveProductsForStudio(): Promise<ProductMock[]> {
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: { variants: { include: { providerVariants: true, mockups: { include: { asset: true } } } } }
  });

  if (products.length === 0) {
    return [];
  }

  return products.map(p => {
    const prices = p.variants.flatMap(v => v.providerVariants.map(pv => Number(pv.costMinor))).filter(cost => !isNaN(cost) && cost > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) / 100 : 25.00;

    // Find the first variant that has a mockup asset
    const firstVariantWithImage = p.variants.find(v => v.mockups && v.mockups.length > 0 && v.mockups[0].asset);
    let imageUrl = firstVariantWithImage?.mockups[0].asset?.objectKey;

    if (!imageUrl) {
      // Fallback for MVP if somehow the asset is missing
      imageUrl = p.category.toLowerCase() === "tote" 
        ? "https://images.unsplash.com/photo-1544816155-12df9643f363?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        : p.category.toLowerCase() === "canvas" 
        ? "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        : p.category.toLowerCase().includes("hoodie")
        ? "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        : "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
    }

    return {
      id: p.id,
      name: p.name,
      price: minPrice,
      imageUrl,
      description: p.description || "A high-quality blank garment.",
      variants: p.variants.filter(v => v.active).map(v => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex
      }))
    };
  });
}
