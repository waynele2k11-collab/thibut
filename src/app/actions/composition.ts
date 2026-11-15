"use server";

import prisma from "@/lib/prisma";
import { DesignComposition } from "@/lib/print/types";

export async function saveCompositionToSession(sessionId: string, composition: DesignComposition) {
  if (!sessionId || sessionId === "00000000-0000-0000-0000-000000000000") return;

  try {
    await prisma.personalizationSession.update({
      where: { id: sessionId },
      data: {
        compositionJson: composition as any,
      },
    });
  } catch (error) {
    console.error("[saveCompositionToSession] Failed to save composition:", error);
  }
}
