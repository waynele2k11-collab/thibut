import type { ImageKind } from "@/lib/catalog/keepsakeCatalog";

/**
 * BRD v1.0 APR-009: a concept render must never be presented as a photograph of a
 * finished product. Rendered on top of every catalog image that is not a product photo.
 */
export function ConceptRenderBadge({ imageKind }: { imageKind: ImageKind }) {
  if (imageKind !== "CONCEPT_RENDER") return null;
  return (
    <span className="absolute left-2 bottom-2 z-10 rounded bg-inverse-surface/90 text-inverse-on-surface px-2 py-1 font-label-caps text-label-caps uppercase">
      Concept render
    </span>
  );
}
