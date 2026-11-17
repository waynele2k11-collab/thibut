"use server";

import type { LayerType, Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  CompositionSchema,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_WIDTH,
  type CompositionLayer,
  type DesignComposition,
} from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { PolicyGuard } from "@/lib/services/PolicyGuard";
import { createClient } from "@/utils/supabase/server";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const SessionIdSchema = z
  .string()
  .uuid("Invalid personalization session ID")
  .refine((id) => id !== NIL_UUID, "Nil session ID is not permitted");

const EnsureStudioSessionSchema = z
  .object({
    sessionId: z
      .string()
      .uuid()
      .refine((id) => id !== NIL_UUID)
      .optional(),
    inputText: z.string().trim().min(1).max(200).optional(),
    culturalStyle: z
      .enum([
        "VIETNAMESE_THU_PHAP",
        "JAPANESE_SHODO",
        "CHINESE_CALLIGRAPHY",
        "KOREAN_BRUSH",
      ])
      .optional(),
  })
  .strict();

export interface SaveCompositionResult {
  ok: true;
  sessionId: string;
  userCompositionId: string;
}

export interface EnsureStudioSessionResult {
  ok: boolean;
  sessionId: string;
  locked: boolean;
  error?: string;
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return null;
    }
    const authUser = data.user;
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email: authUser.email ?? null,
        phoneNumber: authUser.phone ?? null,
      },
      update: {
        ...(authUser.email ? { email: authUser.email } : {}),
        ...(authUser.phone ? { phoneNumber: authUser.phone } : {}),
      },
    });
    return authUser.id;
  } catch {
    return null;
  }
}

function toPrismaLayerRow(
  layer: CompositionLayer,
  compositionId: string
): {
  compositionId: string;
  type: LayerType;
  assetId: string | null;
  text: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  color: string | null;
  opacity: number;
  zIndex: number;
} {
  if (layer.type === "asset") {
    return {
      compositionId,
      type: "IMAGE",
      assetId: layer.assetId,
      text: null,
      x: layer.transform.x,
      y: layer.transform.y,
      width: PRINT_MASTER_WIDTH * layer.transform.scale,
      height: PRINT_MASTER_HEIGHT * layer.transform.scale,
      scaleX: layer.transform.scale,
      scaleY: layer.transform.scale,
      rotation: layer.transform.rotation,
      color: null,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
    };
  }

  if (layer.type === "seal") {
    return {
      compositionId,
      type: "TEXT",
      assetId: null,
      text: layer.sealText,
      x: layer.transform.x,
      y: layer.transform.y,
      width: 420 * layer.transform.scale,
      height: 420 * layer.transform.scale,
      scaleX: layer.transform.scale,
      scaleY: layer.transform.scale,
      rotation: layer.transform.rotation,
      color: layer.colorHex,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
    };
  }

  return {
    compositionId,
    type: "THIBUT_ART",
    assetId: null,
    text: layer.text,
    x: layer.transform.x,
    y: layer.transform.y,
    width: PRINT_MASTER_WIDTH * layer.transform.scale,
    height: PRINT_MASTER_HEIGHT * layer.transform.scale,
    scaleX: layer.transform.scale,
    scaleY: layer.transform.scale,
    rotation: layer.transform.rotation,
    color: layer.colorHex,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
  };
}

/**
 * Ensures the Studio workspace has a caller-bound `PersonalizationSession`
 * backed either by an authenticated user or a signed `ANON_SESSION_COOKIE`.
 */
export async function ensureStudioSessionAction(
  rawInput: unknown = {}
): Promise<EnsureStudioSessionResult> {
  const parsed = EnsureStudioSessionSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      sessionId: "",
      locked: false,
      error: "Invalid studio session input",
    };
  }

  const input = parsed.data;
  const cookieStore = await cookies();
  const userId = await resolveAuthenticatedUserId();
  let anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );

  if (!userId && !anonId) {
    const signed = await signAnonSessionToken();
    anonId = signed.anonId;
    cookieStore.set(ANON_SESSION_COOKIE, signed.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  if (input.sessionId) {
    const existing = await prisma.personalizationSession.findUnique({
      where: { id: input.sessionId },
    });

    if (existing) {
      const ownsByUser = Boolean(userId && existing.userId === userId);
      const ownsByAnon = Boolean(
        anonId && existing.anonymousSessionId === anonId
      );
      if (ownsByUser || ownsByAnon) {
        return {
          ok: true,
          sessionId: existing.id,
          locked: existing.status === "CHECKED_OUT",
        };
      }
      // Never adopt or expose another caller's session; create a fresh caller-owned session instead
      const fresh = await prisma.personalizationSession.create({
        data: {
          userId: userId ?? null,
          anonymousSessionId: userId ? null : anonId,
          mode: "QUOTE",
          inputText: input.inputText ?? "Có Chí Thì Nên",
          culturalStyle: input.culturalStyle ?? "VIETNAMESE_THU_PHAP",
          status: "DRAFT",
        },
      });
      return {
        ok: true,
        sessionId: fresh.id,
        locked: false,
      };
    }

    const created = await prisma.personalizationSession.create({
      data: {
        id: input.sessionId,
        userId: userId ?? null,
        anonymousSessionId: userId ? null : anonId,
        mode: "QUOTE",
        inputText: input.inputText ?? "Có Chí Thì Nên",
        culturalStyle: input.culturalStyle ?? "VIETNAMESE_THU_PHAP",
        status: "DRAFT",
      },
    });
    return {
      ok: true,
      sessionId: created.id,
      locked: false,
    };
  }

  const created = await prisma.personalizationSession.create({
    data: {
      userId: userId ?? null,
      anonymousSessionId: userId ? null : anonId,
      mode: "QUOTE",
      inputText: input.inputText ?? "Có Chí Thì Nên",
      culturalStyle: input.culturalStyle ?? "VIETNAMESE_THU_PHAP",
      status: "DRAFT",
    },
  });

  return {
    ok: true,
    sessionId: created.id,
    locked: false,
  };
}

/**
 * Validates ownership & checkout lock before persisting a CompositionSchema JSON
 * and deterministically syncing `UserComposition` + `UserCompositionLayer` rows (T-102).
 */
export async function saveCompositionToSession(
  sessionId: string,
  composition: DesignComposition
): Promise<SaveCompositionResult> {
  const validSessionId = SessionIdSchema.parse(sessionId);
  const validatedComposition = CompositionSchema.parse(composition);

  const cookieStore = await cookies();
  const userId = await resolveAuthenticatedUserId();
  const anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );

  if (!userId && !anonId) {
    throw new Error("Unauthorized: missing caller identity");
  }

  const session = await prisma.personalizationSession.findUnique({
    where: { id: validSessionId },
  });

  if (!session) {
    throw new Error("Personalization session not found");
  }

  const ownsByUser = Boolean(userId && session.userId === userId);
  const ownsByAnon = Boolean(anonId && session.anonymousSessionId === anonId);

  if (!ownsByUser && !ownsByAnon) {
    throw new Error("Forbidden: you do not own this personalization session");
  }

  if (session.status === "CHECKED_OUT") {
    throw new Error("Personalization session is locked after checkout");
  }

  // Enforce creator DesignPolicyVersion permissions before persisting composition mutations (T-409, INV-012)
  await PolicyGuard.enforceCompositionPolicy({
    designId: session.designId,
    composition: validatedComposition,
    mode: session.mode,
  });

  const compositionJsonValue = JSON.parse(
    JSON.stringify(validatedComposition)
  ) as Prisma.InputJsonValue;

  const primaryCalligraphyLayer = validatedComposition.layers.find(
    (layer) => layer.type === "calligraphy"
  );

  const userCompositionId = await prisma.$transaction(async (tx) => {
    const freshSession = await tx.personalizationSession.findUnique({
      where: { id: validSessionId },
    });

    if (!freshSession) {
      throw new Error("Personalization session not found");
    }
    if (freshSession.status === "CHECKED_OUT") {
      throw new Error("Personalization session is locked after checkout");
    }
    if (freshSession.designId && freshSession.designId !== session.designId) {
      await PolicyGuard.enforceCompositionPolicy({
        designId: freshSession.designId,
        composition: validatedComposition,
        mode: freshSession.mode,
      });
    }

    await tx.personalizationSession.update({
      where: { id: validSessionId },
      data: {
        compositionJson: compositionJsonValue,
        ...(primaryCalligraphyLayer
          ? { inputText: primaryCalligraphyLayer.text }
          : {}),
      },
    });

    const mode = validatedComposition.productVariantId ? "PRODUCT" : "GENERIC";
    const resolvedOwnerId = session.userId ?? userId ?? null;

    const existingUserComp = await tx.userComposition.findFirst({
      where: { sessionId: validSessionId },
    });

    let compId: string;
    if (existingUserComp) {
      compId = existingUserComp.id;
      await tx.userCompositionLayer.deleteMany({
        where: { compositionId: compId },
      });
      await tx.userComposition.update({
        where: { id: compId },
        data: {
          userId: resolvedOwnerId,
          canvasWidth: PRINT_MASTER_WIDTH,
          canvasHeight: PRINT_MASTER_HEIGHT,
          mode,
        },
      });
    } else {
      const createdComp = await tx.userComposition.create({
        data: {
          userId: resolvedOwnerId,
          sessionId: validSessionId,
          canvasWidth: PRINT_MASTER_WIDTH,
          canvasHeight: PRINT_MASTER_HEIGHT,
          mode,
        },
      });
      compId = createdComp.id;
    }

    for (const layer of validatedComposition.layers) {
      await tx.userCompositionLayer.create({
        data: toPrismaLayerRow(layer, compId),
      });
    }

    return compId;
  });

  return {
    ok: true,
    sessionId: validSessionId,
    userCompositionId,
  };
}
