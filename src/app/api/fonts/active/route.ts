import { NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeFonts = FontRegistryService.getActiveFrontendFonts();
    return NextResponse.json({
      success: true,
      fonts: activeFonts.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        categoryLabel: f.categoryLabel,
        fileName: f.fileName,
        previewText: f.previewText,
        description: f.description,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, fonts: [] }, { status: 500 });
  }
}
