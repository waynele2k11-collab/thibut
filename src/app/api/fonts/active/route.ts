import { NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeFonts = await FontRegistryService.getActiveFrontendFonts();

    const fonts = activeFonts.map((f) => ({
      id: f.id,
      name: f.name,
      familyName: f.familyName,
      category: f.category,
      categoryLabel: f.categoryLabel,
      fileName: f.fileName,
      previewText: f.previewText,
      description: f.description,
    }));

    return NextResponse.json({
      success: true,
      fonts,
    });
  } catch {
    return NextResponse.json({ success: false, fonts: [] }, { status: 500 });
  }
}
