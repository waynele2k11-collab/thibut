import "server-only";
import { NextResponse } from "next/server";
import {
  enforceDistributedRateLimit,
  RateLimitError,
} from "@/lib/security/rate-limit";
import {
  DigitalDownloadHttpError,
  resolveDigitalDownloadArtifact,
  verifyDownloadRequestToken,
} from "@/lib/services/DigitalDownloadService";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const claims = await verifyDownloadRequestToken(searchParams.get("token"));

    await enforceDistributedRateLimit({
      bucket: "digital-download",
      key: claims.orderItemId,
      limit: 20,
      windowMs: 10 * 60_000,
    });

    const { pngBuffer, fileName } =
      await resolveDigitalDownloadArtifact(claims);

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: unknown) {
    if (err instanceof DigitalDownloadHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many download requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(err.retryAfterSeconds) },
        }
      );
    }

    console.error("[Download API] Failed to serve print master:", err);
    return NextResponse.json(
      { error: "Unable to generate download artifact" },
      { status: 500 }
    );
  }
}
