import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  IN_HOUSE_FULFILMENT_MODE,
  ITEM_UNAVAILABLE_MESSAGE,
  hasPhysicalItemNotMadeInHouse,
  isInHouseProduct,
} from "../src/lib/catalog/fulfilmentMode";
import {
  FAILED_ORDER_CONFIRM_FIELD,
  FAILED_ORDER_CONFIRM_VALUE,
  ORDERS_ATTENTION_FILTER,
  PAID_ORDERS_AWAITING_PRODUCTION_WHERE,
  PAID_ORDERS_NEEDING_ATTENTION_WHERE,
  mayMoveOrder,
  orderNeedsAttention,
  ordersNeedingAttentionHref,
} from "../src/lib/catalog/orderAttention";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// AC-M1 (docs/ADMIN_CLEANUP_REVIEW.md): a physical item that is not made in-house must be
// refused before payment, so that a paid order can never end FAILED for that reason.

test("only a product whose mode is exactly IN_HOUSE is in-house", () => {
  assert.equal(IN_HOUSE_FULFILMENT_MODE, "IN_HOUSE");
  assert.equal(isInHouseProduct({ fulfillmentMode: "IN_HOUSE" }), true);
  for (const mode of ["PRINTFUL", "in_house", "In_House", " IN_HOUSE", "IN_HOUSE ", "", "DIGITAL"]) {
    assert.equal(isInHouseProduct({ fulfillmentMode: mode }), false, `"${mode}"`);
  }
  assert.equal(isInHouseProduct({ fulfillmentMode: null }), false);
  assert.equal(isInHouseProduct({}), false);
  assert.equal(isInHouseProduct(null), false);
  assert.equal(isInHouseProduct(undefined), false);
});

test("a physical item not made in-house is found; in-house and digital items are not", () => {
  const inHouse = { product: { fulfillmentMode: "IN_HOUSE" } };
  const legacy = { product: { fulfillmentMode: "PRINTFUL" } };

  // In-house only: unchanged.
  assert.equal(hasPhysicalItemNotMadeInHouse([inHouse]), false);
  assert.equal(hasPhysicalItemNotMadeInHouse([inHouse, inHouse]), false);
  // A digital item has no catalog variant: it is not a physical item and is ignored.
  assert.equal(hasPhysicalItemNotMadeInHouse([null]), false);
  assert.equal(hasPhysicalItemNotMadeInHouse([undefined]), false);
  assert.equal(hasPhysicalItemNotMadeInHouse([inHouse, null]), false);
  assert.equal(hasPhysicalItemNotMadeInHouse([]), false);
  // Any physical item that is not in-house refuses the whole cart.
  assert.equal(hasPhysicalItemNotMadeInHouse([legacy]), true);
  assert.equal(hasPhysicalItemNotMadeInHouse([inHouse, legacy]), true);
  assert.equal(hasPhysicalItemNotMadeInHouse([null, legacy]), true);
  // A variant whose product cannot be read is never assumed to be in-house.
  assert.equal(hasPhysicalItemNotMadeInHouse([{ product: null }]), true);
  assert.equal(hasPhysicalItemNotMadeInHouse([{}]), true);
  assert.equal(hasPhysicalItemNotMadeInHouse([{ product: {} }]), true);
});

test("the customer message names no product and gives no internal reason", () => {
  assert.equal(ITEM_UNAVAILABLE_MESSAGE, "One item in your cart is not available right now");
  assert.equal(/printful|provider|in-house|fulfil/i.test(ITEM_UNAVAILABLE_MESSAGE), false);
});

test("all three checkout paths refuse before a price is quoted, an order is written or Stripe is called", () => {
  const source = read("src/lib/services/CheckoutService.ts");
  assert.match(
    source,
    /export function assertPhysicalItemsMadeInHouse\([\s\S]{0,200}if \(hasPhysicalItemNotMadeInHouse\(variants\)\) \{\s*throw new CheckoutHttpError\(409, ITEM_UNAVAILABLE_MESSAGE\);/
  );

  const paths: Array<[string, string, string]> = [
    [
      "async function executeCartCheckout(",
      "assertPhysicalItemsMadeInHouse(cart.items.map((item) => item.catalogVariant));",
      "async function executeDirectCheckout(",
    ],
    [
      "async function executeDirectCheckout(",
      "assertPhysicalItemsMadeInHouse([variant]);",
      "export async function createGalleryCheckoutSession(",
    ],
    [
      "async function executeGalleryCheckout(",
      "assertPhysicalItemsMadeInHouse([resolvedVariant]);",
      "", // to the end of the file
    ],
  ];
  for (const [start, guard, end] of paths) {
    const from = source.indexOf(start);
    assert.ok(from > 0, `${start} exists`);
    const to = end ? source.indexOf(end, from + 1) : source.length;
    const body = source.slice(from, to);
    const guardAt = body.indexOf(guard);
    assert.ok(guardAt > 0, `${start} must call the in-house guard`);
    assert.equal(body.indexOf(guard, guardAt + 1), -1, "the guard is called once");
    for (const later of [
      "calculateItemQuote(",
      "calculateGalleryItemQuote(",
      "tryFindReusable",
      "prisma.$transaction(",
      "createStripeCheckoutSessionWithIdempotency(",
    ]) {
      const laterAt = body.indexOf(later);
      if (laterAt !== -1) {
        assert.ok(guardAt < laterAt, `${start}: the guard must come before ${later}`);
      }
    }
  }
  // The cart path checks ownership first, so a stranger learns nothing about someone's cart.
  const cartBody = source.slice(
    source.indexOf("async function executeCartCheckout("),
    source.indexOf("async function executeDirectCheckout(")
  );
  assert.ok(
    cartBody.indexOf('"Forbidden: cart does not belong to caller"') <
      cartBody.indexOf("assertPhysicalItemsMadeInHouse(")
  );
});

test("both add-to-cart actions refuse a product that is not made in-house, before any write", () => {
  const source = read("src/app/actions/cart.ts");
  for (const [start, end] of [
    ["export async function addCatalogItemToCartAction(", "export async function addToCartAction("],
    ["export async function addToCartAction(", "export async function getCartCountAction("],
  ]) {
    const body = source.slice(source.indexOf(start), source.indexOf(end));
    const guardAt = body.indexOf("if (!isInHouseProduct(variant.product)) {");
    assert.ok(guardAt > 0, `${start} must refuse a product that is not in-house`);
    assert.ok(
      body.slice(guardAt, guardAt + 200).includes("error: ITEM_NOT_AVAILABLE_TO_ADD_MESSAGE"),
      "it answers with the fixed customer message"
    );
    for (const later of ["calculateItemQuote(", "resolveOrCreateActiveCart(", "prisma.$transaction(", "cartItem.create"]) {
      const laterAt = body.indexOf(later);
      if (laterAt !== -1) assert.ok(guardAt < laterAt, `the guard must come before ${later}`);
    }
  }
  assert.ok(source.includes('const ITEM_NOT_AVAILABLE_TO_ADD_MESSAGE = "This item is not available right now";'));
});

test("the paid-order job keeps its own fail-loudly rule as the last line of defence", () => {
  const job = read("src/lib/inngest.ts");
  assert.match(job, /fulfillmentMode !== "IN_HOUSE"/);
  assert.ok(job.includes("throw new OrderFulfillmentUnsupportedError("));
});

// The admin signal, AC-L1, AC-L2 and AC-L3.

test("orders needing attention: paid, FAILED, and not a legacy provider order", () => {
  assert.deepEqual(PAID_ORDERS_NEEDING_ATTENTION_WHERE, {
    paymentStatus: "SUCCEEDED",
    fulfillmentStatus: "FAILED",
    externalFulfillmentId: null,
  });
  const base = { paymentStatus: "SUCCEEDED", fulfillmentStatus: "FAILED", externalFulfillmentId: null };
  assert.equal(orderNeedsAttention(base), true);
  assert.equal(orderNeedsAttention({ ...base, externalFulfillmentId: undefined }), true);
  // A legacy provider order can never be changed here, so it is never counted (AC-L2).
  assert.equal(orderNeedsAttention({ ...base, externalFulfillmentId: "123456" }), false);
  // Not paid, or not failed: nothing to do.
  assert.equal(orderNeedsAttention({ ...base, paymentStatus: "PENDING" }), false);
  assert.equal(orderNeedsAttention({ ...base, paymentStatus: "REFUNDED" }), false);
  for (const status of ["PENDING", "PROCESSING", "IN_PRODUCTION", "SHIPPED", "DELIVERED", "CANCELLED"]) {
    assert.equal(orderNeedsAttention({ ...base, fulfillmentStatus: status }), false, status);
  }
});

test("awaiting production counts only paid orders with a physical item, and no legacy order", () => {
  assert.deepEqual(PAID_ORDERS_AWAITING_PRODUCTION_WHERE, {
    paymentStatus: "SUCCEEDED",
    fulfillmentStatus: { in: ["PENDING", "PROCESSING"] },
    externalFulfillmentId: null,
    // AC-L3: a digital-only order has no item with a product or a variant, so it is not counted.
    items: {
      some: {
        OR: [{ catalogVariantId: { not: null } }, { catalogProductId: { not: null } }],
      },
    },
  });
  // The same test the paid-order job uses to tell a physical item from a digital one.
  assert.match(
    read("src/lib/inngest.ts"),
    /Boolean\(item\.catalogVariantId\) \|\| Boolean\(item\.catalogProductId\)/
  );
});

test("a FAILED order moves only with the confirmation box ticked; other orders move as before", () => {
  assert.equal(mayMoveOrder("FAILED", FAILED_ORDER_CONFIRM_VALUE), true);
  for (const value of [null, undefined, "", "on", "true", "YES", "no", 1, true, ["yes"]]) {
    assert.equal(mayMoveOrder("FAILED", value), false, `FAILED with ${JSON.stringify(value)}`);
  }
  for (const status of ["PENDING", "PROCESSING", "IN_PRODUCTION", "SHIPPED", "DELIVERED"]) {
    assert.equal(mayMoveOrder(status, null), true, status);
  }
});

test("the admin action enforces the confirmation, and the Orders page asks for it", () => {
  const action = read("src/app/actions/keepsake-admin.ts");
  const body = action.slice(action.indexOf("export async function updateOrderFulfillmentFormAction("));
  const guardAt = body.indexOf(
    "if (!mayMoveOrder(order.fulfillmentStatus, formData.get(FAILED_ORDER_CONFIRM_FIELD))) {"
  );
  assert.ok(guardAt > 0, "the action checks the confirmation on the server");
  assert.ok(body.indexOf("await requireAdmin()") < guardAt, "after the access check");
  assert.ok(guardAt < body.indexOf("prisma.order.update("), "before the order is changed");
  assert.ok(body.slice(guardAt, guardAt + 200).includes('finish(path, "error", FAILED_ORDER_CONFIRM_ERROR)'));

  const page = read("src/app/adm/admin/(panel)/orders/page.tsx");
  assert.match(
    page,
    /\{needsAttention && \(\s*<label[\s\S]{0,200}type="checkbox"\s*name=\{FAILED_ORDER_CONFIRM_FIELD\}\s*value=\{FAILED_ORDER_CONFIRM_VALUE\}\s*required/
  );
  assert.ok(page.includes("{FAILED_ORDER_REASON}"), "the page says why the order failed");
  assert.equal(FAILED_ORDER_CONFIRM_FIELD, "confirmFailedOrder");
});

test("the dashboard alert links to the filtered Orders list, which reads only those orders", () => {
  assert.equal(ordersNeedingAttentionHref("/adm/admin/orders"), "/adm/admin/orders?filter=attention");
  assert.equal(ORDERS_ATTENTION_FILTER, "attention");

  const page = read("src/app/adm/admin/(panel)/orders/page.tsx");
  assert.ok(page.includes("const attentionOnly = filter === ORDERS_ATTENTION_FILTER;"));
  assert.ok(page.includes("...(attentionOnly ? { where: PAID_ORDERS_NEEDING_ATTENTION_WHERE } : {}),"));
  assert.ok(
    page.indexOf("await requireAdmin()") < page.indexOf("prisma.order.findMany("),
    "the Orders page checks access before it reads anything"
  );
  // Any other filter value shows every order: the value is compared, never used in a query.
  assert.equal(/where: \{[^}]*filter/.test(page), false);

  const dashboard = read("src/app/adm/admin/(panel)/page.tsx");
  const alertAt = dashboard.indexOf('role="alert"');
  assert.ok(alertAt > 0);
  assert.ok(alertAt < dashboard.indexOf("signInNotices.length > 0"), "the alert is the first thing on the page");
  assert.ok(alertAt < dashboard.indexOf("<MetricCard"), "above the numbers");
});

test("the schema says which legacy tables are still read (AC-M2)", () => {
  const schema = read("prisma/schema.prisma");
  const before = (model: string) => {
    const at = schema.indexOf(`model ${model} {`);
    assert.ok(at > 0, `${model} exists`);
    return schema.slice(Math.max(0, at - 700), at);
  };
  const providerVariant = before("ProviderVariant");
  assert.equal(/LEGACY, UNUSED/.test(providerVariant.slice(providerVariant.lastIndexOf("}"))), false);
  assert.match(providerVariant, /LEGACY, STILL READ/);
  assert.match(providerVariant, /DO NOT DROP/);
  for (const reader of [
    "src/lib/pricing/quote.ts",
    "src/lib/services/CheckoutService.ts",
    "src/app/checkout/checkoutLoader.ts",
    "src/app/actions/cart.ts",
  ]) {
    assert.ok(providerVariant.includes(reader), `the comment names ${reader}`);
    assert.ok(read(reader).includes("providerVariants"), `${reader} really reads providerVariants`);
  }
  assert.match(before("ProductMockup"), /LEGACY, STILL READ/);
  // Nothing in src/ names the one table that is marked unused.
  const walk = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(`${dir}/${entry.name}`)
        : /\.(ts|tsx)$/.test(entry.name)
          ? [`${dir}/${entry.name}`]
          : []
    );
  for (const file of walk("src")) {
    assert.equal(
      /fulfillmentProviderRecord/i.test(read(file)),
      false,
      `${file} must not use the table the schema marks unused`
    );
  }
});
