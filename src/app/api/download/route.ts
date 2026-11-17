import "server-only";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  adaptLegacyComposition,
  generatePrintMasterPng,
} from "@/lib/print-generator";
import {
  SecurityConfigError,
  TokenVerificationError,
  verifyDownloadToken,
} from "@/lib/security/tokens";

const DownloadQuerySchema = z.object({
  token: z.string().trim().min(1).max(4096),
});

const ALLOWED_BLOB_HOST_SUFFIXES = [
  ".public.blob.vercel-storage.com",
  ".blob.vercel-storage.com",
  ".supabase.co",
];

const ALLOWED_BLOB_HOSTS = new Set<string>(["storage.thibut.com"]);

function isAllowedStoredAssetHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (ALLOWED_BLOB_HOSTS.has(lower)) return true;
  return ALLOWED_BLOB_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

async function tryLoadStoredPrintAsset(
  objectKey: string,
  storageProvider: string
): Promise<Buffer | null> {
  if (!objectKey || storageProvider === "memory") {
    return null;
  }

  const trimmed = objectKey.trim();
  if (trimmed.startsWith("/")) {
    const publicRoot = path.resolve(process.cwd(), "public");
    const candidatePath = path.resolve(publicRoot, trimmed.slice(1));
    if (!candidatePath.startsWith(publicRoot + path.sep)) {
      return null;
    }
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return fs.readFileSync(candidatePath);
    }
    return null;
  }

  if (trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol === "https:" &&
        isAllowedStoredAssetHost(parsed.hostname)
      ) {
        const res = await fetch(parsed.toString(), {
          redirect: "error",
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          return Buffer.from(await res.arrayBuffer());
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get("token");

  const parsedQuery = DownloadQuerySchema.safeParse({ token: rawToken ?? "" });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Missing download token" },
      { status: 400 }
    );
  }

  let claims: { orderItemId: string; orderId: string };
  try {
    claims = await verifyDownloadToken(parsedQuery.data.token);
  } catch (err: unknown) {
    if (err instanceof SecurityConfigError) {
      return NextResponse.json(
        { error: "Download verification is not configured" },
        { status: 503 }
      );
    }
    if (err instanceof TokenVerificationError) {
      return NextResponse.json(
        { error: "Invalid or expired download token" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Invalid download token" },
      { status: 401 }
    );
  }

  try {
    // Load strictly from OrderItem -> Order + frozen PersonalizationVersion (INV-003).
    // NEVER read mutable PersonalizationSession.compositionJson!
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: claims.orderItemId },
      include: {
        order: true,
        personalizationVersion: {
          include: {
            printAsset: true,
          },
        },
      },
    });

    if (
      !orderItem ||
      !orderItem.order ||
      orderItem.order.id !== claims.orderId
    ) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }

    const { order, personalizationVersion } = orderItem;

    if (
      order.paymentStatus !== "SUCCEEDED" ||
      order.status === "REFUNDED" ||
      order.status === "PARTIALLY_REFUNDED" ||
      order.status === "CANCELLED"
    ) {
      return NextResponse.json(
        { error: "Order is not eligible for digital download" },
        { status: 403 }
      );
    }

    if (!personalizationVersion) {
      return NextResponse.json(
        { error: "Frozen personalization snapshot not found" },
        { status: 404 }
      );
    }

    let pngBuffer: Buffer | null = null;

    if (personalizationVersion.printAsset?.objectKey) {
      pngBuffer = await tryLoadStoredPrintAsset(
        personalizationVersion.printAsset.objectKey,
        personalizationVersion.printAsset.storageProvider
      );
    }

    if (!pngBuffer) {
      const frozenComposition = adaptLegacyComposition(
        personalizationVersion.styleSnapshot
      );
      pngBuffer = await generatePrintMasterPng(frozenComposition);
    }

    const safeOrderNumber = order.orderNumber.replace(/[^A-Za-z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="ThiBut_Master_${safeOrderNumber}.png"`,
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Stored personalization snapshot is invalid" },
        { status: 422 }
      );
    }
    console.error("[Download API] Failed to serve print master:", err);
    return NextResponse.json(
      { error: "Unable to generate download artifact" },
      { status: 500 }
    );
  }
}
