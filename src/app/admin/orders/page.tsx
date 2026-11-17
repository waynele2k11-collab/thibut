import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: true,
      items: {
        include: {
          snapshot: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-background mb-2">
            Orders
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Track customer orders, payments, and fulfillment status.
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Order
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Buyer
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Total
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Payment
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Fulfillment
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {orders.map((order) => {
                const buyerLabel =
                  order.buyer?.name ??
                  order.buyer?.email ??
                  order.buyerEmail ??
                  "Guest";

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-body-md text-body-md text-on-background">
                          {order.orderNumber}
                        </span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">
                          {order.items.length}{" "}
                          {order.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-body-md text-body-md text-on-surface-variant">
                      {buyerLabel}
                    </td>
                    <td className="px-6 py-4 font-body-md text-body-md text-on-background">
                      {formatUsdMinor(order.totalMinor)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 font-label-caps text-label-caps uppercase rounded ${
                          order.paymentStatus === "SUCCEEDED"
                            ? "bg-primary text-on-primary"
                            : order.paymentStatus === "FAILED" ||
                                order.paymentStatus === "DISPUTED" ||
                                order.paymentStatus === "REFUNDED"
                              ? "bg-error-container text-on-error-container"
                              : "bg-surface-container-high text-on-surface"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 font-label-caps text-label-caps uppercase rounded ${
                          order.fulfillmentStatus === "DELIVERED" ||
                          order.fulfillmentStatus === "SHIPPED"
                            ? "bg-primary text-on-primary"
                            : order.fulfillmentStatus === "FAILED" ||
                                order.fulfillmentStatus === "CANCELLED"
                              ? "bg-error-container text-on-error-container"
                              : "bg-surface-container-high text-on-surface"
                        }`}
                      >
                        {order.fulfillmentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-body-md text-body-md text-on-surface-variant">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
