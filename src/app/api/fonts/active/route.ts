import { NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";

export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const staticFonts = FontRegistryService.getActiveFrontendFonts();
    
    // Fetch active local fonts from database
    const dbFonts = await prisma.font.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" }
    });

    const localFonts = dbFonts.map(dbFont => ({
      id: dbFont.id,
      name: dbFont.name,
      category: dbFont.tradition || "VIETNAMESE_THU_PHAP",
      categoryLabel: "Vietnamese Thư Pháp",
      fileName: dbFont.fileName,
      previewText: "Thi Bút",
      description: "Custom local font imported via archive extraction.",
    }));

    const allActiveFonts = [
      ...staticFonts.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        categoryLabel: f.categoryLabel,
        fileName: f.fileName,
        previewText: f.previewText,
        description: f.description,
      })),
      ...localFonts
    ];

    return NextResponse.json({
      success: true,
      fonts: allActiveFonts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, fonts: [] }, { status: 500 });
  }
}
