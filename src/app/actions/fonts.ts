"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/utils/admin/auth";
import {
  FontLicenseError,
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";

const ToggleFontStatusSchema = z.object({
  fontId: z.string().trim().min(1).max(128),
  enabled: z.boolean(),
});

export async function toggleFontStatus(
  fontId: string,
  enabled: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  // Enforce authenticated ADMIN role (redirecting unauthenticated callers)
  await requireAdmin();

  const parsed = ToggleFontStatusSchema.safeParse({ fontId, enabled });
  if (!parsed.success) {
    return { success: false, error: "Invalid font toggle parameters" };
  }

  try {
    await FontRegistryService.toggleActive(
      parsed.data.fontId,
      parsed.data.enabled
    );

    revalidatePath(adminPath("/fonts"));
    revalidatePath("/create");

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof FontLicenseError || error instanceof FontNotFoundError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update font status" };
  }
}
