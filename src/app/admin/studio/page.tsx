import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { getActiveProductsForStudio } from "@/lib/fulfillment/getActiveProducts";

export default async function AdminStudioPage() {
  const products = await getActiveProductsForStudio();

  return (
    <div className="w-full h-full bg-background">
      <StudioWorkspace isAdmin={true} products={products} />
    </div>
  );
}
