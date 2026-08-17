import fs from "fs";
import path from "path";

export class UploadService {
  /**
   * Uploads an image to Vercel Blob (production) or local disk (development) and returns the URL.
   */
  static async uploadBackgroundImage(
    file: File | Blob,
    filename: string,
    userId: string | null = null
  ) {
    // 1. Try Vercel Blob if token is available
    if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        const { url } = await put(`backgrounds/${Date.now()}-${filename}`, file, {
          access: "public",
          addRandomSuffix: true,
        });

        return {
          url,
          success: true,
        };
      } catch (error: any) {
        console.warn("Vercel Blob failed, falling back to local storage:", error.message);
      }
    }

    // 2. Fallback to local storage in public/uploads/backgrounds/
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "backgrounds");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = path.join(uploadDir, safeName);
      
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      const localUrl = `/uploads/backgrounds/${safeName}`;
      return {
        url: localUrl,
        success: true,
      };
    } catch (error: any) {
      console.error("Local storage upload error:", error);
      return {
        url: null,
        success: false,
        error: error.message,
      };
    }
  }
}
