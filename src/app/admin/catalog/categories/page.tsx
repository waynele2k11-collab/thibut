import {
  createCategoryFormAction,
  updateCategoryFormAction,
} from "@/app/actions/keepsake-admin";
import {
  ADMIN_BUTTON,
  ADMIN_FIELD,
  ADMIN_LABEL,
  AdminNotice,
} from "@/components/admin/AdminNotice";
import { DIVISION_SLUGS } from "@/lib/catalog/divisions";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/utils/admin/auth";
import { CatalogTabs } from "../CatalogTabs";

export default async function AdminCatalogCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireAdmin();
  const { notice, error } = await searchParams;

  const divisions = await prisma.category.findMany({
    where: { parentId: null, slug: { in: [...DIVISION_SLUGS] } },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { designs: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-background mb-2">
          Categories
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Subcategories inside Personal, Business and Living. Inactive categories are
          hidden from the storefront.
        </p>
      </div>
      <CatalogTabs current="/admin/catalog/categories" />
      <AdminNotice notice={notice} error={error} />

      <section className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6">
        <h2 className="font-headline-sm text-headline-sm text-on-background mb-4">
          Add a category
        </h2>
        <form
          action={createCategoryFormAction}
          className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-4 items-end"
        >
          <div>
            <label htmlFor="new-category-division" className={ADMIN_LABEL}>
              Division
            </label>
            <select
              id="new-category-division"
              name="division"
              className={ADMIN_FIELD}
              required
            >
              {divisions.map((division) => (
                <option key={division.id} value={division.slug}>
                  {division.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-category-name" className={ADMIN_LABEL}>
              Name
            </label>
            <input
              id="new-category-name"
              name="name"
              minLength={2}
              maxLength={80}
              className={ADMIN_FIELD}
              required
            />
          </div>
          <button type="submit" className={ADMIN_BUTTON}>
            Add
          </button>
        </form>
      </section>

      {divisions.map((division) => (
        <section
          key={division.id}
          aria-labelledby={`division-${division.id}`}
          className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6"
        >
          <h2
            id={`division-${division.id}`}
            className="font-headline-sm text-headline-sm text-on-background mb-4"
          >
            {division.name}
          </h2>
          <ul className="divide-y divide-surface-variant">
            {division.children.map((category) => (
              <li key={category.id} className="py-3">
                <form
                  action={updateCategoryFormAction}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_96px_auto_auto] gap-3 items-end"
                >
                  <input type="hidden" name="categoryId" value={category.id} />
                  <div>
                    <label htmlFor={`name-${category.id}`} className={ADMIN_LABEL}>
                      Name · {category._count.designs} designs
                    </label>
                    <input
                      id={`name-${category.id}`}
                      name="name"
                      defaultValue={category.name}
                      minLength={2}
                      maxLength={80}
                      className={ADMIN_FIELD}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={`order-${category.id}`} className={ADMIN_LABEL}>
                      Order
                    </label>
                    <input
                      id={`order-${category.id}`}
                      name="sortOrder"
                      type="number"
                      min={0}
                      max={999}
                      defaultValue={category.sortOrder}
                      className={ADMIN_FIELD}
                      required
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 min-h-11 font-body-md text-body-md text-on-surface">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={category.active}
                      className="w-5 h-5 accent-black"
                    />
                    Active
                  </label>
                  <button type="submit" className={ADMIN_BUTTON}>
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
