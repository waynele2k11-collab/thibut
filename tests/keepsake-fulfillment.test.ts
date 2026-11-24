import test from "node:test";
import assert from "node:assert/strict";

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

const { executeOrderFulfillmentJob } = await import("@/lib/inngest");

const recordedSteps: string[] = [];
const stepRunner = {
  run: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    recordedSteps.push(name);
    return fn();
  },
} as unknown as Parameters<typeof executeOrderFulfillmentJob>[0]["step"];

const printfulCalls: string[] = [];
const printfulClient = {
  createDraftOrder: async () => {
    printfulCalls.push("draft");
    return { id: "pf-1" };
  },
  confirmOrder: async () => {
    printfulCalls.push("confirm");
  },
} as unknown as NonNullable<
  Parameters<typeof executeOrderFulfillmentJob>[0]["printfulClient"]
>;

function keepsakeItem(id: string, placement: "front" | "both") {
  return {
    id,
    designVersionId: "dv-keepsake",
    placement,
    quantity: 1,
    catalogVariantId: "variant-keepsake",
    catalogVariant: {
      id: "variant-keepsake",
      // No Printful mapping exists for in-house products.
      providerVariants: [],
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

test("BRD §10: a paid in-house order goes to production without calling Printful", async () => {
  orders.set("ord-keepsake", {
    id: "ord-keepsake",
    orderNumber: "TB-2026-0100",
    buyerId: null,
    buyer: null,
    buyerEmail: "buyer@example.org",
    // Would fail Printful recipient validation; must not matter for in-house orders.
    shippingAddressJson: null,
    externalFulfillmentId: null,
    fulfillmentStatus: "PENDING",
    items: [keepsakeItem("item-1", "both"), keepsakeItem("item-2", "front")],
  });
  recordedSteps.length = 0;

  const result = await executeOrderFulfillmentJob({
    event: { data: { orderId: "ord-keepsake" } },
    step: stepRunner,
    printfulClient,
  });

  assert.equal(result.success, true);
  assert.equal(result.providerOrderId, null);
  assert.equal(result.fulfillmentStatus, "IN_PRODUCTION");
  assert.deepEqual(recordedSteps, [
    "fetch-order",
    "notify-in-house-order",
    "start-in-house-production",
  ]);
  assert.deepEqual(printfulCalls, []);
  assert.equal(orders.get("ord-keepsake")?.fulfillmentStatus, "IN_PRODUCTION");
  assert.deepEqual(orderUpdates.at(-1), {
    id: "ord-keepsake",
    data: { fulfillmentStatus: "IN_PRODUCTION" },
  });
});

test("an in-house order already in production is not processed twice", async () => {
  recordedSteps.length = 0;
  const updatesBefore = orderUpdates.length;

  const result = await executeOrderFulfillmentJob({
    event: { data: { orderId: "ord-keepsake" } },
    step: stepRunner,
    printfulClient,
  });

  assert.equal("skipped" in result && result.skipped, true);
  assert.deepEqual(recordedSteps, ["fetch-order"]);
  assert.equal(orderUpdates.length, updatesBefore);
  assert.deepEqual(printfulCalls, []);
});
