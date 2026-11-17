"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PrintfulProvider } from "@/lib/fulfillment/PrintfulProvider";
import type { ProviderProduct } from "@/lib/fulfillment/types";
import { formatMinor } from "@/lib/money";
import { PricingValidationError } from "@/lib/pricing/quote";
import { CatalogSyncService } from "@/lib/services/CatalogSyncService";
import { requireAdmin } from "@/utils/admin/auth";

const EmptyActionInputSchema = z.undefined();

const ImportProductInputSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Product ID must be a positive numeric string")
  .transform((val) => Number.parseInt(val, 10))
  .pipe(z.number().int().positive());

const ToggleProductStatusSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Invalid product slug"),
  currentStatus: z.enum(["ACTIVE", "INACTIVE"]),
});

export interface ImportedProductStatusEntry {
  id: string;
  slug: string;
  status: string;
  priceMinor?: string;
  formattedCost?: string;
}

export async function getPrintfulMasterCatalog(
  input?: undefined
): Promise<{ success: true; products: ProviderProduct[] } | { success: false; error: string }> {
  await requireAdmin();
  const parsed = EmptyActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request parameters" };
  }

  try {
    const provider = new PrintfulProvider();
    const products = await provider.getProducts();
    return { success: true, products };
  } catch (error: unknown) {
    console.error("[printful-admin] Failed to get Printful catalog:", error);
    return {
      success: false,
      error: "Unable to load Printful master catalog",
    };
  }
}

export async function getImportedProductsStatus(
  input?: undefined
): Promise<
  | { success: true; statusMap: Record<string, ImportedProductStatusEntry> }
  | { success: false; error: string; statusMap?: undefined }
> {
  await requireAdmin();
  const parsed = EmptyActionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request parameters" };
  }

  try {
    const importedProducts = await prisma.catalogProduct.findMany({
      include: {
        variants: {
          include: {
            providerVariants: true,
          },
        },
      },
    });

    const statusMap: Record<string, ImportedProductStatusEntry> = {};

    for (const p of importedProducts) {
      let minCostMinor: bigint | null = null;
      let costCurrency = "USD";
      for (const v of p.variants) {
        for (const pv of v.providerVariants) {
          if (pv.costMinor > 0n) {
            if (minCostMinor === null || pv.costMinor < minCostMinor) {
              minCostMinor = pv.costMinor;
              costCurrency = pv.currency || "USD";
            }
          }
        }
      }

      const serializedCostMinor =
        minCostMinor !== null ? minCostMinor.toString() : undefined;
      const formattedCost =
        minCostMinor !== null
          ? formatMinor(minCostMinor, costCurrency)
          : undefined;

      for (const v of p.variants) {
        for (const mapping of v.providerVariants) {
          if (mapping.externalProductId) {
            statusMap[mapping.externalProductId] = {
              id: p.id,
              slug: p.slug,
              status: p.status,
              priceMinor: serializedCostMinor,
              formattedCost,
            };
          }
        }
      }
    }

    return { success: true, statusMap };
  } catch (error: unknown) {
    console.error("[printful-admin] Failed to get imported products status:", error);
    return {
      success: false,
      error: "Unable to load imported product statuses",
    };
  }
}

export async function importPrintfulProductAction(
  productId: string
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAdmin();
  const parsedId = ImportProductInputSchema.safeParse(productId);
  if (!parsedId.success) {
    return { success: false, error: "Invalid Printful product ID" };
  }

  try {
    const syncService = new CatalogSyncService();
    const category = "apparel";
    const slug = `product-${parsedId.data}`;

    await syncService.importCatalogProduct(parsedId.data, category, slug);

    try {
      revalidatePath("/admin/products");
      revalidatePath("/create");
    } catch (revalidateErr: unknown) {
      console.warn("[printful-admin] revalidatePath skipped:", revalidateErr);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("[printful-admin] Failed to import product:", error);
    if (error instanceof PricingValidationError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to import Printful product" };
  }
}

export async function toggleProductStatusAction(
  slug: string,
  currentStatus: string
): Promise<{ success: true; newStatus: "ACTIVE" | "INACTIVE" } | { success: false; error: string }> {
  await requireAdmin();
  const parsed = ToggleProductStatusSchema.safeParse({ slug, currentStatus });
  if (!parsed.success) {
    return { success: false, error: "Invalid product slug or status" };
  }

  try {
    const newStatus = parsed.data.currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await prisma.catalogProduct.update({
      where: { slug: parsed.data.slug },
      data: { status: newStatus },
    });

    try {
      revalidatePath("/admin/products");
      revalidatePath("/create");
    } catch (revalidateErr: unknown) {
      console.warn("[printful-admin] revalidatePath skipped:", revalidateErr);
    }

    return { success: true, newStatus };
  } catch (error: unknown) {
    console.error("[printful-admin] Failed to toggle product status:", error);
    return { success: false, error: "Failed to update product status" };
  }
}
