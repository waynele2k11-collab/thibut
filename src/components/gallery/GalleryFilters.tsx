"use client";

import type { GalleryCategory, ProductType } from "@/data/gallery";

interface GalleryFiltersProps {
  currentCategory: GalleryCategory | "ALL";
  onCategoryChange: (category: GalleryCategory | "ALL") => void;
  currentProductType: ProductType | "ALL";
  onProductTypeChange: (productType: ProductType | "ALL") => void;
}

export function GalleryFilters({ 
  currentCategory, 
  onCategoryChange,
  currentProductType,
  onProductTypeChange
}: GalleryFiltersProps) {
  const categories: Array<GalleryCategory | "ALL"> = ["ALL", "NAME", "POETRY", "HERITAGE"];
  const productTypes: Array<ProductType | "ALL"> = ["ALL", "TEE", "HOODIE", "TANK", "WALL_ART"];

  return (
    <div className="flex flex-col items-center gap-6 mb-12">
      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-4">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-6 py-2 rounded-full font-label-caps text-label-caps transition-all duration-300 ${
              currentCategory === category
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-variant text-on-surface hover:bg-surface-variant/80"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Type Filter */}
      <div className="flex flex-wrap justify-center gap-4">
        {productTypes.map((type) => (
          <button
            key={type}
            onClick={() => onProductTypeChange(type)}
            className={`px-4 py-1.5 rounded-full font-label-caps text-label-caps text-xs transition-all duration-300 ${
              currentProductType === type
                ? "border-2 border-secondary text-secondary"
                : "border-2 border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {type.replace("_", " ")}
          </button>
        ))}
      </div>
    </div>
  );
}
