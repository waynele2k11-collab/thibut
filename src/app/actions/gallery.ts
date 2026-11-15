"use server";

import prisma from "@/lib/prisma";
import { UploadService } from "@/lib/services/UploadService";
import { revalidatePath } from "next/cache";

export async function createGalleryItem(formData: FormData) {
  try {
    const designId = formData.get("designId") as string;
    const catalogProductId = formData.get("catalogProductId") as string;
    const category = formData.get("category") as string;
    const status = formData.get("status") as string;
    const priceStr = formData.get("price") as string;
    const imageFile = formData.get("productImage") as File;
    const title = formData.get("title") as string;
    const subtitle = formData.get("subtitle") as string;
    
    if (!designId || !catalogProductId || !imageFile) {
      return { success: false, error: "Missing required fields or image." };
    }

    // 1. Fetch related data
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        versions: {
          include: { assets: { include: { asset: true } } },
          orderBy: { versionNumber: "desc" },
          take: 1
        }
      }
    });

    const product = await prisma.catalogProduct.findUnique({
      where: { id: catalogProductId }
    });

    if (!design || !product) {
      return { success: false, error: "Design or product not found." };
    }

    // 2. Upload Mockup Image
    const uploadRes = await UploadService.uploadImage(imageFile, imageFile.name, "gallery-mockups");
    if (!uploadRes.success || !uploadRes.url) {
      return { success: false, error: "Failed to upload product image: " + uploadRes.error };
    }

    // 3. Determine artwork URLs (fallback to dummy or empty if not available in DB structure)
    const latestVersion = design.versions?.[0];
    let artworkPreviewUrl = "";
    let productionArtworkUrl = "";
    
    if (latestVersion && latestVersion.assets && latestVersion.assets.length > 0) {
      // Find a working asset or preview
      const previewAsset = latestVersion.assets.find(a => a.type === "PREVIEW")?.asset;
      const originalAsset = latestVersion.assets.find(a => a.type === "ORIGINAL")?.asset;
      
      artworkPreviewUrl = previewAsset?.objectKey || originalAsset?.objectKey || "";
      productionArtworkUrl = originalAsset?.objectKey || previewAsset?.objectKey || "";
    }

    // Prepare slug
    const slugBase = (title || design.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

    // 4. Create GalleryItem
    const galleryItem = await prisma.galleryItem.create({
      data: {
        slug,
        title: title || design.title,
        subtitle: subtitle || design.description || null,
        description: design.description,
        
        sourceText: design.title,
        sourceLanguage: "VI", // Defaulting, could be improved
        tradition: "VIETNAMESE_THU_PHAP",
        
        artworkId: design.id,
        artworkPreviewUrl,
        productionArtworkUrl,
        
        productType: product.id,
        productName: product.name,
        productImageUrl: uploadRes.url,
        
        listedPriceCents: priceStr ? Math.floor(parseFloat(priceStr) * 100) : 3500, // Default to $35.00
        currency: "USD",
        
        requiresSize: product.sizes.length > 0,
        requiresColor: product.colors.length > 0,
        defaultColor: product.defaultColor,
        availableSizes: product.sizes,
        availableColors: product.colors.map(c => c.name),
        
        category: category || "NAME",
        productCategory: product.category || "APPAREL",
        
        published: status === "active",
        purchasable: true,
      }
    });

    // Also create the DesignProduct linkage just in case it's used elsewhere
    await prisma.designProduct.upsert({
      where: {
        designId_catalogProductId: {
          designId: design.id,
          catalogProductId: product.id,
        }
      },
      create: {
        designId: design.id,
        catalogProductId: product.id,
        active: status === "active",
      },
      update: {
        active: status === "active",
      }
    });

    revalidatePath("/admin/gallery");
    revalidatePath("/gallery");
    
    return { success: true, id: galleryItem.id };
  } catch (error: any) {
    console.error("Failed to create gallery item:", error);
    return { success: false, error: error.message };
  }
}

export async function getGalleryItemById(id: string) {
  try {
    const item = await prisma.galleryItem.findUnique({
      where: { id }
    });
    return item;
  } catch (error) {
    console.error("Error fetching gallery item:", error);
    return null;
  }
}
