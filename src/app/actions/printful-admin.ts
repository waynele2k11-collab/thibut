"use server";

import prisma from "@/lib/prisma";
import { PrintfulProvider } from "@/lib/fulfillment/PrintfulProvider";
import { CatalogSyncService } from "@/lib/services/CatalogSyncService";
import { revalidatePath } from "next/cache";

export async function getPrintfulMasterCatalog() {
  try {
    const provider = new PrintfulProvider();
    const products = await provider.getProducts();
    return { success: true, products };
  } catch (error: any) {
    console.error("Failed to get Printful catalog:", error);
    return { success: false, error: error.message };
  }
}

export async function getImportedProductsStatus() {
  try {
    const importedProducts = await prisma.catalogProduct.findMany({
      include: {
        variants: {
          include: {
            providerVariants: true
          }
        }
      }
    });

    const statusMap: Record<string, { id: string, slug: string, status: string, priceMinor?: number }> = {};

    for (const p of importedProducts) {
      // Find lowest variant Printful cost for this product
      const prices = p.variants.flatMap(v => v.providerVariants.map(pv => Number(pv.costMinor))).filter(cost => !isNaN(cost) && cost > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

      for (const v of p.variants) {
        for (const mapping of v.providerVariants) {
          if (mapping.externalProductId) {
            statusMap[mapping.externalProductId] = {
              id: p.id,
              slug: p.slug,
              status: p.status,
              priceMinor: minPrice
            };
          }
        }
      }
    }

    return { success: true, statusMap };
  } catch (error: any) {
    console.error("Failed to get imported products status:", error);
    return { success: false, error: error.message };
  }
}

export async function importPrintfulProductAction(productId: string) {
  try {
    const syncService = new CatalogSyncService();
    const category = "apparel"; // default
    const slug = `product-${productId}`;
    const defaultRetailPriceMinor = 2500; 

    await syncService.importCatalogProduct(parseInt(productId), category, slug, defaultRetailPriceMinor);
    try {
      revalidatePath("/admin/products");
      revalidatePath("/create");
    } catch (e) {
      console.warn("revalidatePath failed, skipping:", e);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to import product:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleProductStatusAction(slug: string, currentStatus: string) {
  try {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await prisma.catalogProduct.update({
      where: { slug },
      data: { status: newStatus }
    });
    try {
      revalidatePath("/admin/products");
      revalidatePath("/create");
    } catch (e) {
      console.warn("revalidatePath failed, skipping:", e);
    }
    return { success: true, newStatus };
  } catch (error: any) {
    console.error("Failed to toggle product status:", error);
    return { success: false, error: error.message };
  }
}
