import Link from "next/link";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function AdminSellersPage() {
  const sellers = await prisma.creatorProfile.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      _count: {
        select: { designs: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Sellers
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage creator profiles and Stripe Connect onboarding.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Creator
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Stripe Connect
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Designs
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {sellers.map((seller) => (
                <tr
                  key={seller.id}
                  className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <Link
                        href={`/admin/sellers/${seller.id}`}
                        className="font-medium text-secondary hover:underline"
                      >
                        {seller.displayName}
                      </Link>
                      <span className="font-body-md text-xs text-on-surface-variant">
                        @{seller.slug}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        seller.status === "ACTIVE"
                          ? "default"
                          : seller.status === "SUSPENDED" ||
                              seller.status === "RESTRICTED"
                            ? "error"
                            : "outline"
                      }
                    >
                      {seller.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={seller.stripeAccountId ? "default" : "outline"}
                    >
                      {seller.stripeAccountId ? "CONNECTED" : "PENDING"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface">
                    {seller._count.designs}
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {format(new Date(seller.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
              {sellers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No sellers found.
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
