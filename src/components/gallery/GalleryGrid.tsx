"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { GalleryItem } from "@prisma/client";
import {
  galleryProducts,
  type GalleryCategory,
  type GalleryProductFixture,
  type ProductType,
} from "@/data/gallery";
import { GalleryCard } from "./GalleryCard";
import { GalleryFilters } from "./GalleryFilters";

const EPOCH_DATE = new Date(0);

function fixtureToGalleryItem(fixture: GalleryProductFixture): GalleryItem {
  const isApparel = fixture.productType !== "WALL_ART";
  return {
    id: fixture.id,
    slug: fixture.slug,
    title: fixture.title,
    subtitle: fixture.design.romanization ?? null,
    description: fixture.design.meaning,
    sourceText: fixture.design.sourceText,
    sourceLanguage: fixture.design.language,
    tradition: fixture.design.styleName,
    artworkId: fixture.design.id,
    artworkPreviewUrl: "",
    productionArtworkUrl: "",
    productType: fixture.productType,
    productName: fixture.productName,
    productImageUrl: fixture.mockups[0]?.asset ?? "",
    listedPriceMinor: BigInt(fixture.retailPriceMinor),
    currency: fixture.currency,
    requiresSize: isApparel,
    requiresColor: false,
    defaultColor: fixture.color,
    availableSizes: isApparel ? ["S", "M", "L", "XL"] : [],
    availableColors: [fixture.color],
    mockupTransform: null,
    category: fixture.category,
    productCategory: fixture.productType,
    published: fixture.active,
    purchasable: fixture.active,
    createdAt: EPOCH_DATE,
    updatedAt: EPOCH_DATE,
  };
}

export interface GalleryGridProps {
  items?: GalleryItem[];
}

export function GalleryGrid({ items }: GalleryGridProps = {}) {
  const [category, setCategory] = useState<GalleryCategory | "ALL">("ALL");
  const [productType, setProductType] = useState<ProductType | "ALL">("ALL");

  const resolvedItems = useMemo<GalleryItem[]>(() => {
    if (items) return items;
    return galleryProducts.map(fixtureToGalleryItem);
  }, [items]);

  const filteredItems = useMemo(() => {
    return resolvedItems.filter((item) => {
      const categoryMatch = category === "ALL" || item.category === category;
      const productTypeMatch =
        productType === "ALL" ||
        item.productType === productType ||
        item.productCategory === productType;
      return categoryMatch && productTypeMatch;
    });
  }, [resolvedItems, category, productType]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {filteredItems.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-surface-container-low rounded-lg border border-surface-variant">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Nothing matches these filters yet.
            </h3>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-lg mx-auto">
              You can create exactly what you&apos;re looking for.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center justify-center bg-secondary text-on-secondary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:opacity-90 transition-opacity"
            >
              CREATE YOUR THI BÚT
            </Link>
          </div>
        )}

        {filteredItems.length > 0 && (
          <div className="mt-24 text-center">
            <h3 className="font-headline-sm text-headline-sm text-on-background mb-4 uppercase tracking-widest">
              Your words could be next.
            </h3>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 max-w-lg mx-auto">
              Turn a name, thought, or story into your own Thi Bút.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center justify-center bg-secondary text-on-secondary px-10 py-4 rounded font-label-caps text-label-caps uppercase hover:opacity-90 transition-opacity"
            >
              CREATE YOUR THI BÚT <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
