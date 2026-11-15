import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getActiveProductsForStudio } from "@/lib/fulfillment/getActiveProducts";
import { MOCK_PRODUCTS } from "@/components/studio/ProductSelectionModal";
import { StudioOnboardingModal } from "@/components/studio/StudioOnboardingModal";

export default async function CreateSessionPage() {
  let products = await getActiveProductsForStudio();
  if (!products || products.length === 0) {
    products = MOCK_PRODUCTS;
  }

  return (
    <div className="w-full h-full bg-[#FAF7F2] relative">
      <StudioOnboardingModal />
      <StudioWorkspace isAdmin={false} products={products} />
    </div>
  );
}
