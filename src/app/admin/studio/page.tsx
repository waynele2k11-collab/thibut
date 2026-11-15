import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getActiveProductsForStudio } from "@/lib/fulfillment/getActiveProducts";
import { MOCK_PRODUCTS } from "@/components/studio/ProductSelectionModal";

export default async function AdminStudioPage() {
  let products = await getActiveProductsForStudio();
  if (!products || products.length === 0) {
    products = MOCK_PRODUCTS;
  }

  return (
    <div className="w-full h-full bg-[#FAF7F2]">
      <StudioWorkspace isAdmin={true} products={products} />
    </div>
  );
}
