import { NextResponse } from "next/server";
import { BackgroundGenerationService } from "@/lib/services/BackgroundGenerationService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { presetKey, mood, palette, intensity, userNote, compositionId } = body;

    if (!presetKey) {
      return NextResponse.json({ error: "presetKey is required" }, { status: 400 });
    }

    const result = await BackgroundGenerationService.generatePresetBackground({
      presetKey,
      mood,
      palette,
      intensity,
      userNote,
      compositionId
    });

    if (!result.success || !result.url) {
      throw new Error(result.error || "Failed to generate background");
    }

    // Store the generated asset in the DB
    const asset = await prisma.asset.create({
      data: {
        objectKey: result.url,
        mimeType: "image/jpeg",
        sha256: "generated-" + Date.now().toString(),
        storageProvider: "fal-ai",
      }
    });

    // Record the generation
    const generatedBg = await prisma.generatedBackground.create({
      data: {
        compositionId,
        presetKey,
        mood,
        palette,
        intensity,
        promptNote: userNote,
        provider: "fal-ai",
        model: "flux/schnell",
        assetId: asset.id
      }
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      generatedBackgroundId: generatedBg.id,
      assetId: asset.id
    });

  } catch (error: any) {
    console.error("Background generate route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
