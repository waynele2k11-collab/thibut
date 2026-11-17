import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { DeleteGalleryItemButton } from "@/components/admin/DeleteGalleryItemButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminGalleryPage() {
  await requireAdmin();

  const galleryProducts = await prisma.galleryItem.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary mb-2">
            Gallery
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Manage shoppable design catalog.
          </p>
        </div>
        <Link
          href="/admin/gallery/new"
          className="inline-flex items-center justify-center bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
        >
          <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> New Gallery Product
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Image
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Title
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Product Name
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Price
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Created
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {galleryProducts.map((gp) => (
                <tr
                  key={gp.id}
                  className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                >
                  <td className="px-6 py-4">
                    <div className="w-12 h-12 rounded overflow-hidden bg-surface-container border border-surface-variant relative">
                      {gp.productImageUrl && (
                        <Image
                          src={gp.productImageUrl}
                          alt={gp.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/gallery/${gp.id}`}
                      className="font-medium text-secondary hover:underline"
                    >
                      {gp.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface">
                    {gp.productName}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={gp.published ? "default" : "outline"}>
                      {gp.published ? "ACTIVE" : "DRAFT"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface">
                    {formatMinor(gp.listedPriceMinor, gp.currency)}
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {format(new Date(gp.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end">
                      <DeleteGalleryItemButton id={gp.id} title={gp.title} />
                    </div>
                  </td>
                </tr>
              ))}
              {galleryProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No gallery products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
