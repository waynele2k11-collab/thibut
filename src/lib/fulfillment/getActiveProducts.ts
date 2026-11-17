import "server-only";
import prisma from "@/lib/prisma";
import type { ProductMock } from "@/components/studio/ProductSelectionModal";
import { roundUpTo99Minor } from "@/lib/pricing/quote";

export async function getActiveProductsForStudio(): Promise<ProductMock[]> {
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: {
        include: {
          providerVariants: true,
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

    let minRetailMinor: bigint | null = null;
    for (const v of activeVariants) {
      let candidateMinor = v.baseRetailMinor;
      if (candidateMinor <= 0n) {
        const activePv = v.providerVariants.find(
          (pv) => pv.active && pv.costMinor > 0n
        );
        if (activePv) {
          candidateMinor = roundUpTo99Minor(activePv.costMinor * 2n);
        }
      }
      if (candidateMinor > 0n) {
        if (minRetailMinor === null || candidateMinor < minRetailMinor) {
          minRetailMinor = candidateMinor;
        }
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
        lowerCat === "tote"
          ? "https://images.unsplash.com/photo-1544816155-12df9643f363?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
          : lowerCat === "canvas"
            ? "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            : lowerCat.includes("hoodie")
              ? "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              : "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
    }

    return [
      {
        id: p.id,
        name: p.name,
        price: Number(minRetailMinor) / 100,
        imageUrl,
        description: p.description || "A high-quality blank garment.",
        variants: activeVariants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex,
        })),
      },
    ];
  });
}
