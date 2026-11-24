import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ImageUp, PenTool, ScanEye } from "lucide-react";
import { ConceptRenderBadge } from "@/components/catalog/ConceptRenderBadge";
import { DesignCard } from "@/components/catalog/DesignCard";
import { DIVISIONS } from "@/lib/catalog/divisions";
import { listFeaturedDesigns } from "@/lib/catalog/keepsakeCatalog";

export const metadata: Metadata = {
  title: "ThiBút — Art Beyond the Surface",
  description:
    "Personalized crystal-look resin gifts, recognition pieces and interior décor. Buy a ready-made design or commission a custom composition from your own photos and words.",
};

const STEPS = [
  {
    icon: ImageUp,
    title: "1. Choose or Send",
    body: "Buy a ready-made design as shown, or send your photos, names and wording for a custom design.",
  },
  {
    icon: PenTool,
    title: "2. We Design It",
    body: "For custom orders a ThiBút designer composes the artwork and checks every face and every spelling.",
  },
  {
    icon: ScanEye,
    title: "3. You Approve",
    body: "You review a digital proof. Only approved custom artwork is produced, quality-checked and shipped.",
  },
] as const;

export default async function Home() {
  const featured = await listFeaturedDesigns(6);
  const hero = featured[0] ?? null;

  return (
    <div className="bg-background text-on-background min-h-screen relative font-body-md">
      <div className="texture-overlay fixed inset-0 z-0" />

      <main className="relative z-10 pb-14 md:pb-section-gap">
        <section className="w-full border-b border-surface-variant">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-6 md:pt-20 pb-12 md:pb-section-gap grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
            {hero && (
              <Link
                href={`/design/${hero.slug}`}
                className="relative block aspect-[3/2] rounded-lg overflow-hidden border border-surface-variant bg-surface-container md:order-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <Image
                  src={hero.imageUrl}
                  alt={hero.title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <ConceptRenderBadge imageKind={hero.imageKind} />
              </Link>
            )}

            <div className="text-center md:text-left">
              <p className="font-label-caps text-label-caps uppercase text-secondary mb-4">
                ThiBút · Art Beyond the Surface
              </p>
              <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-4">
                Your Photo. Our Design. Your Approval.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-6">
                Crystal-look resin gifts, recognition pieces and décor, made to order
                from artwork, poetry and your own photos.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link
                  href="/personal"
                  className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  Shop Designs
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/custom"
                  className="inline-flex items-center justify-center min-h-12 border border-outline text-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  Custom Design
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-divisions"
          className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-14 md:pt-section-gap"
        >
          <h2
            id="home-divisions"
            className="font-headline-md text-headline-md text-primary mb-7 md:mb-12"
          >
            Three Collections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {DIVISIONS.map((division) => (
              <Link
                key={division.slug}
                href={`/${division.slug}`}
                className="group flex flex-col justify-between gap-6 rounded-lg border border-surface-variant bg-surface-container-lowest p-6 md:p-8 hover:border-outline transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <div>
                  <p className="font-label-caps text-label-caps uppercase text-secondary mb-3">
                    ThiBút
                  </p>
                  <h3 className="font-headline-md text-headline-md text-primary mb-3">
                    {division.name}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {division.tagline}
                  </p>
                </div>
                <span className="inline-flex items-center font-label-caps text-label-caps uppercase text-primary">
                  Explore
                  <ArrowRight
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform motion-reduce:transition-none motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {featured.length > 0 && (
          <section
            aria-labelledby="home-featured"
            className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-14 md:py-section-gap"
            id="explore"
          >
            <h2
              id="home-featured"
              className="font-headline-md text-headline-md text-primary mb-7 md:mb-12"
            >
              Featured Designs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
              {featured.map((design) => (
                <DesignCard key={design.id} design={design} />
              ))}
            </div>
          </section>
        )}

        <section className="bg-surface-container-low py-14 md:py-section-gap border-y border-surface-variant">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-10 md:mb-16">
              <h2 className="font-headline-md text-headline-md text-primary mb-4">
                How It Works
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                No custom piece is produced until you have seen the design and said yes.
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
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                See the Full Process
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
