import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { LedgerAccountType, PrismaClient } from "@prisma/client";
import {
  DIGITAL_TOTAL_MINOR,
  PLACEMENT_FEE_MINOR,
  PricingValidationError,
  calculateDigitalQuote,
  calculateGalleryItemQuote,
  calculateItemQuote,
  formatUsdMinor,
  getPlacementFeeMinor,
  parseUsdDecimalToMinor,
  roundUpTo99Minor,
} from "@/lib/pricing/quote";
import { calculatePricing } from "@/lib/pricing/engine";
import {
  LedgerImbalanceError,
  assertBalancedPostings,
  postOrderRefundLedger,
  postOrderSaleLedger,
} from "@/lib/services/LedgerService";
import {
  SecurityConfigError,
  computeHmacSha256Hex,
  verifyDownloadToken,
} from "@/lib/security/tokens";
import { sendDigitalDownloadEmail } from "@/lib/email";
import { stripe } from "@/lib/stripe";

// ─────────────────────────────────────────────────────────────────────────────
// RESETTABLE IN-MEMORY PRISMA FAKE BOUND BEFORE @/lib/prisma MODULE LOAD
// ─────────────────────────────────────────────────────────────────────────────

interface MockWebhookEventRow {
  id: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  payloadJson: unknown;
  status: string;
  receivedAt: Date;
  processedAt: Date | null;
}

interface MockOrderItemRow {
  id: string;
  orderId: string;
  creatorId: string;
  designId: string;
  designVersionId: string;
  licenseOfferId: string | null;
  galleryItemId: string | null;
  personalizationVersionId: string | null;
  catalogProductId: string | null;
  catalogVariantId: string | null;
  quantity: number;
  placement: string;
  artworkRevenueMinor: bigint;
  personalizationRevenueMinor: bigint;
  productRevenueMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformRevenueMinor: bigint;
  totalMinor: bigint;
  catalogVariant?: {
    id: string;
    color: string | null;
    size: string | null;
    product: { name: string };
  } | null;
  personalizationVersion?: {
    id: string;
    inputSnapshot: unknown;
    interpretationSnapshot: unknown;
    styleSnapshot: unknown;
  } | null;
}

interface MockOrderRow {
  id: string;
  orderNumber: string;
  buyerId: string | null;
  buyerEmail: string | null;
  shippingAddressJson: unknown;
  currency: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  placedAt: Date | null;
}

interface MockPaymentRow {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string | null;
  providerChargeId: string | null;
  amountMinor: bigint;
  currency: string;
  status: string;
  capturedAt: Date | null;
}

interface MockRefundRow {
  id: string;
  orderId: string;
  paymentId: string | null;
  providerRefundId: string | null;
  amountMinor: bigint;
  reason: string | null;
  status: string;
  processedAt: Date | null;
}

interface MockLicenseOfferRow {
  id: string;
  designId: string;
  type: "PERSONAL_PRODUCT" | "PERSONAL_DIGITAL" | "COMMERCIAL";
  priceMinor: bigint;
  currency: string;
  active: boolean;
  allowDigitalDownload: boolean;
  allowResale: boolean;
  allowCommercialUse: boolean;
  termsVersion: number;
}

interface MockLicenseGrantRow {
  id: string;
  orderItemId: string;
  licenseOfferId: string;
  buyerId: string | null;
  creatorId: string;
  designId: string;
  designVersionId: string;
  licenseType: string;
  priceMinor: bigint;
  currency: string;
  allowName: boolean;
  allowQuote: boolean;
  allowTranslation: boolean;
  allowCalligraphy: boolean;
  allowAIRestyle: boolean;
  allowCommercial: boolean;
  allowModelTraining: boolean;
  termsSnapshot: unknown;
  permissionsSnapshot: unknown;
  revokedAt: Date | null;
}

interface MockCreatorEarningRow {
  id: string;
  creatorId: string;
  orderItemId: string;
  grossLicenseMinor: bigint;
  adjustmentMinor: bigint;
  netCreatorMinor: bigint;
  currency: string;
  status: string;
}

interface MockOrderItemSnapshotRow {
  orderItemId: string;
  designTitle: string;
  creatorName: string;
  productName: string | null;
  variantName: string | null;
  color: string | null;
  size: string | null;
  licenseTermsJson: unknown;
  personalizationJson: unknown;
  printPlacementJson: unknown;
  pricingJson: unknown;
}

interface MockLedgerAccountRow {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  ownerType: string | null;
  balanceMinor: bigint;
  currency: string;
}

interface MockLedgerTransactionRow {
  id: string;
  type: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  currency: string;
}

interface MockLedgerPostingRow {
  id: string;
  transactionId: string;
  accountId: string;
  amountMinor: bigint;
  currency: string;
}

interface MockCatalogVariantRow {
  id: string;
  productId: string;
  sku: string;
  color: string | null;
  colorHex?: string | null;
  size: string | null;
  baseRetailMinor: bigint;
  active: boolean;
}

interface MockProviderVariantRow {
  id: string;
  providerId: string;
  catalogVariantId: string;
  externalProductId: string;
  externalVariantId: string;
  costMinor: bigint;
  currency: string;
  active: boolean;
}

function createInMemoryCommerceDb() {
  const state = {
    txCount: 0,
    webhookEvents: new Map<string, MockWebhookEventRow>(),
    orders: new Map<string, MockOrderRow>(),
    orderItems: new Map<string, MockOrderItemRow>(),
    payments: new Map<string, MockPaymentRow>(),
    refunds: new Map<string, MockRefundRow>(),
    designs: new Map<
      string,
      {
        id: string;
        title: string;
        creator: { id: string; displayName: string };
        policyVersions: Array<{
          versionNumber: number;
          allowName: boolean;
          allowQuote: boolean;
          allowTranslation: boolean;
          allowCalligraphy: boolean;
          allowAIRestyle: boolean;
          allowCommercialUse: boolean;
          allowModelTraining: boolean;
        }>;
        licenses: MockLicenseOfferRow[];
      }
    >(),
    licenseOffers: new Map<string, MockLicenseOfferRow>(),
    licenseGrants: new Map<string, MockLicenseGrantRow>(),
    creatorEarnings: new Map<string, MockCreatorEarningRow>(),
    snapshots: new Map<string, MockOrderItemSnapshotRow>(),
    ledgerAccounts: new Map<string, MockLedgerAccountRow>(),
    ledgerTransactions: new Map<string, MockLedgerTransactionRow>(),
    ledgerPostings: [] as MockLedgerPostingRow[],
    catalogProducts: new Map<
      string,
      { id: string; slug: string; name: string; category: string; status: string }
    >(),
    catalogVariants: new Map<string, MockCatalogVariantRow>(),
    providerVariants: new Map<string, MockProviderVariantRow>(),
  };

  function reset() {
    state.txCount = 0;
    state.webhookEvents.clear();
    state.orders.clear();
    state.orderItems.clear();
    state.payments.clear();
    state.refunds.clear();
    state.designs.clear();
    state.licenseOffers.clear();
    state.licenseGrants.clear();
    state.creatorEarnings.clear();
    state.snapshots.clear();
    state.ledgerAccounts.clear();
    state.ledgerTransactions.clear();
    state.ledgerPostings.length = 0;
    state.catalogProducts.clear();
    state.catalogVariants.clear();
    state.providerVariants.clear();
  }

  const webhookKey = (provider: string, externalEventId: string) =>
    `${provider}::${externalEventId}`;

  const txModels = {
    state,
    reset,
    fulfillmentProviderRecord: {
      async upsert() {
        return { id: "prov-printful", code: "PRINTFUL", name: "Printful" };
      },
    },
    catalogProduct: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: { slug: string };
        update: { name?: string; category?: string };
        create: { slug: string; name: string; category: string; status: string };
      }) {
        const existing = state.catalogProducts.get(where.slug);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: crypto.randomUUID(), ...create };
        state.catalogProducts.set(where.slug, created);
        return created;
      },
    },
    catalogVariant: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: { sku: string };
        update: Partial<MockCatalogVariantRow>;
        create: Omit<MockCatalogVariantRow, "id">;
      }) {
        const existing = state.catalogVariants.get(where.sku);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created: MockCatalogVariantRow = {
          id: crypto.randomUUID(),
          ...create,
        };
        state.catalogVariants.set(where.sku, created);
        return created;
      },
    },
    providerVariant: {
      async upsert({
        where,
        update,
        create,
      }: {
        where: {
          providerId_catalogVariantId: {
            providerId: string;
            catalogVariantId: string;
          };
        };
        update: Partial<MockProviderVariantRow>;
        create: Omit<MockProviderVariantRow, "id">;
      }) {
        const key = `${where.providerId_catalogVariantId.providerId}::${where.providerId_catalogVariantId.catalogVariantId}`;
        const existing = state.providerVariants.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created: MockProviderVariantRow = {
          id: crypto.randomUUID(),
          ...create,
        };
        state.providerVariants.set(key, created);
        return created;
      },
    },
    asset: {
      async upsert({
        where,
      }: {
        where: { objectKey: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) {
        return { id: `asset-${where.objectKey}` };
      },
    },
    productMockup: {
      async upsert({
        where,
      }: {
        where: { id: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) {
        return { id: where.id };
      },
    },
    webhookEvent: {
      async create({
        data,
      }: {
        data: {
          provider: string;
          externalEventId: string;
          eventType: string;
          payloadJson: unknown;
          status?: string;
        };
      }) {
        const key = webhookKey(data.provider, data.externalEventId);
        if (state.webhookEvents.has(key)) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const row: MockWebhookEventRow = {
          id: crypto.randomUUID(),
          provider: data.provider,
          externalEventId: data.externalEventId,
          eventType: data.eventType,
          payloadJson: data.payloadJson,
          status: data.status ?? "PENDING",
          receivedAt: new Date(),
          processedAt: null,
        };
        state.webhookEvents.set(key, row);
        return row;
      },
      async findUnique({
        where,
      }: {
        where: {
          provider_externalEventId: { provider: string; externalEventId: string };
        };
      }) {
        const key = webhookKey(
          where.provider_externalEventId.provider,
          where.provider_externalEventId.externalEventId
        );
        return state.webhookEvents.get(key) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: {
          provider_externalEventId: { provider: string; externalEventId: string };
        };
        data: { status?: string; processedAt?: Date };
      }) {
        const key = webhookKey(
          where.provider_externalEventId.provider,
          where.provider_externalEventId.externalEventId
        );
        const existing = state.webhookEvents.get(key);
        if (!existing) {
          throw new Error(`WebhookEvent not found: ${key}`);
        }
        if (data.status !== undefined) existing.status = data.status;
        if (data.processedAt !== undefined) existing.processedAt = data.processedAt;
        return existing;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { provider?: string; externalEventId?: string };
        data: { status?: string; processedAt?: Date };
      }) {
        let count = 0;
        for (const row of state.webhookEvents.values()) {
          if (where.provider && row.provider !== where.provider) continue;
          if (
            where.externalEventId &&
            row.externalEventId !== where.externalEventId
          ) {
            continue;
          }
          if (data.status !== undefined) row.status = data.status;
          if (data.processedAt !== undefined) row.processedAt = data.processedAt;
          count++;
        }
        return { count };
      },
    },
    order: {
      async findUnique({
        where,
      }: {
        where: { id?: string; orderNumber?: string };
      }) {
        let found: MockOrderRow | undefined;
        if (where.id) {
          found = state.orders.get(where.id);
        } else if (where.orderNumber) {
          found = Array.from(state.orders.values()).find(
            (o) => o.orderNumber === where.orderNumber
          );
        }
        if (!found) return null;
        const items = Array.from(state.orderItems.values())
          .filter((i) => i.orderId === found.id)
          .map((item) => ({
            ...item,
            licenseGrant:
              Array.from(state.licenseGrants.values()).find(
                (lg) => lg.orderItemId === item.id
              ) ?? null,
            earning:
              Array.from(state.creatorEarnings.values()).find(
                (ce) => ce.orderItemId === item.id
              ) ?? null,
            snapshot: state.snapshots.get(item.id) ?? null,
          }));
        return { ...found, items };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockOrderRow>;
      }) {
        const existing = state.orders.get(where.id);
        if (!existing) throw new Error(`Order not found: ${where.id}`);
        Object.assign(existing, data);
        return { ...existing };
      },
    },
    design: {
      async findMany({ where }: { where: { id: { in: string[] } } }) {
        return where.id.in
          .map((id) => state.designs.get(id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d));
      },
    },
    licenseOffer: {
      async findMany({ where }: { where: { id: { in: string[] } } }) {
        return where.id.in
          .map((id) => state.licenseOffers.get(id))
          .filter((o): o is MockLicenseOfferRow => Boolean(o));
      },
      async create({
        data,
      }: {
        data: Omit<MockLicenseOfferRow, "id" | "termsVersion">;
      }) {
        const created: MockLicenseOfferRow = {
          id: crypto.randomUUID(),
          termsVersion: 1,
          ...data,
        };
        state.licenseOffers.set(created.id, created);
        return created;
      },
    },
    payment: {
      async create({
        data,
      }: {
        data: {
          orderId: string;
          provider: string;
          providerPaymentId?: string;
          providerChargeId?: string;
          amountMinor: bigint;
          currency: string;
          status: string;
          capturedAt?: Date;
        };
      }) {
        const row: MockPaymentRow = {
          id: crypto.randomUUID(),
          orderId: data.orderId,
          provider: data.provider,
          providerPaymentId: data.providerPaymentId ?? null,
          providerChargeId: data.providerChargeId ?? null,
          amountMinor: data.amountMinor,
          currency: data.currency,
          status: data.status,
          capturedAt: data.capturedAt ?? null,
        };
        state.payments.set(row.id, row);
        return row;
      },
      async findFirst({
        where,
      }: {
        where: {
          OR: Array<{ providerChargeId?: string; providerPaymentId?: string }>;
        };
      }) {
        for (const p of state.payments.values()) {
          const matched = where.OR.some(
            (cond) =>
              (cond.providerChargeId &&
                p.providerChargeId === cond.providerChargeId) ||
              (cond.providerPaymentId &&
                p.providerPaymentId === cond.providerPaymentId)
          );
          if (matched) {
            const order = state.orders.get(p.orderId);
            if (!order) return null;
            const items = Array.from(state.orderItems.values()).filter(
              (i) => i.orderId === order.id
            );
            return { ...p, order: { ...order, items } };
          }
        }
        return null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockPaymentRow>;
      }) {
        const existing = state.payments.get(where.id);
        if (!existing) throw new Error(`Payment not found: ${where.id}`);
        Object.assign(existing, data);
        return existing;
      },
    },
    refund: {
      async findUnique({ where }: { where: { providerRefundId: string } }) {
        return (
          Array.from(state.refunds.values()).find(
            (r) => r.providerRefundId === where.providerRefundId
          ) ?? null
        );
      },
      async create({ data }: { data: Omit<MockRefundRow, "id"> }) {
        const row: MockRefundRow = {
          id: crypto.randomUUID(),
          ...data,
        };
        state.refunds.set(row.id, row);
        return row;
      },
    },
    licenseGrant: {
      async create({
        data,
      }: {
        data: Omit<MockLicenseGrantRow, "id" | "revokedAt">;
      }) {
        const row: MockLicenseGrantRow = {
          id: crypto.randomUUID(),
          revokedAt: null,
          ...data,
        };
        state.licenseGrants.set(row.id, row);
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { orderItemId: { in: string[] }; revokedAt?: null };
        data: { revokedAt: Date };
      }) {
        let count = 0;
        for (const g of state.licenseGrants.values()) {
          if (
            where.orderItemId.in.includes(g.orderItemId) &&
            g.revokedAt === null
          ) {
            g.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      },
    },
    orderItemSnapshot: {
      async create({ data }: { data: MockOrderItemSnapshotRow }) {
        state.snapshots.set(data.orderItemId, data);
        return data;
      },
    },
    creatorEarning: {
      async create({ data }: { data: Omit<MockCreatorEarningRow, "id"> }) {
        const row: MockCreatorEarningRow = {
          id: crypto.randomUUID(),
          ...data,
        };
        state.creatorEarnings.set(row.id, row);
        return row;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { orderItemId: { in: string[] } };
        data: { status: string };
      }) {
        let count = 0;
        for (const ce of state.creatorEarnings.values()) {
          if (where.orderItemId.in.includes(ce.orderItemId)) {
            ce.status = data.status;
            count++;
          }
        }
        return { count };
      },
    },
    personalizationSession: {
      async updateMany() {
        return { count: 0 };
      },
    },
    ledgerAccount: {
      async upsert({
        where,
        create,
      }: {
        where: { code: string };
        update: Record<string, unknown>;
        create: Omit<MockLedgerAccountRow, "id">;
      }) {
        let acc = Array.from(state.ledgerAccounts.values()).find(
          (a) => a.code === where.code
        );
        if (!acc) {
          acc = {
            id: crypto.randomUUID(),
            ...create,
          };
          state.ledgerAccounts.set(acc.id, acc);
        }
        return { id: acc.id };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { balanceMinor: { increment: bigint } };
      }) {
        const acc = state.ledgerAccounts.get(where.id);
        if (!acc) throw new Error(`LedgerAccount not found: ${where.id}`);
        acc.balanceMinor += data.balanceMinor.increment;
        return acc;
      },
    },
    ledgerTransaction: {
      async create({
        data,
      }: {
        data: Omit<MockLedgerTransactionRow, "id">;
      }) {
        const txRow: MockLedgerTransactionRow = {
          id: crypto.randomUUID(),
          ...data,
        };
        state.ledgerTransactions.set(txRow.id, txRow);
        return txRow;
      },
    },
    ledgerPosting: {
      async create({
        data,
      }: {
        data: Omit<MockLedgerPostingRow, "id">;
      }) {
        const pRow: MockLedgerPostingRow = {
          id: crypto.randomUUID(),
          ...data,
        };
        state.ledgerPostings.push(pRow);
        return pRow;
      },
    },
  };

  return {
    ...txModels,
    async $transaction<T>(fn: (tx: typeof txModels) => Promise<T>): Promise<T> {
      state.txCount++;
      return fn(txModels);
    },
  };
}

const sharedMockDb = createInMemoryCommerceDb();
globalThis.prismaGlobalV2 = sharedMockDb as unknown as PrismaClient;

// ─────────────────────────────────────────────────────────────────────────────
// 1. QUOTE & PRICING ENGINE TESTS (T-200, INV-005, INV-006)
// ─────────────────────────────────────────────────────────────────────────────

test("T-200: quote.ts enforces exact BigInt placement fees and physical variant invariants", () => {
  assert.equal(PLACEMENT_FEE_MINOR.front, 0n);
  assert.equal(PLACEMENT_FEE_MINOR.FRONT_CENTER, 0n);
  assert.equal(PLACEMENT_FEE_MINOR.left_chest, 0n);
  assert.equal(PLACEMENT_FEE_MINOR.LEFT_CHEST, 0n);
  assert.equal(PLACEMENT_FEE_MINOR.back, 500n);
  assert.equal(PLACEMENT_FEE_MINOR.BACK_CENTER, 500n);
  assert.equal(PLACEMENT_FEE_MINOR.both, 900n);
  assert.equal(PLACEMENT_FEE_MINOR.FRONT_AND_BACK, 900n);
  assert.equal(getPlacementFeeMinor("both"), 900n);

  const variant = {
    id: "var-tee-black-l",
    active: true,
    baseRetailMinor: 2599n,
    product: { status: "ACTIVE" },
    providerVariants: [{ costMinor: 1295n, currency: "USD", active: true }],
  };

  const frontQuote = calculateItemQuote({
    variant,
    placement: "front",
    shippingMinor: 599n,
    taxMinor: 250n,
  });

  assert.equal(frontQuote.currency, "USD");
  assert.equal(frontQuote.isDigital, false);
  assert.equal(frontQuote.artworkMinor, 499n);
  assert.equal(frontQuote.personalizationMinor, 300n);
  assert.equal(frontQuote.productMinor, 2599n);
  assert.equal(frontQuote.fulfillmentCostMinor, 1295n);
  assert.equal(frontQuote.creatorRoyaltyMinor, frontQuote.artworkMinor);
  assert.equal(
    frontQuote.artworkMinor +
      frontQuote.personalizationMinor +
      frontQuote.productMinor,
    frontQuote.subtotalMinor
  );
  assert.equal(
    frontQuote.platformMinor,
    frontQuote.subtotalMinor -
      frontQuote.creatorRoyaltyMinor -
      frontQuote.fulfillmentCostMinor
  );
  assert.equal(
    frontQuote.subtotalMinor + frontQuote.shippingMinor + frontQuote.taxMinor,
    frontQuote.totalMinor
  );

  const backQuote = calculateItemQuote({ variant, placement: "back" });
  const bothQuote = calculateItemQuote({ variant, placement: "both" });
  assert.equal(backQuote.subtotalMinor - frontQuote.subtotalMinor, 500n);
  assert.equal(bothQuote.subtotalMinor - frontQuote.subtotalMinor, 900n);

  // Creator custom LicenseOffer freezes royalty === licenseOffer.priceMinor (INV-005)
  const customLicenseQuote = calculateItemQuote({
    variant,
    placement: "front",
    licenseOffer: {
      id: "lo-custom",
      priceMinor: 1499n,
      currency: "USD",
      active: true,
    },
  });
  assert.equal(customLicenseQuote.artworkMinor, 1499n);
  assert.equal(customLicenseQuote.creatorRoyaltyMinor, 1499n);
});

test("T-200: digital download quote is a single authoritative 1499n across quote.ts and engine.ts", () => {
  assert.equal(DIGITAL_TOTAL_MINOR, 1499n);

  const digitalQuote = calculateDigitalQuote();
  const itemDigitalQuote = calculateItemQuote({ isDigital: true });
  const engineFacade = calculatePricing(1295n);

  assert.equal(digitalQuote.totalMinor, 1499n);
  assert.equal(digitalQuote.subtotalMinor, 1499n);
  assert.equal(digitalQuote.artworkMinor, 499n);
  assert.equal(digitalQuote.personalizationMinor, 300n);
  assert.equal(digitalQuote.productMinor, 700n);
  assert.equal(digitalQuote.fulfillmentCostMinor, 0n);
  assert.equal(digitalQuote.shippingMinor, 0n);
  assert.equal(digitalQuote.taxMinor, 0n);
  assert.deepEqual(itemDigitalQuote, digitalQuote);

  // Eliminates $9.99 vs $14.99 checkout mismatch
  assert.equal(engineFacade.digitalGalleryPriceMinor, 1499);
  assert.equal(engineFacade.digitalPersonalizedPriceMinor, 1499);
});

test("T-200: quote.ts rejects missing, inactive, zero/negative retail, and unknown placements", () => {
  assert.throws(() => calculateItemQuote({ variant: null }), PricingValidationError);
  assert.throws(
    () =>
      calculateItemQuote({
        variant: { id: "v-inactive", active: false, baseRetailMinor: 2599n },
      }),
    PricingValidationError
  );
  assert.throws(
    () =>
      calculateItemQuote({
        variant: { id: "v-zero", active: true, baseRetailMinor: 0n },
      }),
    PricingValidationError
  );
  assert.throws(
    () =>
      calculateItemQuote({
        variant: { id: "v-neg", active: true, baseRetailMinor: -100n },
      }),
    PricingValidationError
  );
  assert.throws(
    () =>
      calculateItemQuote({
        variant: {
          id: "v-bad-cost",
          active: true,
          baseRetailMinor: 2599n,
          providerVariants: [{ costMinor: 0n, active: true }],
        },
      }),
    PricingValidationError
  );
  assert.throws(
    () =>
      calculateItemQuote({
        variant: { id: "v-ok", active: true, baseRetailMinor: 2599n },
        placement: "collar_secret",
      }),
    PricingValidationError
  );

  // GalleryItem quote uses BigInt listedPriceMinor
  const galleryQuote = calculateGalleryItemQuote(
    {
      id: "gal-1",
      listedPriceMinor: 3900n,
      currency: "USD",
      published: true,
      purchasable: true,
    },
    {
      id: "v-gal",
      active: true,
      baseRetailMinor: 2599n,
      providerVariants: [{ costMinor: 1200n, active: true }],
    },
    { placement: "back", shippingMinor: 499n }
  );
  assert.equal(galleryQuote.subtotalMinor, 4400n);
  assert.equal(galleryQuote.totalMinor, 4899n);
  assert.equal(galleryQuote.platformMinor, 3200n);

  assert.equal(parseUsdDecimalToMinor("28.99"), 2899n);
  assert.equal(roundUpTo99Minor(2590n), 2599n);
  assert.equal(formatUsdMinor(-499n), "-$4.99");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOUBLE-ENTRY LEDGER SERVICE TESTS (T-202, INV-008, INV-009)
// ─────────────────────────────────────────────────────────────────────────────

test("T-202: LedgerService enforces balanced postings (SUM === 0n) and rejects unbalanced legs", async () => {
  sharedMockDb.reset();

  assert.throws(() => assertBalancedPostings([]), LedgerImbalanceError);
  assert.throws(
    () => assertBalancedPostings([{ amountMinor: 1000n }]),
    LedgerImbalanceError
  );
  assert.throws(
    () =>
      assertBalancedPostings([
        { amountMinor: 1000n },
        { amountMinor: -999n },
      ]),
    LedgerImbalanceError
  );
  assert.doesNotThrow(() =>
    assertBalancedPostings([
      { amountMinor: 1499n, currency: "USD" },
      { amountMinor: -499n, currency: "USD" },
      { amountMinor: -1000n, currency: "USD" },
    ])
  );

  const order = {
    id: "ord-ledger-1",
    orderNumber: "TB-LEDGER-1",
    currency: "USD",
    subtotalMinor: 3398n,
    discountMinor: 0n,
    shippingMinor: 599n,
    taxMinor: 250n,
    totalMinor: 4247n,
    fulfillmentStatus: "PENDING",
  };
  const items = [
    {
      id: "oi-ledger-1",
      creatorId: "creator-1",
      artworkRevenueMinor: 499n,
      personalizationRevenueMinor: 300n,
      productRevenueMinor: 2599n,
      fulfillmentCostMinor: 1295n,
      creatorRoyaltyMinor: 499n,
      platformRevenueMinor: 1604n,
      totalMinor: 3398n,
    },
  ];

  const saleTx = await postOrderSaleLedger(
    sharedMockDb as unknown as Parameters<typeof postOrderSaleLedger>[0],
    order,
    items
  );
  const salePostings = sharedMockDb.state.ledgerPostings.filter(
    (p) => p.transactionId === saleTx.id
  );
  assert.equal(
    salePostings.reduce((acc, p) => acc + p.amountMinor, 0n),
    0n
  );

  const stripeAccount = Array.from(
    sharedMockDb.state.ledgerAccounts.values()
  ).find((a) => a.code === "STRIPE_CLEARING");
  const creatorPayable = Array.from(
    sharedMockDb.state.ledgerAccounts.values()
  ).find((a) => a.code === "CREATOR_PAYABLE");
  assert.equal(stripeAccount?.balanceMinor, 4247n);
  assert.equal(creatorPayable?.balanceMinor, -499n);

  // Full refund reverses every cent back to 0n
  const refundTx = await postOrderRefundLedger(
    sharedMockDb as unknown as Parameters<typeof postOrderRefundLedger>[0],
    order,
    4247n,
    items
  );
  const refundPostings = sharedMockDb.state.ledgerPostings.filter(
    (p) => p.transactionId === refundTx.id
  );
  assert.equal(
    refundPostings.reduce((acc, p) => acc + p.amountMinor, 0n),
    0n
  );
  assert.equal(stripeAccount?.balanceMinor, 0n);
  assert.equal(creatorPayable?.balanceMinor, 0n);

  // Partial refund also balances strictly to 0n
  const partialTx = await postOrderRefundLedger(
    sharedMockDb as unknown as Parameters<typeof postOrderRefundLedger>[0],
    order,
    1000n,
    items
  );
  const partialPostings = sharedMockDb.state.ledgerPostings.filter(
    (p) => p.transactionId === partialTx.id
  );
  assert.equal(
    partialPostings.reduce((acc, p) => acc + p.amountMinor, 0n),
    0n
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DOWNLOAD EMAIL TOKEN BINDING TEST (T-103)
// ─────────────────────────────────────────────────────────────────────────────

test("T-103: sendDigitalDownloadEmail binds token via signDownloadToken and fails closed without secret", async () => {
  delete process.env.DOWNLOAD_TOKEN_SECRET;
  delete process.env.RESEND_API_KEY;

  await assert.rejects(
    () =>
      sendDigitalDownloadEmail({
        email: "buyer@example.com",
        orderNumber: "TB-DIG-1",
        orderId: "ord-dig-1",
        orderItemId: "oi-dig-1",
        productName: "Digital Master",
      }),
    SecurityConfigError
  );

  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";
  const result = await sendDigitalDownloadEmail({
    email: "buyer@example.com",
    orderNumber: "TB-DIG-1",
    orderId: "ord-dig-1",
    orderItemId: "oi-dig-1",
    productName: "Digital Master",
  });

  const parsedUrl = new URL(result.downloadLink);
  const token = parsedUrl.searchParams.get("token");
  assert.ok(token);
  const claims = await verifyDownloadToken(token);
  assert.deepEqual(claims, { orderItemId: "oi-dig-1", orderId: "ord-dig-1" });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. STRIPE WEBHOOK ROUTE TESTS (T-202, INV-003/004/005/007/008/009/010)
// ─────────────────────────────────────────────────────────────────────────────

test("T-202/INV-007: Stripe webhook handles idempotency, FAILED retry, amount mismatch rejection, and refund/dispute reversal", async () => {
  sharedMockDb.reset();

  const stripeSecret = "whsec_test_stripe_secret_key_for_unit_tests";
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-offline-mock";

  // Capture Inngest events without hitting network
  const { inngest } = await import("@/lib/inngest");
  const emittedEvents: Array<{ name: string; data: unknown }> = [];
  const originalInngestSend = inngest.send.bind(inngest);
  inngest.send = (async (payload: { name: string; data: unknown }) => {
    emittedEvents.push(payload);
    return { ids: ["evt-inngest-1"] };
  }) as typeof inngest.send;

  try {
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );

    const offerId = "lo-100";
    const licenseOffer: MockLicenseOfferRow = {
      id: offerId,
      designId: "design-100",
      type: "PERSONAL_PRODUCT",
      priceMinor: 499n,
      currency: "USD",
      active: true,
      allowDigitalDownload: false,
      allowResale: false,
      allowCommercialUse: false,
      termsVersion: 1,
    };
    sharedMockDb.state.licenseOffers.set(offerId, licenseOffer);
    sharedMockDb.state.designs.set("design-100", {
      id: "design-100",
      title: "DragonBrush",
      creator: { id: "creator-100", displayName: "Master Minh" },
      policyVersions: [
        {
          versionNumber: 1,
          allowName: true,
          allowQuote: true,
          allowTranslation: true,
          allowCalligraphy: true,
          allowAIRestyle: false,
          allowCommercialUse: false,
          allowModelTraining: true, // Webhook MUST force allowModelTraining: false per INV-010!
        },
      ],
      licenses: [licenseOffer],
    });

    sharedMockDb.state.orders.set("ord-100", {
      id: "ord-100",
      orderNumber: "TB-100",
      buyerId: "buyer-100",
      buyerEmail: "buyer@thibut.com",
      shippingAddressJson: null,
      currency: "USD",
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      fulfillmentStatus: "PENDING",
      subtotalMinor: 3398n,
      discountMinor: 0n,
      shippingMinor: 500n,
      taxMinor: 0n,
      totalMinor: 3898n,
      placedAt: null,
    });

    sharedMockDb.state.orderItems.set("oi-100", {
      id: "oi-100",
      orderId: "ord-100",
      creatorId: "creator-100",
      designId: "design-100",
      designVersionId: "dv-100",
      licenseOfferId: offerId,
      galleryItemId: null,
      personalizationVersionId: null,
      catalogProductId: "prod-tee",
      catalogVariantId: "var-tee",
      quantity: 1,
      placement: "front",
      artworkRevenueMinor: 499n,
      personalizationRevenueMinor: 300n,
      productRevenueMinor: 2599n,
      fulfillmentCostMinor: 1295n,
      creatorRoyaltyMinor: 499n,
      platformRevenueMinor: 1604n,
      totalMinor: 3398n,
      catalogVariant: {
        id: "var-tee",
        color: "Black",
        size: "L",
        product: { name: "Classic Tee" },
      },
      personalizationVersion: null,
    });

    const makeSignedStripeRequest = (payloadObj: Record<string, unknown>) => {
      const payload = JSON.stringify(payloadObj);
      const header = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: stripeSecret,
      });
      return new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": header,
        },
        body: payload,
      });
    };

    // A) Amount mismatch MUST be rejected (400), mark WebhookEvent FAILED, and leave Order PENDING_PAYMENT
    const mismatchEvent = {
      id: "evt_stripe_100",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_100",
          payment_status: "paid",
          amount_total: 999,
          currency: "usd",
          payment_intent: "pi_100",
          metadata: { orderId: "ord-100" },
          customer_details: { email: "buyer@thibut.com" },
        },
      },
    };

    const mismatchRes = await stripeWebhookPost(
      makeSignedStripeRequest(mismatchEvent)
    );
    assert.equal(mismatchRes.status, 400);
    assert.equal(
      sharedMockDb.state.orders.get("ord-100")?.status,
      "PENDING_PAYMENT"
    );
    assert.equal(
      sharedMockDb.state.webhookEvents.get("STRIPE::evt_stripe_100")?.status,
      "FAILED"
    );
    assert.equal(sharedMockDb.state.payments.size, 0);

    // B) Retry of previously FAILED event (same event.id) with authoritative amount succeeds!
    const validSessionEvent = {
      id: "evt_stripe_100",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_100",
          payment_status: "paid",
          amount_total: 3898,
          currency: "usd",
          payment_intent: { id: "pi_100", latest_charge: "ch_100" },
          metadata: { orderId: "ord-100" },
          customer_details: {
            email: "buyer@thibut.com",
            address: { line1: "123 Ink Way", city: "Austin", country: "US" },
          },
        },
      },
    };

    const retryRes = await stripeWebhookPost(
      makeSignedStripeRequest(validSessionEvent)
    );
    assert.equal(retryRes.status, 200);
    assert.equal(sharedMockDb.state.orders.get("ord-100")?.status, "PAID");
    assert.equal(
      sharedMockDb.state.orders.get("ord-100")?.paymentStatus,
      "SUCCEEDED"
    );
    assert.equal(
      sharedMockDb.state.webhookEvents.get("STRIPE::evt_stripe_100")?.status,
      "PROCESSED"
    );
    assert.equal(sharedMockDb.state.payments.size, 1);
    assert.equal(sharedMockDb.state.creatorEarnings.size, 1);
    assert.equal(sharedMockDb.state.snapshots.size, 1);
    assert.equal(sharedMockDb.state.licenseGrants.size, 1);

    const grant = Array.from(sharedMockDb.state.licenseGrants.values())[0];
    assert.equal(grant.allowModelTraining, false); // INV-010 strictly enforced!
    assert.equal(emittedEvents.length, 1);
    assert.deepEqual(emittedEvents[0], {
      name: "order/placed",
      data: { orderId: "ord-100" },
    });

    assert.equal(
      sharedMockDb.state.ledgerPostings.reduce(
        (acc, p) => acc + p.amountMinor,
        0n
      ),
      0n
    );

    // C) Duplicate PROCESSED event is a strict no-op (200)
    const dupRes = await stripeWebhookPost(
      makeSignedStripeRequest(validSessionEvent)
    );
    assert.equal(dupRes.status, 200);
    assert.equal(sharedMockDb.state.payments.size, 1);
    assert.equal(sharedMockDb.state.ledgerTransactions.size, 1);
    assert.equal(emittedEvents.length, 1);

    // D) charge.dispute.created + sequential charge.dispute.closed (lost) reverses once without double-posting
    const disputeCreated = {
      id: "evt_stripe_dispute_1",
      object: "event",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_100",
          amount: 3898,
          currency: "usd",
          status: "needs_response",
          reason: "fraudulent",
          charge: "ch_100",
          payment_intent: "pi_100",
        },
      },
    };

    const dispRes = await stripeWebhookPost(
      makeSignedStripeRequest(disputeCreated)
    );
    assert.equal(dispRes.status, 200);
    assert.equal(sharedMockDb.state.orders.get("ord-100")?.status, "REFUNDED");
    assert.equal(sharedMockDb.state.refunds.size, 1);
    const earningAfterDispute = Array.from(
      sharedMockDb.state.creatorEarnings.values()
    )[0];
    assert.equal(earningAfterDispute.status, "REVERSED");
    assert.notEqual(grant.revokedAt, null);
    assert.equal(sharedMockDb.state.ledgerTransactions.size, 2);

    const disputeClosedLost = {
      id: "evt_stripe_dispute_2",
      object: "event",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_100",
          amount: 3898,
          currency: "usd",
          status: "lost",
          reason: "fraudulent",
          charge: "ch_100",
          payment_intent: "pi_100",
        },
      },
    };
    const closedRes = await stripeWebhookPost(
      makeSignedStripeRequest(disputeClosedLost)
    );
    assert.equal(closedRes.status, 200);
    // Still 1 Refund & 2 LedgerTransactions (sale + 1 reversal) — zero double-posting!
    assert.equal(sharedMockDb.state.refunds.size, 1);
    assert.equal(sharedMockDb.state.ledgerTransactions.size, 2);
    assert.equal(
      sharedMockDb.state.ledgerPostings.reduce(
        (acc, p) => acc + p.amountMinor,
        0n
      ),
      0n
    );
  } finally {
    inngest.send = originalInngestSend;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRINTFUL WEBHOOK ROUTE & PROVIDER TESTS (T-107)
// ─────────────────────────────────────────────────────────────────────────────

test("T-107: Printful webhook enforces HMAC/token auth (401), collision-free deduplication (200), and ignores unknown events", async () => {
  sharedMockDb.reset();

  process.env.PRINTFUL_WEBHOOK_SECRET =
    "printful-webhook-secret-key-minimum-32-chars!!";

  sharedMockDb.state.orders.set("ord-pf-1", {
    id: "ord-pf-1",
    orderNumber: "TB-PF-1",
    buyerId: null,
    buyerEmail: "guest@thibut.com",
    shippingAddressJson: null,
    currency: "USD",
    status: "PAID",
    paymentStatus: "SUCCEEDED",
    fulfillmentStatus: "IN_PRODUCTION",
    subtotalMinor: 3398n,
    discountMinor: 0n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 3398n,
    placedAt: new Date(),
  });

  const { POST: printfulWebhookPost } = await import(
    "@/app/api/webhooks/fulfillment/printful/route"
  );
  const { PrintfulProvider } = await import(
    "@/lib/fulfillment/PrintfulProvider"
  );

  const signBody = (raw: string) =>
    computeHmacSha256Hex(raw, process.env.PRINTFUL_WEBHOOK_SECRET as string);

  // 1) Missing signature -> 401
  const noSigRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      body: JSON.stringify({ type: "package_shipped", created: 1700000001 }),
    })
  );
  assert.equal(noSigRes.status, 401);

  // 2) Invalid signature -> 401
  const badSigRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: {
        "x-pf-webhook-signature": "0".repeat(64),
      },
      body: JSON.stringify({ type: "package_shipped", created: 1700000001 }),
    })
  );
  assert.equal(badSigRes.status, 401);

  // 3) Unknown event -> 200 ignored, NEVER marks order FAILED!
  const unknownBody = JSON.stringify({
    type: "stock_updated",
    created: 1700000010,
    data: { order: { external_id: "TB-PF-1" } },
  });
  const unknownRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: {
        "x-pf-webhook-signature": signBody(unknownBody),
      },
      body: unknownBody,
    })
  );
  assert.equal(unknownRes.status, 200);
  const unknownJson = (await unknownRes.json()) as {
    received: boolean;
    ignored?: boolean;
  };
  assert.equal(unknownJson.ignored, true);
  assert.equal(
    sharedMockDb.state.orders.get("ord-pf-1")?.fulfillmentStatus,
    "IN_PRODUCTION"
  );
  assert.equal(
    sharedMockDb.state.webhookEvents.get(
      "PRINTFUL::stock_updated:1700000010:TB-PF-1"
    )?.status,
    "IGNORED"
  );

  // 4) Valid package_shipped -> updates order to SHIPPED & records collision-free externalEventId
  const shippedBody = JSON.stringify({
    type: "package_shipped",
    created: 1700000020,
    data: { order: { id: 777, external_id: "TB-PF-1" } },
  });
  const shippedRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: {
        "x-pf-webhook-signature": signBody(shippedBody),
      },
      body: shippedBody,
    })
  );
  assert.equal(shippedRes.status, 200);
  assert.equal(
    sharedMockDb.state.orders.get("ord-pf-1")?.fulfillmentStatus,
    "SHIPPED"
  );
  assert.equal(
    sharedMockDb.state.webhookEvents.get(
      "PRINTFUL::package_shipped:1700000020:TB-PF-1"
    )?.status,
    "PROCESSED"
  );

  // 5) Duplicate delivery of same Printful event -> 200 { received: true, duplicate: true }
  const duplicateRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: {
        "x-pf-webhook-signature": signBody(shippedBody),
      },
      body: shippedBody,
    })
  );
  assert.equal(duplicateRes.status, 200);
  const dupJson = (await duplicateRes.json()) as {
    received: boolean;
    duplicate?: boolean;
  };
  assert.equal(dupJson.duplicate, true);

  // 6) Constant-time token header auth also works when valid and fails closed when wrong
  const failedOrderBody = JSON.stringify({
    type: "order_failed",
    created: 1700000030,
    data: { order: { external_id: "TB-PF-1" } },
  });
  const badTokenRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: { "x-webhook-secret": "wrong-secret" },
      body: failedOrderBody,
    })
  );
  assert.equal(badTokenRes.status, 401);

  const goodTokenRes = await printfulWebhookPost(
    new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
      method: "POST",
      headers: {
        "x-webhook-secret": process.env.PRINTFUL_WEBHOOK_SECRET as string,
      },
      body: failedOrderBody,
    })
  );
  assert.equal(goodTokenRes.status, 200);
  assert.equal(
    sharedMockDb.state.orders.get("ord-pf-1")?.fulfillmentStatus,
    "FAILED"
  );

  // 7) Missing `created` falls back to SHA-256 of payload (never `payload.type` alone)
  const provider = new PrintfulProvider();
  const rawNoCreated = JSON.stringify({
    type: "package_shipped",
    data: { order: { external_id: "TB-PF-2" } },
  });
  const parsedNoCreated = await provider.parseWebhook(
    JSON.parse(rawNoCreated),
    rawNoCreated
  );
  assert.notEqual(parsedNoCreated.externalEventId, "package_shipped");
  assert.match(
    parsedNoCreated.externalEventId,
    /^package_shipped:sha256:[0-9a-f]{64}$/
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CATALOG SYNC SERVICE TESTS (T-206)
// ─────────────────────────────────────────────────────────────────────────────

test("T-206: CatalogSyncService uses BigInt math, wraps imports in $transaction, and refreshes baseRetailMinor on re-import", async () => {
  sharedMockDb.reset();

  const { CatalogSyncService } = await import(
    "@/lib/services/CatalogSyncService"
  );
  let currentVariantPrice = "12.95";

  const fakeProvider = {
    async getCatalogProductDetails(productId: string | number) {
      return {
        result: {
          product: {
            id: Number(productId),
            title: "Bella + Canvas 3001",
            image: "https://cdn.printful.com/product-71.jpg",
          },
          variants: [
            {
              id: 4012,
              name: "Bella + Canvas 3001 - Black / L",
              color: "Black",
              color_code: "#111111",
              size: "L",
              price: currentVariantPrice,
              in_stock: true,
              image: "https://cdn.printful.com/variant-4012.jpg",
            },
          ],
        },
      };
    },
  };

  const syncService = new CatalogSyncService(
    fakeProvider as unknown as ConstructorParameters<typeof CatalogSyncService>[0]
  );

  // Initial import at $12.95 cost -> 1295n * 2n = 2590n -> roundUpTo99Minor = 2599n
  await syncService.importCatalogProduct(71, "apparel", "product-71");
  assert.equal(sharedMockDb.state.txCount, 1);
  assert.equal(
    sharedMockDb.state.catalogVariants.get("TB-CAT-4012")?.baseRetailMinor,
    2599n
  );

  // Re-import after Printful price increase ($15.20 -> 1520n * 2n = 3040n -> 3099n) refreshes baseRetailMinor!
  currentVariantPrice = "15.20";
  await syncService.importCatalogProduct(71, "apparel", "product-71");
  assert.equal(sharedMockDb.state.txCount, 2);
  assert.equal(
    sharedMockDb.state.catalogVariants.get("TB-CAT-4012")?.baseRetailMinor,
    3099n
  );

  // Zero-price variants are rejected with PricingValidationError (no hardcoded 2500 fallback)
  currentVariantPrice = "0.00";
  await assert.rejects(
    () => syncService.importCatalogProduct(71, "apparel", "product-71"),
    PricingValidationError
  );
});
