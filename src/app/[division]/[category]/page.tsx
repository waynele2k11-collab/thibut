import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DesignCard } from "@/components/catalog/DesignCard";
import { DIVISIONS, isDivisionSlug } from "@/lib/catalog/divisions";
import {
  getCatalogDivision,
  listDivisionDesigns,
} from "@/lib/catalog/keepsakeCatalog";

interface Props {
  params: Promise<{ division: string; category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { division, category } = await params;
  if (!isDivisionSlug(division)) {
    return { title: "Not Found", robots: { index: false } };
  }
  const found = (await getCatalogDivision(division))?.categories.find(
    (c) => c.slug === category
  );
  if (!found) return { title: "Not Found", robots: { index: false } };
  return {
    title: `${found.name} — ThiBút`,
    alternates: { canonical: `/${division}/${category}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { division: divisionSlug, category: categorySlug } = await params;
  if (!isDivisionSlug(divisionSlug)) notFound();

  const division = await getCatalogDivision(divisionSlug);
  const category = division?.categories.find((c) => c.slug === categorySlug);
  if (!division || !category) notFound();

  const designs = await listDivisionDesigns(divisionSlug, categorySlug);
  const inputs = DIVISIONS.find((d) => d.slug === divisionSlug)?.subcategories.find(
    (s) => s.slug === categorySlug
  )?.inputs;

  return (
    <main className="min-h-screen bg-background text-on-background pb-16 md:pb-24">
      <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-6 md:pt-12 pb-8">
        <Link
          href={`/${division.slug}`}
          className="inline-flex items-center gap-2 min-h-11 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {division.name}
        </Link>
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mt-2">
          {category.name}
        </h1>
        {inputs && (
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-3 max-w-2xl">
            For a custom design we work from: {inputs.charAt(0).toLowerCase()}
            {inputs.slice(1)}
          </p>
        )}
      </section>

      <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        {designs.length === 0 ? (
          <div className="rounded-lg border border-surface-variant bg-surface-container-lowest p-8 md:p-12 text-center flex flex-col items-center gap-4">
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
              Ready-made {category.name} designs are coming soon. You can commission a
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
