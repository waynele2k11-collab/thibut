import { NextRequest, NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { requireAdmin } from "@/utils/admin/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const staticFonts = FontRegistryService.getAllFonts();
    
    // Fetch newly imported local fonts from database
    const dbFonts = await prisma.font.findMany({
      orderBy: { name: "asc" }
    });

    const localFonts = dbFonts.map(dbFont => ({
      id: dbFont.id,
      name: dbFont.name,
      category: dbFont.tradition || "VIETNAMESE_THU_PHAP",
      categoryLabel: "Vietnamese Thư Pháp",
      fileName: dbFont.fileName,
      previewText: "Thi Bút",
      sourceUrl: "Local Import",
      sourceLabel: "Local Extraction",
      downloadUrl: "",
      isZipArchive: false,
      license: "Local Archive",
      commercialApproved: true,
      licenseVerifiedAt: new Date().toISOString().split("T")[0],
      description: "Custom local font imported via archive extraction.",
      isDownloaded: true,
      isActiveOnFrontend: dbFont.enabled,
      base64Data: FontRegistryService.getBase64(dbFont.fileName)
    }));

    const allFonts = [...staticFonts, ...localFonts];

    return NextResponse.json({
      success: true,
      fonts: allFonts,
      total: allFonts.length,
      downloadedCount: allFonts.filter((f) => f.isDownloaded).length,
      activeCount: allFonts.filter((f) => f.isActiveOnFrontend).length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { fontId } = await request.json();
    if (!fontId) {
      return NextResponse.json({ success: false, error: "fontId required" }, { status: 400 });
    }

    if (fontId.includes("-") && fontId.length > 20) {
      // Prisma Font
      const dbFont = await prisma.font.findUnique({ where: { id: fontId } });
      if (!dbFont) {
        return NextResponse.json({ success: false, error: "Font not found in DB" }, { status: 404 });
      }
      
      const fontPath = path.join(process.cwd(), "public", "fonts", dbFont.fileName);
      if (fs.existsSync(fontPath)) {
        fs.unlinkSync(fontPath);
      }
      
      await prisma.font.delete({ where: { id: fontId } });
      
      return NextResponse.json({
        success: true,
        message: `Font ${dbFont.name} removed from disk and database`,
      });
    } else {
      // Static Font
      const fonts = FontRegistryService.getAllFonts();
      const font = fonts.find((f) => f.id === fontId);
      if (!font) {
        return NextResponse.json({ success: false, error: "Font not found" }, { status: 404 });
      }

      // Delete font file if exists
      const fontPath = path.join(process.cwd(), "public", "fonts", font.fileName);
      if (fs.existsSync(fontPath)) {
        fs.unlinkSync(fontPath);
      }

      // Deactivate in registry
      FontRegistryService.toggleActive(fontId, false);

      return NextResponse.json({
        success: true,
        message: `Font ${font.name} removed from disk and deactivated`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
