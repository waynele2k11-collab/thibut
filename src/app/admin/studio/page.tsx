import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { loadStudioSharedCatalog } from "@/lib/studio/loadStudioEntryContext";

export default async function AdminStudioPage() {
  const { products, availableFonts } = await loadStudioSharedCatalog();

  return (
    <div className="w-full h-full bg-background">
      <StudioWorkspace
        isAdmin={true}
        products={products}
        availableFonts={availableFonts}
      />
    </div>
  );
}
