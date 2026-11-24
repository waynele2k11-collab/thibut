import prisma from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { resolveSideSurchargeMinor } from "@/lib/pricing/quote";
import { type DivisionSlug, isDivisionSlug } from "./divisions";

/**
 * Read model for the made-to-order storefront (BRD v1.0 Milestone 1).
 * Everything returned is plain, serialisable data: BigInt prices are pre-formatted to
 * display strings on the server so pages and client components never do money arithmetic.
 */

export type ImageKind = "CONCEPT_RENDER" | "PRODUCT_PHOTO";

export interface CatalogSizeOption {
  variantId: string;
  size: string;
  singleLabel: string;
  doubleLabel: string;
}

export interface CatalogProductOption {
  productId: string;
  name: string;
  description: string | null;
  /** "ACTIVE" products can be bought now; "QUOTE_ONLY" products are quoted by email. */
  status: "ACTIVE" | "QUOTE_ONLY";
  sizes: CatalogSizeOption[];
}

export interface CatalogDesignSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string;
  imageKind: ImageKind;
  categoryName: string | null;
  fromLabel: string | null;
}

export interface CatalogDesignDetail extends CatalogDesignSummary {
  imageUrls: string[];
  division: { slug: DivisionSlug; name: string } | null;
  category: { slug: string; name: string } | null;
  products: CatalogProductOption[];
}

export interface CatalogCategory {
  id: string;
  /** URL segment within the division, e.g. "wedding-engagement". */
  slug: string;
  name: string;
  designCount: number;
}

export interface CatalogDivision {
  slug: DivisionSlug;
  name: string;
  categories: CatalogCategory[];
}

const PUBLIC_DESIGN_WHERE = {
  status: "PUBLISHED" as const,
  visibility: "PUBLIC" as const,
  catalogImageUrls: { isEmpty: false },
};

const DESIGN_SUMMARY_INCLUDE = {
  category: { select: { name: true } },
  products: {
    where: { active: true },
    select: {
      catalogProduct: {
        select: {
          status: true,
          variants: {
            where: { active: true },
            select: { baseRetailMinor: true },
          },
        },
      },
    },
  },
} as const;

/** 16000 -> "1.6×", 20000 -> "2×". Integer arithmetic only. */
export function formatMultiplierBps(bps: number): string {
  const whole = Math.trunc(bps / 10000);
  const fraction = String(bps % 10000).padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}×` : `${whole}×`;
}

function toImageKind(value: string): ImageKind {
  return value === "PRODUCT_PHOTO" ? "PRODUCT_PHOTO" : "CONCEPT_RENDER";
}

function subSlug(division: string, categorySlug: string): string {
  return categorySlug.startsWith(`${division}-`)
    ? categorySlug.slice(division.length + 1)
    : categorySlug;
}

type SummaryRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageKind: string;
  catalogImageUrls: string[];
  category: { name: string } | null;
  products: {
    catalogProduct: {
      status: string;
      variants: { baseRetailMinor: bigint }[];
    };
  }[];
};

function toSummary(row: SummaryRow): CatalogDesignSummary {
  const prices = row.products
    .filter((link) => link.catalogProduct.status === "ACTIVE")
    .flatMap((link) => link.catalogProduct.variants.map((v) => v.baseRetailMinor));
  const lowest = prices.reduce<bigint | null>(
    (min, price) => (min === null || price < min ? price : min),
    null
  );
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.catalogImageUrls[0],
    imageKind: toImageKind(row.imageKind),
    categoryName: row.category?.name ?? null,
    fromLabel: lowest === null ? null : formatMinor(lowest),
  };
}

export async function getCatalogDivision(
  divisionSlug: string
): Promise<CatalogDivision | null> {
  if (!isDivisionSlug(divisionSlug)) return null;
  const root = await prisma.category.findUnique({
    where: { slug: divisionSlug },
    include: {
      children: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { designs: { where: PUBLIC_DESIGN_WHERE } } },
        },
      },
    },
  });
  if (!root || !root.active || root.parentId !== null) return null;
  return {
    slug: divisionSlug,
    name: root.name,
    categories: root.children.map((child) => ({
      id: child.id,
      slug: subSlug(divisionSlug, child.slug),
      name: child.name,
      designCount: child._count.designs,
    })),
  };
}

export async function listDivisionDesigns(
  divisionSlug: string,
  categorySubSlug?: string
): Promise<CatalogDesignSummary[]> {
  if (!isDivisionSlug(divisionSlug)) return [];
  const rows = await prisma.design.findMany({
    where: {
      ...PUBLIC_DESIGN_WHERE,
      category: {
        active: true,
        parent: { slug: divisionSlug },
        ...(categorySubSlug ? { slug: `${divisionSlug}-${categorySubSlug}` } : {}),
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: DESIGN_SUMMARY_INCLUDE,
  });
  return rows.map(toSummary);
}

export async function listFeaturedDesigns(limit = 6): Promise<CatalogDesignSummary[]> {
  const rows = await prisma.design.findMany({
    where: PUBLIC_DESIGN_WHERE,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: DESIGN_SUMMARY_INCLUDE,
  });
  return rows.map(toSummary);
}

export async function getCatalogDesign(
  slug: string
): Promise<CatalogDesignDetail | null> {
  const row = await prisma.design.findFirst({
    where: { slug, ...PUBLIC_DESIGN_WHERE },
    include: {
      category: { include: { parent: true } },
      products: {
        where: { active: true },
        include: {
          catalogProduct: {
            include: {
              variants: {
                where: { active: true },
                orderBy: { baseRetailMinor: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  const products: CatalogProductOption[] = [];
  for (const link of row.products) {
    const product = link.catalogProduct;
    if (product.status !== "ACTIVE" && product.status !== "QUOTE_ONLY") continue;
    const sizes: CatalogSizeOption[] =
      product.status === "ACTIVE"
        ? product.variants.map((variant) => {
            const quoteVariant = {
              id: variant.id,
              active: variant.active,
              baseRetailMinor: variant.baseRetailMinor,
              product,
            };
            const single = variant.baseRetailMinor;
            const double =
              single +
              resolveSideSurchargeMinor(quoteVariant, "both", single);
            return {
              variantId: variant.id,
              size: variant.size ?? "One size",
              singleLabel: formatMinor(single),
              doubleLabel: formatMinor(double),
            };
          })
        : [];
    if (product.status === "ACTIVE" && sizes.length === 0) continue;
    products.push({
      productId: product.id,
      name: product.name,
      description: product.description,
      status: product.status,
      sizes,
    });
  }

  const parent = row.category?.parent ?? null;
  const division =
    parent && isDivisionSlug(parent.slug)
      ? { slug: parent.slug, name: parent.name }
      : null;

  const firstActive = products.find((p) => p.status === "ACTIVE");
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    imageUrl: row.catalogImageUrls[0],
    imageUrls: row.catalogImageUrls,
    imageKind: toImageKind(row.imageKind),
    categoryName: row.category?.name ?? null,
    fromLabel: firstActive?.sizes[0]?.singleLabel ?? null,
    division,
    category:
      row.category && division
        ? { slug: subSlug(division.slug, row.category.slug), name: row.category.name }
        : null,
    products,
  };
}

/** Price table for the default keepsake product, shown on the Custom Design page. */
export async function getKeepsakePriceTable(
  productSlug: string
): Promise<{ multiplierLabel: string; sizes: CatalogSizeOption[] } | null> {
  const product = await prisma.catalogProduct.findUnique({
    where: { slug: productSlug },
    include: {
      variants: { where: { active: true }, orderBy: { baseRetailMinor: "asc" } },
    },
  });
  if (!product || product.status !== "ACTIVE" || product.variants.length === 0) {
    return null;
  }
  const bps = product.doubleSidedMultiplierBps ?? 10000;
  return {
    multiplierLabel: formatMultiplierBps(bps),
    sizes: product.variants.map((variant) => {
      const single = variant.baseRetailMinor;
      const double =
        single +
        resolveSideSurchargeMinor(
          { id: variant.id, active: true, baseRetailMinor: single, product },
          "both",
          single
        );
      return {
        variantId: variant.id,
        size: variant.size ?? "One size",
        singleLabel: formatMinor(single),
        doubleLabel: formatMinor(double),
      };
    }),
  };
}
