import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { GalleryItemForm } from "./GalleryItemForm";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminNewGalleryProductPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const [designs, products] = await Promise.all([
    prisma.design.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true },
    }),
    prisma.catalogProduct.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, category: true },
    }),
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={adminPath("/gallery")}
        className="inline-flex items-center font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
      >
        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Gallery
      </Link>

      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Create Gallery Product
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Publish a new shoppable design configuration.
        </p>
      </div>

      <Card className="p-8">
        <GalleryItemForm designs={designs} products={products} />
      </Card>
    </div>
  );
}
