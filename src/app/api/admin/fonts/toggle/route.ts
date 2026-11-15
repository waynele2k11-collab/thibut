import { NextRequest, NextResponse } from "next/server";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { requireAdmin } from "@/utils/admin/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { fontId, isActive } = body;

    if (!fontId || typeof isActive !== "boolean") {
      return NextResponse.json({ success: false, error: "fontId and isActive (boolean) required" }, { status: 400 });
    }

    // Simple check if it's a Prisma UUID (contains hyphens)
    if (fontId.includes("-") && fontId.length > 20) {
      await prisma.font.update({
        where: { id: fontId },
        data: { enabled: isActive }
      });
    } else {
      FontRegistryService.toggleActive(fontId, isActive);
    }

    return NextResponse.json({
      success: true,
      fontId,
      isActive,
      message: `Font ${fontId} is now ${isActive ? "ACTIVE on frontend" : "INACTIVE"}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
