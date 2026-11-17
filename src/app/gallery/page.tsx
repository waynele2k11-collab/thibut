import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Paintbrush } from "lucide-react";
import prisma from "@/lib/prisma";
import { GalleryCard, type GalleryCardItem } from "@/components/gallery/GalleryCard";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";

export const metadata: Metadata = {
  title: "Gallery — Vietnamese Calligraphy Art",
  description:
    "Browse the Thi Bút Gallery of personalized Vietnamese Thư Pháp brush calligraphy. Buy finished designs or use them as inspiration in the Studio.",
};

const FILTER_TO_CATEGORY: Record<string, string> = {
  names: "NAME",
  quotes: "POETRY",
  heritage: "HERITAGE",
  abstract: "ABSTRACT",
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const activeFilter = filter ?? "all";
  const mappedCategory = FILTER_TO_CATEGORY[activeFilter];

  const items = await prisma.galleryItem.findMany({
    where: {
      published: true,
      ...(mappedCategory ? { category: mappedCategory } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedItems: GalleryCardItem[] = items.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    description: item.description,
    sourceText: item.sourceText,
    sourceLanguage: item.sourceLanguage,
    tradition: item.tradition,
    artworkId: item.artworkId,
    artworkPreviewUrl: item.artworkPreviewUrl,
    productionArtworkUrl: item.productionArtworkUrl,
    productType: item.productType,
    productName: item.productName,
    productImageUrl: item.productImageUrl,
    listedPriceMinor: item.listedPriceMinor.toString(),
    currency: item.currency,
    requiresSize: item.requiresSize,
    requiresColor: item.requiresColor,
    defaultColor: item.defaultColor,
    availableSizes: item.availableSizes,
    availableColors: item.availableColors,
    mockupTransform: item.mockupTransform,
    category: item.category,
    productCategory: item.productCategory,
    published: item.published,
    purchasable: item.purchasable,
  }));

  return (
    <div className="w-full flex flex-col bg-background min-h-screen pb-24">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-10 flex flex-col items-center text-center gap-3">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Vietnamese <span lang="vi">Thư Pháp</span>
        </span>
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
          The Gallery
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          Every piece is a starting point.{" "}
          <strong className="text-on-background">Personalize any design</strong>{" "}
          in the Studio — or buy it as-is.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-label-caps text-label-caps text-on-surface-variant mt-1">
          <span>4.9 Rating</span>
          <span className="opacity-30" aria-hidden="true">
            &middot;
          </span>
          <span>Printed in USA</span>
          <span className="opacity-30" aria-hidden="true">
            &middot;
          </span>
          <span>300 DPI Master</span>
        </div>
      </section>

      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <GalleryFilters activeFilter={activeFilter} />

        {serializedItems.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center">
              <Paintbrush className="w-8 h-8 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-background mb-2">
                Gallery coming soon
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
                Our artists are crafting the first pieces now. Be the first to
                personalize your own design in the Studio.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
            >
              Start in Studio <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter mt-6">
            {serializedItems.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
