import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";
import Link from "next/link";
import { ArrowRight, Paintbrush } from "lucide-react";

export const metadata: Metadata = {
  title: "Gallery — Vietnamese Calligraphy Art | Thi Bút",
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

  return (
    <div className="w-full flex flex-col bg-background min-h-screen pb-24">
      {/* Page Header */}
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-10 flex flex-col items-center text-center gap-3">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Vietnamese Thư Pháp
        </span>
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
          The Gallery
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          Every piece is a starting point.{" "}
          <strong className="text-on-background">Personalize any design</strong>{" "}
          in the Studio — or buy it as-is.
        </p>

        {/* Trust mini-strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-label-caps text-label-caps text-on-surface-variant mt-1">
          <span>4.9 Rating</span>
          <span className="opacity-30">&middot;</span>
          <span>Printed in USA</span>
          <span className="opacity-30">&middot;</span>
          <span>300 DPI Master</span>
        </div>
      </section>

      {/* Filter Chips + Grid */}
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <GalleryFilters activeFilter={activeFilter} />

        {items.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center">
              <Paintbrush className="w-8 h-8 text-on-surface-variant" />
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
              className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors"
            >
              Start in Studio <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter mt-6">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
