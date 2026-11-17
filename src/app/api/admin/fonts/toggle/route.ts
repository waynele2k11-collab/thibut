import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  FontLicenseError,
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

const ToggleFontBodySchema = z.object({
  fontId: z.string().trim().min(1).max(128),
  isActive: z.boolean(),
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

    const parsed = ToggleFontBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "fontId (string) and isActive (boolean) are required" },
        { status: 400 }
      );
    }

    const { fontId, isActive } = parsed.data;
    await FontRegistryService.toggleActive(fontId, isActive);

    return NextResponse.json({
      success: true,
      fontId,
      isActive,
      message: `Font ${fontId} is now ${isActive ? "ACTIVE on frontend" : "INACTIVE"}`,
    });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof FontLicenseError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 422 }
      );
    }
    if (error instanceof FontNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to toggle font status" },
      { status: 500 }
    );
  }
}
