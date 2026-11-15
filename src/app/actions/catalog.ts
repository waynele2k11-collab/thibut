"use server";

import prisma from "@/lib/prisma";
import { ProductConfig } from "@/config/catalog";
import { calculatePricing } from "@/lib/pricing/engine";

export async function getCatalogProducts(): Promise<Record<string, ProductConfig>> {
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: {
        include: {
          providerVariants: true,
          mockups: {
            include: { asset: true }
          }
        },
      },
      printAreas: true,
    },
  });

  const catalog: Record<string, ProductConfig> = {};

  for (const p of products) {
    const colorsMap = new Map<string, { id: string; name: string; hex: string; mockup: string }>();
    const sizesSet = new Set<string>();

    for (const v of p.variants) {
      if (v.size) sizesSet.add(v.size);
      
      if (v.color) {
        const colorId = v.color.toLowerCase().replace(/\s+/g, "-");
        
        // Find the first mockup asset for this variant
        let mockupUrl = `/mockups/printful/${p.slug}-${colorId}.jpg`; // Fallback
        if (v.mockups && v.mockups.length > 0) {
          mockupUrl = v.mockups[0].asset.objectKey;
        }

        // Fallback color map for common garment colors if hex is missing
        const hexMap: Record<string, string> = {
          "black": "#111111",
          "white": "#F6F1E7",
          "navy": "#1E293B",
          "red": "#B3261E",
          "grey": "#A8A8A8",
          "charcoal": "#333333",
          "buttermilk": "#FDFBF7",
          "forest": "#2E4A35",
        };
        
        let resolvedHex = v.colorHex;
        if (!resolvedHex || resolvedHex === "#CCCCCC") {
          const lowerColor = v.color.toLowerCase();
          for (const [key, val] of Object.entries(hexMap)) {
            if (lowerColor.includes(key)) {
              resolvedHex = val;
              break;
            }
          }
        }

        if (!colorsMap.has(v.color)) {
          colorsMap.set(v.color, {
            id: colorId,
            name: v.color,
            hex: resolvedHex || "#CCCCCC",
            mockup: mockupUrl,
          });
        }
      }
    }

    const colors = Array.from(colorsMap.values());
    const sizes = Array.from(sizesSet);
    
    // Determine default size and color
    const defaultSize = sizes.includes("L") ? "L" : sizes.includes("18x24 in") ? "18x24 in" : sizes[0] || "";
    const defaultColor = colors.length > 0 ? colors[0].name : "";
    
    // Calculate authoritative pricing based on the first provider variant cost
    let baseCostMinor = 0;
    if (p.variants.length > 0 && p.variants[0].providerVariants && p.variants[0].providerVariants.length > 0) {
      baseCostMinor = Number(p.variants[0].providerVariants[0].costMinor);
    }
    const pricing = calculatePricing(baseCostMinor);
    
    const price = pricing.galleryPriceMinor / 100;

    catalog[p.name] = {
      id: p.name,
      name: p.name,
      price: price,
      pricing: pricing,
      category: p.category as any,
      sizes: sizes,
      colors: colors,
      defaultSize,
      defaultColor,
      supportedPlacements: (p.category === "apparel" || p.name.includes("T-Shirt") || p.name.includes("Tee") || p.name.includes("Hoodie")) ? ["front", "back"] : ["front"],
      printArea: p.printAreas.length > 0 && p.printAreas[0].schemaJson ? (p.printAreas[0].schemaJson as any) : undefined,
    };
  }

  console.log("Returned catalog item Unisex Staple T-Shirt:", catalog["Unisex Staple T-Shirt | Bella + Canvas 3001"]);


  return catalog;
}
