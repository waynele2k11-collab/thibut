import Image from "next/image";
import Link from "next/link";
import type { CatalogDesignSummary } from "@/lib/catalog/keepsakeCatalog";
import { ConceptRenderBadge } from "./ConceptRenderBadge";

export function DesignCard({
  design,
  priority = false,
}: {
  design: CatalogDesignSummary;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/design/${design.slug}`}
      className="group flex flex-col rounded-lg border border-surface-variant bg-surface-container-lowest overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
    >
      <div className="relative aspect-[3/2] bg-surface-container overflow-hidden">
        <Image
          src={design.imageUrl}
          alt={design.title}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
        />
        <ConceptRenderBadge imageKind={design.imageKind} />
      </div>
      <div className="flex flex-col gap-1 p-4 md:p-5">
        {design.categoryName && (
          <p className="font-label-caps text-label-caps uppercase text-secondary">
            {design.categoryName}
          </p>
        )}
        <h3 className="font-headline-sm text-headline-sm text-primary">
          {design.title}
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {design.fromLabel ? `From ${design.fromLabel}` : "By quotation"}
        </p>
      </div>
    </Link>
  );
}
