import { put } from "@vercel/blob";

export class UploadService {
  /**
   * Uploads an image to Vercel Blob and returns the URL.
   */
  static async uploadBackgroundImage(
    file: File | Blob,
    filename: string,
    userId: string | null = null
  ) {
    try {
      // Vercel blob expects a filename and standard options. 
      // We set access to "public" but we treat it as private conceptually via obfuscated URLs 
      // since vercel blob doesn't have strict "private" without auth tokens.
      // For V0.1 MVP, we just upload to blob.
      
      const { url } = await put(`backgrounds/${Date.now()}-${filename}`, file, {
        access: "public",
        addRandomSuffix: true,
      });

      return {
        url,
        success: true,
      };
    } catch (error: any) {
      console.error("Upload error:", error);
      return {
        url: null,
        success: false,
        error: error.message,
      };
    }
  }
}
