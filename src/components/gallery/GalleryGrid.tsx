"use client";

import { useState } from "react";
import { galleryProducts, type GalleryCategory, type ProductType } from "@/data/gallery";
import { GalleryCard } from "./GalleryCard";
import { GalleryFilters } from "./GalleryFilters";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function GalleryGrid() {
  const [category, setCategory] = useState<GalleryCategory | "ALL">("ALL");
  const [productType, setProductType] = useState<ProductType | "ALL">("ALL");

  const filteredItems = galleryProducts.filter((item) => {
    const categoryMatch = category === "ALL" || item.category === category;
    const productTypeMatch = productType === "ALL" || item.productType === productType;
    return categoryMatch && productTypeMatch;
  });

  return (
    <section className="py-12 md:py-24">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <GalleryFilters 
          currentCategory={category} 
          onCategoryChange={setCategory} 
          currentProductType={productType}
          onProductTypeChange={setProductType}
        />

        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {filteredItems.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-surface-variant/30 rounded-3xl border border-surface-variant">
            <h3 className="font-display-md text-headline-sm text-on-surface mb-4">
              Nothing matches these filters yet.
            </h3>
            <p className="font-body text-body-lg text-on-surface-variant mb-8 max-w-lg mx-auto">
              You can create exactly what you're looking for.
            </p>
            <Link 
              href="/create" 
              className="inline-flex items-center justify-center bg-secondary text-on-secondary px-8 py-4 rounded-full font-label-caps text-label-caps hover:bg-secondary/90 transition-colors"
            >
              CREATE YOUR THI BÚT
            </Link>
          </div>
        )}

        {filteredItems.length > 0 && (
          <div className="mt-24 text-center">
            <h3 className="font-display-md text-headline-sm text-on-background mb-4 uppercase tracking-widest">
              Your words could be next.
            </h3>
            <p className="font-body text-body-lg text-on-surface-variant mb-8 max-w-lg mx-auto">
              Turn a name, thought, or story into your own Thi Bút.
            </p>
            <Link 
              href="/create" 
              className="inline-flex items-center justify-center bg-secondary text-on-secondary px-10 py-4 rounded-full font-label-caps text-label-caps hover:bg-secondary/90 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              CREATE YOUR THI BÚT <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
