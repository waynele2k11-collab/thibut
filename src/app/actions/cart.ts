"use server";

import type { LayerType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  PricingValidationError,
  calculateItemQuote,
} from "@/lib/pricing/quote";
import {
  CompositionSchema,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_WIDTH,
  PlacementSchema,
  type CompositionLayer,
} from "@/lib/print/types";
import {
  RateLimitError,
  enforceDistributedRateLimit,
} from "@/lib/security/rate-limit";
import {
  ANON_SESSION_COOKIE,
  signAnonSessionToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import {
  CreatorPolicyViolationError,
  PolicyGuard,
} from "@/lib/services/PolicyGuard";
import { createClient } from "@/utils/supabase/server";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const CART_ID_COOKIE = "tb_cart_id";
const PLATFORM_STUDIO_USER_EMAIL = "studio-platform@thibut.internal";
const PLATFORM_STUDIO_CREATOR_SLUG = "thibut-studio";
const PLATFORM_STUDIO_DESIGN_SLUG = "thibut-studio-custom-calligraphy";

const AddToCartInputSchema = z
  .object({
    variantId: z.string().trim().min(1).max(128),
    composition: CompositionSchema,
    text: z.string().trim().min(1).max(200),
    fontFamily: z.string().trim().min(1).max(120),
    tradition: z
      .enum([
        "VIETNAMESE_THU_PHAP",
        "JAPANESE_SHODO",
        "CHINESE_CALLIGRAPHY",
        "KOREAN_BRUSH",
      ])
      .default("VIETNAMESE_THU_PHAP"),
    placement: PlacementSchema.default("front"),
    sessionId: z
      .string()
      .uuid()
      .refine((id) => id !== NIL_UUID, "Invalid session ID")
      .optional(),
    designId: z.string().uuid().optional(),
    licenseOfferId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(100).default(1),
  })
  .strict();

export type AddToCartInput = z.infer<typeof AddToCartInputSchema>;

export interface AddToCartResult {
  success: boolean;
  cartId?: string;
  cartItemId?: string;
  count?: number;
  error?: string;
}

const RemoveCartItemSchema = z.string().uuid();

const UpdateCartItemQuantitySchema = z
  .object({
    cartItemId: z.string().uuid(),
    quantity: z.number().int().min(0).max(100),
  })
  .strict();

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

function mapCompositionLayerToRow(
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

async function resolveOrCreateStudioDesign(
  tx: Prisma.TransactionClient,
  requestedDesignId?: string
): Promise<{
  designId: string;
  designVersionId: string;
  creatorId: string;
}> {
  if (requestedDesignId) {
    const found = await tx.design.findUnique({
      where: { id: requestedDesignId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });
    if (!found) {
      throw new Error("Selected design was not found");
    }
    let version = found.versions[0];
    if (!version) {
      version = await tx.designVersion.create({
        data: {
          designId: found.id,
          versionNumber: 1,
        },
      });
    }
    return {
      designId: found.id,
      designVersionId: version.id,
      creatorId: found.creatorId,
    };
  }

  const existingPlatformDesign = await tx.design.findUnique({
    where: { slug: PLATFORM_STUDIO_DESIGN_SLUG },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (existingPlatformDesign) {
    let version = existingPlatformDesign.versions[0];
    if (!version) {
      version = await tx.designVersion.create({
        data: {
          designId: existingPlatformDesign.id,
          versionNumber: 1,
        },
      });
    }
    return {
      designId: existingPlatformDesign.id,
      designVersionId: version.id,
      creatorId: existingPlatformDesign.creatorId,
    };
  }

  // Ensure platform studio creator profile (strictly for creator attribution, NEVER shared buyer/cart identity)
  let creator = await tx.creatorProfile.findUnique({
    where: { slug: PLATFORM_STUDIO_CREATOR_SLUG },
  });

  if (!creator) {
    let platformUser = await tx.user.findUnique({
      where: { email: PLATFORM_STUDIO_USER_EMAIL },
    });
    if (!platformUser) {
      platformUser = await tx.user.create({
        data: {
          email: PLATFORM_STUDIO_USER_EMAIL,
          name: "Thi Bút Studio",
          status: "ACTIVE",
        },
      });
    }
    creator = await tx.creatorProfile.create({
      data: {
        userId: platformUser.id,
        slug: PLATFORM_STUDIO_CREATOR_SLUG,
        displayName: "Thi Bút Studio",
        status: "ACTIVE",
      },
    });
  }

  const createdDesign = await tx.design.create({
    data: {
      creatorId: creator.id,
      slug: PLATFORM_STUDIO_DESIGN_SLUG,
      title: "Thi Bút Studio Calligraphy",
      description: "Personalized controlled brush calligraphy composition.",
      status: "PUBLISHED",
      visibility: "UNLISTED",
    },
  });

  const createdVersion = await tx.designVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
    },
  });

  await tx.designPolicyVersion.create({
    data: {
      designId: createdDesign.id,
      versionNumber: 1,
      allowName: true,
      allowQuote: true,
      allowTranslation: true,
      allowCalligraphy: true,
      allowRecolor: true,
      allowCrop: true,
      allowBackgroundRemoval: true,
      allowDerivative: true,
      allowCommercialUse: false,
      allowModelTraining: false,
    },
  });

  return {
    designId: createdDesign.id,
    designVersionId: createdVersion.id,
    creatorId: creator.id,
  };
}

export async function addToCartAction(
  rawPayload: unknown
): Promise<AddToCartResult> {
  const parsed = AddToCartInputSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid cart item payload",
    };
  }

  const input = parsed.data;

  try {
    const variant = await prisma.catalogVariant.findUnique({
      where: { id: input.variantId },
      include: {
        product: true,
        providerVariants: true,
      },
    });

    if (!variant || !variant.active || variant.product.status !== "ACTIVE") {
      return {
        success: false,
        error: "Selected product variant is unavailable",
      };
    }

    const licenseOffer = input.licenseOfferId
      ? await prisma.licenseOffer.findUnique({
          where: { id: input.licenseOfferId },
        })
      : null;

    if (input.licenseOfferId && (!licenseOffer || !licenseOffer.active)) {
      return {
        success: false,
        error: "Selected license offer is unavailable",
      };
    }

    const unitQuote = calculateItemQuote({
      isDigital: false,
      variant,
      placement: input.placement,
      quantity: 1,
      isPersonalized: true,
      licenseOffer,
    });

    const cookieStore = await cookies();
    const userId = await resolveAuthenticatedUserId();
    let anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );

    if (!userId && !anonId) {
      const minted = await signAnonSessionToken();
      anonId = minted.anonId;
      cookieStore.set(ANON_SESSION_COOKIE, minted.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    await enforceDistributedRateLimit({
      bucket: "action:cart-add",
      key: userId ? `user:${userId}` : `anon:${anonId ?? "guest"}`,
      limit: 30,
      windowMs: 60_000,
    });

    const cookieCartId = cookieStore.get(CART_ID_COOKIE)?.value;
    const compositionJsonValue = JSON.parse(
      JSON.stringify(input.composition)
    ) as Prisma.InputJsonValue;

    // Resolve any caller-owned session upfront so creator design attribution & PolicyGuard cannot be bypassed (T-409, INV-012)
    let ownedSessionPreview: {
      id: string;
      designId: string | null;
      mode: string;
    } | null = null;
    if (input.sessionId) {
      const candidateSession = await prisma.personalizationSession.findUnique({
        where: { id: input.sessionId },
      });
      if (candidateSession) {
        const ownsByUser = Boolean(
          userId && candidateSession.userId === userId
        );
        const ownsByAnon = Boolean(
          anonId && candidateSession.anonymousSessionId === anonId
        );
        if (ownsByUser || ownsByAnon) {
          ownedSessionPreview = {
            id: candidateSession.id,
            designId: candidateSession.designId,
            mode: candidateSession.mode,
          };
        }
      }
    }

    if (
      input.designId &&
      ownedSessionPreview?.designId &&
      input.designId !== ownedSessionPreview.designId
    ) {
      return {
        success: false,
        error: "Session design mismatch",
      };
    }

    const effectiveCreatorDesignId =
      input.designId ?? ownedSessionPreview?.designId ?? undefined;

    if (
      licenseOffer &&
      effectiveCreatorDesignId &&
      licenseOffer.designId !== effectiveCreatorDesignId
    ) {
      return {
        success: false,
        error: "Selected license offer does not belong to this design",
      };
    }

    await PolicyGuard.enforceCompositionPolicy({
      designId: effectiveCreatorDesignId ?? null,
      composition: input.composition,
      mode: ownedSessionPreview?.mode ?? "QUOTE",
      commercialUse: Boolean(
        licenseOffer?.allowCommercialUse || licenseOffer?.type === "COMMERCIAL"
      ),
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve isolated Cart strictly owned by this caller
      let cart = null;
      if (cookieCartId) {
        const candidateCart = await tx.cart.findUnique({
          where: { id: cookieCartId },
        });
        if (candidateCart && candidateCart.status === "ACTIVE") {
          const matchesUser = Boolean(userId && candidateCart.userId === userId);
          const matchesAnon = Boolean(
            !userId && anonId && candidateCart.anonymousSessionId === anonId
          );
          if (matchesUser || matchesAnon) {
            cart = candidateCart;
          }
        }
      }

      if (!cart) {
        cart = await tx.cart.findFirst({
          where: userId
            ? { userId, status: "ACTIVE" }
            : { anonymousSessionId: anonId, status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
        });
      }

      if (!cart) {
        cart = await tx.cart.create({
          data: {
            userId: userId ?? null,
            anonymousSessionId: userId ? null : anonId,
            currency: "USD",
            status: "ACTIVE",
          },
        });
      }

      // 2. Resolve real Design + DesignVersion
      const { designId, designVersionId, creatorId } =
        await resolveOrCreateStudioDesign(tx, effectiveCreatorDesignId);

      // 3. Resolve or create caller-owned PersonalizationSession
      let session = null;
      if (input.sessionId) {
        const existingSession = await tx.personalizationSession.findUnique({
          where: { id: input.sessionId },
        });
        if (existingSession) {
          const ownsByUser = Boolean(
            userId && existingSession.userId === userId
          );
          const ownsByAnon = Boolean(
            anonId && existingSession.anonymousSessionId === anonId
          );
          if (
            (ownsByUser || ownsByAnon) &&
            existingSession.status !== "CHECKED_OUT"
          ) {
            session = await tx.personalizationSession.update({
              where: { id: existingSession.id },
              data: {
                designId,
                designVersionId,
                inputText: input.text,
                culturalStyle: input.tradition,
                status: "SELECTED",
                compositionJson: compositionJsonValue,
              },
            });
          }
        } else {
          session = await tx.personalizationSession.create({
            data: {
              id: input.sessionId,
              userId: userId ?? null,
              anonymousSessionId: userId ? null : anonId,
              designId,
              designVersionId,
              mode: "QUOTE",
              inputText: input.text,
              culturalStyle: input.tradition,
              status: "SELECTED",
              compositionJson: compositionJsonValue,
            },
          });
        }
      }

      if (!session) {
        session = await tx.personalizationSession.create({
          data: {
            userId: userId ?? null,
            anonymousSessionId: userId ? null : anonId,
            designId,
            designVersionId,
            mode: "QUOTE",
            inputText: input.text,
            culturalStyle: input.tradition,
            status: "SELECTED",
            compositionJson: compositionJsonValue,
          },
        });
      }

      // 4. Deterministically persist UserComposition + UserCompositionLayer rows
      const userComp = await tx.userComposition.create({
        data: {
          userId: userId ?? null,
          sessionId: session.id,
          canvasWidth: PRINT_MASTER_WIDTH,
          canvasHeight: PRINT_MASTER_HEIGHT,
          mode: "PRODUCT",
        },
      });

      for (const layer of input.composition.layers) {
        await tx.userCompositionLayer.create({
          data: mapCompositionLayerToRow(layer, userComp.id),
        });
      }

      // 5. Create immutable PersonalizationVersion snapshot
      const latestPv = await tx.personalizationVersion.findFirst({
        where: { sessionId: session.id },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersionNumber = (latestPv?.versionNumber ?? 0) + 1;

      const personalizationVersion = await tx.personalizationVersion.create({
        data: {
          sessionId: session.id,
          designVersionId,
          versionNumber: nextVersionNumber,
          inputSnapshot: {
            text: input.text,
            fontFamily: input.fontFamily,
            tradition: input.tradition,
          },
          interpretationSnapshot: {
            text: input.text,
            tradition: input.tradition,
          },
          styleSnapshot: compositionJsonValue,
        },
      });

      // 6. Create CartItem with authoritative BigInt unit quotes
      const cartItem = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          creatorId,
          designId,
          designVersionId,
          personalizationVersionId: personalizationVersion.id,
          catalogVariantId: variant.id,
          licenseOfferId: licenseOffer?.id ?? null,
          placement: unitQuote.placement,
          quantity: input.quantity,
          unitArtworkMinor: unitQuote.artworkMinor,
          unitPersonalizationMinor: unitQuote.personalizationMinor,
          unitProductMinor: unitQuote.productMinor,
        },
      });

      const items = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        select: { quantity: true },
      });
      const totalCount = items.reduce((acc, row) => acc + row.quantity, 0);

      return {
        cartId: cart.id,
        cartItemId: cartItem.id,
        count: totalCount,
      };
    });

    cookieStore.set(CART_ID_COOKIE, result.cartId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    revalidatePath("/cart");

    return {
      success: true,
      cartId: result.cartId,
      cartItemId: result.cartItemId,
      count: result.count,
    };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many cart requests. Please wait a moment and try again.",
      };
    }
    if (
      err instanceof PricingValidationError ||
      err instanceof CreatorPolicyViolationError
    ) {
      return { success: false, error: err.message };
    }
    console.error("[addToCartAction] Failed to add item:", err);
    return {
      success: false,
      error: "Unable to add item to cart",
    };
  }
}

export async function getCartCountAction(): Promise<number> {
  try {
    const cookieStore = await cookies();
    const userId = await resolveAuthenticatedUserId();
    const anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );

    if (!userId && !anonId) {
      return 0;
    }

    const cookieCartId = cookieStore.get(CART_ID_COOKIE)?.value;
    let cart = null;

    if (cookieCartId) {
      const found = await prisma.cart.findUnique({
        where: { id: cookieCartId },
        include: { items: { select: { quantity: true } } },
      });
      if (found && found.status === "ACTIVE") {
        const matchesUser = Boolean(userId && found.userId === userId);
        const matchesAnon = Boolean(
          !userId && anonId && found.anonymousSessionId === anonId
        );
        if (matchesUser || matchesAnon) {
          cart = found;
        }
      }
    }

    if (!cart) {
      cart = await prisma.cart.findFirst({
        where: userId
          ? { userId, status: "ACTIVE" }
          : { anonymousSessionId: anonId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        include: { items: { select: { quantity: true } } },
      });
    }

    if (!cart) {
      return 0;
    }

    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    return 0;
  }
}

export async function removeFromCartAction(
  cartItemId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const parsed = RemoveCartItemSchema.safeParse(cartItemId);
  if (!parsed.success) {
    return { success: false, count: 0, error: "Invalid cart item ID" };
  }

  try {
    const cookieStore = await cookies();
    const userId = await resolveAuthenticatedUserId();
    const anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );

    if (!userId && !anonId) {
      return { success: false, count: 0, error: "Unauthorized" };
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: parsed.data },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.status !== "ACTIVE") {
      return { success: false, count: 0, error: "Cart item not found" };
    }

    const ownsByUser = Boolean(userId && cartItem.cart.userId === userId);
    const ownsByAnon = Boolean(
      !userId && anonId && cartItem.cart.anonymousSessionId === anonId
    );
    if (!ownsByUser && !ownsByAnon) {
      return { success: false, count: 0, error: "Forbidden" };
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    const remaining = await prisma.cartItem.findMany({
      where: { cartId: cartItem.cartId },
      select: { quantity: true },
    });
    const count = remaining.reduce((sum, item) => sum + item.quantity, 0);

    revalidatePath("/cart");

    return { success: true, count };
  } catch (err: unknown) {
    console.error("[removeFromCartAction] Failed to remove item:", err);
    return { success: false, count: 0, error: "Unable to remove item" };
  }
}

export async function removeFromCartFormAction(
  formData: FormData
): Promise<void> {
  const itemId = formData.get("cartItemId");
  if (typeof itemId === "string" && itemId.length > 0) {
    await removeFromCartAction(itemId);
  }
}

export async function updateCartItemQuantityAction(
  rawInput: unknown
): Promise<{ success: boolean; count: number; error?: string }> {
  const parsed = UpdateCartItemQuantitySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, count: 0, error: "Invalid quantity update" };
  }

  const { cartItemId, quantity } = parsed.data;
  if (quantity === 0) {
    return removeFromCartAction(cartItemId);
  }

  try {
    const cookieStore = await cookies();
    const userId = await resolveAuthenticatedUserId();
    const anonId = await verifyAnonSessionToken(
      cookieStore.get(ANON_SESSION_COOKIE)?.value
    );

    if (!userId && !anonId) {
      return { success: false, count: 0, error: "Unauthorized" };
    }

    await enforceDistributedRateLimit({
      bucket: "action:cart-update",
      key: userId ? `user:${userId}` : `anon:${anonId ?? "guest"}`,
      limit: 60,
      windowMs: 60_000,
    });

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem || cartItem.cart.status !== "ACTIVE") {
      return { success: false, count: 0, error: "Cart item not found" };
    }

    const ownsByUser = Boolean(userId && cartItem.cart.userId === userId);
    const ownsByAnon = Boolean(
      !userId && anonId && cartItem.cart.anonymousSessionId === anonId
    );
    if (!ownsByUser && !ownsByAnon) {
      return { success: false, count: 0, error: "Forbidden" };
    }

    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity },
    });

    const items = await prisma.cartItem.findMany({
      where: { cartId: cartItem.cartId },
      select: { quantity: true },
    });
    const count = items.reduce((sum, row) => sum + row.quantity, 0);

    revalidatePath("/cart");

    return { success: true, count };
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return { success: false, count: 0, error: "Too many requests" };
    }
    console.error("[updateCartItemQuantityAction] Error:", err);
    return { success: false, count: 0, error: "Unable to update quantity" };
  }
}

export async function updateCartItemQuantityFormAction(
  formData: FormData
): Promise<void> {
  const itemId = formData.get("cartItemId");
  const rawQty = formData.get("quantity");
  if (typeof itemId !== "string" || typeof rawQty !== "string") return;
  const parsedQty = Number.parseInt(rawQty, 10);
  if (!Number.isInteger(parsedQty)) return;
  await updateCartItemQuantityAction({
    cartItemId: itemId,
    quantity: parsedQty,
  });
}
