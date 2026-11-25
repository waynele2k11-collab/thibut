/**
 * Which paid orders the admin must look at, and the rule for moving a failed order by hand.
 * Pure: plain data and functions, no database or framework imports, so it can be unit tested.
 *
 * An order is marked FAILED by the paid-order job when it holds a physical item that is not
 * made in-house (`src/lib/inngest.ts`). Checkout refuses such items before payment, so this
 * should never happen; if it does, the customer has paid and nothing is being made.
 */
import type { Prisma } from "@prisma/client";

/** `?filter=attention` on the admin Orders page lists only the orders below. */
export const ORDERS_FILTER_PARAM = "filter";
export const ORDERS_ATTENTION_FILTER = "attention";

/**
 * Paid, failed by the in-house rule, and ours to fix. An order that carries an outside
 * provider's order id predates in-house production: it cannot be changed here and is not
 * counted, or it would stay in the count for ever.
 */
export const PAID_ORDERS_NEEDING_ATTENTION_WHERE = {
  paymentStatus: "SUCCEEDED",
  fulfillmentStatus: "FAILED",
  externalFulfillmentId: null,
} satisfies Prisma.OrderWhereInput;

/**
 * Paid, not yet in production, and holding at least one physical item. A digital-only order
 * is delivered by the "order/paid" job and never goes into production, so it is not counted.
 * Legacy provider orders are not counted either (see above).
 */
export const PAID_ORDERS_AWAITING_PRODUCTION_WHERE = {
  paymentStatus: "SUCCEEDED",
  fulfillmentStatus: { in: ["PENDING", "PROCESSING"] },
  externalFulfillmentId: null,
  items: {
    some: {
      OR: [{ catalogVariantId: { not: null } }, { catalogProductId: { not: null } }],
    },
  },
} satisfies Prisma.OrderWhereInput;

/** True for an order the admin can and must act on. */
export function orderNeedsAttention(order: {
  paymentStatus: string;
  fulfillmentStatus: string;
  externalFulfillmentId?: string | null;
}): boolean {
  return (
    order.paymentStatus === "SUCCEEDED" &&
    order.fulfillmentStatus === "FAILED" &&
    !order.externalFulfillmentId
  );
}

/** Shown to the admin only. It carries no customer data. */
export const FAILED_ORDER_REASON =
  "Paid, but not in production: this order holds an item that is not made in-house. Refund it in Stripe, or contact the customer.";

export const FAILED_ORDER_CONFIRM_FIELD = "confirmFailedOrder";
export const FAILED_ORDER_CONFIRM_VALUE = "yes";
export const FAILED_ORDER_CONFIRM_LABEL =
  "I have checked this order and it can be made in-house";
export const FAILED_ORDER_CONFIRM_ERROR =
  "This order failed. Tick the confirmation box before moving it.";

/**
 * A FAILED order moves only when the admin ticked the confirmation box. Any other order
 * moves as before. `confirmValue` is the raw form value.
 */
export function mayMoveOrder(currentFulfillmentStatus: string, confirmValue: unknown): boolean {
  if (currentFulfillmentStatus !== "FAILED") return true;
  return confirmValue === FAILED_ORDER_CONFIRM_VALUE;
}

/** The address of the filtered Orders list, given the admin Orders address. */
export function ordersNeedingAttentionHref(ordersPath: string): string {
  return `${ordersPath}?${ORDERS_FILTER_PARAM}=${ORDERS_ATTENTION_FILTER}`;
}
