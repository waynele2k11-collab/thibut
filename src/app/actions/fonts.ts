"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleFontStatus(fontId: string, enabled: boolean) {
  try {
    await prisma.font.update({
      where: { id: fontId },
      data: { enabled }
    });
    
    // Invalidate the cache for the admin page and the studio
    revalidatePath("/admin/fonts");
    revalidatePath("/create");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle font status:", error);
    return { error: "Failed to update font status" };
  }
}
