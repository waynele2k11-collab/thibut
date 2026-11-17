import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function AdminArtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const design = await prisma.design.findUnique({
    where: { id },
    include: {
      creator: true,
      category: true,
      versions: { orderBy: { versionNumber: "desc" } },
      products: { include: { catalogProduct: true } },
    },
  });

  if (!design) {
    notFound();
  }

  const latestVersion = design.versions[0];

  return (
    <div className="space-y-8">
      <Link
        href="/admin/art"
        className="inline-flex items-center font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
      >
        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Art
      </Link>

      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          {design.title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          By {design.creator.displayName}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Artwork Preview
            </h2>
            <div className="w-full aspect-video bg-surface-container-low rounded-lg border border-surface-variant flex flex-col items-center justify-center text-on-surface-variant">
              <ImageIcon className="w-12 h-12 mb-4 opacity-50" aria-hidden="true" />
              <p className="font-body-md text-sm">
                Immutable Original Asset (INV-001)
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Metadata
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Category
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {design.category?.name || "Uncategorized"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Visibility
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {design.visibility}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Description
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {design.description || "No description provided."}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Gallery Usage
            </h2>
            {design.products.length > 0 ? (
              <div className="space-y-4">
                {design.products.map((dp) => (
                  <div
                    key={dp.id}
                    className="flex items-center justify-between py-2 border-b border-surface-variant last:border-0"
                  >
                    <div>
                      <span className="font-body-md text-sm font-medium text-on-surface">
                        {dp.catalogProduct.name} —{" "}
                        {dp.defaultPlacement || "Default Placement"}
                      </span>
                    </div>
                    <Badge variant={dp.active ? "default" : "outline"}>
                      {dp.active ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                Not used in any gallery products.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Current Status
                </span>
                <Badge
                  variant={
                    design.status === "PUBLISHED" ? "default" : "outline"
                  }
                >
                  {design.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Latest Version
                </span>
                <span className="text-sm font-mono text-on-surface">
                  v{latestVersion?.versionNumber || 1}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
