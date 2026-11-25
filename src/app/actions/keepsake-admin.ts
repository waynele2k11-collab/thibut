"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_FULFILLMENT_STATUSES,
  PRODUCT_STATUSES,
  isValidSlug,
  parseCatalogImagePaths,
  parseMultiplierToBps,
  slugify,
} from "@/lib/catalog/adminInput";
import { PLATFORM_CREATOR_SLUG, isDivisionSlug } from "@/lib/catalog/divisions";
import { sendOrderShippedEmail } from "@/lib/email";
import { parseDecimalDollarsToMinor } from "@/lib/money";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/utils/admin/auth";

/**
 * Catalog administration for the made-to-order storefront (BRD v1.0 §12).
 * Every action re-checks administrator access; results are reported through
 * a `notice` or `error` query parameter on the page the form was submitted from.
 */

function finish(path: string, kind: "notice" | "error", message: string): never {
  revalidatePath("/", "layout");
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

const Uuid = z.string().uuid();

// ── Products and variants ────────────────────────────────────────────────────

export async function updateProductSettingsFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/catalog");
  const productId = Uuid.safeParse(formData.get("productId"));
  const status = z.enum(PRODUCT_STATUSES).safeParse(formData.get("status"));
  const bps = parseMultiplierToBps(String(formData.get("multiplier") ?? ""));
  if (!productId.success || !status.success) {
    finish(path, "error", "Invalid product or status.");
  }
  if (bps === null) {
    finish(path, "error", "Multiplier must be between 1.0 and 3.0, for example 1.6.");
  }

  const product = await prisma.catalogProduct.findUnique({
    where: { id: productId.data },
    include: { variants: { where: { active: true } } },
  });
  if (!product || product.fulfillmentMode !== "IN_HOUSE") {
    finish(path, "error", "Product not found.");
  }
  if (status.data === "ACTIVE" && product.variants.length === 0) {
    finish(path, "error", "Add at least one active size before publishing a product.");
  }

  await prisma.catalogProduct.update({
    where: { id: product.id },
    data: { status: status.data, doubleSidedMultiplierBps: bps },
  });
  finish(path, "notice", `${product.name} updated.`);
}

export async function updateVariantFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/catalog");
  const variantId = Uuid.safeParse(formData.get("variantId"));
  if (!variantId.success) finish(path, "error", "Invalid size.");

  let priceMinor: bigint;
  try {
    priceMinor = parseDecimalDollarsToMinor(String(formData.get("price") ?? ""));
  } catch {
    finish(path, "error", "Enter a price such as 49.00.");
  }
  if (priceMinor <= 0n || priceMinor > 10_000_000n) {
    finish(path, "error", "Price must be between $0.01 and $100,000.");
  }

  const variant = await prisma.catalogVariant.findUnique({
    where: { id: variantId.data },
    include: { product: true },
  });
  if (!variant || variant.product.fulfillmentMode !== "IN_HOUSE") {
    finish(path, "error", "Size not found.");
  }

  await prisma.catalogVariant.update({
    where: { id: variant.id },
    data: {
      baseRetailMinor: priceMinor,
      active: formData.get("active") === "on",
    },
  });
  finish(path, "notice", `${variant.size ?? variant.sku} updated.`);
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function createCategoryFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/catalog/categories");
  const division = String(formData.get("division") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!isDivisionSlug(division) || name.length < 2 || name.length > 80) {
    finish(path, "error", "Choose a division and enter a name of 2 to 80 characters.");
  }
  const slug = `${division}-${slugify(name)}`;
  if (!isValidSlug(slug)) finish(path, "error", "That name cannot be used.");

  const root = await prisma.category.findUnique({ where: { slug: division } });
  if (!root) finish(path, "error", "Division not found. Run the keepsake seed first.");
  if (await prisma.category.findUnique({ where: { slug } })) {
    finish(path, "error", "A category with that name already exists in this division.");
  }
  const last = await prisma.category.findFirst({
    where: { parentId: root.id },
    orderBy: { sortOrder: "desc" },
  });
  await prisma.category.create({
    data: {
      slug,
      name,
      parentId: root.id,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      active: true,
    },
  });
  finish(path, "notice", `${name} added.`);
}

export async function updateCategoryFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/catalog/categories");
  const categoryId = Uuid.safeParse(formData.get("categoryId"));
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = z.coerce
    .number()
    .int()
    .min(0)
    .max(999)
    .safeParse(formData.get("sortOrder"));
  if (!categoryId.success || !sortOrder.success || name.length < 2 || name.length > 80) {
    finish(path, "error", "Enter a name of 2 to 80 characters and an order from 0 to 999.");
  }
  const category = await prisma.category.findUnique({
    where: { id: categoryId.data },
  });
  // Only subcategories are editable; the three divisions are fixed by the storefront routes.
  if (!category || category.parentId === null) {
    finish(path, "error", "Category not found.");
  }
  await prisma.category.update({
    where: { id: category.id },
    data: {
      name,
      sortOrder: sortOrder.data,
      active: formData.get("active") === "on",
    },
  });
  finish(path, "notice", `${name} updated.`);
}

// ── Catalog designs ──────────────────────────────────────────────────────────

export async function saveCatalogDesignFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/catalog/designs");
  const rawId = String(formData.get("designId") ?? "");
  const designId = rawId ? Uuid.safeParse(rawId) : null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = Uuid.safeParse(formData.get("categoryId"));
  const imageKind = z
    .enum(["CONCEPT_RENDER", "PRODUCT_PHOTO"])
    .safeParse(formData.get("imageKind"));
  const images = parseCatalogImagePaths(String(formData.get("images") ?? ""));
  const productIds = z
    .array(Uuid)
    .max(20)
    .safeParse(formData.getAll("productIds").map(String));
  const published = formData.get("published") === "on";

  if (designId && !designId.success) finish(path, "error", "Invalid design.");
  if (title.length < 3 || title.length > 140) {
    finish(path, "error", "Title must be 3 to 140 characters.");
  }
  if (description.length > 1000) {
    finish(path, "error", "Description must be 1,000 characters or fewer.");
  }
  if (!categoryId.success || !imageKind.success || !productIds.success) {
    finish(path, "error", "Choose a category, an image type and valid products.");
  }
  if (!images) {
    finish(
      path,
      "error",
      "List 1 to 8 image paths, one per line, such as /keepsakes/name.webp."
    );
  }
  if (published && productIds.data.length === 0) {
    finish(path, "error", "A published design needs at least one product.");
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId.data },
    include: { parent: true },
  });
  if (!category?.parent || !isDivisionSlug(category.parent.slug)) {
    finish(path, "error", "Choose a subcategory inside Personal, Business or Living.");
  }
  const products = await prisma.catalogProduct.findMany({
    where: { id: { in: productIds.data }, fulfillmentMode: "IN_HOUSE" },
    select: { id: true },
  });
  if (products.length !== productIds.data.length) {
    finish(path, "error", "One of the selected products is not available.");
  }

  const creator = await prisma.creatorProfile.findUnique({
    where: { slug: PLATFORM_CREATOR_SLUG },
  });
  if (!creator) {
    finish(path, "error", "Platform creator missing. Run the keepsake seed first.");
  }

  const existing = designId
    ? await prisma.design.findUnique({ where: { id: designId.data } })
    : null;
  if (designId && (!existing || existing.creatorId !== creator.id)) {
    finish(path, "error", "Design not found.");
  }

  let slug = existing?.slug ?? slugify(String(formData.get("slug") ?? "") || title);
  if (!isValidSlug(slug)) finish(path, "error", "Enter a valid URL name.");
  if (!existing) {
    const clash = await prisma.design.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`.slice(0, 80);
  }

  await prisma.$transaction(async (tx) => {
    const data = {
      title,
      description: description || null,
      categoryId: category.id,
      imageKind: imageKind.data,
      catalogImageUrls: images,
      status: published ? ("PUBLISHED" as const) : ("PAUSED" as const),
      visibility: published ? ("PUBLIC" as const) : ("PRIVATE" as const),
    };
    const design = existing
      ? await tx.design.update({
          where: { id: existing.id },
          data: {
            ...data,
            publishedAt: published ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
          },
        })
      : await tx.design.create({
          data: {
            ...data,
            creatorId: creator.id,
            slug,
            publishedAt: published ? new Date() : null,
          },
        });

    await tx.designVersion.upsert({
      where: { designId_versionNumber: { designId: design.id, versionNumber: 1 } },
      update: {},
      create: { designId: design.id, versionNumber: 1 },
    });
    await tx.designPolicyVersion.upsert({
      where: { designId_versionNumber: { designId: design.id, versionNumber: 1 } },
      update: {},
      create: {
        designId: design.id,
        versionNumber: 1,
        allowName: false,
        allowQuote: false,
        allowTranslation: false,
        allowCalligraphy: false,
        allowBackgroundRemoval: false,
      },
    });
    const licence = await tx.licenseOffer.findFirst({
      where: { designId: design.id, type: "PERSONAL_PRODUCT" },
    });
    if (!licence) {
      await tx.licenseOffer.create({
        data: {
          designId: design.id,
          type: "PERSONAL_PRODUCT",
          priceMinor: 0n,
          currency: "USD",
          active: true,
        },
      });
    }

    // Product compatibility: activate the chosen links, deactivate the rest.
    await tx.designProduct.updateMany({
      where: { designId: design.id, catalogProductId: { notIn: productIds.data } },
      data: { active: false },
    });
    for (const catalogProductId of productIds.data) {
      await tx.designProduct.upsert({
        where: {
          designId_catalogProductId: { designId: design.id, catalogProductId },
        },
        update: { active: true },
        create: {
          designId: design.id,
          catalogProductId,
          active: true,
          defaultPlacement: "front",
        },
      });
    }
  });

  finish(path, "notice", `${title} saved.`);
}

// ── Order fulfilment ─────────────────────────────────────────────────────────

export async function updateOrderFulfillmentFormAction(formData: FormData) {
  await requireAdmin();
  const path = adminPath("/orders");
  const orderId = Uuid.safeParse(formData.get("orderId"));
  const status = z
    .enum(ADMIN_FULFILLMENT_STATUSES)
    .safeParse(formData.get("fulfillmentStatus"));
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();
  const trackingCarrier = String(formData.get("trackingCarrier") ?? "").trim();
  if (!orderId.success || !status.success) {
    finish(path, "error", "Invalid order or status.");
  }
  if (trackingNumber.length > 64 || trackingCarrier.length > 40) {
    finish(path, "error", "Tracking number or carrier is too long.");
  }
  if (status.data === "SHIPPED" && !trackingNumber) {
    finish(path, "error", "Enter a tracking number to mark an order as shipped.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId.data },
    include: { buyer: true },
  });
  if (!order) finish(path, "error", "Order not found.");
  if (order.paymentStatus !== "SUCCEEDED") {
    finish(path, "error", "Only paid orders can move through fulfilment.");
  }
  // Printful-fulfilled orders are driven by the provider webhook, not by hand.
  if (order.externalFulfillmentId) {
    finish(path, "error", "This order is fulfilled by Printful and updates automatically.");
  }

  const wasShipped =
    order.fulfillmentStatus === "SHIPPED" || order.fulfillmentStatus === "DELIVERED";
  await prisma.order.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: status.data,
      trackingNumber: trackingNumber || order.trackingNumber,
      trackingCarrier: trackingCarrier || order.trackingCarrier,
      ...(status.data === "DELIVERED" ? { completedAt: new Date() } : {}),
    },
  });

  let emailNote = "";
  if (status.data === "SHIPPED" && !wasShipped) {
    const email = order.buyer?.email ?? order.buyerEmail ?? null;
    if (email) {
      try {
        const result = await sendOrderShippedEmail({
          email,
          orderNumber: order.orderNumber,
          trackingNumber,
          trackingCarrier: trackingCarrier || null,
        });
        emailNote = result.sent
          ? " Customer notified."
          : " Email is not configured, so the customer was not notified.";
      } catch (error) {
        console.error("[keepsake-admin] shipped email failed:", error);
        emailNote = " The status was saved but the customer email failed.";
      }
    } else {
      emailNote = " No customer email on file.";
    }
  }
  finish(path, "notice", `Order ${order.orderNumber} set to ${status.data.replace(/_/g, " ").toLowerCase()}.${emailNote}`);
}
