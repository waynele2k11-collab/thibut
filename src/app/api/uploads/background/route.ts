import { NextResponse } from "next/server";
import { UploadService } from "@/lib/services/UploadService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Upload to Vercel Blob
    const result = await UploadService.uploadBackgroundImage(file, file.name);

    if (!result.success || !result.url) {
      throw new Error(result.error || "Failed to upload image");
    }

    // Store the asset in the database
    const asset = await prisma.asset.create({
      data: {
        objectKey: result.url,
        mimeType: "image/jpeg",
        sha256: "uploaded-" + Date.now().toString(),
        storageProvider: "vercel-blob",
      }
    });

    return NextResponse.json({ 
      success: true, 
      url: result.url,
      assetId: asset.id 
    });

  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
