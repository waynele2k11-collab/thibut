import { NextRequest, NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { requireAdmin } from "@/utils/admin/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const fonts = FontRegistryService.getAllFonts();
    return NextResponse.json({
      success: true,
      fonts,
      total: fonts.length,
      downloadedCount: fonts.filter((f) => f.isDownloaded).length,
      activeCount: fonts.filter((f) => f.isActiveOnFrontend).length,
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
