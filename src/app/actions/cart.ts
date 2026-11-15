"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface AddToCartPayload {
  variantId: string;
  designDataUrl: string;
  config: {
    text: string;
    fontFamily: string;
    inkColor: string;
    hasSeal: boolean;
    layoutMode: string;
    tradition: string;
  };
}

export async function addToCartAction(payload: AddToCartPayload) {
  try {
    const cookieStore = await cookies();
    let cartId = cookieStore.get("cartId")?.value;

    // TODO: Link to actual authenticated user if logged in
    
    if (cartId) {
      const existingCart = await prisma.cart.findUnique({ where: { id: cartId } });
      if (!existingCart) {
        cartId = undefined; // DB was wiped or cart deleted, we need to create a new one
      }
    }

    if (!cartId) {
      // For MVP, create a temporary "guest" user or just rely on session.
      // Wait, our schema requires a userId for Cart:
      // userId String
      // Since this is MVP and we might not have a logged in user, we will create an anonymous user.
      let anonUser = await prisma.user.findFirst({ where: { email: "guest@thibut.com" } });
      if (!anonUser) {
        anonUser = await prisma.user.create({
          data: {
            email: "guest@thibut.com",
            name: "Guest User",
          }
        });
      }
      
      const newCart = await prisma.cart.create({
        data: {
          userId: anonUser.id,
          currency: "USD",
        }
      });
      cartId = newCart.id;
      cookieStore.set("cartId", cartId, { path: "/", maxAge: 60 * 60 * 24 * 7 });
    }

    // 1. Create UserComposition (MVP: we save the config as JSON and dummy asset for now)
    const composition = await prisma.userComposition.create({
      data: {
        canvasWidth: 2000,
        canvasHeight: 2000,
        mode: "PRODUCT",
      }
    });

    // 2. We need a designId. The CartItem schema requires:
    // creatorId, designId, designVersionId, catalogVariantId
    // Since this is custom generated art, we need a generic "Custom" design or we have to create one.
    let sysCreator = await prisma.creatorProfile.findFirst();
    if (!sysCreator) {
      // Fallback
      return { success: false, error: "System creator not found" };
    }

    let genericDesign = await prisma.design.findFirst({ where: { title: "Custom Calligraphy" } });
    if (!genericDesign) {
      genericDesign = await prisma.design.create({
        data: {
          creatorId: sysCreator.id,
          title: "Custom Calligraphy",
          sourceText: payload.config.text,
          assetId: "temp-asset",
          status: "PUBLISHED"
        }
      });
    }

    // 3. Add CartItem
    await prisma.cartItem.create({
      data: {
        cartId,
        creatorId: sysCreator.id,
        designId: genericDesign.id,
        designVersionId: "1",
        catalogVariantId: payload.variantId,
        unitArtworkMinor: 0,
        unitPersonalizationMinor: 500, // $5.00
        unitProductMinor: 2500, // $25.00
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("addToCartAction error:", error);
    return { success: false, error: error.message };
  }
}
