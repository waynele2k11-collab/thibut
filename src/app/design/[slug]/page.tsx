import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ConceptRenderBadge } from "@/components/catalog/ConceptRenderBadge";
import { DesignPurchasePanel } from "@/components/catalog/DesignPurchasePanel";
import { orderMailto } from "@/lib/catalog/contact";
import { getCatalogDesign } from "@/lib/catalog/keepsakeCatalog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const design = await getCatalogDesign(slug);
  if (!design) return { title: "Not Found", robots: { index: false } };
  return {
    title: design.title,
    description: design.description ?? undefined,
    alternates: { canonical: `/design/${design.slug}` },
  };
}

export default async function DesignPage({ params }: Props) {
  const { slug } = await params;
  const design = await getCatalogDesign(slug);
  if (!design) notFound();

  const buyable = design.products.find((product) => product.status === "ACTIVE");
  const quoteOnly = design.products.find(
    (product) => product.status === "QUOTE_ONLY"
  );
  const customHref = `/custom?design=${encodeURIComponent(design.slug)}`;
  const backHref = design.division
    ? design.category
      ? `/${design.division.slug}/${design.category.slug}`
      : `/${design.division.slug}`
    : "/";

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-6 md:py-12">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 min-h-11 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {design.category?.name ?? design.division?.name ?? "Home"}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-4 items-start">
          <div className="flex flex-col gap-4">
            {design.imageUrls.map((url, index) => (
              <div
                key={url}
                className="relative aspect-[3/2] rounded-lg overflow-hidden border border-surface-variant bg-surface-container"
              >
                <Image
                  src={url}
                  alt={
                    index === 0
                      ? design.title
                      : `${design.title}, alternate view ${index + 1}`
                  }
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <ConceptRenderBadge imageKind={design.imageKind} />
              </div>
            ))}
            {design.imageKind === "CONCEPT_RENDER" && (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Images are illustrative concept renders, not photographs of a finished
                piece. Each piece is cast by hand, so the finished item will vary.
              </p>
            )}
          </div>

          <div className="lg:sticky lg:top-28">
            {design.categoryName && (
              <p className="font-label-caps text-label-caps uppercase text-secondary mb-3">
                {design.division ? `${design.division.name} · ` : ""}
                {design.categoryName}
              </p>
            )}
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-headline-md md:text-headline-md text-primary mb-4">
              {design.title}
            </h1>
            {design.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                {design.description}
              </p>
            )}
            {buyable && (
              <p className="font-body-md text-body-md text-on-surface mb-6">
                {buyable.name}
                {buyable.description ? ` — ${buyable.description}` : ""}
              </p>
            )}

            {buyable ? (
              <DesignPurchasePanel
                designId={design.id}
                designTitle={design.title}
                product={buyable}
                customHref={customHref}
              />
            ) : (
              <div className="border-t border-surface-variant pt-5 flex flex-col gap-3">
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {quoteOnly
                    ? "This piece is made to your dimensions and priced by quotation."
                    : "This design is not available to buy online yet."}
                </p>
                <a
                  href={orderMailto(`Quote request — ${design.title}`)}
                  className="inline-flex w-full items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  Request a Quote
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
