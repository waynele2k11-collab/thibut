import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { loadSignInNoticesForCurrentAdmin } from "@/lib/auth/admin-sign-in-report";
import {
  PAID_ORDERS_AWAITING_PRODUCTION_WHERE,
  PAID_ORDERS_NEEDING_ATTENTION_WHERE,
  ordersNeedingAttentionHref,
} from "@/lib/catalog/orderAttention";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { requireAdmin } from "@/utils/admin/auth";

/** First instant of the current month, in UTC. */
function startOfThisMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function AdminDashboard() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();
  const signInNotices = await loadSignInNoticesForCurrentAdmin();
  const monthStart = startOfThisMonthUtc(new Date());

  const [
    awaitingProductionCount,
    paidThisMonthCount,
    activeKeepsakeProducts,
    publishedCatalogDesigns,
    needsAttentionCount,
    recentOrders,
  ] = await Promise.all([
    // Paid, holding a physical item, and not yet moved to production by the paid-order job
    // or by hand. Digital-only orders and legacy provider orders are not counted.
    prisma.order.count({ where: PAID_ORDERS_AWAITING_PRODUCTION_WHERE }),
    prisma.order.count({
      where: { paymentStatus: "SUCCEEDED", placedAt: { gte: monthStart } },
    }),
    prisma.catalogProduct.count({
      where: { fulfillmentMode: "IN_HOUSE", status: "ACTIVE" },
    }),
    prisma.design.count({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        catalogImageUrls: { isEmpty: false },
      },
    }),
    // Paid orders the in-house rule failed. Legacy provider orders are not counted.
    prisma.order.count({ where: PAID_ORDERS_NEEDING_ATTENTION_WHERE }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        totalMinor: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Dashboard
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Orders and catalog at a glance.
        </p>
      </div>

      {needsAttentionCount > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-3 p-5 bg-error-container border-2 border-error rounded-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-headline-sm text-headline-sm text-on-error-container">
              {needsAttentionCount} paid{" "}
              {needsAttentionCount === 1 ? "order needs" : "orders need"} attention
            </p>
            <p className="font-body-md text-sm text-on-error-container mt-1">
              The customer has paid and nothing is being made. Open the{" "}
              {needsAttentionCount === 1 ? "order" : "orders"} to see why, then refund in
              Stripe or contact the customer.
            </p>
          </div>
          <Link
            href={ordersNeedingAttentionHref(adminPath("/orders"))}
            className="inline-flex shrink-0 items-center justify-center px-4 py-2 rounded-lg bg-error text-on-primary font-label-caps text-label-caps uppercase hover:opacity-90"
          >
            Review {needsAttentionCount === 1 ? "order" : "orders"}
          </Link>
        </div>
      )}

      {signInNotices.length > 0 && (
        <div className="space-y-3" role="status" aria-label="Sign-in activity">
          {signInNotices.map((notice) => (
            <div
              key={notice.text}
              className={
                notice.tone === "warning"
                  ? "p-4 bg-error-container border border-error/30 rounded-lg text-on-error-container font-medium text-sm"
                  : "p-4 bg-surface-container-low border border-surface-variant rounded-lg text-on-surface font-medium text-sm"
              }
            >
              {notice.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Orders awaiting production"
          value={awaitingProductionCount}
        />
        <MetricCard title="Paid orders this month" value={paidThisMonthCount} />
        <MetricCard
          title="Active keepsake products"
          value={activeKeepsakeProducts}
        />
        <MetricCard
          title="Published catalog designs"
          value={publishedCatalogDesigns}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
            Needs attention
          </h2>
          <div className="space-y-4">
            {needsAttentionCount > 0 ? (
              <div className="flex items-center justify-between p-4 bg-error-container border border-error/30 rounded-lg">
                <span className="text-on-error-container font-medium text-sm">
                  {needsAttentionCount} paid{" "}
                  {needsAttentionCount === 1 ? "order" : "orders"} failed and{" "}
                  {needsAttentionCount === 1 ? "is" : "are"} not being made
                </span>
                <Link
                  href={ordersNeedingAttentionHref(adminPath("/orders"))}
                  className="font-label-caps text-label-caps uppercase text-on-error-container hover:underline"
                >
                  View
                </Link>
              </div>
            ) : (
              <div className="p-4 bg-surface-container-low border border-surface-variant rounded-lg">
                <span className="text-on-surface font-medium text-sm">
                  No paid order has failed.
                </span>
              </div>
            )}

            {awaitingProductionCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-surface-container-high border border-outline-variant rounded-lg">
                <span className="text-on-surface font-medium text-sm">
                  {awaitingProductionCount} paid{" "}
                  {awaitingProductionCount === 1 ? "order is" : "orders are"} not
                  in production yet
                </span>
                <Link
                  href={adminPath("/orders")}
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
            Recent orders
          </h2>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 p-3 bg-surface-container-low border border-surface-variant rounded-lg"
              >
                <div
                  className="w-2 h-2 rounded-full bg-secondary shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body-md text-sm text-on-surface truncate">
                    <strong>{order.orderNumber}</strong> ·{" "}
                    {formatUsdMinor(order.totalMinor)}
                  </p>
                  <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString()} · payment{" "}
                    {order.paymentStatus.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <Badge variant="outline">
                  {order.fulfillmentStatus.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="font-body-md text-sm text-on-surface-variant">
                No orders yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
