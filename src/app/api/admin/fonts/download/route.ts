import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FontRegistryService } from "@/lib/fonts/FontRegistryService";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

const DownloadFontsBodySchema = z.object({
  fontIds: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
});

export async function POST(request: NextRequest) {
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

    const parsed = DownloadFontsBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Non-empty fontIds array is required" },
        { status: 400 }
      );
    }

    const result = await FontRegistryService.downloadMultipleFonts(
      parsed.data.fontIds
    );

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.successCount} font(s).${
        result.failureCount > 0 ? ` ${result.failureCount} blocked or failed.` : ""
      }`,
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to process font ingestion" },
      { status: 500 }
    );
  }
}
