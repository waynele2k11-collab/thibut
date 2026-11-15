import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { GalleryFilters } from "@/components/gallery/GalleryFilters";
import Link from "next/link";
import { ArrowRight, Paintbrush } from "lucide-react";

export const metadata: Metadata = {
  title: "Gallery — Vietnamese Calligraphy Art | Thi Bút",
  description: "Browse the Thi Bút Gallery of personalized Vietnamese Thư Pháp brush calligraphy. Buy finished designs or use them as inspiration in the Studio.",
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  const items = await prisma.galleryItem.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="w-full flex flex-col bg-[#FBF9F5] min-h-screen pb-24">
      {/* Page Header */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-10 flex flex-col items-center text-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant font-label-caps">
          Vietnamese Thư Pháp
        </span>
        <h1 className="font-display-lg text-4xl md:text-5xl text-on-background font-bold leading-tight">
          The Gallery
        </h1>
        <p className="font-body-lg text-base sm:text-lg text-on-surface-variant max-w-xl leading-relaxed">
          Every piece is a starting point.{" "}
          <strong className="text-on-background">Personalize any design</strong> in the Studio — or buy it as-is.
        </p>

        {/* Trust mini-strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-on-surface-variant mt-1">
          <span>⭐ 4.9 rating</span>
          <span className="opacity-30">·</span>
          <span>🖨 Printed in USA</span>
          <span className="opacity-30">·</span>
          <span>📐 300 DPI Vector</span>
        </div>
      </section>

      {/* Filter Chips + Grid */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6">
        <GalleryFilters activeFilter={filter ?? "all"} />

        {items.length === 0 ? (
          /* Premium empty state */
          <div className="w-full flex flex-col items-center justify-center py-24 gap-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#F4EFE6] border border-[#E5E0D8] flex items-center justify-center">
              <Paintbrush className="w-8 h-8 text-on-surface-variant" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-on-background mb-2">Gallery coming soon</h2>
              <p className="text-on-surface-variant text-sm max-w-sm">
                Our artists are crafting the first pieces now. Be the first to personalize your own design in the Studio.
              </p>
            </div>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-[#111111] text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-black active:scale-[0.99] transition-all"
            >
              Start in Studio <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-6">
            {items.map((item) => (
              <GalleryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
