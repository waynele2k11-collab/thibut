import { adminPath } from "@/lib/admin-path";
import {
  updateProductSettingsFormAction,
  updateVariantFormAction,
} from "@/app/actions/keepsake-admin";
import {
  ADMIN_BUTTON,
  ADMIN_FIELD,
  ADMIN_LABEL,
  AdminNotice,
} from "@/components/admin/AdminNotice";
import { PRODUCT_STATUSES, bpsToMultiplierInput } from "@/lib/catalog/adminInput";
import { formatMinor, minorToDecimalInput } from "@/lib/money";
import { resolveSideSurchargeMinor } from "@/lib/pricing/quote";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/utils/admin/auth";
import { CatalogTabs } from "./CatalogTabs";

const STATUS_HELP: Record<string, string> = {
  DRAFT: "Hidden from the storefront",
  ACTIVE: "On sale (Buy Now)",
  QUOTE_ONLY: "Shown, priced by quotation",
  INACTIVE: "Hidden and retired",
};

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireAdmin();
  const { notice, error } = await searchParams;

  const products = await prisma.catalogProduct.findMany({
    where: { fulfillmentMode: "IN_HOUSE" },
    orderBy: { createdAt: "asc" },
    include: { variants: { orderBy: { baseRetailMinor: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-background mb-2">
          Catalog
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Made-to-order products, size prices and the double-sided multiplier.
        </p>
      </div>
      <CatalogTabs current={adminPath("/catalog")} />
      <AdminNotice notice={notice} error={error} />

      {products.length === 0 && (
        <p className="font-body-md text-body-md text-on-surface-variant">
          No made-to-order products yet. Run <code>npm run db:seed:keepsakes</code>.
        </p>
      )}

      {products.map((product) => {
        const bps = product.doubleSidedMultiplierBps ?? 16000;
        return (
          <section
            key={product.id}
            aria-labelledby={`product-${product.id}`}
            className="bg-surface-container-lowest border border-surface-variant rounded-lg p-6 space-y-6"
          >
            <div>
              <h2
                id={`product-${product.id}`}
                className="font-headline-sm text-headline-sm text-on-background"
              >
                {product.name}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {product.slug} · {STATUS_HELP[product.status] ?? product.status}
              </p>
            </div>

            <form
              action={updateProductSettingsFormAction}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end"
            >
              <input type="hidden" name="productId" value={product.id} />
              <div>
                <label htmlFor={`status-${product.id}`} className={ADMIN_LABEL}>
                  Status
                </label>
                <select
                  id={`status-${product.id}`}
                  name="status"
                  defaultValue={product.status}
                  className={ADMIN_FIELD}
                >
                  {PRODUCT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")} — {STATUS_HELP[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`multiplier-${product.id}`} className={ADMIN_LABEL}>
                  Double-sided multiplier (×)
                </label>
                <input
                  id={`multiplier-${product.id}`}
                  name="multiplier"
                  inputMode="decimal"
                  defaultValue={bpsToMultiplierInput(bps)}
                  className={ADMIN_FIELD}
                  required
                />
              </div>
              <button type="submit" className={ADMIN_BUTTON}>
                Save product
              </button>
            </form>

            {product.variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-surface-variant">
                    <tr>
                      {["Size", "Single-sided price (USD)", "Double-sided", "On sale", ""].map(
                        (heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="py-3 pr-4 font-label-caps text-label-caps uppercase text-on-surface-variant"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-variant">
                    {product.variants.map((variant) => {
                      const formId = `variant-form-${variant.id}`;
                      const doubleMinor =
                        variant.baseRetailMinor +
                        resolveSideSurchargeMinor(
                          {
                            id: variant.id,
                            active: true,
                            baseRetailMinor: variant.baseRetailMinor,
                            product: {
                              sidePricing: "MULTIPLIER",
                              doubleSidedMultiplierBps: bps,
                            },
                          },
                          "both",
                          variant.baseRetailMinor
                        );
                      return (
                        <tr key={variant.id}>
                          <th
                            scope="row"
                            className="py-3 pr-4 font-body-md text-body-md text-on-background font-normal"
                          >
                            {variant.size ?? variant.sku}
                            <form id={formId} action={updateVariantFormAction}>
                              <input type="hidden" name="variantId" value={variant.id} />
                            </form>
                          </th>
                          <td className="py-3 pr-4">
                            <label htmlFor={`price-${variant.id}`} className="sr-only">
                              Single-sided price for {variant.size ?? variant.sku}
                            </label>
                            <input
                              id={`price-${variant.id}`}
                              form={formId}
                              name="price"
                              inputMode="decimal"
                              defaultValue={minorToDecimalInput(variant.baseRetailMinor)}
                              className={`${ADMIN_FIELD} max-w-36`}
                              required
                            />
                          </td>
                          <td className="py-3 pr-4 font-body-md text-body-md text-on-surface-variant">
                            {formatMinor(doubleMinor)}
                          </td>
                          <td className="py-3 pr-4">
                            <label className="inline-flex items-center gap-2 min-h-11 font-body-md text-body-md text-on-surface">
                              <input
                                type="checkbox"
                                form={formId}
                                name="active"
                                defaultChecked={variant.active}
                                className="w-5 h-5 accent-black"
                              />
                              Active
                            </label>
                          </td>
                          <td className="py-3 text-right">
                            <button type="submit" form={formId} className={ADMIN_BUTTON}>
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
