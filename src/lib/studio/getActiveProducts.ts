import "server-only";
import prisma from "@/lib/prisma";
import type { ProductMock } from "@/components/studio/ProductSelectionModal";
import { formatMinor } from "@/lib/money";

/**
 * The Studio's product list: active catalog products with a retail price on at least one
 * active variant. Reads the database only; it has never called an outside provider.
 * A variant without its own retail price is left out (there is no provider cost to price from).
 */
export async function getActiveProductsForStudio(): Promise<ProductMock[]> {
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: {
        include: {
          mockups: {
            include: { asset: true },
          },
        },
      },
    },
  });

  if (products.length === 0) {
    return [];
  }

  return products.flatMap((p) => {
    const activeVariants = p.variants.filter((v) => v.active);
    if (activeVariants.length === 0) {
      return [];
    }

    const resolvedVariants = activeVariants.flatMap((v) => {
      const candidateMinor = v.baseRetailMinor;
      if (candidateMinor <= 0n) {
        return [];
      }
      return [
        {
          id: v.id,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
          retailPriceMinor: candidateMinor.toString(),
          mockupImageUrl: v.mockups?.[0]?.asset?.objectKey ?? null,
          resolvedMinor: candidateMinor,
        },
      ];
    });

    if (resolvedVariants.length === 0) {
      return [];
    }

    let minRetailMinor: bigint | null = null;
    for (const rv of resolvedVariants) {
      if (minRetailMinor === null || rv.resolvedMinor < minRetailMinor) {
        minRetailMinor = rv.resolvedMinor;
      }
    }

    if (minRetailMinor === null || minRetailMinor <= 0n) {
      return [];
    }

    const firstVariantWithImage = activeVariants.find(
      (v) => v.mockups && v.mockups.length > 0 && v.mockups[0].asset
    );
    let imageUrl = firstVariantWithImage?.mockups[0].asset?.objectKey;

    if (!imageUrl) {
      const lowerCat = p.category.toLowerCase();
      imageUrl =
        lowerCat.includes("canvas") || lowerCat.includes("poster") || lowerCat.includes("wall")
          ? "/mockups/framed_print.jpg"
          : lowerCat.includes("hoodie")
            ? "/mockups/hoodie.jpg"
            : "/mockups/blank_hoodie.jpg";
    }

    return [
      {
        id: p.id,
        name: p.name,
        category: p.category,
        priceMinor: minRetailMinor.toString(),
        formattedPrice: formatMinor(minRetailMinor, "USD"),
        imageUrl,
        description: p.description || "A high-quality blank garment.",
        variants: resolvedVariants.map((rv) => ({
          id: rv.id,
          size: rv.size,
          color: rv.color,
          colorHex: rv.colorHex,
          retailPriceMinor: rv.retailPriceMinor,
          mockupImageUrl: rv.mockupImageUrl,
        })),
      },
    ];
  });
}
