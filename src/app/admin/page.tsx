import Link from "next/link";
import prisma from "@/lib/prisma";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function AdminDashboard() {
  const [
    totalUsers,
    activeSellers,
    publishedDesigns,
    totalGalleryProducts,
    pendingReviewsCount,
    failedOrdersCount,
    heldPayoutsCount,
    recentDesigns,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.creatorProfile.count({ where: { status: "ACTIVE" } }),
    prisma.design.count({ where: { status: "PUBLISHED" } }),
    prisma.designProduct.count({ where: { active: true } }),
    prisma.design.count({ where: { status: "REVIEW" } }),
    prisma.order.count({ where: { fulfillmentStatus: "FAILED" } }),
    prisma.creatorEarning.count({ where: { status: "HELD" } }),
    prisma.design.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { creator: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Dashboard
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Operational overview of the Thi Bút platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Users" value={totalUsers} />
        <MetricCard title="Active Sellers" value={activeSellers} />
        <MetricCard title="Published Designs" value={publishedDesigns} />
        <MetricCard title="Gallery Products" value={totalGalleryProducts} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
            Operational Alerts
          </h2>
          <div className="space-y-4">
            {pendingReviewsCount > 0 ? (
              <div className="flex items-center justify-between p-4 bg-error-container border border-error/30 rounded-lg">
                <span className="text-on-error-container font-medium text-sm">
                  {pendingReviewsCount} artwork submissions awaiting review
                </span>
                <Link
                  href="/admin/art"
                  className="font-label-caps text-label-caps uppercase text-on-error-container hover:underline"
                >
                  Review
                </Link>
              </div>
            ) : (
              <div className="p-4 bg-surface-container-low border border-surface-variant rounded-lg">
                <span className="text-on-surface font-medium text-sm">
                  No artwork submissions awaiting review.
                </span>
              </div>
            )}

            {failedOrdersCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-error-container border border-error/30 rounded-lg">
                <span className="text-on-error-container font-medium text-sm">
                  {failedOrdersCount} failed Printful orders
                </span>
                <Link
                  href="/admin/orders"
                  className="font-label-caps text-label-caps uppercase text-on-error-container hover:underline"
                >
                  View
                </Link>
              </div>
            )}

            {heldPayoutsCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant rounded-lg">
                <span className="text-on-surface font-medium text-sm">
                  {heldPayoutsCount} creator payouts on hold
                </span>
                <Link
                  href="/admin/finance"
                  className="font-label-caps text-label-caps uppercase text-secondary hover:underline"
                >
                  View
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {recentDesigns.map((design) => (
              <div
                key={design.id}
                className="flex items-center gap-3 p-3 bg-surface-container-low border border-surface-variant rounded-lg"
              >
                <div
                  className="w-2 h-2 rounded-full bg-secondary shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-sm text-on-surface truncate">
                    {design.creator.displayName} submitted{" "}
                    <strong>{design.title}</strong>
                  </p>
                  <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                    {new Date(design.createdAt).toLocaleDateString()} at{" "}
                    {new Date(design.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <Badge variant="outline">{design.status}</Badge>
              </div>
            ))}
            {recentDesigns.length === 0 && (
              <p className="font-body-md text-sm text-on-surface-variant">
                No recent design submissions.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
