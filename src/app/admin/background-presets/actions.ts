"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createPreset(data: {
  key: string;
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  defaultMood: string;
  defaultPalette: string;
  defaultIntensity: string;
  enabled: boolean;
  sortOrder: number;
}) {
  try {
    if (prisma.backgroundPreset) {
      await prisma.backgroundPreset.create({
        data,
      });
    } else {
      await prisma.$executeRaw`
        INSERT INTO "BackgroundPreset" ("id", "key", "name", "category", "description", "promptTemplate", "defaultMood", "defaultPalette", "defaultIntensity", "enabled", "sortOrder", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${data.key}, ${data.name}, ${data.category}, ${data.description}, ${data.promptTemplate}, ${data.defaultMood}, ${data.defaultPalette}, ${data.defaultIntensity}, ${data.enabled}, ${data.sortOrder}, NOW(), NOW())
      `;
    }
    revalidatePath("/admin/background-presets");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updatePreset(id: string, data: {
  name: string;
  category: string;
  description: string;
  promptTemplate: string;
  defaultMood: string;
  defaultPalette: string;
  defaultIntensity: string;
  enabled: boolean;
  sortOrder: number;
}) {
  try {
    if (prisma.backgroundPreset) {
      await prisma.backgroundPreset.update({
        where: { id },
        data,
      });
    } else {
      await prisma.$executeRaw`
        UPDATE "BackgroundPreset"
        SET "name" = ${data.name},
            "category" = ${data.category},
            "description" = ${data.description},
            "promptTemplate" = ${data.promptTemplate},
            "defaultMood" = ${data.defaultMood},
            "defaultPalette" = ${data.defaultPalette},
            "defaultIntensity" = ${data.defaultIntensity},
            "enabled" = ${data.enabled},
            "sortOrder" = ${data.sortOrder},
            "updatedAt" = NOW()
        WHERE "id" = ${id}
      `;
    }
    revalidatePath("/admin/background-presets");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function togglePresetStatus(id: string, enabled: boolean) {
  try {
    if (prisma.backgroundPreset) {
      await prisma.backgroundPreset.update({
        where: { id },
        data: { enabled },
      });
    } else {
      await prisma.$executeRaw`
        UPDATE "BackgroundPreset"
        SET "enabled" = ${enabled}, "updatedAt" = NOW()
        WHERE "id" = ${id}
      `;
    }
    revalidatePath("/admin/background-presets");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePreset(id: string) {
  try {
    if (prisma.backgroundPreset) {
      await prisma.backgroundPreset.delete({
        where: { id },
      });
    } else {
      await prisma.$executeRaw`
        DELETE FROM "BackgroundPreset" WHERE "id" = ${id}
      `;
    }
    revalidatePath("/admin/background-presets");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
