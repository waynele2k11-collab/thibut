import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readEligibleFontFile } from "@/lib/keepsake-editor/eligible-fonts.server";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FontIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

/**
 * Streams one font file to the keepsake editor. Admin only. The id is looked up in the computed
 * list of eligible fonts; it is never used as a file path.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertAdminApi();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Not authorized" }, { status: error.status });
    }
    // Anything else (a database outage, say) is a server fault, not a sign-in problem. No detail.
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  try {
    const { id } = await params;
    const parsed = FontIdSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: "Font not found" }, { status: 404 });
    }
    const file = await readEligibleFontFile(parsed.data);
    if (!file) {
      return NextResponse.json({ error: "Font not found" }, { status: 404 });
    }
    return new NextResponse(file.bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.bytes.byteLength),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to serve the font" }, { status: 500 });
  }
}
