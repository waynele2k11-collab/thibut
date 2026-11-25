import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { ProductMock } from "@/components/studio/ProductSelectionModal";
import { FontRegistryService, type ScriptCategory } from "@/lib/fonts/FontRegistryService";
import { getActiveProductsForStudio } from "@/lib/fulfillment/getActiveProducts";
import {
  ANON_SESSION_COOKIE,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { getSessionUser } from "@/lib/auth/session";
import type { GalleryRemixContext, StudioFontOption } from "./fontPairing";

const ValidUuidSchema = z
  .string()
  .uuid()
  .refine((id) => id !== "00000000-0000-0000-0000-000000000000");

export function mapGalleryTraditionToScriptCategory(
  tradition?: string | null,
  sourceLanguage?: string | null
): ScriptCategory {
  const upperTradition = (tradition ?? "").trim().toUpperCase();
  if (
    upperTradition === "JAPANESE_SHODO" ||
    upperTradition.includes("JAPAN") ||
    upperTradition.includes("SHODO")
  ) {
    return "JAPANESE_SHODO";
  }
  if (
    upperTradition === "CHINESE_CALLIGRAPHY" ||
    upperTradition.includes("CHIN") ||
    upperTradition.includes("SHUFA")
  ) {
    return "CHINESE_CALLIGRAPHY";
  }
  if (
    upperTradition === "KOREAN_BRUSH" ||
    upperTradition.includes("KOREA") ||
    upperTradition.includes("SEOYE") ||
    upperTradition.includes("HANGUL")
  ) {
    return "KOREAN_BRUSH";
  }
  if (upperTradition === "VIETNAMESE_THU_PHAP" || upperTradition.includes("VIET")) {
    return "VIETNAMESE_THU_PHAP";
  }

  const lowerLang = (sourceLanguage ?? "").trim().toLowerCase();
  if (lowerLang.startsWith("ja") || lowerLang.includes("japan")) {
    return "JAPANESE_SHODO";
  }
  if (lowerLang.startsWith("zh") || lowerLang.includes("chin")) {
    return "CHINESE_CALLIGRAPHY";
  }
  if (lowerLang.startsWith("ko") || lowerLang.includes("korea")) {
    return "KOREAN_BRUSH";
  }

  return "VIETNAMESE_THU_PHAP";
}

export function matchGalleryProductToCatalog(
  galleryProduct: {
    productName: string;
    productCategory: string;
    defaultColor: string | null;
  },
  products: readonly ProductMock[]
): {
  matchedProductId?: string;
  matchedVariantId?: string;
} {
  if (products.length === 0) {
    return {};
  }

  const targetName = galleryProduct.productName.trim().toLowerCase();
  const targetCat = galleryProduct.productCategory.trim().toLowerCase();

  const matchedProduct =
    products.find((p) => p.name.trim().toLowerCase() === targetName) ??
    products.find(
      (p) =>
        (targetName.includes("hoodie") && p.name.toLowerCase().includes("hoodie")) ||
        (targetName.includes("tee") && p.name.toLowerCase().includes("tee")) ||
        (targetName.includes("shirt") && p.name.toLowerCase().includes("tee")) ||
        (targetCat.includes("wall") &&
          (p.category ?? "").toLowerCase().includes("canvas")) ||
        (targetCat.includes("canvas") &&
          (p.category ?? "").toLowerCase().includes("canvas"))
    ) ??
    products[0];

  if (!matchedProduct) {
    return {};
  }

  const desiredColor = galleryProduct.defaultColor?.trim().toLowerCase();
  const matchedVariant = desiredColor
    ? matchedProduct.variants?.find(
        (v) => (v.color ?? "").trim().toLowerCase() === desiredColor
      ) ?? matchedProduct.variants?.[0]
    : matchedProduct.variants?.[0];

  return {
    matchedProductId: matchedProduct.id,
    matchedVariantId: matchedVariant?.id,
  };
}

export async function loadActiveStudioFontOptions(): Promise<StudioFontOption[]> {
  const entries = await FontRegistryService.getActiveFrontendFonts();
  return entries.map((f) => ({
    id: f.id,
    name: f.name,
    familyName: f.familyName,
    category: f.category,
    categoryLabel: f.categoryLabel,
    supportedScripts: f.supportedScripts,
    previewText: f.previewText,
    description: f.description,
  }));
}

export async function resolveStudioCallerIdentity(): Promise<{
  userId: string | null;
  anonId: string | null;
}> {
  const cookieStore = await cookies();
  const anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );

  let userId: string | null = null;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser?.id) {
      userId = sessionUser.id;
    }
  } catch {
    userId = null;
  }

  return { userId, anonId };
}

export async function loadGalleryRemixContext(
  rawGalleryId: string | undefined,
  products: readonly ProductMock[]
): Promise<GalleryRemixContext | null> {
  if (!rawGalleryId) return null;
  const parsed = ValidUuidSchema.safeParse(rawGalleryId.trim());
  if (!parsed.success) return null;

  try {
    const item = await prisma.galleryItem.findUnique({
      where: { id: parsed.data },
    });
    if (!item || !item.published) {
      return null;
    }

    const tradition = mapGalleryTraditionToScriptCategory(
      item.tradition,
      item.sourceLanguage
    );
    const { matchedProductId, matchedVariantId } = matchGalleryProductToCatalog(
      {
        productName: item.productName,
        productCategory: item.productCategory,
        defaultColor: item.defaultColor,
      },
      products
    );

    const cleanPhrase = (item.sourceText || item.title).trim().slice(0, 200);

    return {
      galleryItemId: item.id,
      title: item.title,
      subtitle: item.subtitle ?? null,
      sourceText: cleanPhrase || "Thi Bút",
      tradition,
      matchedProductId,
      matchedVariantId,
    };
  } catch {
    return null;
  }
}

export async function loadStudioSharedCatalog(rawGalleryId?: string): Promise<{
  products: ProductMock[];
  availableFonts: StudioFontOption[];
  galleryRemix: GalleryRemixContext | null;
}> {
  const [products, availableFonts] = await Promise.all([
    getActiveProductsForStudio(),
    loadActiveStudioFontOptions(),
  ]);
  const galleryRemix = await loadGalleryRemixContext(rawGalleryId, products);

  return { products, availableFonts, galleryRemix };
}
