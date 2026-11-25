"use server";

import { adminPath } from "@/lib/admin-path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/utils/admin/auth";

const PresetIdSchema = z.string().trim().min(1, "Preset ID is required").max(128);

const PresetUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.string().trim().min(1, "Category is required").max(80),
  description: z.string().max(1000).optional().default(""),
  promptTemplate: z
    .string()
    .trim()
    .min(1, "Prompt template is required")
    .max(4000),
  defaultMood: z.string().max(120).optional().default(""),
  defaultPalette: z.string().max(120).optional().default(""),
  defaultIntensity: z.string().max(120).optional().default(""),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(-10000).max(10000),
});

const PresetCreateSchema = PresetUpdateSchema.extend({
  key: z
    .string()
    .trim()
    .min(1, "Unique key is required")
    .max(80)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Key may contain only letters, numbers, hyphens, and underscores"
    ),
});

const PresetToggleSchema = z.object({
  id: PresetIdSchema,
  enabled: z.boolean(),
});

export type PresetCreateInput = z.input<typeof PresetCreateSchema>;
export type PresetUpdateInput = z.input<typeof PresetUpdateSchema>;

export async function createPreset(
  data: PresetCreateInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const parsed = PresetCreateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid preset input",
    };
  }

  try {
    await prisma.backgroundPreset.create({
      data: parsed.data,
    });
    revalidatePath(adminPath("/background-presets"));
    return { success: true };
  } catch (error: unknown) {
    console.error(
      "[AdminBackgroundPresets] Failed to create preset:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { success: false, error: "Failed to create background preset" };
  }
}

export async function updatePreset(
  id: string,
  data: PresetUpdateInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const parsedId = PresetIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: "Invalid preset ID" };
  }

  const parsedData = PresetUpdateSchema.safeParse(data);
  if (!parsedData.success) {
    return {
      success: false,
      error: parsedData.error.issues[0]?.message ?? "Invalid preset input",
    };
  }

  try {
    await prisma.backgroundPreset.update({
      where: { id: parsedId.data },
      data: parsedData.data,
    });
    revalidatePath(adminPath("/background-presets"));
    return { success: true };
  } catch (error: unknown) {
    console.error(
      "[AdminBackgroundPresets] Failed to update preset:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { success: false, error: "Failed to update background preset" };
  }
}

export async function togglePresetStatus(
  id: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const parsed = PresetToggleSchema.safeParse({ id, enabled });
  if (!parsed.success) {
    return { success: false, error: "Invalid preset status toggle input" };
  }

  try {
    await prisma.backgroundPreset.update({
      where: { id: parsed.data.id },
      data: { enabled: parsed.data.enabled },
    });
    revalidatePath(adminPath("/background-presets"));
    return { success: true };
  } catch (error: unknown) {
    console.error(
      "[AdminBackgroundPresets] Failed to toggle preset status:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { success: false, error: "Failed to toggle preset status" };
  }
}

export async function deletePreset(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const parsedId = PresetIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: "Invalid preset ID" };
  }

  try {
    await prisma.backgroundPreset.delete({
      where: { id: parsedId.data },
    });
    revalidatePath(adminPath("/background-presets"));
    return { success: true };
  } catch (error: unknown) {
    console.error(
      "[AdminBackgroundPresets] Failed to delete preset:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { success: false, error: "Failed to delete background preset" };
  }
}
