import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageUp, PenTool, ScanEye } from "lucide-react";
import { KEEPSAKE_FROM_PRICE, KEEPSAKE_SAMPLES } from "@/lib/custom/keepsakes";

export const metadata: Metadata = {
  title: "Personalized Crystal Keepsakes — Your Photo, Our Design",
  description: `Thi Bút turns your photos and words into hand-designed crystal keepsakes for weddings, family and remembrance. You approve the proof before anything is made. From ${KEEPSAKE_FROM_PRICE}.`,
};

// MVP: the home page leads with custom keepsakes. The calligraphy Studio hero
// (src/components/home/*) is paused, not deleted.
const STEPS = [
  {
    icon: ImageUp,
    title: "1. Send Your Photos",
    body: "Choose a size and format, then send your portraits with the names, dates and wording you would like.",
  },
  {
    icon: PenTool,
    title: "2. We Design It",
    body: "A Thi Bút designer composes the artwork by hand and checks every face and every spelling.",
  },
  {
    icon: ScanEye,
    title: "3. You Approve",
    body: "You review a digital proof. Only approved artwork is produced, quality-checked and shipped.",
  },
] as const;

export default function Home() {
  const [heroSample] = KEEPSAKE_SAMPLES;

  return (
    <div className="bg-background text-on-background min-h-screen relative font-body-md">
      <div className="texture-overlay fixed inset-0 z-0" />

      <main className="relative z-10 pb-14 md:pb-section-gap">
        <section className="w-full border-b border-surface-variant">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-6 md:pt-20 pb-12 md:pb-section-gap grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
            <div className="relative aspect-[3/2] rounded-lg overflow-hidden border border-surface-variant bg-surface-container md:order-2">
              <Image
                src={heroSample.imageSrc}
                alt={heroSample.imageAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div className="text-center md:text-left">
              <p className="font-label-caps text-label-caps uppercase text-secondary mb-4">
                Thi Bút · Custom Crystal Keepsakes
              </p>
              <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-4">
                Your Photo. Our Design. Your Approval.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">
                Hand-designed keepsakes for weddings, family and remembrance,
                made from your own photos and words. From {KEEPSAKE_FROM_PRICE}.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link
                  href="/custom"
                  className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  Start a Custom Order
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/gallery"
                  className="inline-flex items-center justify-center min-h-12 border border-outline text-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  See Samples &amp; Prices
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-14 md:py-section-gap"
          id="explore"
        >
          <div className="flex justify-between items-end mb-7 md:mb-12">
            <h2 className="font-headline-md text-headline-md text-primary">
              Sample Designs
            </h2>
            <Link
              className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors motion-reduce:transition-none inline-flex items-center min-h-11 group"
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
            {KEEPSAKE_SAMPLES.map((sample) => (
              <Link
                key={sample.id}
                className="group block w-[78vw] sm:w-[60vw] md:w-auto snap-start shrink-0"
                href="/gallery"
              >
                <div className="relative overflow-hidden aspect-[3/2] bg-surface-container-highest border border-surface-variant mb-5 rounded">
                  <Image
                    alt={sample.imageAlt}
                    fill
                    sizes="(max-width: 768px) 78vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                    src={sample.imageSrc}
                  />
                </div>
                <p className="font-label-caps text-label-caps uppercase text-secondary mb-2">
                  {sample.occasion}
                </p>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                  {sample.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {sample.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-low py-14 md:py-section-gap border-y border-surface-variant">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-10 md:mb-16">
              <h2 className="font-headline-md text-headline-md text-primary mb-4">
                How It Works
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                Nothing is produced until you have seen the design and said yes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-outline-variant z-0" />
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="relative z-10 flex flex-col items-center text-center"
                  >
                    <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8 text-secondary" aria-hidden="true" />
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                      {step.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {step.body}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center mt-10 md:mt-16">
              <Link
                href="/custom"
                className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                See Sizes &amp; Pricing
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
