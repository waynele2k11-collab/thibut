import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Paintbrush, SlidersHorizontal, Truck } from "lucide-react";
import { Hero } from "@/components/home/Hero";

export const metadata: Metadata = {
  title: "Words Become Art — Personalized Asian Calligraphy & Apparel",
  description:
    "Transform names, quotes, and personal stories into culturally authentic Vietnamese, Japanese, Chinese, and Korean brush calligraphy on fine art prints and premium apparel.",
};

export default function Home() {
  return (
    <div className="bg-background text-on-background min-h-screen relative font-body-md">
      <div className="texture-overlay fixed inset-0 z-0" />

      <main className="relative z-10 pb-section-gap">
        <section className="w-full">
          <Hero />
        </section>

        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-section-gap flex justify-center">
          <div className="w-16 h-px bg-outline-variant" />
        </div>

        <section
          className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-section-gap"
          id="explore"
        >
          <div className="flex justify-between items-end mb-12">
            <h2 className="font-headline-md text-headline-md text-primary">
              Curated Themes
            </h2>
            <Link
              className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors motion-reduce:transition-none flex items-center group"
              href="/gallery"
            >
              VIEW ALL
              <ArrowRight
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform motion-reduce:transition-none motion-reduce:transform-none"
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 md:grid md:grid-cols-3 md:overflow-visible scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <Link
              className="group block min-w-[72vw] sm:min-w-[60vw] md:min-w-0 snap-start shrink-0"
              href="/gallery?filter=names"
            >
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest border border-surface-variant mb-6 rounded">
                <Image
                  alt="Personalized Name Hoodie"
                  fill
                  sizes="(max-width: 768px) 72vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                  src="/mockups/hoodie.jpg"
                />
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-transparent transition-colors motion-reduce:transition-none" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                Names &amp; Identity
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Wear your story with personalized calligraphy on premium garments.
              </p>
            </Link>

            <Link
              className="group block min-w-[72vw] sm:min-w-[60vw] md:min-w-0 snap-start shrink-0"
              href="/gallery?filter=quotes"
            >
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest border border-surface-variant mb-6 rounded">
                <Image
                  alt="Framed Poetry Print"
                  fill
                  sizes="(max-width: 768px) 72vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                  src="/mockups/framed_print.jpg"
                />
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-transparent transition-colors motion-reduce:transition-none" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                Poetry &amp; Quotes
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Elevate your space with framed statements and timeless wisdom.
              </p>
            </Link>

            <Link
              className="group block min-w-[72vw] sm:min-w-[60vw] md:min-w-0 snap-start shrink-0"
              href="/gallery?filter=heritage"
            >
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest border border-surface-variant mb-6 rounded">
                <Image
                  alt="Heritage Seal Stamp"
                  fill
                  sizes="(max-width: 768px) 72vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                  src="/mockups/seal.jpg"
                />
                <div className="absolute inset-0 bg-primary/5 group-hover:bg-transparent transition-colors motion-reduce:transition-none" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                Heritage &amp; Values
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Traditional art prints and intricate seal details honoring your legacy.
              </p>
            </Link>
          </div>
        </section>

        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-section-gap flex justify-center">
          <div className="w-16 h-px bg-outline-variant" />
        </div>

        <section className="bg-surface-container-low py-section-gap border-y border-surface-variant">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-16">
              <h2 className="font-headline-md text-headline-md text-primary mb-4">
                The Process
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                From an artist&rsquo;s brush to a statement piece, understand the journey of personalization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-outline-variant z-0" />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6">
                  <Paintbrush className="w-8 h-8 text-secondary" aria-hidden="true" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                  1. Select Artwork
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Browse exclusive calligraphy designs from master creators, finding the concept that resonates.
                </p>
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6">
                  <SlidersHorizontal className="w-8 h-8 text-secondary" aria-hidden="true" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                  2. Personalize
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Choose your canvas—from premium apparel to fine prints—and customize the scale and placement.
                </p>
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6">
                  <Truck className="w-8 h-8 text-secondary" aria-hidden="true" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                  3. Receive Excellence
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Your personalized piece is meticulously crafted and delivered, ready to make a profound statement.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
