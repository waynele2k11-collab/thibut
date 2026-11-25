/**
 * The one fulfilment rule since the in-house pivot (BRD v1.0 §10): a physical item can be sold
 * only when its product is made in-house. Pure: no database, framework or network imports.
 *
 * Checkout and add-to-cart use this to refuse such an item BEFORE any money moves. The
 * paid-order job in `src/lib/inngest.ts` keeps its own fail-loudly check as the last line of
 * defence.
 */

export const IN_HOUSE_FULFILMENT_MODE = "IN_HOUSE" as const;

/** Safe to show a customer. It names no product and gives no internal reason. */
export const ITEM_UNAVAILABLE_MESSAGE =
  "One item in your cart is not available right now";

type ProductLike = { fulfillmentMode?: string | null } | null | undefined;
type VariantLike = { product?: ProductLike } | null | undefined;

/** Exactly "IN_HOUSE". Lower case, blank, missing or any other value is not in-house. */
export function isInHouseProduct(product: ProductLike): boolean {
  return product?.fulfillmentMode === IN_HOUSE_FULFILMENT_MODE;
}

/**
 * True when any PHYSICAL item cannot be made in-house.
 *
 * Pass the catalog variant of each item. A physical item has a variant; a digital item has
 * none (null or undefined) and is ignored here. A variant whose product is missing, or whose
 * product is anything other than in-house, counts as not sellable.
 */
export function hasPhysicalItemNotMadeInHouse(variants: readonly VariantLike[]): boolean {
  return variants.some(
    (variant) => variant !== null && variant !== undefined && !isInHouseProduct(variant.product)
  );
}
