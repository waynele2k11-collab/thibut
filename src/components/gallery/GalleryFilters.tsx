"use client";

import { useRouter } from "next/navigation";
import type { GalleryCategory, ProductType } from "@/data/gallery";

const FILTERS = [
  { id: "all", label: "All Works" },
  { id: "names", label: "Names & Identity" },
  { id: "quotes", label: "Poetry & Quotes" },
  { id: "heritage", label: "Heritage & Values" },
  { id: "abstract", label: "Abstract" },
] as const;

const CATEGORY_TABS: { id: GalleryCategory | "ALL"; label: string }[] = [
  { id: "ALL", label: "All Themes" },
  { id: "NAME", label: "Names" },
  { id: "POETRY", label: "Poetry & Quotes" },
  { id: "HERITAGE", label: "Heritage" },
];

const PRODUCT_TABS: { id: ProductType | "ALL"; label: string }[] = [
  { id: "ALL", label: "All Formats" },
  { id: "TEE", label: "Tees" },
  { id: "HOODIE", label: "Hoodies" },
  { id: "TANK", label: "Tanks" },
  { id: "WALL_ART", label: "Wall Art" },
];

export interface GalleryFiltersProps {
  activeFilter?: string;
  currentCategory?: GalleryCategory | "ALL";
  onCategoryChange?: (category: GalleryCategory | "ALL") => void;
  currentProductType?: ProductType | "ALL";
  onProductTypeChange?: (productType: ProductType | "ALL") => void;
}

export function GalleryFilters({
  activeFilter,
  currentCategory,
  onCategoryChange,
  currentProductType,
  onProductTypeChange,
}: GalleryFiltersProps) {
  const router = useRouter();

  // Controlled client-state mode (used by GalleryGrid)
  if (onCategoryChange && onProductTypeChange) {
    const selectedCat = currentCategory ?? "ALL";
    const selectedProd = currentProductType ?? "ALL";

    return (
      <div className="flex flex-col gap-4 mb-10">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_TABS.map((tab) => {
            const isActive = tab.id === selectedCat;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onCategoryChange(tab.id)}
                className={`px-4 py-2 rounded-full font-label-caps text-label-caps uppercase transition-colors ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {PRODUCT_TABS.map((tab) => {
            const isActive = tab.id === selectedProd;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onProductTypeChange(tab.id)}
                className={`px-3 py-1.5 rounded font-label-caps text-label-caps uppercase transition-colors ${
                  isActive
                    ? "bg-surface-container-highest border border-primary text-primary"
                    : "bg-surface-container-low border border-surface-variant text-on-surface-variant hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // URL search-param mode (used by /gallery page)
  const resolvedFilter = activeFilter ?? "all";

  const setFilter = (id: string) => {
    if (id === "all") {
      router.push("/gallery");
    } else {
      router.push(`/gallery?filter=${encodeURIComponent(id)}`);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      {FILTERS.map((f) => {
        const isActive =
          f.id === resolvedFilter ||
          (f.id === "all" && resolvedFilter === "all");
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full font-label-caps text-label-caps uppercase transition-colors ${
              isActive
                ? "bg-primary text-on-primary"
                : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
