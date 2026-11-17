import "server-only";
import prisma from "@/lib/prisma";
import type { ProductMock } from "@/components/studio/ProductSelectionModal";
import { formatMinor } from "@/lib/money";
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
        priceMinor: minRetailMinor.toString(),
        formattedPrice: formatMinor(minRetailMinor, "USD"),
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
