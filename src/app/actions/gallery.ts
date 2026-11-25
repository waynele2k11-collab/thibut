"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { MAX_UPLOAD_BYTES, UploadService } from "@/lib/services/UploadService";
import { assertAdminApi, requireAdmin } from "@/utils/admin/auth";

const CreateGalleryFormSchema = z.object({
  designId: z.string().trim().min(1, "Design is required").max(128),
  catalogProductId: z
    .string()
    .trim()
    .min(1, "Catalog product is required")
    .max(128),
  category: z.string().trim().max(80).optional().default("NAME"),
  status: z.enum(["active", "draft"]).optional().default("draft"),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid USD amount")
    .optional(),
  title: z.string().trim().max(200).optional(),
  subtitle: z.string().trim().max(500).optional(),
});

const GalleryItemIdSchema = z.string().trim().min(1).max(128);

function getStringField(
  formData: FormData,
  key: string
): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseUsdToMinorBigInt(priceStr: string | undefined): bigint {
  if (!priceStr) return 3500n;
  const [dollarsPart = "0", centsPart = ""] = priceStr.split(".");
  const paddedCents = `${centsPart}00`.slice(0, 2);
  return BigInt(dollarsPart) * 100n + BigInt(paddedCents);
}

export async function createGalleryItem(
  formData: FormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = await requireAdmin();

  const parsedFields = CreateGalleryFormSchema.safeParse({
    designId: getStringField(formData, "designId") ?? "",
    catalogProductId: getStringField(formData, "catalogProductId") ?? "",
    category: getStringField(formData, "category"),
    status: getStringField(formData, "status"),
    price: getStringField(formData, "price"),
    title: getStringField(formData, "title"),
    subtitle: getStringField(formData, "subtitle"),
  });

  if (!parsedFields.success) {
    return {
      success: false,
      error:
        parsedFields.error.issues[0]?.message ?? "Invalid gallery form input",
    };
  }

  const imageEntry = formData.get("productImage");
  if (!(imageEntry instanceof File) || imageEntry.size === 0) {
    return {
      success: false,
      error: "Product mockup image is required.",
    };
  }

  if (imageEntry.size > MAX_UPLOAD_BYTES) {
    return {
      success: false,
      error: "Product mockup image exceeds 10MB size limit.",
    };
  }

  try {
    const rawBuffer = Buffer.from(await imageEntry.arrayBuffer());
    const sniffed = UploadService.sniffImageMagicBytes(rawBuffer);
    if (!sniffed) {
      return {
        success: false,
        error:
          "Invalid image file signature. Only PNG, JPEG, and WEBP images are allowed.",
      };
    }

    const {
      designId,
      catalogProductId,
      category,
      status,
      price,
      title,
      subtitle,
    } = parsedFields.data;

    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        versions: {
          include: { assets: { include: { asset: true } } },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    const product = await prisma.catalogProduct.findUnique({
      where: { id: catalogProductId },
      include: {
        variants: {
          where: { active: true },
        },
      },
    });

    if (!design || !product) {
      return { success: false, error: "Design or product not found." };
    }

    const uploadRes = await UploadService.uploadImage(
      rawBuffer,
      imageEntry.name,
      "gallery-mockups"
    );

    if (
      !uploadRes.success ||
      !uploadRes.objectKey ||
      !uploadRes.mimeType ||
      !uploadRes.sha256 ||
      !uploadRes.storageProvider
    ) {
      return {
        success: false,
        error: uploadRes.error ?? "Failed to upload product image.",
      };
    }

    const mockupAsset = await prisma.asset.create({
      data: {
        objectKey: uploadRes.objectKey,
        mimeType: uploadRes.mimeType,
        sha256: uploadRes.sha256,
        width: uploadRes.width ?? null,
        height: uploadRes.height ?? null,
        sizeBytes: uploadRes.sizeBytes ?? null,
        storageProvider: uploadRes.storageProvider,
        ownerId: admin.id,
        visibility: "PUBLIC",
      },
    });

    const productImageUrl = `/api/uploads/background?assetId=${encodeURIComponent(
      mockupAsset.id
    )}`;

    const latestVersion = design.versions[0];
    let artworkPreviewUrl = "";
    let productionArtworkUrl = "";

    if (latestVersion && latestVersion.assets.length > 0) {
      const previewAsset = latestVersion.assets.find(
        (a) => a.type === "PREVIEW"
      )?.asset;
      const originalAsset = latestVersion.assets.find(
        (a) => a.type === "ORIGINAL"
      )?.asset;

      artworkPreviewUrl =
        previewAsset?.objectKey || originalAsset?.objectKey || "";
      productionArtworkUrl =
        originalAsset?.objectKey || previewAsset?.objectKey || "";
    }

    const availableSizes = Array.from(
      new Set(
        product.variants
          .map((v) => v.size?.trim())
          .filter((s): s is string => Boolean(s))
      )
    );
    const availableColors = Array.from(
      new Set(
        product.variants
          .map((v) => v.color?.trim())
          .filter((c): c is string => Boolean(c))
      )
    );
    const defaultColor = availableColors[0] ?? null;

    const slugBase = (title || design.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${slugBase || "gallery-item"}-${Date.now()
      .toString()
      .slice(-6)}`;

    const listedPriceMinor = parseUsdToMinorBigInt(price);

    const galleryItem = await prisma.galleryItem.create({
      data: {
        slug,
        title: title || design.title,
        subtitle: subtitle || design.description || null,
        description: design.description,
        sourceText: design.title,
        sourceLanguage: "VI",
        tradition: "VIETNAMESE_THU_PHAP",
        artworkId: design.id,
        artworkPreviewUrl,
        productionArtworkUrl,
        productType: product.id,
        productName: product.name,
        productImageUrl,
        listedPriceMinor,
        currency: "USD",
        requiresSize: availableSizes.length > 0,
        requiresColor: availableColors.length > 0,
        defaultColor,
        availableSizes,
        availableColors,
        category: category || "NAME",
        productCategory: product.category || "APPAREL",
        published: status === "active",
        purchasable: true,
      },
    });

    await prisma.designProduct.upsert({
      where: {
        designId_catalogProductId: {
          designId: design.id,
          catalogProductId: product.id,
        },
      },
      create: {
        designId: design.id,
        catalogProductId: product.id,
        active: status === "active",
      },
      update: {
        active: status === "active",
      },
    });

    revalidatePath(adminPath("/gallery"));
    revalidatePath("/gallery");

    return { success: true, id: galleryItem.id };
  } catch (error: unknown) {
    console.error(
      "[GalleryActions] Failed to create gallery item:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return {
      success: false,
      error: "Failed to create gallery item.",
    };
  }
}

export async function getGalleryItemById(id: string) {
  const parsedId = GalleryItemIdSchema.safeParse(id);
  if (!parsedId.success) {
    return null;
  }

  let isAdmin = false;
  try {
    await assertAdminApi();
    isAdmin = true;
  } catch {
    isAdmin = false;
  }

  try {
    return await prisma.galleryItem.findFirst({
      where: isAdmin
        ? { id: parsedId.data }
        : { id: parsedId.data, published: true },
    });
  } catch (error: unknown) {
    console.error(
      "[GalleryActions] Error fetching gallery item:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return null;
  }
}
