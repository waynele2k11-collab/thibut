import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

const GalleryIdSchema = z.string().trim().min(1).max(128);

const SafeImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (val) =>
      (val.startsWith("/") && !val.startsWith("//")) ||
      val.startsWith("https://"),
    "Custom image URL must be a relative path or HTTPS URL"
  );

const PatchGalleryItemSchema = z.object({
  customImageUrl: SafeImageUrlSchema.nullable().optional(),
  published: z.boolean().optional(),
  listedPriceMinor: z
    .union([
      z.number().int().nonnegative().max(100_000_00),
      z.string().regex(/^\d+$/),
    ])
    .optional(),
});

function serializeGalleryItem<T extends { listedPriceMinor: bigint }>(item: T) {
  return {
    ...item,
    listedPriceMinor: item.listedPriceMinor.toString(),
  };
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAdminApi();

    const { id } = await params;
    const parsedId = GalleryIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid gallery item ID" }, { status: 400 });
    }

    const existing = await prisma.galleryItem.findUnique({
      where: { id: parsedId.data },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Gallery item not found" }, { status: 404 });
    }

    await prisma.galleryItem.delete({
      where: { id: parsedId.data },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "[AdminGallery DELETE] Failed to delete gallery item:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to delete gallery item" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAdminApi();

    const { id } = await params;
    const parsedId = GalleryIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ error: "Invalid gallery item ID" }, { status: 400 });
    }

    const rawBody: unknown = await req.json().catch(() => null);
    const parsedBody = PatchGalleryItemSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid update payload" },
        { status: 400 }
      );
    }

    const currentItem = await prisma.galleryItem.findUnique({
      where: { id: parsedId.data },
    });

    if (!currentItem) {
      return NextResponse.json({ error: "Gallery item not found" }, { status: 404 });
    }

    const updateData: Prisma.GalleryItemUpdateInput = {};

    if (parsedBody.data.customImageUrl !== undefined) {
      const existingTransform =
        currentItem.mockupTransform &&
        typeof currentItem.mockupTransform === "object" &&
        !Array.isArray(currentItem.mockupTransform)
          ? { ...(currentItem.mockupTransform as Prisma.JsonObject) }
          : {};
      existingTransform.customImageUrl = parsedBody.data.customImageUrl;
      updateData.mockupTransform = existingTransform;
    }

    if (parsedBody.data.published !== undefined) {
      updateData.published = parsedBody.data.published;
    }

    if (parsedBody.data.listedPriceMinor !== undefined) {
      updateData.listedPriceMinor = BigInt(parsedBody.data.listedPriceMinor);
    }

    const updated = await prisma.galleryItem.update({
      where: { id: parsedId.data },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      item: serializeGalleryItem(updated),
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "[AdminGallery PATCH] Failed to update gallery item:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to update gallery item" },
      { status: 500 }
    );
  }
}
