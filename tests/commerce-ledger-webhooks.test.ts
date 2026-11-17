import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { LedgerAccountType, PrismaClient } from "@prisma/client";
import {
  DIGITAL_TOTAL_MINOR,
  EXTRA_ITEM_SHIPPING_MINOR,
  INTL_FLAT_SHIPPING_MINOR,
  PLACEMENT_FEE_MINOR,
  PricingValidationError,
  US_FLAT_SHIPPING_MINOR,
  calculateDigitalQuote,
  calculateFlatShippingMinor,
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
  attempts: number;
  receivedAt: Date;
  updatedAt: Date;
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
  anonymousSessionId?: string | null;
  stripeCheckoutSessionId?: string | null;
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
  cancelledAt?: Date | null;
  createdAt?: Date;
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
      {
        id: string;
        slug: string;
        name: string;
        category: string;
        status: string;
        defaultMarkupMinor?: bigint;
      }
    >(),
    catalogVariants: new Map<string, MockCatalogVariantRow>(),
    providerVariants: new Map<string, MockProviderVariantRow>(),
    sessions: new Map<
      string,
      {
        id: string;
        userId: string | null;
        anonymousSessionId: string | null;
        designId: string | null;
        designVersionId: string | null;
        mode: string;
        inputText: string;
        inputLanguage?: string | null;
        targetLanguage?: string | null;
        selectedInterpretationId?: string | null;
        status: string;
        compositionJson?: unknown;
        createdAt?: Date;
      }
    >(),
    personalizationVersions: new Map<
      string,
      {
        id: string;
        sessionId: string;
        designVersionId: string | null;
        versionNumber: number;
        inputSnapshot: unknown;
        interpretationSnapshot: unknown;
        styleSnapshot: unknown;
      }
    >(),
    carts: new Map<
      string,
      {
        id: string;
        userId: string | null;
        anonymousSessionId: string | null;
        status: string;
      }
    >(),
    priceQuotes: new Map<
      string,
      {
        id: string;
        cartId: string | null;
        orderId: string | null;
        currency: string;
        subtotalMinor: bigint;
        artworkMinor?: bigint;
        personalizationMinor?: bigint;
        productMinor?: bigint;
        fulfillmentCostMinor?: bigint;
        creatorRoyaltyMinor?: bigint;
        platformMinor?: bigint;
        shippingMinor: bigint;
        taxMinor: bigint;
        discountMinor?: bigint;
        totalMinor: bigint;
        expiresAt: Date;
        createdAt: Date;
      }
    >(),
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
    state.sessions.clear();
    state.personalizationVersions.clear();
    state.carts.clear();
    state.priceQuotes.clear();
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
        const created = { id: crypto.randomUUID(), defaultMarkupMinor: 0n, ...create };
        state.catalogProducts.set(where.slug, created);
        return created;
      },
      async findMany({ where }: { where?: { status?: string } }) {
        return Array.from(state.catalogProducts.values())
          .filter((p) => !where?.status || p.status === where.status)
          .map((p) => ({
            ...p,
            defaultMarkupMinor: p.defaultMarkupMinor ?? 0n,
            printAreas: [],
            variants: Array.from(state.catalogVariants.values())
              .filter((v) => v.productId === p.id && v.active)
              .map((v) => ({
                ...v,
                mockups: [],
                providerVariants: Array.from(state.providerVariants.values()).filter(
                  (pv) => pv.catalogVariantId === v.id && pv.active
                ),
              })),
          }));
      },
    },
    catalogVariant: {
      async findUnique({ where }: { where: { id: string } }) {
        const found = Array.from(state.catalogVariants.values()).find(
          (v) => v.id === where.id
        );
        if (!found) return null;
        const product = Array.from(state.catalogProducts.values()).find(
          (p) => p.id === found.productId
        );
        const providerVariants = Array.from(state.providerVariants.values()).filter(
          (pv) => pv.catalogVariantId === found.id
        );
        return {
          ...found,
          product: product ?? {
            id: found.productId,
            name: "Product",
            status: "ACTIVE",
            defaultMarkupMinor: 0n,
          },
          providerVariants,
        };
      },
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
          attempts?: number;
        };
      }) {
        const key = webhookKey(data.provider, data.externalEventId);
        if (state.webhookEvents.has(key)) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const now = new Date();
        const row: MockWebhookEventRow = {
          id: crypto.randomUUID(),
          provider: data.provider,
          externalEventId: data.externalEventId,
          eventType: data.eventType,
          payloadJson: data.payloadJson,
          status: data.status ?? "PENDING",
          attempts: data.attempts ?? 0,
          receivedAt: now,
          updatedAt: now,
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
        data: { status?: string; processedAt?: Date; updatedAt?: Date };
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
        existing.updatedAt = data.updatedAt ?? new Date();
        return existing;
      },
      async updateMany({
        where,
        data,
      }: {
        where: {
          provider?: string;
          externalEventId?: string;
          status?: string | { in: string[] };
          updatedAt?: { lt?: Date };
        };
        data: {
          status?: string;
          processedAt?: Date;
          updatedAt?: Date;
          attempts?: { increment: number };
        };
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
          if (typeof where.status === "string" && row.status !== where.status) {
            continue;
          }
          if (
            typeof where.status === "object" &&
            where.status !== null &&
            "in" in where.status &&
            !where.status.in.includes(row.status)
          ) {
            continue;
          }
          if (
            where.updatedAt?.lt &&
            row.updatedAt.getTime() >= where.updatedAt.lt.getTime()
          ) {
            continue;
          }
          if (data.status !== undefined) row.status = data.status;
          if (data.processedAt !== undefined) row.processedAt = data.processedAt;
          if (data.attempts?.increment !== undefined) {
            row.attempts += data.attempts.increment;
          }
          row.updatedAt = data.updatedAt ?? new Date();
          count++;
        }
        return { count };
      },
    },
    order: {
      async create({
        data,
      }: {
        data: Omit<MockOrderRow, "id" | "placedAt" | "buyerEmail" | "shippingAddressJson"> & {
          buyerEmail?: string | null;
          shippingAddressJson?: unknown;
          placedAt?: Date | null;
        };
      }) {
        const row: MockOrderRow = {
          id: crypto.randomUUID(),
          buyerEmail: data.buyerEmail ?? null,
          shippingAddressJson: data.shippingAddressJson ?? null,
          placedAt: data.placedAt ?? null,
          createdAt: new Date(),
          ...data,
        };
        state.orders.set(row.id, row);
        return row;
      },
      async findFirst({
        where,
      }: {
        where: {
          id?: string;
          status?: string;
          stripeCheckoutSessionId?: string | { not: null };
          createdAt?: { gte?: Date };
          totalMinor?: bigint;
          buyerId?: string;
          anonymousSessionId?: string | null;
          items?: {
            some?: {
              catalogVariantId?: string | null;
              placement?: string;
              quantity?: number;
              galleryItemId?: string;
              personalizationVersion?: { sessionId?: string };
            };
          };
        };
      }) {
        const candidates = Array.from(state.orders.values()).filter((o) => {
          if (where.id && o.id !== where.id) return false;
          if (where.status && o.status !== where.status) return false;
          if (typeof where.stripeCheckoutSessionId === "string") {
            if (o.stripeCheckoutSessionId !== where.stripeCheckoutSessionId) {
              return false;
            }
          } else if (where.stripeCheckoutSessionId?.not === null) {
            if (!o.stripeCheckoutSessionId) return false;
          }
          if (
            where.createdAt?.gte &&
            (o.createdAt ?? new Date()).getTime() < where.createdAt.gte.getTime()
          ) {
            return false;
          }
          if (
            where.totalMinor !== undefined &&
            o.totalMinor !== where.totalMinor
          ) {
            return false;
          }
          if (where.buyerId !== undefined && o.buyerId !== where.buyerId) {
            return false;
          }
          if (
            where.anonymousSessionId !== undefined &&
            o.anonymousSessionId !== where.anonymousSessionId
          ) {
            return false;
          }
          if (where.items?.some) {
            const cond = where.items.some;
            const orderItems = Array.from(state.orderItems.values()).filter(
              (i) => i.orderId === o.id
            );
            const matchedItem = orderItems.some((item) => {
              if (
                cond.catalogVariantId !== undefined &&
                item.catalogVariantId !== cond.catalogVariantId
              ) {
                return false;
              }
              if (cond.placement && item.placement !== cond.placement) {
                return false;
              }
              if (cond.quantity !== undefined && item.quantity !== cond.quantity) {
                return false;
              }
              if (cond.galleryItemId && item.galleryItemId !== cond.galleryItemId) {
                return false;
              }
              if (cond.personalizationVersion?.sessionId) {
                const pv = item.personalizationVersionId
                  ? state.personalizationVersions.get(item.personalizationVersionId)
                  : null;
                if (pv?.sessionId !== cond.personalizationVersion.sessionId) {
                  return false;
                }
              }
              return true;
            });
            if (!matchedItem) return false;
          }
          return true;
        });

        const found = candidates[candidates.length - 1];
        if (!found) return null;
        const items = Array.from(state.orderItems.values())
          .filter((i) => i.orderId === found.id)
          .map((item) => ({
            ...item,
            personalizationVersion: item.personalizationVersionId
              ? (state.personalizationVersions.get(
                  item.personalizationVersionId
                ) ?? item.personalizationVersion ?? null)
              : (item.personalizationVersion ?? null),
          }));
        return { ...found, items };
      },
      async findMany({
        where,
      }: {
        where?: { status?: string; createdAt?: { lt?: Date } };
      }) {
        return Array.from(state.orders.values())
          .filter((o) => {
            if (where?.status && o.status !== where.status) return false;
            if (
              where?.createdAt?.lt &&
              (o.createdAt ?? new Date()).getTime() >= where.createdAt.lt.getTime()
            ) {
              return false;
            }
            return true;
          })
          .map((o) => ({
            ...o,
            items: Array.from(state.orderItems.values())
              .filter((i) => i.orderId === o.id)
              .map((item) => ({
                ...item,
                personalizationVersion: item.personalizationVersionId
                  ? (state.personalizationVersions.get(
                      item.personalizationVersionId
                    ) ?? null)
                  : null,
              })),
          }));
      },
      async updateMany({
        where,
        data,
      }: {
        where: { id?: { in: string[] }; status?: string };
        data: Partial<MockOrderRow>;
      }) {
        let count = 0;
        for (const o of state.orders.values()) {
          if (where.id?.in && !where.id.in.includes(o.id)) continue;
          if (where.status && o.status !== where.status) continue;
          Object.assign(o, data);
          count++;
        }
        return { count };
      },
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
            personalizationVersion: item.personalizationVersionId
              ? (state.personalizationVersions.get(
                  item.personalizationVersionId
                ) ?? item.personalizationVersion ?? null)
              : (item.personalizationVersion ?? null),
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
    orderItem: {
      async create({
        data,
      }: {
        data: Omit<MockOrderItemRow, "id" | "galleryItemId" | "licenseOfferId" | "personalizationVersionId" | "catalogProductId" | "catalogVariantId"> & {
          galleryItemId?: string | null;
          licenseOfferId?: string | null;
          personalizationVersionId?: string | null;
          catalogProductId?: string | null;
          catalogVariantId?: string | null;
        };
      }) {
        const row: MockOrderItemRow = {
          id: crypto.randomUUID(),
          galleryItemId: data.galleryItemId ?? null,
          licenseOfferId: data.licenseOfferId ?? null,
          personalizationVersionId: data.personalizationVersionId ?? null,
          catalogProductId: data.catalogProductId ?? null,
          catalogVariantId: data.catalogVariantId ?? null,
          ...data,
        };
        state.orderItems.set(row.id, row);
        return row;
      },
    },
    design: {
      async findUnique({ where }: { where: { id?: string; slug?: string } }) {
        if (where.id) {
          const d = state.designs.get(where.id);
          if (!d) return null;
          return { ...d, versions: [{ id: `dv-${d.id}`, designId: d.id, versionNumber: 1 }] };
        }
        return null;
      },
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
      async findMany({ where }: { where: { orderId: string } }) {
        return Array.from(state.refunds.values()).filter(
          (r) => r.orderId === where.orderId
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
      async findMany({ where }: { where: { orderItemId: { in: string[] } } }) {
        return Array.from(state.creatorEarnings.values()).filter((ce) =>
          where.orderItemId.in.includes(ce.orderItemId)
        );
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockCreatorEarningRow>;
      }) {
        const existing = state.creatorEarnings.get(where.id);
        if (!existing) throw new Error(`CreatorEarning not found: ${where.id}`);
        Object.assign(existing, data);
        return existing;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { orderItemId: { in: string[] } };
        data: { status?: string; netCreatorMinor?: bigint };
      }) {
        let count = 0;
        for (const ce of state.creatorEarnings.values()) {
          if (where.orderItemId.in.includes(ce.orderItemId)) {
            if (data.status !== undefined) ce.status = data.status;
            if (data.netCreatorMinor !== undefined) {
              ce.netCreatorMinor = data.netCreatorMinor;
            }
            count++;
          }
        }
        return { count };
      },
    },
    personalizationSession: {
      async findUnique({ where }: { where: { id: string } }) {
        const found = state.sessions.get(where.id);
        if (!found) return null;
        return { ...found, interpretations: [] };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        const existing = state.sessions.get(where.id);
        if (!existing) throw new Error(`Session not found: ${where.id}`);
        Object.assign(existing, data);
        return { ...existing, interpretations: [] };
      },
      async updateMany({
        where,
        data,
      }: {
        where?: { id?: string | { in: string[] }; status?: string };
        data?: { status?: string };
      }) {
        let count = 0;
        for (const sess of state.sessions.values()) {
          if (typeof where?.id === "string" && sess.id !== where.id) continue;
          if (
            typeof where?.id === "object" &&
            where.id !== null &&
            "in" in where.id &&
            !where.id.in.includes(sess.id)
          ) {
            continue;
          }
          if (where?.status && sess.status !== where.status) continue;
          if (data?.status) sess.status = data.status;
          count++;
        }
        return { count };
      },
    },
    personalizationVersion: {
      async findUnique({ where }: { where: { id: string } }) {
        const pv = state.personalizationVersions.get(where.id);
        if (!pv) return null;
        const session = state.sessions.get(pv.sessionId) ?? null;
        return {
          ...pv,
          session: session ? { ...session, interpretations: [] } : null,
        };
      },
      async findFirst({ where }: { where: { sessionId: string } }) {
        const list = Array.from(state.personalizationVersions.values())
          .filter((pv) => pv.sessionId === where.sessionId)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return list[0] ?? null;
      },
      async create({
        data,
      }: {
        data: {
          sessionId: string;
          designVersionId?: string | null;
          versionNumber: number;
          inputSnapshot: unknown;
          interpretationSnapshot: unknown;
          styleSnapshot: unknown;
        };
      }) {
        const row = {
          id: crypto.randomUUID(),
          sessionId: data.sessionId,
          designVersionId: data.designVersionId ?? null,
          versionNumber: data.versionNumber,
          inputSnapshot: data.inputSnapshot,
          interpretationSnapshot: data.interpretationSnapshot,
          styleSnapshot: data.styleSnapshot,
        };
        state.personalizationVersions.set(row.id, row);
        const session = state.sessions.get(row.sessionId) ?? null;
        return {
          ...row,
          session: session ? { ...session, interpretations: [] } : null,
        };
      },
    },
    cart: {
      async findUnique({ where }: { where: { id: string } }) {
        return state.carts.get(where.id) ?? null;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) {
        const existing = state.carts.get(where.id);
        if (!existing) throw new Error(`Cart not found: ${where.id}`);
        existing.status = data.status;
        return existing;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { id: string | { in: string[] }; status?: string };
        data: { status: string };
      }) {
        let count = 0;
        for (const c of state.carts.values()) {
          if (typeof where.id === "string" && c.id !== where.id) continue;
          if (
            typeof where.id === "object" &&
            where.id !== null &&
            "in" in where.id &&
            !where.id.in.includes(c.id)
          ) {
            continue;
          }
          if (where.status && c.status !== where.status) continue;
          c.status = data.status;
          count++;
        }
        return { count };
      },
    },
    priceQuote: {
      async create({
        data,
      }: {
        data: {
          cartId?: string | null;
          orderId?: string | null;
          currency: string;
          subtotalMinor: bigint;
          artworkMinor?: bigint;
          personalizationMinor?: bigint;
          productMinor?: bigint;
          fulfillmentCostMinor?: bigint;
          creatorRoyaltyMinor?: bigint;
          platformMinor?: bigint;
          shippingMinor: bigint;
          taxMinor: bigint;
          discountMinor?: bigint;
          totalMinor: bigint;
          expiresAt: Date;
        };
      }) {
        const row = {
          id: crypto.randomUUID(),
          cartId: data.cartId ?? null,
          orderId: data.orderId ?? null,
          currency: data.currency,
          subtotalMinor: data.subtotalMinor,
          artworkMinor: data.artworkMinor,
          personalizationMinor: data.personalizationMinor,
          productMinor: data.productMinor,
          fulfillmentCostMinor: data.fulfillmentCostMinor,
          creatorRoyaltyMinor: data.creatorRoyaltyMinor,
          platformMinor: data.platformMinor,
          shippingMinor: data.shippingMinor,
          taxMinor: data.taxMinor,
          discountMinor: data.discountMinor,
          totalMinor: data.totalMinor,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        state.priceQuotes.set(row.id, row);
        return row;
      },
      async findFirst({
        where,
      }: {
        where: {
          cartId?: string;
          orderId?: string | { not: null };
          expiresAt?: { gt: Date };
        };
      }) {
        const matches = Array.from(state.priceQuotes.values()).filter((q) => {
          if (where.cartId && q.cartId !== where.cartId) return false;
          if (typeof where.orderId === "string" && q.orderId !== where.orderId) {
            return false;
          }
          if (
            typeof where.orderId === "object" &&
            where.orderId !== null &&
            "not" in where.orderId &&
            q.orderId === null
          ) {
            return false;
          }
          if (
            where.expiresAt?.gt &&
            q.expiresAt.getTime() <= where.expiresAt.gt.getTime()
          ) {
            return false;
          }
          return true;
        });
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return matches[0] ?? null;
      },
      async findMany({
        where,
      }: {
        where: { orderId: { in: string[] } };
      }) {
        return Array.from(state.priceQuotes.values()).filter(
          (q) => q.orderId !== null && where.orderId.in.includes(q.orderId)
        );
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

  // Eliminates $9.99 vs $14.99 checkout mismatch with pure BigInt fields (R-201)
  assert.equal(engineFacade.digitalGalleryPriceMinor, 1499n);
  assert.equal(engineFacade.digitalPersonalizedPriceMinor, 1499n);
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

    // D) charge.dispute.created holds funds in DISPUTE_RESERVE (keeps license active), then charge.dispute.closed (lost) releases hold & executes full reversal once (R-103)
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
    assert.equal(sharedMockDb.state.orders.get("ord-100")?.status, "PAID");
    assert.equal(
      sharedMockDb.state.orders.get("ord-100")?.paymentStatus,
      "DISPUTED"
    );
    const earningAfterDispute = Array.from(
      sharedMockDb.state.creatorEarnings.values()
    )[0];
    assert.equal(earningAfterDispute.status, "HELD");
    assert.equal(grant.revokedAt, null);
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
    assert.equal(sharedMockDb.state.orders.get("ord-100")?.status, "REFUNDED");
    assert.equal(earningAfterDispute.status, "REVERSED");
    assert.notEqual(grant.revokedAt, null);
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. ROUND-2 AUDIT REMEDIATION TESTS (R-102, R-103, R-104, R-105, R-200..R-205)
// ─────────────────────────────────────────────────────────────────────────────

function seedSettledDigitalOrderForTests(orderId: string, chargeId: string) {
  const offerId = `lo-${orderId}`;
  const offer: MockLicenseOfferRow = {
    id: offerId,
    designId: `design-${orderId}`,
    type: "PERSONAL_DIGITAL",
    priceMinor: 499n,
    currency: "USD",
    active: true,
    allowDigitalDownload: true,
    allowResale: false,
    allowCommercialUse: false,
    termsVersion: 1,
  };
  sharedMockDb.state.licenseOffers.set(offerId, offer);
  sharedMockDb.state.designs.set(`design-${orderId}`, {
    id: `design-${orderId}`,
    title: "Bình An Crest",
    creator: { id: `creator-${orderId}`, displayName: "Master Kiên" },
    policyVersions: [
      {
        versionNumber: 1,
        allowName: true,
        allowQuote: true,
        allowTranslation: true,
        allowCalligraphy: true,
        allowAIRestyle: false,
        allowCommercialUse: false,
        allowModelTraining: false,
      },
    ],
    licenses: [offer],
  });

  sharedMockDb.state.orders.set(orderId, {
    id: orderId,
    orderNumber: `TB-${orderId.toUpperCase()}`,
    buyerId: `buyer-${orderId}`,
    buyerEmail: "buyer@thibut.com",
    shippingAddressJson: null,
    currency: "USD",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING",
    subtotalMinor: 1499n,
    discountMinor: 0n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 1499n,
    placedAt: null,
    createdAt: new Date(),
  });

  sharedMockDb.state.orderItems.set(`oi-${orderId}`, {
    id: `oi-${orderId}`,
    orderId,
    creatorId: `creator-${orderId}`,
    designId: `design-${orderId}`,
    designVersionId: `dv-${orderId}`,
    licenseOfferId: offerId,
    galleryItemId: null,
    personalizationVersionId: null,
    catalogProductId: null,
    catalogVariantId: null,
    quantity: 1,
    placement: "front",
    artworkRevenueMinor: 499n,
    personalizationRevenueMinor: 300n,
    productRevenueMinor: 700n,
    fulfillmentCostMinor: 0n,
    creatorRoyaltyMinor: 499n,
    platformRevenueMinor: 1000n,
    totalMinor: 1499n,
  });

  return {
    settlementEvent: {
      id: `evt_settle_${orderId}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${orderId}`,
          payment_status: "paid",
          amount_total: 1499,
          currency: "usd",
          payment_intent: {
            id: `pi_${orderId}`,
            latest_charge: chargeId,
          },
          metadata: { orderId, isDigital: "true" },
          customer_details: { email: "buyer@thibut.com" },
        },
      },
    },
  };
}

test("R-102: Partial refunds preserve LicenseGrant, adjust CreatorEarning pro-rata, post exact delta, transition to REFUNDED at 100%, and clamp refund+dispute at totalMinor", async () => {
  sharedMockDb.reset();
  const stripeSecret = "whsec_r102_partial_refund_secret";
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";

  const { inngest } = await import("@/lib/inngest");
  const origSend = inngest.send.bind(inngest);
  inngest.send = (async () => ({ ids: ["evt-r102"] })) as typeof inngest.send;

  try {
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );

    const sign = (obj: Record<string, unknown>) => {
      const payload = JSON.stringify(obj);
      const sig = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: stripeSecret,
      });
      return new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": sig,
        },
        body: payload,
      });
    };

    // 1. Settle 1499n order
    const { settlementEvent } = seedSettledDigitalOrderForTests(
      "ord-r102-a",
      "ch_r102_a"
    );
    const settleRes = await stripeWebhookPost(sign(settlementEvent));
    assert.equal(settleRes.status, 200);

    // 2. First partial refund: 500n on 1499n order -> PARTIALLY_REFUNDED, license stays active!
    const partial1Res = await stripeWebhookPost(
      sign({
        id: "evt_r102_ref_1",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_r102_a",
            amount: 1499,
            amount_refunded: 500,
            currency: "usd",
            refunds: {
              data: [
                {
                  id: "re_r102_1",
                  amount: 500,
                  reason: "requested_by_customer",
                  created: 1700000100,
                },
              ],
            },
          },
        },
      })
    );
    assert.equal(partial1Res.status, 200);

    const orderAfterPartial = sharedMockDb.state.orders.get("ord-r102-a")!;
    const paymentAfterPartial = Array.from(
      sharedMockDb.state.payments.values()
    )[0]!;
    const grantAfterPartial = Array.from(
      sharedMockDb.state.licenseGrants.values()
    )[0]!;
    const earningAfterPartial = Array.from(
      sharedMockDb.state.creatorEarnings.values()
    )[0]!;

    assert.equal(orderAfterPartial.status, "PARTIALLY_REFUNDED");
    assert.equal(paymentAfterPartial.status, "PARTIALLY_REFUNDED");
    assert.equal(
      grantAfterPartial.revokedAt,
      null,
      "Partial refund MUST keep LicenseGrant active"
    );
    assert.equal(earningAfterPartial.status, "PENDING");
    // Pro-rata: -(499n * 500n / 1499n) = -166n -> net = 333n
    assert.equal(earningAfterPartial.adjustmentMinor, -166n);
    assert.equal(earningAfterPartial.netCreatorMinor, 333n);

    const stripeAcc = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "STRIPE_CLEARING")!;
    assert.equal(stripeAcc.balanceMinor, 1499n - 500n);
    assert.equal(
      sharedMockDb.state.ledgerPostings.reduce(
        (acc, p) => acc + p.amountMinor,
        0n
      ),
      0n
    );

    // 3. Replaying partial refund with a new webhook event ID (or same) posts 0 extra entries
    const replayRes = await stripeWebhookPost(
      sign({
        id: "evt_r102_ref_1_replay",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_r102_a",
            amount: 1499,
            amount_refunded: 500,
            currency: "usd",
            refunds: {
              data: [
                {
                  id: "re_r102_1",
                  amount: 500,
                  reason: "requested_by_customer",
                  created: 1700000100,
                },
              ],
            },
          },
        },
      })
    );
    assert.equal(replayRes.status, 200);
    assert.equal(stripeAcc.balanceMinor, 999n);
    assert.equal(sharedMockDb.state.ledgerTransactions.size, 2);

    // 4. Second partial refund (999n; Stripe sends both re_r102_2 and re_r102_1 in refunds.data) -> REFUNDED!
    const partial2Res = await stripeWebhookPost(
      sign({
        id: "evt_r102_ref_2",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_r102_a",
            amount: 1499,
            amount_refunded: 1499,
            currency: "usd",
            refunds: {
              data: [
                {
                  id: "re_r102_2",
                  amount: 999,
                  reason: "requested_by_customer",
                  created: 1700000200,
                },
                {
                  id: "re_r102_1",
                  amount: 500,
                  reason: "requested_by_customer",
                  created: 1700000100,
                },
              ],
            },
          },
        },
      })
    );
    assert.equal(partial2Res.status, 200);
    assert.equal(sharedMockDb.state.orders.get("ord-r102-a")?.status, "REFUNDED");
    assert.equal(paymentAfterPartial.status, "REFUNDED");
    assert.equal(earningAfterPartial.status, "REVERSED");
    assert.equal(earningAfterPartial.netCreatorMinor, 0n);
    const grantAfterFull = Array.from(
      sharedMockDb.state.licenseGrants.values()
    )[0]!;
    assert.ok(grantAfterFull.revokedAt instanceof Date);
    assert.equal(stripeAcc.balanceMinor, 0n);
    const creatorPayable = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "CREATOR_PAYABLE")!;
    assert.equal(creatorPayable.balanceMinor, 0n);

    // 5. Partial refund (500n) + lost dispute (1499n) on a second 1499n order NEVER reverses > 1499n!
    sharedMockDb.reset();
    const { settlementEvent: settleB } = seedSettledDigitalOrderForTests(
      "ord-r102-b",
      "ch_r102_b"
    );
    await stripeWebhookPost(sign(settleB));
    await stripeWebhookPost(
      sign({
        id: "evt_r102_b_ref",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_r102_b",
            amount: 1499,
            amount_refunded: 500,
            currency: "usd",
            refunds: { data: [{ id: "re_b_500", amount: 500 }] },
          },
        },
      })
    );
    await stripeWebhookPost(
      sign({
        id: "evt_r102_b_disp_created",
        object: "event",
        type: "charge.dispute.created",
        data: {
          object: {
            id: "dp_b_1",
            amount: 1499,
            currency: "usd",
            status: "needs_response",
            charge: "ch_r102_b",
          },
        },
      })
    );
    await stripeWebhookPost(
      sign({
        id: "evt_r102_b_disp_lost",
        object: "event",
        type: "charge.dispute.closed",
        data: {
          object: {
            id: "dp_b_1",
            amount: 1499,
            currency: "usd",
            status: "lost",
            charge: "ch_r102_b",
          },
        },
      })
    );

    const stripeAccB = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "STRIPE_CLEARING")!;
    const reserveAccB = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "DISPUTE_RESERVE")!;
    assert.equal(
      stripeAccB.balanceMinor,
      0n,
      "Total Stripe outflow across partial refund + lost dispute must equal 1499n (net 0n)"
    );
    assert.equal(reserveAccB.balanceMinor, 0n);
  } finally {
    inngest.send = origSend;
  }
});

test("R-103: Dispute created -> funds_withdrawn -> closed (won) releases DISPUTE_RESERVE hold (net 0n), restores earning, and keeps license active", async () => {
  sharedMockDb.reset();
  const stripeSecret = "whsec_r103_dispute_won_secret";
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";

  const { inngest } = await import("@/lib/inngest");
  const origSend = inngest.send.bind(inngest);
  inngest.send = (async () => ({ ids: ["evt-r103"] })) as typeof inngest.send;

  try {
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );

    const sign = (obj: Record<string, unknown>) => {
      const payload = JSON.stringify(obj);
      const sig = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: stripeSecret,
      });
      return new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": sig,
        },
        body: payload,
      });
    };

    const { settlementEvent } = seedSettledDigitalOrderForTests(
      "ord-r103",
      "ch_r103"
    );
    await stripeWebhookPost(sign(settlementEvent));

    // 1. charge.dispute.created -> Payment DISPUTED, Earning HELD, License active, DISPUTE_RESERVE +1499n
    const createdRes = await stripeWebhookPost(
      sign({
        id: "evt_r103_disp_created",
        object: "event",
        type: "charge.dispute.created",
        data: {
          object: {
            id: "dp_r103",
            amount: 1499,
            currency: "usd",
            status: "needs_response",
            charge: "ch_r103",
          },
        },
      })
    );
    assert.equal(createdRes.status, 200);

    const payment = Array.from(sharedMockDb.state.payments.values())[0]!;
    const earning = Array.from(sharedMockDb.state.creatorEarnings.values())[0]!;
    const grant = Array.from(sharedMockDb.state.licenseGrants.values())[0]!;
    assert.equal(payment.status, "DISPUTED");
    assert.equal(earning.status, "HELD");
    assert.equal(grant.revokedAt, null);

    const reserveAcc = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "DISPUTE_RESERVE")!;
    const stripeAcc = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "STRIPE_CLEARING")!;
    assert.equal(reserveAcc.balanceMinor, 1499n);
    assert.equal(stripeAcc.balanceMinor, 0n);

    // 2. Subsequent charge.dispute.funds_withdrawn is idempotent (does not double-hold)
    const withdrawnRes = await stripeWebhookPost(
      sign({
        id: "evt_r103_disp_withdrawn",
        object: "event",
        type: "charge.dispute.funds_withdrawn",
        data: {
          object: {
            id: "dp_r103",
            amount: 1499,
            currency: "usd",
            status: "under_review",
            charge: "ch_r103",
          },
        },
      })
    );
    assert.equal(withdrawnRes.status, 200);
    assert.equal(reserveAcc.balanceMinor, 1499n);

    // 3. charge.dispute.closed with status === "won" -> releases hold (DISPUTE_RESERVE = 0n), restores Payment SUCCEEDED & Earning PENDING!
    const wonRes = await stripeWebhookPost(
      sign({
        id: "evt_r103_disp_won",
        object: "event",
        type: "charge.dispute.closed",
        data: {
          object: {
            id: "dp_r103",
            amount: 1499,
            currency: "usd",
            status: "won",
            charge: "ch_r103",
          },
        },
      })
    );
    assert.equal(wonRes.status, 200);
    assert.equal(reserveAcc.balanceMinor, 0n);
    assert.equal(stripeAcc.balanceMinor, 1499n);
    assert.equal(payment.status, "SUCCEEDED");
    assert.equal(
      sharedMockDb.state.orders.get("ord-r103")?.paymentStatus,
      "SUCCEEDED"
    );
    assert.equal(earning.status, "PENDING");
    assert.equal(grant.revokedAt, null);
    assert.equal(
      sharedMockDb.state.ledgerPostings.reduce(
        (acc, p) => acc + p.amountMinor,
        0n
      ),
      0n
    );
  } finally {
    inngest.send = origSend;
  }
});

test("R-104: Stale PROCESSING WebhookEvent (>5 min) is atomically reclaimed and processed to PROCESSED on both Stripe and Printful", async () => {
  sharedMockDb.reset();
  const stripeSecret = "whsec_r104_lease_secret";
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;
  process.env.PRINTFUL_WEBHOOK_SECRET =
    "printful-r104-secret-key-minimum-32-chars!!";
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";

  const { inngest } = await import("@/lib/inngest");
  const origSend = inngest.send.bind(inngest);
  inngest.send = (async () => ({ ids: ["evt-r104"] })) as typeof inngest.send;

  try {
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );
    const { POST: printfulWebhookPost } = await import(
      "@/app/api/webhooks/fulfillment/printful/route"
    );

    const { settlementEvent } = seedSettledDigitalOrderForTests(
      "ord-r104",
      "ch_r104"
    );
    const payload = JSON.stringify(settlementEvent);
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: stripeSecret,
    });

    // 1. Seed fresh PROCESSING row (1 minute old) -> returns 409 inProgress
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    sharedMockDb.state.webhookEvents.set("STRIPE::evt_settle_ord-r104", {
      id: "wh-r104-1",
      provider: "STRIPE",
      externalEventId: "evt_settle_ord-r104",
      eventType: "checkout.session.completed",
      payloadJson: settlementEvent,
      status: "PROCESSING",
      attempts: 1,
      receivedAt: oneMinAgo,
      updatedAt: oneMinAgo,
      processedAt: null,
    });

    const freshRes = await stripeWebhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: payload,
      })
    );
    assert.equal(freshRes.status, 409);

    // 2. Age updatedAt to 10 minutes ago -> reclaimed & processed to 200 PROCESSED!
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const seededRow = sharedMockDb.state.webhookEvents.get(
      "STRIPE::evt_settle_ord-r104"
    )!;
    seededRow.updatedAt = tenMinAgo;
    seededRow.attempts = 5; // Next reclaim hits attempts = 6 (> 5 alert threshold)

    const reclaimedRes = await stripeWebhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: payload,
      })
    );
    assert.equal(reclaimedRes.status, 200);
    assert.equal(seededRow.status, "PROCESSED");
    assert.equal(seededRow.attempts, 6);
    assert.equal(sharedMockDb.state.orders.get("ord-r104")?.status, "PAID");

    // 3. Printful stale PROCESSING row (10 minutes old) is also reclaimed and processed to PROCESSED
    sharedMockDb.state.orders.set("ord-pf-r104", {
      id: "ord-pf-r104",
      orderNumber: "TB-PF-R104",
      buyerId: null,
      buyerEmail: null,
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

    const pfBody = JSON.stringify({
      type: "package_shipped",
      created: 1700999999,
      data: { order: { id: 909, external_id: "TB-PF-R104" } },
    });
    const pfEventKey = "PRINTFUL::package_shipped:1700999999:TB-PF-R104";
    sharedMockDb.state.webhookEvents.set(pfEventKey, {
      id: "wh-pf-r104",
      provider: "PRINTFUL",
      externalEventId: "package_shipped:1700999999:TB-PF-R104",
      eventType: "package_shipped",
      payloadJson: JSON.parse(pfBody),
      status: "PROCESSING",
      attempts: 1,
      receivedAt: tenMinAgo,
      updatedAt: tenMinAgo,
      processedAt: null,
    });

    const pfRes = await printfulWebhookPost(
      new Request("http://localhost:3000/api/webhooks/fulfillment/printful", {
        method: "POST",
        headers: {
          "x-pf-webhook-signature": computeHmacSha256Hex(
            pfBody,
            process.env.PRINTFUL_WEBHOOK_SECRET
          ),
        },
        body: pfBody,
      })
    );
    assert.equal(pfRes.status, 200);
    assert.equal(
      sharedMockDb.state.webhookEvents.get(pfEventKey)?.status,
      "PROCESSED"
    );
    assert.equal(
      sharedMockDb.state.orders.get("ord-pf-r104")?.fulfillmentStatus,
      "SHIPPED"
    );
  } finally {
    inngest.send = origSend;
  }
});

test("R-105 & R-205: checkout.session.expired cancels PENDING_PAYMENT order, unlocks session to SELECTED, reverts cart to ACTIVE; >24h expired PriceQuote rejected; cleanup cron unlocks stale orders", async () => {
  sharedMockDb.reset();
  const stripeSecret = "whsec_r105_expired_secret";
  process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;

  const { POST: stripeWebhookPost } = await import(
    "@/app/api/webhooks/stripe/route"
  );
  const { executeCleanupExpiredPendingOrders } = await import("@/lib/inngest");

  const sign = (obj: Record<string, unknown>) => {
    const payload = JSON.stringify(obj);
    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: stripeSecret,
    });
    return new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": sig,
      },
      body: payload,
    });
  };

  // 1. Seed PENDING_PAYMENT order + CHECKED_OUT session + frozen version + CHECKOUT cart
  sharedMockDb.state.sessions.set("sess-r105", {
    id: "sess-r105",
    userId: "buyer-r105",
    anonymousSessionId: null,
    designId: "design-r105",
    designVersionId: "dv-r105",
    mode: "QUOTE",
    inputText: "An Nhiên",
    status: "CHECKED_OUT",
  });
  sharedMockDb.state.personalizationVersions.set("pv-r105", {
    id: "pv-r105",
    sessionId: "sess-r105",
    designVersionId: "dv-r105",
    versionNumber: 1,
    inputSnapshot: { text: "An Nhiên" },
    interpretationSnapshot: { text: "An Nhiên" },
    styleSnapshot: { version: 1, placement: "front", layers: [] },
  });
  sharedMockDb.state.carts.set("cart-r105", {
    id: "cart-r105",
    userId: "buyer-r105",
    anonymousSessionId: null,
    status: "CHECKOUT",
  });
  sharedMockDb.state.orders.set("ord-r105", {
    id: "ord-r105",
    orderNumber: "TB-R105",
    buyerId: "buyer-r105",
    buyerEmail: "buyer@thibut.com",
    stripeCheckoutSessionId: "cs_r105",
    shippingAddressJson: null,
    currency: "USD",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING",
    subtotalMinor: 3398n,
    discountMinor: 0n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 3398n,
    placedAt: null,
    createdAt: new Date(),
  });
  sharedMockDb.state.orderItems.set("oi-r105", {
    id: "oi-r105",
    orderId: "ord-r105",
    creatorId: "creator-r105",
    designId: "design-r105",
    designVersionId: "dv-r105",
    licenseOfferId: null,
    galleryItemId: null,
    personalizationVersionId: "pv-r105",
    catalogProductId: "prod-1",
    catalogVariantId: "var-1",
    quantity: 1,
    placement: "front",
    artworkRevenueMinor: 499n,
    personalizationRevenueMinor: 300n,
    productRevenueMinor: 2599n,
    fulfillmentCostMinor: 1295n,
    creatorRoyaltyMinor: 499n,
    platformRevenueMinor: 1604n,
    totalMinor: 3398n,
  });
  sharedMockDb.state.priceQuotes.set("pq-r105", {
    id: "pq-r105",
    cartId: "cart-r105",
    orderId: "ord-r105",
    currency: "USD",
    subtotalMinor: 3398n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 3398n,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
  });

  const expiredRes = await stripeWebhookPost(
    sign({
      id: "evt_r105_expired",
      object: "event",
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_r105",
          metadata: {
            orderId: "ord-r105",
            cartId: "cart-r105",
            personalizationSessionId: "sess-r105",
          },
        },
      },
    })
  );
  assert.equal(expiredRes.status, 200);
  assert.equal(sharedMockDb.state.orders.get("ord-r105")?.status, "CANCELLED");
  assert.equal(
    sharedMockDb.state.orders.get("ord-r105")?.paymentStatus,
    "CANCELLED"
  );
  assert.equal(
    sharedMockDb.state.sessions.get("sess-r105")?.status,
    "SELECTED",
    "Abandoned checkout must unlock session back to SELECTED"
  );
  assert.equal(
    sharedMockDb.state.personalizationVersions.has("pv-r105"),
    true,
    "Frozen PersonalizationVersion must be preserved"
  );
  assert.equal(
    sharedMockDb.state.carts.get("cart-r105")?.status,
    "ACTIVE",
    "Abandoned checkout must revert Cart back to ACTIVE"
  );

  // 2. R-205: PriceQuote expired > 24h before settlement is rejected with 400 and cancels order
  const { settlementEvent } = seedSettledDigitalOrderForTests(
    "ord-r205",
    "ch_r205"
  );
  sharedMockDb.state.priceQuotes.set("pq-r205", {
    id: "pq-r205",
    cartId: null,
    orderId: "ord-r205",
    currency: "USD",
    subtotalMinor: 1499n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 1499n,
    expiresAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26h expired (> 24h grace)
    createdAt: new Date(Date.now() - 27 * 60 * 60 * 1000),
  });

  const staleQuoteRes = await stripeWebhookPost(sign(settlementEvent));
  assert.equal(staleQuoteRes.status, 400);
  assert.equal(sharedMockDb.state.orders.get("ord-r205")?.status, "CANCELLED");
  assert.equal(sharedMockDb.state.payments.size, 0);

  // 3. Inngest hourly cleanup cron cancels PENDING_PAYMENT orders > 24h old
  sharedMockDb.state.sessions.set("sess-cron", {
    id: "sess-cron",
    userId: "buyer-cron",
    anonymousSessionId: null,
    designId: null,
    designVersionId: null,
    mode: "QUOTE",
    inputText: "Tĩnh Tâm",
    status: "CHECKED_OUT",
  });
  sharedMockDb.state.personalizationVersions.set("pv-cron", {
    id: "pv-cron",
    sessionId: "sess-cron",
    designVersionId: null,
    versionNumber: 1,
    inputSnapshot: {},
    interpretationSnapshot: {},
    styleSnapshot: {},
  });
  sharedMockDb.state.orders.set("ord-cron", {
    id: "ord-cron",
    orderNumber: "TB-CRON",
    buyerId: "buyer-cron",
    buyerEmail: null,
    shippingAddressJson: null,
    currency: "USD",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    fulfillmentStatus: "PENDING",
    subtotalMinor: 1499n,
    discountMinor: 0n,
    shippingMinor: 0n,
    taxMinor: 0n,
    totalMinor: 1499n,
    placedAt: null,
    createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
  });
  sharedMockDb.state.orderItems.set("oi-cron", {
    id: "oi-cron",
    orderId: "ord-cron",
    creatorId: "c-1",
    designId: "d-1",
    designVersionId: "dv-1",
    licenseOfferId: null,
    galleryItemId: null,
    personalizationVersionId: "pv-cron",
    catalogProductId: null,
    catalogVariantId: null,
    quantity: 1,
    placement: "front",
    artworkRevenueMinor: 499n,
    personalizationRevenueMinor: 300n,
    productRevenueMinor: 700n,
    fulfillmentCostMinor: 0n,
    creatorRoyaltyMinor: 499n,
    platformRevenueMinor: 1000n,
    totalMinor: 1499n,
  });

  const cronStats = await executeCleanupExpiredPendingOrders({
    step: { run: async (_id, fn) => fn() },
  });
  assert.equal(cronStats.cancelledOrders, 1);
  assert.equal(cronStats.unlockedSessions, 1);
  assert.equal(sharedMockDb.state.orders.get("ord-cron")?.status, "CANCELLED");
  assert.equal(sharedMockDb.state.sessions.get("sess-cron")?.status, "SELECTED");
});

test("R-200: Concurrent & repeated checkouts reuse PENDING_PAYMENT order and pass Stripe idempotencyKey + expires_at", async () => {
  sharedMockDb.reset();
  process.env.STRIPE_SECRET_KEY = "sk_test_r200_idempotent_key";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";

  const capturedCalls: Array<{
    params: Record<string, unknown>;
    options?: { idempotencyKey?: string };
  }> = [];
  const origCreate = stripe.checkout.sessions.create.bind(
    stripe.checkout.sessions
  );
  stripe.checkout.sessions.create = (async (
    params: Record<string, unknown>,
    options?: { idempotencyKey?: string }
  ) => {
    capturedCalls.push({ params, options });
    return {
      id: `cs_r200_${capturedCalls.length}`,
      url: `https://checkout.stripe.com/c/pay/cs_r200_${capturedCalls.length}`,
    } as Awaited<ReturnType<typeof origCreate>>;
  }) as typeof stripe.checkout.sessions.create;

  try {
    const { createCheckoutSession } = await import(
      "@/lib/services/CheckoutService"
    );

    const sessionId = "77777777-7777-4777-8777-777777777777";
    const designId = "88888888-8888-4888-8888-888888888888";
    sharedMockDb.state.designs.set(designId, {
      id: designId,
      title: "Idempotent Scroll",
      creator: { id: "creator-r200", displayName: "Master Hà" },
      policyVersions: [
        {
          versionNumber: 1,
          allowName: true,
          allowQuote: true,
          allowTranslation: true,
          allowCalligraphy: true,
          allowAIRestyle: false,
          allowCommercialUse: false,
          allowModelTraining: false,
        },
      ],
      licenses: [],
    });
    sharedMockDb.state.sessions.set(sessionId, {
      id: sessionId,
      userId: "buyer-r200",
      anonymousSessionId: null,
      designId,
      designVersionId: `dv-${designId}`,
      mode: "QUOTE",
      inputText: "Nhẫn",
      status: "DRAFT",
    });

    const caller = {
      userId: "buyer-r200",
      anonId: null,
      cookieCartId: undefined,
    };

    // 1. Two concurrent checkouts -> 1 Order + 1 Stripe session creation!
    const [resA, resB] = await Promise.all([
      createCheckoutSession(
        { sessionId, isDigital: true, placement: "front", quantity: 1 },
        caller
      ),
      createCheckoutSession(
        { sessionId, isDigital: true, placement: "front", quantity: 1 },
        caller
      ),
    ]);

    assert.equal(resA.orderId, resB.orderId);
    assert.equal(resA.url, resB.url);
    assert.equal(sharedMockDb.state.orders.size, 1);
    assert.equal(capturedCalls.length, 1);
    assert.equal(
      capturedCalls[0]?.options?.idempotencyKey,
      `checkout:${resA.orderId}`
    );
    assert.equal(typeof capturedCalls[0]?.params.expires_at, "number");

    // 2. Sequential repeat call (<30 min) ALSO reuses the existing PENDING_PAYMENT order without a 2nd Stripe call!
    const resC = await createCheckoutSession(
      { sessionId, isDigital: true, placement: "front", quantity: 1 },
      caller
    );
    assert.equal(resC.orderId, resA.orderId);
    assert.equal(sharedMockDb.state.orders.size, 1);
    assert.equal(capturedCalls.length, 1);
  } finally {
    stripe.checkout.sessions.create = origCreate;
  }
});

test("R-201: src/lib/pricing has zero Number(, and catalog display prices match calculateItemQuote.totalMinor", async () => {
  sharedMockDb.reset();

  // 1. Verify zero `Number(` anywhere in src/lib/pricing/ and zero minorBigIntToDollarsNumber in catalog
  const pricingDir = path.join(process.cwd(), "src", "lib", "pricing");
  for (const fileName of fs.readdirSync(pricingDir)) {
    if (!fileName.endsWith(".ts")) continue;
    const src = fs.readFileSync(path.join(pricingDir, fileName), "utf8");
    assert.equal(
      src.includes("Number("),
      false,
      `src/lib/pricing/${fileName} must contain zero Number( calls (R-201)`
    );
  }

  for (const rel of ["src/config/catalog.ts", "src/app/actions/catalog.ts"]) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.equal(src.includes("minorBigIntToDollarsNumber"), false);
  }

  // 2. Verify static PRODUCT_CATALOG Digital Download matches 1499n ($14.99)
  const { PRODUCT_CATALOG } = await import("@/config/catalog");
  assert.equal(
    PRODUCT_CATALOG["Digital Download (All 6)"]?.priceMinor,
    DIGITAL_TOTAL_MINOR.toString()
  );
  assert.equal(
    PRODUCT_CATALOG["Digital Download (All 6)"]?.formattedPrice,
    "$14.99"
  );

  // 3. Seed CatalogProduct + CatalogVariant and verify getCatalogProducts() equals calculateItemQuote(...).totalMinor
  const prod = await sharedMockDb.catalogProduct.upsert({
    where: { slug: "heavy-tee" },
    update: {},
    create: {
      slug: "heavy-tee",
      name: "Heavyweight Studio Tee",
      category: "apparel",
      status: "ACTIVE",
    },
  });
  const variant = await sharedMockDb.catalogVariant.upsert({
    where: { sku: "TB-R201-TEE-L" },
    update: {},
    create: {
      productId: prod.id,
      sku: "TB-R201-TEE-L",
      color: "Black",
      colorHex: "#111111",
      size: "L",
      baseRetailMinor: 2599n,
      active: true,
    },
  });
  await sharedMockDb.providerVariant.upsert({
    where: {
      providerId_catalogVariantId: {
        providerId: "prov-printful",
        catalogVariantId: variant.id,
      },
    },
    update: {},
    create: {
      providerId: "prov-printful",
      catalogVariantId: variant.id,
      externalProductId: "71",
      externalVariantId: "4012",
      costMinor: 1295n,
      currency: "USD",
      active: true,
    },
  });

  const { getCatalogProducts } = await import("@/app/actions/catalog");
  const catalog = await getCatalogProducts();
  const entry = catalog["Heavyweight Studio Tee"];
  assert.ok(entry);

  const expectedQuote = calculateItemQuote({
    isDigital: false,
    variant: {
      id: variant.id,
      active: true,
      baseRetailMinor: 2599n,
      providerVariants: [{ costMinor: 1295n, currency: "USD", active: true }],
    },
    placement: "front",
    quantity: 1,
    isPersonalized: true,
  });

  assert.equal(entry.priceMinor, expectedQuote.totalMinor.toString());
  assert.equal(BigInt(entry.priceMinor), 3398n);
  assert.equal(entry.formattedPrice, "$33.98");
});

test("R-202 & R-203: Flat-rate shipping + STRIPE_TAX_ENABLED reconcile TAX_PAYABLE & SHIPPING_REVENUE to 0n, and post-commit Inngest failure never marks PAID webhook FAILED", async () => {
  sharedMockDb.reset();

  // 1. Flat shipping schedule unit checks
  assert.equal(US_FLAT_SHIPPING_MINOR, 599n);
  assert.equal(INTL_FLAT_SHIPPING_MINOR, 1199n);
  assert.equal(EXTRA_ITEM_SHIPPING_MINOR, 200n);
  assert.equal(
    calculateFlatShippingMinor({ countryCode: "US", physicalQuantity: 0 }),
    0n
  );
  assert.equal(
    calculateFlatShippingMinor({ countryCode: "US", physicalQuantity: 1 }),
    599n
  );
  assert.equal(
    calculateFlatShippingMinor({ countryCode: "US", physicalQuantity: 3 }),
    999n
  );
  assert.equal(
    calculateFlatShippingMinor({ countryCode: "VN", physicalQuantity: 2 }),
    1399n
  );

  // 2. Checkout with shippingCountry="US" + STRIPE_TAX_ENABLED="true", then webhook settlement with total_details tax + shipping
  process.env.STRIPE_SECRET_KEY = "sk_test_r202_tax_shipping";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_r202_tax_shipping";
  process.env.STRIPE_TAX_ENABLED = "true";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";
  process.env.DOWNLOAD_TOKEN_SECRET = "test-download-secret-32-chars-minimum!!";
  process.env.RESEND_API_KEY = "";

  const capturedCreateCalls: Array<Record<string, unknown>> = [];
  const origCreate = stripe.checkout.sessions.create.bind(
    stripe.checkout.sessions
  );
  stripe.checkout.sessions.create = (async (params: Record<string, unknown>) => {
    capturedCreateCalls.push(params);
    return {
      id: "cs_r202_1",
      url: "https://checkout.stripe.com/c/pay/cs_r202_1",
    } as Awaited<ReturnType<typeof origCreate>>;
  }) as typeof stripe.checkout.sessions.create;

  const { inngest, executeDeliverOrderPaidEffects } = await import(
    "@/lib/inngest"
  );
  const origSend = inngest.send.bind(inngest);
  // Simulate post-commit Inngest network outage (R-203) — webhook MUST still return 200 and keep WebhookEvent PROCESSED!
  inngest.send = (async () => {
    throw new Error("Simulated Inngest API 503 outage");
  }) as typeof inngest.send;

  try {
    const prod = await sharedMockDb.catalogProduct.upsert({
      where: { slug: "r202-tee" },
      update: {},
      create: {
        slug: "r202-tee",
        name: "R202 Tee",
        category: "apparel",
        status: "ACTIVE",
      },
    });
    const variant = await sharedMockDb.catalogVariant.upsert({
      where: { sku: "TB-R202-L" },
      update: {},
      create: {
        productId: prod.id,
        sku: "TB-R202-L",
        color: "Black",
        size: "L",
        baseRetailMinor: 2599n,
        active: true,
      },
    });
    await sharedMockDb.providerVariant.upsert({
      where: {
        providerId_catalogVariantId: {
          providerId: "prov-printful",
          catalogVariantId: variant.id,
        },
      },
      update: {},
      create: {
        providerId: "prov-printful",
        catalogVariantId: variant.id,
        externalProductId: "71",
        externalVariantId: "4012",
        costMinor: 1295n,
        currency: "USD",
        active: true,
      },
    });

    const designId = "99999999-9999-4999-8999-999999999999";
    const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    sharedMockDb.state.designs.set(designId, {
      id: designId,
      title: "Tax & Shipping Scroll",
      creator: { id: "creator-r202", displayName: "Master Nam" },
      policyVersions: [
        {
          versionNumber: 1,
          allowName: true,
          allowQuote: true,
          allowTranslation: true,
          allowCalligraphy: true,
          allowAIRestyle: false,
          allowCommercialUse: false,
          allowModelTraining: false,
        },
      ],
      licenses: [],
    });
    sharedMockDb.state.sessions.set(sessionId, {
      id: sessionId,
      userId: "buyer-r202",
      anonymousSessionId: null,
      designId,
      designVersionId: `dv-${designId}`,
      mode: "QUOTE",
      inputText: "Phúc",
      status: "DRAFT",
    });

    const { createCheckoutSession } = await import(
      "@/lib/services/CheckoutService"
    );
    const checkoutRes = await createCheckoutSession(
      {
        sessionId,
        isDigital: false,
        catalogVariantId: variant.id,
        placement: "front",
        quantity: 1,
        shippingCountry: "US",
      },
      { userId: "buyer-r202", anonId: null, cookieCartId: undefined }
    );

    const createdOrder = sharedMockDb.state.orders.get(checkoutRes.orderId)!;
    assert.equal(createdOrder.subtotalMinor, 3398n);
    assert.equal(createdOrder.shippingMinor, 599n);
    assert.equal(createdOrder.totalMinor, 3997n);
    assert.deepEqual(capturedCreateCalls[0]?.automatic_tax, { enabled: true });
    assert.ok(Array.isArray(capturedCreateCalls[0]?.shipping_options));

    // Settle via Stripe webhook with Stripe Tax amount_tax = 280 and amount_shipping = 599 (amount_total = 4277)
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );
    const settlePayload = JSON.stringify({
      id: "evt_r202_settle",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_r202_1",
          payment_status: "paid",
          amount_total: 4277,
          currency: "usd",
          total_details: {
            amount_shipping: 599,
            amount_tax: 280,
          },
          payment_intent: { id: "pi_r202", latest_charge: "ch_r202" },
          metadata: {
            orderId: createdOrder.id,
            isDigital: "false",
          },
          customer_details: {
            email: "buyer-r202@thibut.com",
            address: {
              line1: "100 Main St",
              city: "Austin",
              state: "TX",
              country: "US",
              postal_code: "78701",
            },
          },
        },
      },
    });
    const sig = stripe.webhooks.generateTestHeaderString({
      payload: settlePayload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const webhookRes = await stripeWebhookPost(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": sig },
        body: settlePayload,
      })
    );

    // R-203: Even though inngest.send threw 503, committed PAID order returns 200 and WebhookEvent is PROCESSED!
    assert.equal(webhookRes.status, 200);
    assert.equal(
      sharedMockDb.state.webhookEvents.get("STRIPE::evt_r202_settle")?.status,
      "PROCESSED"
    );

    const settled = sharedMockDb.state.orders.get(createdOrder.id)!;
    assert.equal(settled.status, "PAID");
    assert.equal(settled.shippingMinor, 599n);
    assert.equal(settled.taxMinor, 280n);
    assert.equal(settled.totalMinor, 4277n);

    const shippingAcc = Array.from(
      sharedMockDb.state.ledgerAccounts.values()
    ).find((a) => a.code === "SHIPPING_REVENUE")!;
    const taxAcc = Array.from(sharedMockDb.state.ledgerAccounts.values()).find(
      (a) => a.code === "TAX_PAYABLE"
    )!;
    assert.equal(shippingAcc.balanceMinor, -599n);
    assert.equal(taxAcc.balanceMinor, -280n);
    assert.equal(
      sharedMockDb.state.ledgerPostings.reduce(
        (acc, p) => acc + p.amountMinor,
        0n
      ),
      0n
    );

    // Verify durable deliverOrderPaidEffects worker step execution (R-203)
    const dispatchedEmails: string[] = [];
    const paidWorkerResult = await executeDeliverOrderPaidEffects({
      event: {
        data: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          buyerEmail: "buyer-r202@thibut.com",
          hasPhysicalItems: false,
          digitalItems: [
            { orderItemId: "oi-dig-r203", productName: "Digital Master" },
          ],
        },
      },
      step: { run: async (_id, fn) => fn() },
      emailSender: async (input) => {
        dispatchedEmails.push(`${input.email}:${input.orderItemId}`);
        return { sent: true, downloadLink: "https://thibut.com/api/download" };
      },
    });
    assert.equal(paidWorkerResult.emailsDispatched, 1);
    assert.deepEqual(dispatchedEmails, ["buyer-r202@thibut.com:oi-dig-r203"]);
  } finally {
    delete process.env.STRIPE_TAX_ENABLED;
    stripe.checkout.sessions.create = origCreate;
    inngest.send = origSend;
  }
});
