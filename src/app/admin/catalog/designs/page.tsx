import Link from "next/link";
import { saveCatalogDesignFormAction } from "@/app/actions/keepsake-admin";
import {
  ADMIN_BUTTON,
  ADMIN_FIELD,
  ADMIN_LABEL,
  AdminNotice,
} from "@/components/admin/AdminNotice";
import { DIVISION_SLUGS, PLATFORM_CREATOR_SLUG } from "@/lib/catalog/divisions";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/utils/admin/auth";
import { CatalogTabs } from "../CatalogTabs";

interface CategoryOption {
  id: string;
  label: string;
}
interface ProductOption {
  id: string;
  name: string;
  status: string;
}
interface DesignFormValues {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryId: string | null;
  imageKind: string;
  images: string[];
  published: boolean;
  productIds: string[];
}

function DesignForm({
  design,
  categories,
  products,
}: {
  design: DesignFormValues | null;
  categories: CategoryOption[];
  products: ProductOption[];
}) {
  const key = design?.id ?? "new";
  return (
    <form action={saveCatalogDesignFormAction} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {design && <input type="hidden" name="designId" value={design.id} />}
      <div>
        <label htmlFor={`title-${key}`} className={ADMIN_LABEL}>
          Title
        </label>
        <input
          id={`title-${key}`}
          name="title"
          defaultValue={design?.title ?? ""}
          minLength={3}
          maxLength={140}
          className={ADMIN_FIELD}
          required
        />
      </div>
      <div>
        <label htmlFor={`category-${key}`} className={ADMIN_LABEL}>
          Category
        </label>
        <select
          id={`category-${key}`}
          name="categoryId"
          defaultValue={design?.categoryId ?? ""}
          className={ADMIN_FIELD}
          required
        >
          <option value="" disabled>
            Choose…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label htmlFor={`description-${key}`} className={ADMIN_LABEL}>
          Description
        </label>
        <textarea
          id={`description-${key}`}
          name="description"
          defaultValue={design?.description ?? ""}
          maxLength={1000}
          rows={3}
          className={`${ADMIN_FIELD} h-auto py-2`}
        />
      </div>
      <div>
        <label htmlFor={`images-${key}`} className={ADMIN_LABEL}>
          Image paths, one per line (first is the cover)
        </label>
        <textarea
          id={`images-${key}`}
          name="images"
          defaultValue={design?.images.join("\n") ?? ""}
          rows={3}
          placeholder="/keepsakes/example.webp"
          className={`${ADMIN_FIELD} h-auto py-2`}
          required
        />
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Files must already be in the site&rsquo;s <code>public</code> folder.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor={`kind-${key}`} className={ADMIN_LABEL}>
            Image type
          </label>
          <select
            id={`kind-${key}`}
            name="imageKind"
            defaultValue={design?.imageKind ?? "CONCEPT_RENDER"}
            className={ADMIN_FIELD}
          >
            <option value="CONCEPT_RENDER">Concept render (labelled on the site)</option>
            <option value="PRODUCT_PHOTO">Photograph of a finished product</option>
          </select>
        </div>
        <fieldset>
          <legend className={ADMIN_LABEL}>Available as</legend>
          <div className="flex flex-col gap-1">
            {products.map((product) => (
              <label
                key={product.id}
                className="inline-flex items-center gap-2 min-h-11 font-body-md text-body-md text-on-surface"
              >
                <input
                  type="checkbox"
                  name="productIds"
                  value={product.id}
                  defaultChecked={design?.productIds.includes(product.id) ?? false}
                  className="w-5 h-5 accent-black"
                />
                {product.name}
                <span className="text-on-surface-variant">
                  ({product.status.replace(/_/g, " ").toLowerCase()})
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-surface-variant">
        <label className="inline-flex items-center gap-2 min-h-11 font-body-md text-body-md text-on-surface">
          <input
            type="checkbox"
            name="published"
            defaultChecked={design?.published ?? false}
            className="w-5 h-5 accent-black"
          />
          Published on the storefront
        </label>
        <button type="submit" className={ADMIN_BUTTON}>
          {design ? "Save design" : "Create design"}
        </button>
      </div>
    </form>
  );
}

export default async function AdminCatalogDesignsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireAdmin();
  const { notice, error } = await searchParams;

  const [divisions, products, designs] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null, slug: { in: [...DIVISION_SLUGS] } },
      orderBy: { sortOrder: "asc" },
      include: { children: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.catalogProduct.findMany({
      where: { fulfillmentMode: "IN_HOUSE", status: { not: "INACTIVE" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.design.findMany({
      where: {
        creator: { slug: PLATFORM_CREATOR_SLUG },
        category: { parent: { slug: { in: [...DIVISION_SLUGS] } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        category: { include: { parent: true } },
        products: { where: { active: true }, select: { catalogProductId: true } },
      },
    }),
  ]);

  const categories: CategoryOption[] = divisions.flatMap((division) =>
    division.children.map((child) => ({
      id: child.id,
      label: `${division.name} › ${child.name}${child.active ? "" : " (inactive)"}`,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-background mb-2">
          Designs
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Catalog artwork sold unchanged through Buy Now. One design can be offered on
          several products.
        </p>
      </div>
      <CatalogTabs current="/admin/catalog/designs" />
      <AdminNotice notice={notice} error={error} />

      <details className="bg-surface-container-lowest border border-surface-variant rounded-lg">
        <summary className="cursor-pointer min-h-11 px-6 py-4 font-headline-sm text-headline-sm text-on-background">
          Add a design
        </summary>
        <div className="px-6 pb-6">
          <DesignForm design={null} categories={categories} products={products} />
        </div>
      </details>

      {designs.map((design) => {
        const published = design.status === "PUBLISHED" && design.visibility === "PUBLIC";
        return (
          <details
            key={design.id}
            className="bg-surface-container-lowest border border-surface-variant rounded-lg"
          >
            <summary className="cursor-pointer min-h-11 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <span className="font-headline-sm text-headline-sm text-on-background">
                {design.title}
              </span>
              <span className="flex items-center gap-3 font-label-caps text-label-caps uppercase text-on-surface-variant">
                {design.category?.parent?.name} › {design.category?.name}
                <span
                  className={`px-2 py-1 rounded ${
                    published
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  {published ? "Published" : "Hidden"}
                </span>
              </span>
            </summary>
            <div className="px-6 pb-6 space-y-4">
              {published && (
                <Link
                  href={`/design/${design.slug}`}
                  className="inline-flex items-center min-h-11 font-label-caps text-label-caps uppercase text-secondary hover:underline"
                >
                  View on storefront
                </Link>
              )}
              <DesignForm
                design={{
                  id: design.id,
                  slug: design.slug,
                  title: design.title,
                  description: design.description ?? "",
                  categoryId: design.categoryId,
                  imageKind: design.imageKind,
                  images: design.catalogImageUrls,
                  published,
                  productIds: design.products.map((link) => link.catalogProductId),
                }}
                categories={categories}
                products={products}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
