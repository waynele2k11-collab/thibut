import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DesignCard } from "@/components/catalog/DesignCard";
import { DIVISIONS, isDivisionSlug } from "@/lib/catalog/divisions";
import {
  getCatalogDivision,
  listDivisionDesigns,
} from "@/lib/catalog/keepsakeCatalog";

interface Props {
  params: Promise<{ division: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { division } = await params;
  const seed = DIVISIONS.find((d) => d.slug === division);
  if (!seed) return { title: "Not Found", robots: { index: false } };
  return {
    title: `ThiBút ${seed.name} — Crystal-Look Resin Art`,
    description: seed.tagline,
    alternates: { canonical: `/${seed.slug}` },
  };
}

export default async function DivisionPage({ params }: Props) {
  const { division: divisionSlug } = await params;
  if (!isDivisionSlug(divisionSlug)) notFound();

  const [division, designs] = await Promise.all([
    getCatalogDivision(divisionSlug),
    listDivisionDesigns(divisionSlug),
  ]);
  if (!division) notFound();
  const tagline = DIVISIONS.find((d) => d.slug === divisionSlug)?.tagline;

  return (
    <main className="min-h-screen bg-background text-on-background pb-16 md:pb-24">
      <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-8 md:pt-16 pb-8 text-center flex flex-col items-center gap-3">
        <p className="font-label-caps text-label-caps uppercase text-secondary">
          ThiBút {division.name}
        </p>
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary">
          {division.name}
        </h1>
        {tagline && (
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            {tagline}
          </p>
        )}
      </section>

      <section
        aria-labelledby="division-categories"
        className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-10 md:mb-16"
      >
        <h2 id="division-categories" className="sr-only">
          Categories
        </h2>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {division.categories.map((category) => (
            <li key={category.id}>
              <Link
                href={`/${division.slug}/${category.slug}`}
                className="flex h-full min-h-16 items-center justify-between gap-2 rounded-lg border border-surface-variant bg-surface-container-lowest px-4 py-3 hover:border-outline transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                <span className="font-body-md text-body-md text-on-surface">
                  {category.name}
                </span>
                <span className="font-label-caps text-label-caps text-on-surface-variant shrink-0">
                  {category.designCount > 0 ? category.designCount : "Soon"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="division-designs"
        className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop"
      >
        <h2
          id="division-designs"
          className="font-headline-md text-headline-md text-primary mb-6"
        >
          Designs
        </h2>
        {designs.length === 0 ? (
          <div className="rounded-lg border border-surface-variant bg-surface-container-lowest p-8 md:p-12 text-center flex flex-col items-center gap-4">
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
              The first {division.name} designs are being prepared. You can commission a
              custom piece today.
            </p>
            <Link
              href="/custom"
              className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
            >
              Start a Custom Design
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {designs.map((design, index) => (
              <DesignCard key={design.id} design={design} priority={index === 0} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
