import prisma from "@/lib/prisma";
import { createCanvas, loadImage } from "canvas";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export class PrintMasterService {
  /**
   * Generates or retrieves the production-quality, transparent, high-DPI asset 
   * required by Printful for manufacturing.
   */
  public async generatePrintMaster(params: {
    personalizationVersionId: string;
    generatedDesignVariationId: string;
    catalogProductId: string;
    placement: string;
  }) {
    // 1. Fetch the exact print area constraints (width, height, DPI)
    const printArea = await prisma.printArea.findUnique({
      where: {
        catalogProductId_placement: {
          catalogProductId: params.catalogProductId,
          placement: params.placement
        }
      }
    });

    if (!printArea) {
      throw new Error(`No PrintArea configured for Product ${params.catalogProductId} at ${params.placement}`);
    }

    // 2. Fetch the GeneratedDesignVariation to get what we are printing
    const variation = await prisma.generatedDesignVariation.findUnique({
      where: { id: params.generatedDesignVariationId }
    });

    if (!variation) {
      throw new Error(`GeneratedDesignVariation ${params.generatedDesignVariationId} not found`);
    }

    // 3. Create the Production Canvas
    // Printful requires exact pixel dimensions at 300 DPI
    const canvas = createCanvas(printArea.widthPx, printArea.heightPx);
    const ctx = canvas.getContext("2d");

    // Make it fully transparent
    ctx.clearRect(0, 0, printArea.widthPx, printArea.heightPx);

    // In a real scenario, we load the SVG asset here:
    // const image = await loadImage(`https://storage.thibut.com/${asset.objectKey}`);
    // But for MVP, we will render the calligraphy directly onto the canvas using text
    
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Calculate a font size that fits nicely into the safe area
    // If it's a huge 3600x4800 canvas, we might need an 800px font
    const fontSize = Math.floor(printArea.safeWidthPx / variation.renderedText.length);
    ctx.font = `${fontSize}px Arial, sans-serif`;

    ctx.fillText(
      variation.renderedText,
      printArea.widthPx / 2,
      printArea.heightPx / 2
    );

    // Add a signature/stamp (Thi Bút aesthetic)
    ctx.fillStyle = "#B3261E"; // Vermilion red
    ctx.fillRect(
      (printArea.widthPx / 2) + (printArea.safeWidthPx / 3),
      (printArea.heightPx / 2) + (printArea.safeHeightPx / 4),
      150, 150
    );

    // 4. Export to PNG Buffer
    const buffer = canvas.toBuffer("image/png");

    // Compute SHA256 for integrity
    const hashSum = crypto.createHash("sha256");
    hashSum.update(buffer);
    const sha256 = hashSum.digest("hex");

    // 5. Save to local disk for MVP (simulating Vercel Blob)
    const fileName = `print-master-${params.personalizationVersionId}.png`;
    const mockStoragePath = path.join(process.cwd(), "public", "mock-storage");
    if (!fs.existsSync(mockStoragePath)) {
      fs.mkdirSync(mockStoragePath, { recursive: true });
    }
    fs.writeFileSync(path.join(mockStoragePath, fileName), buffer);

    // 6. Register the Asset
    const mockPrintMasterAsset = await prisma.asset.create({
      data: {
        objectKey: `mock-storage/${fileName}`,
        mimeType: "image/png",
        sha256: sha256,
        width: printArea.widthPx,
        height: printArea.heightPx,
        sizeBytes: buffer.length,
        storageProvider: "local"
      }
    });

    // 3. Freeze the PrintMaster reference on the PersonalizationVersion
    await prisma.personalizationVersion.update({
      where: { id: params.personalizationVersionId },
      data: {
        printAssetId: mockPrintMasterAsset.id
      }
    });

    return mockPrintMasterAsset;
  }
}
