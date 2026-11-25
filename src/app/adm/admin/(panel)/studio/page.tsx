import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { loadStudioSharedCatalog } from "@/lib/studio/loadStudioEntryContext";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminStudioPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

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
