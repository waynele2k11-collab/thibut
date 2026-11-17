import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

const DeleteFontBodySchema = z.object({
  fontId: z.string().trim().min(1).max(128),
});

export async function GET() {
  try {
    await assertAdminApi();
    const allFonts = await FontRegistryService.getAllFonts({
      includeBase64: true,
    });

    return NextResponse.json({
      success: true,
      fonts: allFonts,
      total: allFonts.length,
      downloadedCount: allFonts.filter((f) => f.isDownloaded).length,
      activeCount: allFonts.filter((f) => f.isActiveOnFrontend).length,
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to load font registry" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await assertAdminApi();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const parsed = DeleteFontBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Valid fontId is required" },
        { status: 400 }
      );
    }

    const deactivated = await FontRegistryService.deactivateFont(
      parsed.data.fontId
    );

    return NextResponse.json({
      success: true,
      message: `Font "${deactivated.name}" deactivated in registry`,
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof FontNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to deactivate font" },
      { status: 500 }
    );
  }
}
