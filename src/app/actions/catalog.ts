"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import type { ProductConfig } from "@/config/catalog";
import { calculatePricing, roundUpTo99Minor } from "@/lib/pricing/engine";

const PrintAreaSchemaJsonSchema = z.object({
  topPct: z.number(),
  leftPct: z.number(),
  widthPct: z.number(),
  heightPct: z.number(),
});

function normalizeCategory(raw: string): ProductConfig["category"] {
  if (raw === "apparel" || raw === "wall_art" || raw === "merch" || raw === "digital") {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("canvas") || lower.includes("poster") || lower.includes("wall")) {
    return "wall_art";
  }
  if (lower.includes("mug") || lower.includes("tote")) {
    return "merch";
  }
  return "apparel";
}

function minorBigIntToDollarsNumber(minor: bigint): number {
  const wholeDollars = Number(minor / 100n);
  const cents = Number(minor % 100n);
  return wholeDollars + cents / 100;
}

export async function getCatalogProducts(): Promise<Record<string, ProductConfig>> {
  const products = await prisma.catalogProduct.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: {
        where: { active: true },
        include: {
          providerVariants: {
            where: { active: true },
          },
          mockups: {
            include: { asset: true },
          },
        },
      },
      printAreas: true,
    },
  });

  const catalog: Record<string, ProductConfig> = {};

  const hexMap: Record<string, string> = {
    black: "#111111",
    white: "#F6F1E7",
    navy: "#1E293B",
    red: "#B3261E",
    grey: "#A8A8A8",
    charcoal: "#333333",
    buttermilk: "#FDFBF7",
    forest: "#2E4A35",
  };

  for (const p of products) {
    const colorsMap = new Map<
      string,
      { id: string; name: string; hex: string; mockup: string }
    >();
    const sizesSet = new Set<string>();

    for (const v of p.variants) {
      if (v.size) {
        sizesSet.add(v.size);
      }

      if (v.color) {
        const colorId = v.color.toLowerCase().replace(/\s+/g, "-");

        let mockupUrl = `/mockups/printful/${p.slug}-${colorId}.jpg`;
        if (v.mockups && v.mockups.length > 0 && v.mockups[0].asset) {
          mockupUrl = v.mockups[0].asset.objectKey;
        }

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

    const defaultSize = sizes.includes("L")
      ? "L"
      : sizes.includes("18x24 in")
        ? "18x24 in"
        : sizes[0] || "";
    const defaultColor = colors.length > 0 ? colors[0].name : "";

    let baseCostMinor = 0n;
    let minVariantRetailMinor = 0n;

    for (const v of p.variants) {
      if (v.baseRetailMinor > 0n) {
        if (minVariantRetailMinor === 0n || v.baseRetailMinor < minVariantRetailMinor) {
          minVariantRetailMinor = v.baseRetailMinor;
        }
      }
      for (const pv of v.providerVariants) {
        if (pv.costMinor > 0n) {
          if (baseCostMinor === 0n || pv.costMinor < baseCostMinor) {
            baseCostMinor = pv.costMinor;
          }
        }
      }
    }

    const pricing = calculatePricing(baseCostMinor);
    const authoritativeRetailMinor =
      baseCostMinor > 0n
        ? roundUpTo99Minor(baseCostMinor * 2n)
        : minVariantRetailMinor;

    const rawSchema =
      p.printAreas.length > 0 ? p.printAreas[0].schemaJson : undefined;
    const parsedPrintArea = PrintAreaSchemaJsonSchema.safeParse(rawSchema);

    catalog[p.name] = {
      id: p.name,
      name: p.name,
      price: minorBigIntToDollarsNumber(authoritativeRetailMinor),
      pricing,
      category: normalizeCategory(p.category),
      sizes,
      colors,
      defaultSize,
      defaultColor,
      supportedPlacements:
        p.category === "apparel" ||
        p.name.includes("T-Shirt") ||
        p.name.includes("Tee") ||
        p.name.includes("Hoodie")
          ? ["front", "back"]
          : ["front"],
      printArea: parsedPrintArea.success ? parsedPrintArea.data : undefined,
    };
  }

  return catalog;
}
