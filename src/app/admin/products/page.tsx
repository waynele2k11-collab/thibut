import { getPrintfulMasterCatalog, getImportedProductsStatus } from "@/app/actions/printful-admin";
import { ProductsGrid } from "./ProductsGrid";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const catalogRes = await getPrintfulMasterCatalog();
  const statusRes = await getImportedProductsStatus();

  if (!catalogRes.success) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-display text-red-600 mb-4">Error Loading Catalog</h1>
        <p>{catalogRes.error}</p>
        <p className="text-sm text-gray-500 mt-2">Ensure your Printful API token is valid and you have internet access.</p>
      </div>
    );
  }

  const products = catalogRes.products || [];
  const statusMap = statusRes.statusMap || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-[#111111]">Printful Catalog Sync</h1>
          <p className="text-[#666666] mt-1 font-body">
            Browse the live Printful catalog. Import new blanks to sync their high-resolution assets into your database.
          </p>
        </div>
        <Link href="/admin/products" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors">
          <RefreshCcw className="w-4 h-4" />
          Refresh Status
        </Link>
      </div>

      <ProductsGrid products={products} statusMap={statusMap} />
    </div>
  );
}
