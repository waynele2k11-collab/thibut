import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KeepsakeSampleCard } from "@/components/custom/KeepsakeSampleCard";
import { KEEPSAKE_FROM_PRICE, KEEPSAKE_SAMPLES } from "@/lib/custom/keepsakes";

export const metadata: Metadata = {
  title: "Gallery — Custom Crystal Keepsakes",
  description: `Sample Thi Bút crystal keepsakes for weddings and family, with prices by size. Each piece is designed from your own photos. From ${KEEPSAKE_FROM_PRICE}.`,
  alternates: { canonical: "/gallery" },
};

// MVP: the gallery shows custom keepsake samples only. The calligraphy
// product listings (GalleryCard / GalleryFilters, backed by the galleryItem
// table) are paused, not deleted.
export default function GalleryPage() {
  return (
    <div className="w-full flex flex-col bg-background min-h-screen pb-16 md:pb-24">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-8 md:pt-16 pb-8 md:pb-12 flex flex-col items-center text-center gap-3">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Custom Crystal Keepsakes
        </span>
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
          The Gallery
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          Sample designs to start from.{" "}
          <strong className="text-on-background">
            Yours is made from your own photos and words
          </strong>
          , and nothing is produced until you approve the proof.
        </p>
      </section>

      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {KEEPSAKE_SAMPLES.map((sample, index) => (
            <KeepsakeSampleCard
              key={sample.id}
              sample={sample}
              priority={index === 0}
            />
          ))}
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant text-center mt-8 max-w-2xl mx-auto">
          Prices include custom design, a digital proof and one revision round.
          Shipping is quoted with your order. Samples are illustrations; your
          finished piece uses your own photos.
        </p>

        <div className="flex justify-center mt-8">
          <Link
            href="/custom"
            className="inline-flex items-center justify-center gap-2 min-h-12 border border-outline text-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            How a Custom Order Works
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
