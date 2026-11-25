import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { requireAdmin } from "@/utils/admin/auth";
import { updateOrderFulfillmentFormAction } from "@/app/actions/keepsake-admin";
import {
  ADMIN_BUTTON,
  ADMIN_FIELD,
  AdminNotice,
} from "@/components/admin/AdminNotice";
import Link from "next/link";
import { adminPath } from "@/lib/admin-path";
import { ADMIN_FULFILLMENT_STATUSES } from "@/lib/catalog/adminInput";
import {
  FAILED_ORDER_CONFIRM_FIELD,
  FAILED_ORDER_CONFIRM_LABEL,
  FAILED_ORDER_CONFIRM_VALUE,
  FAILED_ORDER_REASON,
  ORDERS_ATTENTION_FILTER,
  PAID_ORDERS_NEEDING_ATTENTION_WHERE,
  orderNeedsAttention,
} from "@/lib/catalog/orderAttention";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; filter?: string }>;
}) {
  await requireAdmin();
  const { notice, error, filter } = await searchParams;
  // `?filter=attention`: only paid orders that failed and are not being made.
  const attentionOnly = filter === ORDERS_ATTENTION_FILTER;

  const orders = await prisma.order.findMany({
    ...(attentionOnly ? { where: PAID_ORDERS_NEEDING_ATTENTION_WHERE } : {}),
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

      <AdminNotice notice={notice} error={error} />

      {attentionOnly && (
        <div
          role="status"
          className="flex flex-col gap-2 p-4 bg-error-container border border-error/30 rounded-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="font-body-md text-sm text-on-error-container">
            Showing {orders.length} paid{" "}
            {orders.length === 1 ? "order that needs" : "orders that need"} attention.
          </p>
          <Link
            href={adminPath("/orders")}
            className="font-label-caps text-label-caps uppercase text-on-error-container hover:underline"
          >
            Show all orders
          </Link>
        </div>
      )}

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
                <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                  In-house fulfilment
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
                const needsAttention = orderNeedsAttention(order);

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
                      {needsAttention && (
                        <p className="mt-2 max-w-xs font-body-md text-xs text-on-error-container">
                          {FAILED_ORDER_REASON}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-body-md text-body-md text-on-surface-variant">
                      {format(new Date(order.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      {order.paymentStatus === "SUCCEEDED" &&
                      !order.externalFulfillmentId ? (
                        <form
                          action={updateOrderFulfillmentFormAction}
                          className="flex flex-col gap-2 min-w-56"
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <label htmlFor={`status-${order.id}`} className="sr-only">
                            Fulfilment status for {order.orderNumber}
                          </label>
                          <select
                            id={`status-${order.id}`}
                            name="fulfillmentStatus"
                            defaultValue={
                              ADMIN_FULFILLMENT_STATUSES.find(
                                (status) => status === order.fulfillmentStatus
                              ) ?? "IN_PRODUCTION"
                            }
                            className={ADMIN_FIELD}
                          >
                            {ADMIN_FULFILLMENT_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          <label htmlFor={`carrier-${order.id}`} className="sr-only">
                            Carrier for {order.orderNumber}
                          </label>
                          <input
                            id={`carrier-${order.id}`}
                            name="trackingCarrier"
                            placeholder="Carrier"
                            maxLength={40}
                            defaultValue={order.trackingCarrier ?? ""}
                            className={ADMIN_FIELD}
                          />
                          <label htmlFor={`tracking-${order.id}`} className="sr-only">
                            Tracking number for {order.orderNumber}
                          </label>
                          <input
                            id={`tracking-${order.id}`}
                            name="trackingNumber"
                            placeholder="Tracking number"
                            maxLength={64}
                            defaultValue={order.trackingNumber ?? ""}
                            className={ADMIN_FIELD}
                          />
                          {needsAttention && (
                            <label className="flex items-start gap-2 font-body-md text-xs text-on-surface">
                              <input
                                type="checkbox"
                                name={FAILED_ORDER_CONFIRM_FIELD}
                                value={FAILED_ORDER_CONFIRM_VALUE}
                                required
                                className="mt-0.5"
                              />
                              <span>{FAILED_ORDER_CONFIRM_LABEL}</span>
                            </label>
                          )}
                          <button type="submit" className={ADMIN_BUTTON}>
                            Update
                          </button>
                        </form>
                      ) : (
                        <span className="font-body-md text-body-md text-on-surface-variant">
                          {order.externalFulfillmentId
                            ? "Handled by an outside provider (legacy)"
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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
