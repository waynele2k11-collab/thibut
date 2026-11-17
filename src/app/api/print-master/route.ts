import { NextResponse } from "next/server";
import {
  AssetResolutionError,
  FontLicenseError,
  FontNotFoundError,
  GlyphCoverageError,
  PrintMasterHttpError,
  authorizeAndParsePrintMasterRequest,
  generatePrintMasterPng,
} from "@/lib/print-generator";
import { AdminAuthError, assertAdminApi } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-fulfillment-signature");

    const composition = await authorizeAndParsePrintMasterRequest({
      rawBody,
      signatureHeader,
      assertAdminFn: () => assertAdminApi(),
    });

    const pngBuffer = await generatePrintMasterPng(composition);

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition":
          'attachment; filename="thi_but_print_master.png"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    if (error instanceof PrintMasterHttpError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (
      error instanceof FontLicenseError ||
      error instanceof FontNotFoundError ||
      error instanceof GlyphCoverageError ||
      error instanceof AssetResolutionError
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Failed to generate print master" },
      { status: 500 }
    );
  }
}
