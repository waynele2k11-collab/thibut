import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import {
  getImportedProductsStatus,
  getPrintfulMasterCatalog,
} from "@/app/actions/printful-admin";
import { ProductsGrid } from "./ProductsGrid";
import { requireAdmin } from "@/utils/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const catalogRes = await getPrintfulMasterCatalog();
  const statusRes = await getImportedProductsStatus();

  if (!catalogRes.success) {
    return (
      <div className="p-8 bg-surface-container-lowest border border-surface-variant rounded-lg">
        <h1 className="font-headline-md text-headline-md text-error mb-3">
          Error Loading Catalog
        </h1>
        <p className="font-body-md text-body-md text-on-surface">
          {catalogRes.error}
        </p>
        <p className="font-body-md text-sm text-on-surface-variant mt-2">
          Ensure your Printful API token is valid and network connectivity is available.
        </p>
      </div>
    );
  }

  const products = catalogRes.products || [];
  const statusMap = statusRes.statusMap || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            Printful Catalog Sync
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Browse the live Printful catalog. Import blanks to sync high-resolution mockups and variants into PostgreSQL.
          </p>
        </div>
        <Link
          href={adminPath("/products")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded font-label-caps text-label-caps uppercase text-primary hover:bg-surface-container-high transition-colors motion-reduce:transition-none w-fit"
        >
          <RefreshCcw className="w-4 h-4" aria-hidden="true" />
          Refresh Status
        </Link>
      </div>

      <ProductsGrid products={products} statusMap={statusMap} />
    </div>
  );
}
