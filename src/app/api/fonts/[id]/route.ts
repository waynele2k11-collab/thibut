import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  FontLicenseError,
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";

export const runtime = "nodejs";

const FontIdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/, "Invalid font identifier"),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rawParams = await params;
    const parsed = FontIdParamSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid font identifier" },
        { status: 400 }
      );
    }

    const resolved = await FontRegistryService.resolveWebEmbedFont(
      parsed.data.id
    );

    const bodyCopy = new Uint8Array(resolved.buffer.byteLength);
    bodyCopy.set(resolved.buffer);

    return new NextResponse(bodyCopy.buffer, {
      status: 200,
      headers: {
        "Content-Type": resolved.mimeType,
        "Content-Length": String(bodyCopy.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    if (error instanceof FontLicenseError) {
      return NextResponse.json(
        { error: "Font is not licensed or enabled for web embedding" },
        { status: 403 }
      );
    }
    if (error instanceof FontNotFoundError) {
      return NextResponse.json(
        { error: "Font not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to serve font binary" },
      { status: 500 }
    );
  }
}
