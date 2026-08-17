import { NextRequest, NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { requireAdmin } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { fontIds } = body;

    if (!fontIds || !Array.isArray(fontIds) || fontIds.length === 0) {
      return NextResponse.json({ success: false, error: "fontIds array required" }, { status: 400 });
    }

    const result = await FontRegistryService.downloadMultipleFonts(fontIds);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Downloaded ${result.successCount} font(s). ${result.failureCount > 0 ? `${result.failureCount} failed.` : ""}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
