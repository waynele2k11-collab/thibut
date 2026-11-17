import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

const CreateGalleryRouteSchema = z.object({
  svgBase64: z.string().min(1).max(2_000_000),
  product: z.string().trim().min(1).max(200),
  color: z.string().trim().max(100).optional(),
  mockupUrl: z.string().trim().max(2048).optional(),
  placement: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100).default("NAME"),
  text: z.string().trim().min(1).max(500),
  tradition: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .default("VIETNAMESE_THU_PHAP"),
  interpretation: z
    .object({
      type: z.string().max(100).optional(),
      meaning: z.string().max(1000).optional(),
    })
    .optional(),
  basePriceMinor: z
    .union([
      z.number().int().nonnegative().max(100_000_00),
      z.string().regex(/^\d+$/),
    ])
    .default(3500),
  isApparel: z.boolean().optional().default(true),
  mockupTransform: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    await assertAdminApi();

    const rawBody: unknown = await req.json().catch(() => null);
    const parsed = CreateGalleryRouteSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid gallery item payload" },
        { status: 400 }
      );
    }

    const {
      svgBase64,
      product,
      color,
      mockupUrl,
      category,
      text,
      tradition,
      interpretation,
      basePriceMinor,
      isApparel,
      mockupTransform,
    } = parsed.data;

    const slug = `admin-generated-${Date.now()}`;
    const listedPriceMinor = BigInt(basePriceMinor);

    const title = `"${text}" in ${tradition.replace(/_/g, " ")}`;
    const subtitle = `${interpretation?.type || "Custom"} Edition`;
    const description = `"${text}" rendered in stunning calligraphy. Meaning: ${
      interpretation?.meaning || "N/A"
    }`;

    const galleryItem = await prisma.galleryItem.create({
      data: {
        slug,
        title,
        subtitle,
        description,
        sourceText: text,
        sourceLanguage: "English",
        tradition,
        artworkId: "admin-studio-vector",
        artworkPreviewUrl: svgBase64,
        productionArtworkUrl: svgBase64,
        productType: product,
        productCategory: isApparel ? "apparel" : "accessory",
        productName: product,
        productImageUrl: mockupUrl || "/mockups/model-male.jpg",
        defaultColor: color ?? null,
        availableSizes: [],
        availableColors: color ? [color] : [],
        listedPriceMinor,
        currency: "USD",
        requiresSize: isApparel,
        requiresColor: Boolean(color),
        category,
        published: true,
        mockupTransform: mockupTransform
          ? (mockupTransform as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        ...galleryItem,
        listedPriceMinor: galleryItem.listedPriceMinor.toString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "[AdminGallery Create] Failed to create gallery item:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { error: "Failed to create gallery item" },
      { status: 500 }
    );
  }
}
