import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminArtPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const designs = await prisma.design.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      creator: true,
      category: true,
      _count: {
        select: { products: true, versions: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Artwork &amp; Designs
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage original designs and interpretations.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Title
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Creator
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Category
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Gallery Usage
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {designs.map((design) => (
                <tr
                  key={design.id}
                  className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <Link
                        href={adminPath(`/art/${design.id}`)}
                        className="font-medium text-secondary hover:underline"
                      >
                        {design.title}
                      </Link>
                      <span className="font-body-md text-xs text-on-surface-variant">
                        {design._count.versions} versions
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={adminPath(`/sellers/${design.creatorId}`)}
                      className="font-body-md text-sm text-on-surface hover:underline"
                    >
                      {design.creator.displayName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {design.category?.name || "Uncategorized"}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        design.status === "PUBLISHED"
                          ? "default"
                          : design.status === "REJECTED" ||
                              design.status === "TAKEDOWN"
                            ? "error"
                            : "outline"
                      }
                    >
                      {design.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {design._count.products} Products
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {format(new Date(design.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
              {designs.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No artwork found.
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
