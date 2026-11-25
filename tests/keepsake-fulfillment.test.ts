import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// In-memory Prisma double, installed before any module reads the client (src/lib/prisma.ts).
type OrderRow = Record<string, unknown> & { id: string; fulfillmentStatus: string };
const orders = new Map<string, OrderRow>();
const orderUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];

(globalThis as unknown as { prismaGlobalV2: unknown }).prismaGlobalV2 = {
  order: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      orders.get(where.id) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const row = orders.get(where.id);
      if (!row) throw new Error("order not found");
      Object.assign(row, data);
      orderUpdates.push({ id: where.id, data });
      return row;
    },
  },
};

delete process.env.RESEND_API_KEY;

const {
  executeOrderFulfillmentJob,
  OrderFulfillmentUnsupportedError,
  UNSUPPORTED_FULFILMENT_MESSAGE,
} = await import("@/lib/inngest");

const recordedSteps: string[] = [];
const stepRunner = {
  run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    recordedSteps.push(name);
    return fn();
  },
} as unknown as Parameters<typeof executeOrderFulfillmentJob>[0]["step"];

function keepsakeItem(id: string, placement: "front" | "both") {
  return {
    id,
    designVersionId: "dv-keepsake",
    placement,
    quantity: 1,
    catalogProductId: "product-keepsake",
    catalogVariantId: "variant-keepsake",
    catalogVariant: {
      id: "variant-keepsake",
      product: { fulfillmentMode: "IN_HOUSE", sidePricing: "MULTIPLIER" },
    },
    // Buy Now items have no personalization version and therefore no print master.
    personalizationVersion: null,
    snapshot: {
      designTitle: "Trăm Năm Hạnh Phúc — Wedding Blessing",
      productName: "Crystal-Look Resin Keepsake — Rectangle",
      size: "Large",
    },
  };
}

/** A physical item whose product is anything other than exactly "IN_HOUSE". */
function physicalItem(id: string, fulfillmentMode: string | undefined) {
  return {
    ...keepsakeItem(id, "front"),
    catalogProductId: "product-legacy",
    catalogVariantId: "variant-legacy",
    catalogVariant: {
      id: "variant-legacy",
      product: { fulfillmentMode, sidePricing: "PLACEMENT_FEE" },
    },
    snapshot: {
      designTitle: "Legacy tee design",
      productName: "Classic T-Shirt",
      size: "M",
    },
  };
}

/** A digital item: no product and no variant. The "order/paid" job delivers it. */
function digitalItem(id: string) {
  return {
    ...keepsakeItem(id, "front"),
    catalogProductId: null,
    catalogVariantId: null,
    catalogVariant: null,
    snapshot: { designTitle: "Digital artwork", productName: null, size: null },
  };
}

function seedOrder(id: string, items: unknown[], extra: Record<string, unknown> = {}) {
  orders.set(id, {
    id,
    orderNumber: `TB-2026-${id}`,
    buyerId: null,
    buyer: null,
    buyerEmail: "buyer@example.org",
    shippingAddressJson: null,
    externalFulfillmentId: null,
    fulfillmentStatus: "PENDING",
    items,
    ...extra,
  });
}

/** Runs the job and captures what it writes to the error log. */
async function runCapturingErrors(orderId: string) {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  recordedSteps.length = 0;
  let thrown: unknown = null;
  let result: Awaited<ReturnType<typeof executeOrderFulfillmentJob>> | null = null;
  try {
    result = await executeOrderFulfillmentJob({
      event: { data: { orderId } },
      step: stepRunner,
    });
  } catch (err: unknown) {
    thrown = err;
  } finally {
    console.error = original;
  }
  return { logged, thrown, result, steps: [...recordedSteps] };
}

test("BRD §10: a paid in-house order is confirmed and goes to production", async () => {
  seedOrder("ord-keepsake", [keepsakeItem("item-1", "both"), keepsakeItem("item-2", "front")]);
  recordedSteps.length = 0;

  const result = await executeOrderFulfillmentJob({
    event: { data: { orderId: "ord-keepsake" } },
    step: stepRunner,
  });

  assert.equal("success" in result && result.success, true);
  assert.equal(result.providerOrderId, null);
  assert.equal("fulfillmentStatus" in result && result.fulfillmentStatus, "IN_PRODUCTION");
  assert.deepEqual(recordedSteps, [
    "fetch-order",
    "notify-in-house-order",
    "start-in-house-production",
  ]);
  assert.equal(orders.get("ord-keepsake")?.fulfillmentStatus, "IN_PRODUCTION");
  assert.deepEqual(orderUpdates.at(-1), {
    id: "ord-keepsake",
    data: { fulfillmentStatus: "IN_PRODUCTION" },
  });
  // In-house production never writes an outside provider's order id.
  assert.equal(orders.get("ord-keepsake")?.externalFulfillmentId, null);
});

test("an in-house order already in production is not processed twice", async () => {
  recordedSteps.length = 0;
  const updatesBefore = orderUpdates.length;

  const result = await executeOrderFulfillmentJob({
    event: { data: { orderId: "ord-keepsake" } },
    step: stepRunner,
  });

  assert.equal("skipped" in result && result.skipped, true);
  assert.deepEqual(recordedSteps, ["fetch-order"]);
  assert.equal(orderUpdates.length, updatesBefore);
});

test("a physical item that is not in-house fails the order: marked FAILED, logged with fixed text, never sent to production", async () => {
  for (const [orderId, mode] of [
    ["ord-legacy-provider", "PRINTFUL"],
    ["ord-lowercase-mode", "in_house"],
    ["ord-blank-mode", ""],
    ["ord-missing-mode", undefined],
  ] as const) {
    seedOrder(orderId, [physicalItem("item-x", mode)]);
    const updatesBefore = orderUpdates.length;

    const run = await runCapturingErrors(orderId);

    assert.ok(
      run.thrown instanceof OrderFulfillmentUnsupportedError,
      `mode ${String(mode)}: the job must fail, not return`
    );
    assert.equal(run.result, null);
    assert.equal((run.thrown as Error).message, UNSUPPORTED_FULFILMENT_MESSAGE);
    assert.equal((run.thrown as InstanceType<typeof OrderFulfillmentUnsupportedError>).unsupportedItemCount, 1);

    // Visible to the admin: FAILED, and nothing else was written.
    assert.equal(orders.get(orderId)?.fulfillmentStatus, "FAILED");
    assert.deepEqual(orderUpdates.slice(updatesBefore), [
      { id: orderId, data: { fulfillmentStatus: "FAILED" } },
    ]);
    assert.equal(orders.get(orderId)?.externalFulfillmentId, null);

    // Never treated as in-house and never skipped: no confirmation, no production step.
    assert.deepEqual(run.steps, ["fetch-order", "mark-order-unfulfillable"]);

    // Logged once, as a fixed sentence plus ids and a count: no email, title or order number.
    assert.equal(run.logged.length, 1);
    assert.equal(run.logged[0][0], `[Order Fulfilment] ${UNSUPPORTED_FULFILMENT_MESSAGE}`);
    assert.deepEqual(run.logged[0][1], { orderId, unsupportedItemCount: 1 });
    const flat = JSON.stringify(run.logged);
    for (const secret of ["buyer@example.org", "Legacy tee design", "Classic T-Shirt", "TB-2026-"]) {
      assert.equal(flat.includes(secret), false, `the log must not carry ${secret}`);
    }
  }
});

test("a mixed order fails as a whole: the in-house item is not confirmed or started while another item cannot be made", async () => {
  seedOrder("ord-mixed", [
    keepsakeItem("item-in-house", "front"),
    physicalItem("item-legacy-1", "PRINTFUL"),
    physicalItem("item-legacy-2", "PRINTIFY"),
  ]);

  const run = await runCapturingErrors("ord-mixed");

  assert.ok(run.thrown instanceof OrderFulfillmentUnsupportedError);
  assert.equal((run.thrown as InstanceType<typeof OrderFulfillmentUnsupportedError>).unsupportedItemCount, 2);
  assert.equal(orders.get("ord-mixed")?.fulfillmentStatus, "FAILED");
  assert.deepEqual(run.steps, ["fetch-order", "mark-order-unfulfillable"]);
  assert.equal(run.steps.includes("notify-in-house-order"), false);
  assert.equal(run.steps.includes("start-in-house-production"), false);
});

test("a physical item whose variant or product cannot be read is unknown, so the order fails", async () => {
  seedOrder("ord-missing-variant", [
    { ...keepsakeItem("item-orphan", "front"), catalogVariant: null },
  ]);
  const missingVariant = await runCapturingErrors("ord-missing-variant");
  assert.ok(missingVariant.thrown instanceof OrderFulfillmentUnsupportedError);
  assert.equal(orders.get("ord-missing-variant")?.fulfillmentStatus, "FAILED");

  seedOrder("ord-missing-product", [
    {
      ...keepsakeItem("item-orphan", "front"),
      catalogVariant: { id: "variant-keepsake", product: null },
    },
  ]);
  const missingProduct = await runCapturingErrors("ord-missing-product");
  assert.ok(missingProduct.thrown instanceof OrderFulfillmentUnsupportedError);
  assert.equal(orders.get("ord-missing-product")?.fulfillmentStatus, "FAILED");

  // A product id alone (no variant id) is still a physical item.
  seedOrder("ord-product-only", [
    { ...keepsakeItem("item-orphan", "front"), catalogVariantId: null, catalogVariant: null },
  ]);
  const productOnly = await runCapturingErrors("ord-product-only");
  assert.ok(productOnly.thrown instanceof OrderFulfillmentUnsupportedError);
  assert.equal(orders.get("ord-product-only")?.fulfillmentStatus, "FAILED");
});

test("a failed order is not picked up again: a second run changes nothing and does not move it to production", async () => {
  const updatesBefore = orderUpdates.length;

  const rerun = await runCapturingErrors("ord-mixed");

  assert.equal(rerun.thrown, null);
  assert.ok(rerun.result && "skipped" in rerun.result && rerun.result.skipped);
  assert.deepEqual(rerun.steps, ["fetch-order"]);
  assert.equal(orderUpdates.length, updatesBefore);
  assert.equal(orders.get("ord-mixed")?.fulfillmentStatus, "FAILED");
});

test("digital items are left to the order/paid job: they neither fail an in-house order nor start production alone", async () => {
  seedOrder("ord-keepsake-plus-digital", [keepsakeItem("item-1", "front"), digitalItem("item-d")]);
  const withKeepsake = await runCapturingErrors("ord-keepsake-plus-digital");
  assert.equal(withKeepsake.thrown, null);
  assert.equal(orders.get("ord-keepsake-plus-digital")?.fulfillmentStatus, "IN_PRODUCTION");
  assert.deepEqual(withKeepsake.steps, [
    "fetch-order",
    "notify-in-house-order",
    "start-in-house-production",
  ]);

  seedOrder("ord-digital-only", [digitalItem("item-d")]);
  const updatesBefore = orderUpdates.length;
  const digitalOnly = await runCapturingErrors("ord-digital-only");
  assert.equal(digitalOnly.thrown, null);
  assert.ok(digitalOnly.result && "skipped" in digitalOnly.result && digitalOnly.result.skipped);
  assert.deepEqual(digitalOnly.steps, ["fetch-order"]);
  assert.equal(orderUpdates.length, updatesBefore);
  assert.equal(orders.get("ord-digital-only")?.fulfillmentStatus, "PENDING");

  // A digital item does not excuse a physical item that cannot be made.
  seedOrder("ord-digital-plus-legacy", [digitalItem("item-d"), physicalItem("item-x", "PRINTFUL")]);
  const withLegacy = await runCapturingErrors("ord-digital-plus-legacy");
  assert.ok(withLegacy.thrown instanceof OrderFulfillmentUnsupportedError);
  assert.equal(orders.get("ord-digital-plus-legacy")?.fulfillmentStatus, "FAILED");
});

test("the paid-order job has no outside provider left, and its failure is not retried", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/lib/inngest.ts"), "utf8");
  assert.equal(/printful/i.test(source), false, "no provider name in the job");
  for (const gone of [
    "providerVariants",
    "createDraftOrder",
    "confirmOrder",
    "resolveItemPrintMasterUrl",
    "@/lib/fulfillment",
  ]) {
    assert.equal(source.includes(gone), false, `${gone} must be gone from the job`);
  }
  // Exactly "IN_HOUSE" is in-house; anything else is unsupported.
  assert.match(source, /fulfillmentMode === "IN_HOUSE"/);
  assert.match(source, /fulfillmentMode !== "IN_HOUSE"/);
  // The order is marked FAILED before the job throws.
  const markAt = source.indexOf('"mark-order-unfulfillable"');
  const throwAt = source.indexOf("throw new OrderFulfillmentUnsupportedError(");
  const notifyAt = source.indexOf('"notify-in-house-order"');
  assert.ok(markAt > 0 && throwAt > markAt, "mark FAILED, then throw");
  assert.ok(notifyAt > throwAt, "the confirmation email comes only after the check");
  // Inngest must not retry it: the order is no longer PENDING on a second run.
  assert.match(
    source,
    /if \(err instanceof OrderFulfillmentUnsupportedError\) \{[\s\S]{0,200}throw new NonRetriableError\(err\.message, \{ cause: err \}\);/
  );
});

test("the provider's code is gone from src/ and scripts/; only the image host waits for its own step", () => {
  const root = process.cwd();
  const collect = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return /\.(ts|tsx|js|mjs|json|css)$/.test(entry.name) ? [full] : [];
    });

  const naming = [...collect(path.join(root, "src")), ...collect(path.join(root, "scripts"))]
    .filter((file) => /printful/i.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file));
  // The image host in the content-security policy stays until the database is checked for
  // stored provider image addresses (docs/ADMIN_CLEANUP_PLAN.md, AC-04).
  assert.deepEqual(naming, [path.join("src", "lib", "security", "headers.ts")]);

  for (const gone of [
    "src/app/adm/admin/(panel)/products",
    "src/app/actions/printful-admin.ts",
    "src/app/api/webhooks/fulfillment",
    "src/lib/fulfillment",
    "src/lib/services/CatalogSyncService.ts",
    "src/config/catalog.ts",
    "src/app/actions/catalog.ts",
    "public/mockups/printful",
    "scripts/seed-catalog.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(root, gone)), false, `${gone} must be removed`);
  }

  // Moved, not deleted: the Studio still gets its product list, priced from the catalog only.
  const studioProducts = fs.readFileSync(
    path.join(root, "src", "lib", "studio", "getActiveProducts.ts"),
    "utf8"
  );
  assert.match(studioProducts, /import "server-only"/);
  assert.match(studioProducts, /export async function getActiveProductsForStudio\(/);
  assert.equal(studioProducts.includes("providerVariants"), false);
  assert.match(
    fs.readFileSync(path.join(root, "src", "lib", "studio", "loadStudioEntryContext.ts"), "utf8"),
    /from "@\/lib\/studio\/getActiveProducts"/
  );

  // The live site no longer asks for the provider's settings, and nothing documents them.
  const env = fs.readFileSync(path.join(root, "src", "lib", "env.ts"), "utf8");
  assert.equal(/printful/i.test(env), false);
  for (const stillRequired of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "INNGEST_SIGNING_KEY", "DATABASE_URL"]) {
    assert.ok(env.includes(`"${stillRequired}"`), `${stillRequired} stays required`);
  }
  assert.equal(/printful/i.test(fs.readFileSync(path.join(root, ".env.example"), "utf8")), false);
});
