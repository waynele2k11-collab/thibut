import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import zlib from "node:zlib";
import { PNG } from "pngjs";
import type { LedgerAccountType, PrismaClient } from "@prisma/client";
import {
  DIGITAL_TOTAL_MINOR,
  calculateItemQuote,
} from "@/lib/pricing/quote";
import {
  CompositionSchema,
  PRINT_MASTER_DPI,
  PRINT_MASTER_HEIGHT,
  PRINT_MASTER_PIXELS_PER_METER,
  PRINT_MASTER_WIDTH,
} from "@/lib/print/types";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  isUnverifiedLegacyArchiveFile,
} from "@/lib/fonts/fontCatalog";
import { signDownloadToken, verifyDownloadToken } from "@/lib/security/tokens";
import { stripe } from "@/lib/stripe";

// ─────────────────────────────────────────────────────────────────────────────
// MODULE HOOKS FOR NEXT REQUEST-SCOPE HELPERS (next/headers, supabase/server)
// ─────────────────────────────────────────────────────────────────────────────

interface ResolveContext {
  conditions: string[];
  importAttributes: Record<string, string>;
  parentURL?: string;
}

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}

type NextResolveFn = (
  specifier: string,
  context: ResolveContext
) => ResolveResult;

interface ModuleHooksApi {
  registerHooks: (hooks: {
    resolve?: (
      specifier: string,
      context: ResolveContext,
      nextResolve: NextResolveFn
    ) => ResolveResult;
  }) => void;
}

interface QaAuthState {
  currentUserId: string | null;
  cookies: Map<string, string>;
}

const qaAuthState: QaAuthState = {
  currentUserId: null,
  cookies: new Map<string, string>(),
};

declare global {
  var __tbQaAuditHooks: {
    cookies: () => Promise<{
      get: (name: string) => { name: string; value: string } | undefined;
      set: (name: string, value: string) => void;
      delete: (name: string) => void;
    }>;
    createSupabaseClient: () => Promise<{
      auth: {
        getUser: () => Promise<{
          data: { user: { id: string; email: string } | null };
          error: Error | null;
        }>;
      };
    }>;
  };
}

globalThis.__tbQaAuditHooks = {
  async cookies() {
    return {
      get(name: string) {
        const val = qaAuthState.cookies.get(name);
        return val !== undefined ? { name, value: val } : undefined;
      },
      set(name: string, value: string) {
        qaAuthState.cookies.set(name, value);
      },
      delete(name: string) {
        qaAuthState.cookies.delete(name);
      },
    };
  },
  async createSupabaseClient() {
    return {
      auth: {
        async getUser() {
          if (!qaAuthState.currentUserId) {
            return { data: { user: null }, error: new Error("Unauthenticated") };
          }
          return {
            data: {
              user: {
                id: qaAuthState.currentUserId,
                email: "qa-buyer@thibut.com",
              },
            },
            error: null,
          };
        },
      },
    };
  },
};

const hooksApi = nodeModule as unknown as Partial<ModuleHooksApi>;
if (typeof hooksApi.registerHooks === "function") {
  hooksApi.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
      }
      if (specifier === "next/headers") {
        const src = `export const cookies = (...args) => globalThis.__tbQaAuditHooks.cookies(...args);`;
        return {
          url: `data:text/javascript,${encodeURIComponent(src)}`,
          format: "module",
          shortCircuit: true,
        };
      }
      if (specifier === "@/utils/supabase/server") {
        const src = `export const createClient = (...args) => globalThis.__tbQaAuditHooks.createSupabaseClient(...args);`;
        return {
          url: `data:text/javascript,${encodeURIComponent(src)}`,
          format: "module",
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY PRISMA HARNESS FOR END-TO-END CHECKOUT -> WEBHOOK -> DOWNLOAD -> REFUND
// ─────────────────────────────────────────────────────────────────────────────

interface QaDesignPolicyRow {
  id: string;
  designId: string;
  versionNumber: number;
  allowName: boolean;
  allowQuote: boolean;
  allowTranslation: boolean;
  allowCalligraphy: boolean;
  allowAIRestyle: boolean;
  allowCommercialUse: boolean;
  allowModelTraining: boolean;
}

interface QaDesignVersionRow {
  id: string;
  designId: string;
  versionNumber: number;
}

interface QaLicenseOfferRow {
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

interface QaDesignRow {
  id: string;
  creatorId: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  creator: { id: string; userId: string; slug: string; displayName: string; status: string };
  versions: QaDesignVersionRow[];
  policyVersions: QaDesignPolicyRow[];
  licenses: QaLicenseOfferRow[];
}

interface QaInterpretationRow {
  id: string;
  type: string;
  language: string;
  text: string;
  romanization: string | null;
  meaning: string | null;
  recommended: boolean;
}

interface QaSessionRow {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  designId: string | null;
  designVersionId: string | null;
  mode: string;
  inputText: string;
  inputLanguage: string | null;
  targetLanguage: string | null;
  selectedInterpretationId: string | null;
  status: string;
  compositionJson: unknown;
  interpretations: QaInterpretationRow[];
}

interface QaPersonalizationVersionRow {
  id: string;
  sessionId: string;
  designVersionId: string | null;
  versionNumber: number;
  inputSnapshot: unknown;
  interpretationSnapshot: unknown;
  styleSnapshot: unknown;
  printAssetId: string | null;
}

interface QaOrderRow {
  id: string;
  orderNumber: string;
  buyerId: string | null;
  buyerEmail: string | null;
  anonymousSessionId: string | null;
  shippingAddressJson: unknown;
  stripeCheckoutSessionId: string | null;
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

interface QaOrderItemRow {
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
}

interface QaSnapshotRow {
  orderItemId: string;
  designTitle: string;
  creatorName: string;
  productName: string | null;
  variantName: string | null;
  color: string | null;
  size: string | null;
  licenseTermsJson: unknown;
  personalizationJson?: unknown;
  printPlacementJson?: unknown;
  pricingJson: unknown;
}

interface QaPriceQuoteRow {
  id: string;
  orderId: string | null;
  cartId?: string | null;
  currency: string;
  subtotalMinor: bigint;
  artworkMinor: bigint;
  personalizationMinor: bigint;
  productMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  discountMinor: bigint;
  totalMinor: bigint;
  expiresAt: Date;
}

interface QaWebhookEventRow {
  id: string;
  provider: string;
  externalEventId: string;
  eventType: string;
  payloadJson: unknown;
  status: string;
  receivedAt: Date;
  processedAt: Date | null;
}

interface QaPaymentRow {
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

interface QaRefundRow {
  id: string;
  orderId: string;
  paymentId: string | null;
  providerRefundId: string | null;
  amountMinor: bigint;
  reason: string | null;
  status: string;
  processedAt: Date | null;
}

interface QaLicenseGrantRow {
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

interface QaCreatorEarningRow {
  id: string;
  creatorId: string;
  orderItemId: string;
  grossLicenseMinor: bigint;
  adjustmentMinor: bigint;
  netCreatorMinor: bigint;
  currency: string;
  status: string;
}

interface QaLedgerAccountRow {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  ownerType: string | null;
  balanceMinor: bigint;
  currency: string;
}

interface QaLedgerTransactionRow {
  id: string;
  type: string;
  description: string;
  referenceType: string | null;
  referenceId: string | null;
  currency: string;
}

interface QaLedgerPostingRow {
  id: string;
  transactionId: string;
  accountId: string;
  amountMinor: bigint;
  currency: string;
}

function createQaE2EDatabase() {
  const state = {
    designs: new Map<string, QaDesignRow>(),
    licenseOffers: new Map<string, QaLicenseOfferRow>(),
    sessions: new Map<string, QaSessionRow>(),
    personalizationVersions: new Map<string, QaPersonalizationVersionRow>(),
    orders: new Map<string, QaOrderRow>(),
    orderItems: new Map<string, QaOrderItemRow>(),
    snapshots: new Map<string, QaSnapshotRow>(),
    priceQuotes: new Map<string, QaPriceQuoteRow>(),
    webhookEvents: new Map<string, QaWebhookEventRow>(),
    payments: new Map<string, QaPaymentRow>(),
    refunds: new Map<string, QaRefundRow>(),
    licenseGrants: new Map<string, QaLicenseGrantRow>(),
    creatorEarnings: new Map<string, QaCreatorEarningRow>(),
    ledgerAccounts: new Map<string, QaLedgerAccountRow>(),
    ledgerTransactions: new Map<string, QaLedgerTransactionRow>(),
    ledgerPostings: [] as QaLedgerPostingRow[],
  };

  function reset() {
    state.designs.clear();
    state.licenseOffers.clear();
    state.sessions.clear();
    state.personalizationVersions.clear();
    state.orders.clear();
    state.orderItems.clear();
    state.snapshots.clear();
    state.priceQuotes.clear();
    state.webhookEvents.clear();
    state.payments.clear();
    state.refunds.clear();
    state.licenseGrants.clear();
    state.creatorEarnings.clear();
    state.ledgerAccounts.clear();
    state.ledgerTransactions.clear();
    state.ledgerPostings.length = 0;
  }

  const webhookKey = (provider: string, externalEventId: string) =>
    `${provider}::${externalEventId}`;

  const hydrateOrderItem = (item: QaOrderItemRow) => {
    const pv = item.personalizationVersionId
      ? (state.personalizationVersions.get(item.personalizationVersionId) ?? null)
      : null;
    const order = state.orders.get(item.orderId) ?? null;
    const licenseGrant =
      Array.from(state.licenseGrants.values()).find(
        (lg) => lg.orderItemId === item.id
      ) ?? null;
    const earning =
      Array.from(state.creatorEarnings.values()).find(
        (ce) => ce.orderItemId === item.id
      ) ?? null;
    const snapshot = state.snapshots.get(item.id) ?? null;
    return {
      ...item,
      order,
      catalogVariant: null,
      personalizationVersion: pv ? { ...pv, printAsset: null } : null,
      licenseGrant,
      earning,
      snapshot,
    };
  };

  const models = {
    state,
    reset,
    font: {
      async findMany() {
        return [];
      },
    },
    design: {
      async findUnique(args: { where: { id?: string; slug?: string } }) {
        if (args.where.id) {
          return state.designs.get(args.where.id) ?? null;
        }
        if (args.where.slug) {
          return (
            Array.from(state.designs.values()).find(
              (d) => d.slug === args.where.slug
            ) ?? null
          );
        }
        return null;
      },
      async findMany(args: { where: { id: { in: string[] } } }) {
        return args.where.id.in
          .map((id) => state.designs.get(id))
          .filter((d): d is QaDesignRow => Boolean(d));
      },
    },
    licenseOffer: {
      async findUnique(args: { where: { id: string } }) {
        return state.licenseOffers.get(args.where.id) ?? null;
      },
      async findMany(args: { where: { id: { in: string[] } } }) {
        return args.where.id.in
          .map((id) => state.licenseOffers.get(id))
          .filter((o): o is QaLicenseOfferRow => Boolean(o));
      },
      async create(args: {
        data: Omit<QaLicenseOfferRow, "id" | "termsVersion">;
      }) {
        const row: QaLicenseOfferRow = {
          id: crypto.randomUUID(),
          termsVersion: 1,
          ...args.data,
        };
        state.licenseOffers.set(row.id, row);
        return row;
      },
    },
    personalizationSession: {
      async findUnique(args: { where: { id: string } }) {
        return state.sessions.get(args.where.id) ?? null;
      },
      async update(args: {
        where: { id: string };
        data: Partial<QaSessionRow>;
      }) {
        const existing = state.sessions.get(args.where.id);
        if (!existing) {
          throw new Error(`Session not found: ${args.where.id}`);
        }
        Object.assign(existing, args.data);
        return existing;
      },
      async updateMany(args: {
        where: { id: string };
        data: Partial<QaSessionRow>;
      }) {
        const existing = state.sessions.get(args.where.id);
        if (!existing) return { count: 0 };
        Object.assign(existing, args.data);
        return { count: 1 };
      },
    },
    personalizationVersion: {
      async findUnique(args: { where: { id: string } }) {
        const pv = state.personalizationVersions.get(args.where.id);
        if (!pv) return null;
        const session = state.sessions.get(pv.sessionId) ?? null;
        return { ...pv, session };
      },
      async findFirst(args: { where: { sessionId: string } }) {
        const list = Array.from(state.personalizationVersions.values())
          .filter((v) => v.sessionId === args.where.sessionId)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        return list[0] ?? null;
      },
      async create(args: {
        data: {
          sessionId: string;
          designVersionId?: string | null;
          versionNumber: number;
          inputSnapshot: unknown;
          interpretationSnapshot: unknown;
          styleSnapshot: unknown;
        };
      }) {
        const row: QaPersonalizationVersionRow = {
          id: crypto.randomUUID(),
          sessionId: args.data.sessionId,
          designVersionId: args.data.designVersionId ?? null,
          versionNumber: args.data.versionNumber,
          inputSnapshot: args.data.inputSnapshot,
          interpretationSnapshot: args.data.interpretationSnapshot,
          styleSnapshot: args.data.styleSnapshot,
          printAssetId: null,
        };
        state.personalizationVersions.set(row.id, row);
        const session = state.sessions.get(row.sessionId) ?? null;
        return { ...row, session };
      },
    },
    order: {
      async create(args: {
        data: {
          orderNumber: string;
          buyerId?: string | null;
          buyerEmail?: string | null;
          anonymousSessionId?: string | null;
          currency: string;
          status: string;
          paymentStatus: string;
          fulfillmentStatus: string;
          subtotalMinor: bigint;
          discountMinor: bigint;
          shippingMinor: bigint;
          taxMinor: bigint;
          totalMinor: bigint;
        };
      }) {
        const row: QaOrderRow = {
          id: crypto.randomUUID(),
          orderNumber: args.data.orderNumber,
          buyerId: args.data.buyerId ?? null,
          buyerEmail: args.data.buyerEmail ?? null,
          anonymousSessionId: args.data.anonymousSessionId ?? null,
          shippingAddressJson: null,
          stripeCheckoutSessionId: null,
          currency: args.data.currency,
          status: args.data.status,
          paymentStatus: args.data.paymentStatus,
          fulfillmentStatus: args.data.fulfillmentStatus,
          subtotalMinor: args.data.subtotalMinor,
          discountMinor: args.data.discountMinor,
          shippingMinor: args.data.shippingMinor,
          taxMinor: args.data.taxMinor,
          totalMinor: args.data.totalMinor,
          placedAt: null,
        };
        state.orders.set(row.id, row);
        return row;
      },
      async findUnique(args: { where: { id?: string; orderNumber?: string } }) {
        const found = args.where.id
          ? state.orders.get(args.where.id)
          : Array.from(state.orders.values()).find(
            (o) => o.orderNumber === args.where.orderNumber
          );
        if (!found) return null;
        const items = Array.from(state.orderItems.values())
          .filter((i) => i.orderId === found.id)
          .map(hydrateOrderItem);
        return { ...found, items };
      },
      async update(args: { where: { id: string }; data: Partial<QaOrderRow> }) {
        const existing = state.orders.get(args.where.id);
        if (!existing) throw new Error(`Order not found: ${args.where.id}`);
        Object.assign(existing, args.data);
        return { ...existing };
      },
    },
    orderItem: {
      async create(args: { data: Omit<QaOrderItemRow, "id" | "galleryItemId"> & { galleryItemId?: string | null } }) {
        const row: QaOrderItemRow = {
          id: crypto.randomUUID(),
          galleryItemId: args.data.galleryItemId ?? null,
          ...args.data,
        };
        state.orderItems.set(row.id, row);
        return row;
      },
      async findUnique(args: { where: { id: string } }) {
        const found = state.orderItems.get(args.where.id);
        if (!found) return null;
        return hydrateOrderItem(found);
      },
    },
    orderItemSnapshot: {
      async create(args: { data: QaSnapshotRow }) {
        state.snapshots.set(args.data.orderItemId, args.data);
        return args.data;
      },
    },
    priceQuote: {
      async create(args: { data: Omit<QaPriceQuoteRow, "id"> }) {
        const row: QaPriceQuoteRow = {
          id: crypto.randomUUID(),
          ...args.data,
        };
        state.priceQuotes.set(row.id, row);
        return row;
      },
    },
    webhookEvent: {
      async create(args: {
        data: {
          provider: string;
          externalEventId: string;
          eventType: string;
          payloadJson: unknown;
          status?: string;
        };
      }) {
        const key = webhookKey(args.data.provider, args.data.externalEventId);
        if (state.webhookEvents.has(key)) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        const row: QaWebhookEventRow = {
          id: crypto.randomUUID(),
          provider: args.data.provider,
          externalEventId: args.data.externalEventId,
          eventType: args.data.eventType,
          payloadJson: args.data.payloadJson,
          status: args.data.status ?? "PENDING",
          receivedAt: new Date(),
          processedAt: null,
        };
        state.webhookEvents.set(key, row);
        return row;
      },
      async findUnique(args: {
        where: {
          provider_externalEventId: { provider: string; externalEventId: string };
        };
      }) {
        return (
          state.webhookEvents.get(
            webhookKey(
              args.where.provider_externalEventId.provider,
              args.where.provider_externalEventId.externalEventId
            )
          ) ?? null
        );
      },
      async update(args: {
        where: {
          provider_externalEventId: { provider: string; externalEventId: string };
        };
        data: { status?: string; processedAt?: Date };
      }) {
        const existing = state.webhookEvents.get(
          webhookKey(
            args.where.provider_externalEventId.provider,
            args.where.provider_externalEventId.externalEventId
          )
        );
        if (!existing) throw new Error("WebhookEvent not found");
        if (args.data.status !== undefined) existing.status = args.data.status;
        if (args.data.processedAt !== undefined) {
          existing.processedAt = args.data.processedAt;
        }
        return existing;
      },
      async updateMany(args: {
        where: { provider?: string; externalEventId?: string };
        data: { status?: string; processedAt?: Date };
      }) {
        let count = 0;
        for (const row of state.webhookEvents.values()) {
          if (args.where.provider && row.provider !== args.where.provider) continue;
          if (
            args.where.externalEventId &&
            row.externalEventId !== args.where.externalEventId
          ) {
            continue;
          }
          if (args.data.status !== undefined) row.status = args.data.status;
          if (args.data.processedAt !== undefined) {
            row.processedAt = args.data.processedAt;
          }
          count++;
        }
        return { count };
      },
    },
    payment: {
      async create(args: {
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
        const row: QaPaymentRow = {
          id: crypto.randomUUID(),
          orderId: args.data.orderId,
          provider: args.data.provider,
          providerPaymentId: args.data.providerPaymentId ?? null,
          providerChargeId: args.data.providerChargeId ?? null,
          amountMinor: args.data.amountMinor,
          currency: args.data.currency,
          status: args.data.status,
          capturedAt: args.data.capturedAt ?? null,
        };
        state.payments.set(row.id, row);
        return row;
      },
      async findFirst(args: {
        where: {
          OR: Array<{ providerChargeId?: string; providerPaymentId?: string }>;
        };
      }) {
        for (const p of state.payments.values()) {
          const matched = args.where.OR.some(
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
      async update(args: { where: { id: string }; data: Partial<QaPaymentRow> }) {
        const existing = state.payments.get(args.where.id);
        if (!existing) throw new Error("Payment not found");
        Object.assign(existing, args.data);
        return existing;
      },
    },
    refund: {
      async findUnique(args: { where: { providerRefundId: string } }) {
        return (
          Array.from(state.refunds.values()).find(
            (r) => r.providerRefundId === args.where.providerRefundId
          ) ?? null
        );
      },
      async findMany(args: { where?: { orderId?: string; status?: string } }) {
        return Array.from(state.refunds.values()).filter((r) => {
          if (args.where?.orderId && r.orderId !== args.where.orderId) {
            return false;
          }
          if (args.where?.status && r.status !== args.where.status) {
            return false;
          }
          return true;
        });
      },
      async create(args: { data: Omit<QaRefundRow, "id"> }) {
        const row: QaRefundRow = {
          id: crypto.randomUUID(),
          ...args.data,
        };
        state.refunds.set(row.id, row);
        return row;
      },
    },
    licenseGrant: {
      async create(args: { data: Omit<QaLicenseGrantRow, "id" | "revokedAt"> }) {
        const row: QaLicenseGrantRow = {
          id: crypto.randomUUID(),
          revokedAt: null,
          ...args.data,
        };
        state.licenseGrants.set(row.id, row);
        return row;
      },
      async updateMany(args: {
        where: { orderItemId: { in: string[] }; revokedAt?: null };
        data: { revokedAt: Date };
      }) {
        let count = 0;
        for (const lg of state.licenseGrants.values()) {
          if (
            args.where.orderItemId.in.includes(lg.orderItemId) &&
            lg.revokedAt === null
          ) {
            lg.revokedAt = args.data.revokedAt;
            count++;
          }
        }
        return { count };
      },
    },
    creatorEarning: {
      async create(args: { data: Omit<QaCreatorEarningRow, "id"> }) {
        const row: QaCreatorEarningRow = {
          id: crypto.randomUUID(),
          ...args.data,
        };
        state.creatorEarnings.set(row.id, row);
        return row;
      },
      async findMany(args: { where?: { orderItemId?: { in: string[] } } }) {
        return Array.from(state.creatorEarnings.values()).filter((ce) =>
          args.where?.orderItemId?.in
            ? args.where.orderItemId.in.includes(ce.orderItemId)
            : true
        );
      },
      async update(args: {
        where: { id: string };
        data: Partial<QaCreatorEarningRow>;
      }) {
        const existing = state.creatorEarnings.get(args.where.id);
        if (!existing) throw new Error("CreatorEarning not found");
        Object.assign(existing, args.data);
        return existing;
      },
      async updateMany(args: {
        where: { orderItemId: { in: string[] } };
        data: Partial<QaCreatorEarningRow>;
      }) {
        let count = 0;
        for (const ce of state.creatorEarnings.values()) {
          if (args.where.orderItemId.in.includes(ce.orderItemId)) {
            Object.assign(ce, args.data);
            count++;
          }
        }
        return { count };
      },
    },
    ledgerAccount: {
      async upsert(args: {
        where: { code: string };
        update: Record<string, unknown>;
        create: Omit<QaLedgerAccountRow, "id">;
      }) {
        let acc = Array.from(state.ledgerAccounts.values()).find(
          (a) => a.code === args.where.code
        );
        if (!acc) {
          acc = {
            id: crypto.randomUUID(),
            ...args.create,
          };
          state.ledgerAccounts.set(acc.id, acc);
        }
        return { id: acc.id };
      },
      async update(args: {
        where: { id: string };
        data: { balanceMinor: { increment: bigint } };
      }) {
        const acc = state.ledgerAccounts.get(args.where.id);
        if (!acc) throw new Error("LedgerAccount not found");
        acc.balanceMinor += args.data.balanceMinor.increment;
        return acc;
      },
    },
    ledgerTransaction: {
      async create(args: { data: Omit<QaLedgerTransactionRow, "id"> }) {
        const row: QaLedgerTransactionRow = {
          id: crypto.randomUUID(),
          ...args.data,
        };
        state.ledgerTransactions.set(row.id, row);
        return row;
      },
    },
    ledgerPosting: {
      async create(args: { data: Omit<QaLedgerPostingRow, "id"> }) {
        const row: QaLedgerPostingRow = {
          id: crypto.randomUUID(),
          ...args.data,
        };
        state.ledgerPostings.push(row);
        return row;
      },
    },
  };

  return {
    ...models,
    async $transaction<T>(fn: (tx: typeof models) => Promise<T>): Promise<T> {
      return fn(models);
    },
  };
}

const qaDb = createQaE2EDatabase();
globalThis.prismaGlobalV2 = qaDb as unknown as PrismaClient;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES FOR STATIC SOURCE SWEEP & PNG INSPECTION
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const SRC_ROOT = path.join(REPO_ROOT, "src");

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|css|json)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

interface ParsedPhysChunk {
  ppuX: number;
  ppuY: number;
  unit: number;
  crcValid: boolean;
}

function readPngPhysChunk(png: Buffer): ParsedPhysChunk | null {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(
    png.subarray(0, 8),
    PNG_SIGNATURE,
    "Buffer must start with standard 8-byte PNG signature"
  );

  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const storedCrc = png.readUInt32BE(dataEnd);

    if (type === "pHYs") {
      assert.equal(length, 9, "pHYs chunk payload must be 9 bytes");
      const ppuX = png.readUInt32BE(dataStart);
      const ppuY = png.readUInt32BE(dataStart + 4);
      const unit = png.readUInt8(dataStart + 8);
      const computedCrc = zlib.crc32(png.subarray(offset + 4, dataEnd)) >>> 0;
      return {
        ppuX,
        ppuY,
        unit,
        crcValid: storedCrc === computedCrc,
      };
    }

    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1: STATIC SOURCE-CODE SECURITY & INVARIANT VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

test("QA Static Sweep: zero backdoors, banned literals, client secrets, or legacy middleware/dead files across src/", async () => {
  const allSrcFiles = collectSourceFiles(SRC_ROOT);
  assert.ok(allSrcFiles.length > 50, "Expected to scan full src/ directory tree");

  const bannedGlobalLiterals = [
    "waynele2k11",
    "fallback_secret_for_dev",
    "mock-design-123",
    "guest@thibut.com",
    "listedPriceCents",
    "[DEV AUTH PIN]",
  ];

  for (const filePath of allSrcFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");

    for (const banned of bannedGlobalLiterals) {
      assert.equal(
        content.includes(banned),
        false,
        `Banned literal "${banned}" found in ${rel}`
      );
    }

    // Legacy forgeable cookie may ONLY appear where step-up login deletes it
    if (content.includes("admin_master_pwd_verified")) {
      assert.equal(
        rel,
        path.join("src", "app", "admin-verify", "actions.ts"),
        `Unexpected reference to admin_master_pwd_verified in ${rel}`
      );
      assert.equal(
        content.includes('cookieStore.get("admin_master_pwd_verified")'),
        false,
        "admin_master_pwd_verified must NEVER be read for authorization"
      );
    }

    // Client modules must never touch PRINTFUL_API_KEY
    const isClientModule =
      /^\s*["']use client["']/.test(content) ||
      rel.startsWith(path.join("src", "components") + path.sep);
    if (isClientModule) {
      assert.equal(
        content.includes("PRINTFUL_API_KEY"),
        false,
        `Client module ${rel} must never reference PRINTFUL_API_KEY`
      );
    }

    // Every module in src/ (outside src/lib/prisma.ts) must use the shared @/lib/prisma singleton
    if (rel !== path.join("src", "lib", "prisma.ts")) {
      assert.equal(
        content.includes("new PrismaClient("),
        false,
        `Module ${rel} instantiated new PrismaClient() outside src/lib/prisma.ts`
      );
    }
  }

  // T-409 & INV-012: PolicyGuard is enforced in both composition and cart Server Actions
  for (const actionRel of [
    path.join("src", "app", "actions", "composition.ts"),
    path.join("src", "app", "actions", "cart.ts"),
  ]) {
    const actionSrc = fs.readFileSync(path.join(REPO_ROOT, actionRel), "utf8");
    assert.ok(
      actionSrc.includes("PolicyGuard.enforceCompositionPolicy"),
      `${actionRel} must enforce PolicyGuard.enforceCompositionPolicy (T-409 / INV-012)`
    );
  }

  // T-100 AC: print-master route & generator contain zero admin_master_pwd_verified, waynele2k11, PRINTFUL_API_KEY
  for (const relTarget of [
    path.join("src", "app", "api", "print-master", "route.ts"),
    path.join("src", "lib", "print-generator.tsx"),
  ]) {
    const content = fs.readFileSync(path.join(REPO_ROOT, relTarget), "utf8");
    for (const forbidden of [
      "admin_master_pwd_verified",
      "waynele2k11",
      "PRINTFUL_API_KEY",
    ]) {
      assert.equal(
        content.includes(forbidden),
        false,
        `${relTarget} must not contain ${forbidden} (T-100 AC)`
      );
    }
  }

  // T-302 AC: zero toDataURL in cart or checkout paths
  const cartAndCheckoutFiles = [
    path.join(REPO_ROOT, "src", "app", "actions", "cart.ts"),
    ...collectSourceFiles(path.join(REPO_ROOT, "src", "app", "api", "checkout")),
    ...collectSourceFiles(path.join(REPO_ROOT, "src", "app", "checkout")),
  ];
  for (const filePath of cartAndCheckoutFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    assert.equal(
      content.includes("toDataURL"),
      false,
      `${path.relative(REPO_ROOT, filePath)} must not use raster toDataURL (T-302 AC)`
    );
  }

  // T-093: src/middleware.ts removed; src/proxy.ts exists and exports proxy
  assert.equal(
    fs.existsSync(path.join(REPO_ROOT, "src", "middleware.ts")),
    false,
    "Legacy src/middleware.ts must be deleted in Next.js 16"
  );
  const proxyPath = path.join(REPO_ROOT, "src", "proxy.ts");
  assert.equal(fs.existsSync(proxyPath), true, "src/proxy.ts must exist");
  const proxyMod = await import("@/proxy");
  assert.equal(
    typeof proxyMod.proxy,
    "function",
    "src/proxy.ts must export a proxy function"
  );

  // T-093: server-only guard present in sensitive server modules
  for (const serverModuleRel of [
    "src/lib/stripe.ts",
    "src/lib/prisma.ts",
    "src/lib/fulfillment/PrintfulProvider.ts",
    "src/lib/fulfillment/getActiveProducts.ts",
    "src/lib/ai/visual-provider.ts",
    "src/lib/ai/cultural-provider.ts",
    "src/lib/ai/InterpretationEngine.ts",
  ]) {
    const content = fs.readFileSync(path.join(REPO_ROOT, serverModuleRel), "utf8");
    assert.match(
      content,
      /import\s+["']server-only["']/,
      `${serverModuleRel} must import "server-only"`
    );
  }

  // T-303 & T-092: dead/duplicate files & prohibited packages removed
  const deletedFiles = [
    "src/lib/services/PrintMasterService.ts",
    "src/lib/fonts/font_registry_state.json",
    "src/components/create/StudioConfigurator.tsx",
    "src/components/create/CompositionEditor.tsx",
    "src/components/home/HeroInput.tsx",
    "src/components/ui/HeroInput.tsx",
    "src/lib/services/FulfillmentService.ts",
    "src/lib/services/MockupService.ts",
    "src/lib/services/PricingService.ts",
    "src/lib/cart/cartStore.ts",
  ];
  for (const relDead of deletedFiles) {
    assert.equal(
      fs.existsSync(path.join(REPO_ROOT, relDead)),
      false,
      `Dead file ${relDead} should be deleted (T-303 / T-092)`
    );
  }

  const deletedDirs = [
    "src/components/personalization",
    "src/providers/fulfillment",
    "src/lib/ai/resolvers",
  ];
  for (const relDir of deletedDirs) {
    const absDir = path.join(REPO_ROOT, relDir);
    const remainingFiles = fs.existsSync(absDir)
      ? collectSourceFiles(absDir)
      : [];
    assert.equal(
      remainingFiles.length,
      0,
      `Dead directory ${relDir} must contain zero source files (T-092)`
    );
  }

  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
  ) as {
    name: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  assert.notEqual(pkgJson.name, "next-app-temp");
  assert.equal(Boolean(pkgJson.dependencies?.canvas), false);
  assert.equal(Boolean(pkgJson.dependencies?.["html-to-image"]), false);
  assert.equal(Boolean(pkgJson.devDependencies?.canvas), false);
  assert.equal(Boolean(pkgJson.devDependencies?.["html-to-image"]), false);

  // T-002 & INV-009: baseline & remediation migrations + deferred zero-sum trigger
  const baselineSqlPath = path.join(
    REPO_ROOT,
    "prisma/migrations/0000_baseline/migration.sql"
  );
  const remediationSqlPath = path.join(
    REPO_ROOT,
    "prisma/migrations/0001_audit_remediation/migration.sql"
  );
  assert.equal(fs.existsSync(baselineSqlPath), true);
  assert.equal(fs.existsSync(remediationSqlPath), true);
  const remediationSql = fs.readFileSync(remediationSqlPath, "utf8");
  assert.match(
    remediationSql,
    /CREATE CONSTRAINT TRIGGER enforce_ledger_transaction_zero_sum/
  );
  assert.match(remediationSql, /DEFERRABLE INITIALLY DEFERRED/);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2: END-TO-END CONTRACT (QUOTE -> CHECKOUT -> STRIPE SETTLEMENT ->
// 4500x5400 @ 300 DPI DOWNLOAD -> STRIPE REFUND -> 403 ACCESS REVOCATION)
// ─────────────────────────────────────────────────────────────────────────────

test("QA End-to-End Contract: Quote -> Checkout + Frozen Snapshot -> Stripe Settlement + Zero-Sum Ledger -> 4500x5400 @ 300 DPI Download -> Refund 403 Revocation", async () => {
  qaDb.reset();
  qaAuthState.cookies.clear();
  qaAuthState.currentUserId = "buyer-qa-e2e-001";

  const savedDbUrl = process.env.DATABASE_URL;
  const savedResendKey = process.env.RESEND_API_KEY;
  // Set to empty string rather than deleting so any transitive dotenv import cannot re-populate from .env
  process.env.DATABASE_URL = "";
  process.env.RESEND_API_KEY = "";

  process.env.STRIPE_SECRET_KEY = "sk_test_qa_audit_real_key_configured";
  const stripeWebhookSecret = "whsec_qa_audit_e2e_webhook_secret_key";
  process.env.STRIPE_WEBHOOK_SECRET = stripeWebhookSecret;
  process.env.DOWNLOAD_TOKEN_SECRET =
    "qa-audit-download-token-secret-minimum-32-chars!!";
  process.env.NEXT_PUBLIC_APP_URL = "https://thibut.com";
  process.env.OPENAI_API_KEY =
    process.env.OPENAI_API_KEY || "sk-test-offline-mock";

  // Intercept outgoing Stripe session creation + Inngest event emission while keeping real route handlers
  const capturedStripeSessions: Array<Record<string, unknown>> = [];
  const originalStripeCreate = stripe.checkout.sessions.create.bind(
    stripe.checkout.sessions
  );
  stripe.checkout.sessions.create = (async (params: unknown) => {
    capturedStripeSessions.push(params as Record<string, unknown>);
    return {
      id: "cs_test_qa_e2e_001",
      url: "https://checkout.stripe.com/c/pay/cs_test_qa_e2e_001",
    } as Awaited<ReturnType<typeof originalStripeCreate>>;
  }) as typeof stripe.checkout.sessions.create;

  const { inngest } = await import("@/lib/inngest");
  const originalInngestSend = inngest.send.bind(inngest);
  const emittedInngestEvents: Array<{ name: string; data: unknown }> = [];
  inngest.send = (async (payload: { name: string; data: unknown }) => {
    emittedInngestEvents.push(payload);
    return { ids: ["evt-inngest-qa-001"] };
  }) as typeof inngest.send;

  try {
    const { POST: checkoutPost } = await import("@/app/api/checkout/route");
    const { POST: stripeWebhookPost } = await import(
      "@/app/api/webhooks/stripe/route"
    );
    const { GET: downloadGet } = await import("@/app/api/download/route");

    // 1. Seed Creator, Design (with allowModelTraining: true in policy to test INV-010 override),
    //    LicenseOffer, and PersonalizationSession with canonical CompositionSchema
    const designId = "11111111-1111-4111-8111-111111111111";
    const designVersionId = "22222222-2222-4222-8222-222222222222";
    const offerId = "33333333-3333-4333-8333-333333333333";
    const sessionId = "44444444-4444-4444-8444-444444444444";

    const offer: QaLicenseOfferRow = {
      id: offerId,
      designId,
      type: "PERSONAL_DIGITAL",
      priceMinor: 499n,
      currency: "USD",
      active: true,
      allowDigitalDownload: true,
      allowResale: false,
      allowCommercialUse: false,
      termsVersion: 1,
    };
    qaDb.state.licenseOffers.set(offerId, offer);

    qaDb.state.designs.set(designId, {
      id: designId,
      creatorId: "creator-qa-001",
      slug: "master-thu-phap-crest",
      title: "Master Thư Pháp Crest",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      creator: {
        id: "creator-qa-001",
        userId: "user-creator-qa-001",
        slug: "master-kien",
        displayName: "Master Kiên",
        status: "ACTIVE",
      },
      versions: [
        {
          id: designVersionId,
          designId,
          versionNumber: 1,
        },
      ],
      policyVersions: [
        {
          id: "policy-qa-001",
          designId,
          versionNumber: 1,
          allowName: true,
          allowQuote: true,
          allowTranslation: true,
          allowCalligraphy: true,
          allowAIRestyle: false,
          allowCommercialUse: false,
          allowModelTraining: true, // Webhook MUST force LicenseGrant.allowModelTraining === false (INV-010)
        },
      ],
      licenses: [offer],
    });

    const canonicalComposition = CompositionSchema.parse({
      version: 1,
      placement: "front",
      color: "#121212",
      layers: [
        {
          id: "qa-calligraphy-main",
          type: "calligraphy",
          text: "Bình An",
          fontFamily: "UTM ThuPhap Thien An",
          layout: "VERTICAL",
          colorHex: "#121212",
          zIndex: 10,
          opacity: 1,
          transform: { x: 0.5, y: 0.46, scale: 1, rotation: 0 },
        },
        {
          id: "qa-seal-stamp",
          type: "seal",
          sealText: "印",
          fontFamily: DEFAULT_SEAL_FONT_FAMILY,
          colorHex: "#B71032",
          zIndex: 20,
          opacity: 0.95,
          transform: { x: 0.66, y: 0.84, scale: 1, rotation: 0 },
        },
      ],
    });

    qaDb.state.sessions.set(sessionId, {
      id: sessionId,
      userId: "buyer-qa-e2e-001",
      anonymousSessionId: null,
      designId,
      designVersionId,
      mode: "PHRASE",
      inputText: "Peace",
      inputLanguage: "English",
      targetLanguage: "Vietnamese",
      selectedInterpretationId: "interp-qa-001",
      status: "DRAFT",
      compositionJson: canonicalComposition,
      interpretations: [
        {
          id: "interp-qa-001",
          type: "POETIC",
          language: "Vietnamese",
          text: "Bình An",
          romanization: "Bình An",
          meaning: "Inner peace and tranquil harmony",
          recommended: true,
        },
      ],
    });

    // 2. Verify authoritative quote calculation (T-200, INV-006)
    const expectedQuote = calculateItemQuote({
      isDigital: true,
      licenseOffer: offer,
    });
    assert.equal(expectedQuote.totalMinor, DIGITAL_TOTAL_MINOR);
    assert.equal(expectedQuote.totalMinor, 1499n);
    assert.equal(expectedQuote.artworkMinor, 499n);
    assert.equal(expectedQuote.personalizationMinor, 300n);
    assert.equal(expectedQuote.productMinor, 700n);
    assert.equal(expectedQuote.creatorRoyaltyMinor, 499n);
    assert.equal(expectedQuote.platformMinor, 1000n);

    // 2b. Client-injected price or title fields MUST be rejected by strict Zod schema (T-201 AC)
    const tamperedCheckoutRes = await checkoutPost(
      new Request("https://thibut.com/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          isDigital: true,
          placement: "front",
          licenseOfferId: offerId,
          price: 1,
          title: "Forged Free Download",
        }),
      })
    );
    assert.equal(tamperedCheckoutRes.status, 400);
    assert.equal(qaDb.state.orders.size, 0);

    // 3. Execute legitimate POST /api/checkout -> creates Order(PENDING_PAYMENT) + frozen PersonalizationVersion
    const checkoutRes = await checkoutPost(
      new Request("https://thibut.com/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          isDigital: true,
          placement: "front",
          licenseOfferId: offerId,
        }),
      })
    );
    assert.equal(checkoutRes.status, 200);
    const checkoutJson = (await checkoutRes.json()) as {
      url: string;
      orderId: string;
      orderNumber: string;
    };
    assert.ok(checkoutJson.orderId);
    assert.match(checkoutJson.orderNumber, /^TB-/);

    const createdOrder = qaDb.state.orders.get(checkoutJson.orderId);
    assert.ok(createdOrder);
    assert.equal(createdOrder.status, "PENDING_PAYMENT");
    assert.equal(createdOrder.paymentStatus, "PENDING");
    assert.equal(createdOrder.totalMinor, 1499n);
    assert.equal(
      qaDb.state.sessions.get(sessionId)?.status,
      "CHECKED_OUT",
      "PersonalizationSession must be locked as CHECKED_OUT upon order creation (T-102)"
    );
    assert.equal(qaDb.state.personalizationVersions.size, 1);
    assert.equal(qaDb.state.priceQuotes.size, 1);

    const createdOrderItem = Array.from(qaDb.state.orderItems.values())[0];
    assert.ok(createdOrderItem);
    assert.equal(createdOrderItem.orderId, createdOrder.id);
    assert.equal(createdOrderItem.totalMinor, 1499n);

    // Verify Stripe session payload contains server-built price & orderId metadata
    assert.equal(capturedStripeSessions.length, 1);
    const stripeCall = capturedStripeSessions[0];
    const lineItems = stripeCall.line_items as Array<{
      price_data: { unit_amount: number };
    }>;
    assert.equal(lineItems[0]?.price_data.unit_amount, 1499);
    const metadata = stripeCall.metadata as Record<string, string>;
    assert.equal(metadata.orderId, createdOrder.id);

    // 3b. Pre-payment download attempt MUST be rejected with 403 even with a valid signed JWT (T-103)
    const downloadToken = await signDownloadToken({
      orderItemId: createdOrderItem.id,
      orderId: createdOrder.id,
    });
    const verifiedClaims = await verifyDownloadToken(downloadToken);
    assert.deepEqual(verifiedClaims, {
      orderItemId: createdOrderItem.id,
      orderId: createdOrder.id,
    });

    const prePaymentDownloadRes = await downloadGet(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(downloadToken)}`
      )
    );
    assert.equal(
      prePaymentDownloadRes.status,
      403,
      "Unpaid PENDING_PAYMENT order must never serve digital master"
    );

    // 3c. Simulate rogue mutation of PersonalizationSession.compositionJson in memory to prove
    //     /api/download renders strictly from frozen PersonalizationVersion (INV-003)
    const mutableSession = qaDb.state.sessions.get(sessionId)!;
    mutableSession.compositionJson = { layers: [] };

    // 4. Settle via signed Stripe checkout.session.completed webhook (T-202, INV-007/008/009/010)
    const buildSignedStripeWebhook = (eventObj: Record<string, unknown>) => {
      const rawPayload = JSON.stringify(eventObj);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload: rawPayload,
        secret: stripeWebhookSecret,
      });
      return new Request("https://thibut.com/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawPayload,
      });
    };

    const settlementRes = await stripeWebhookPost(
      buildSignedStripeWebhook({
        id: "evt_qa_checkout_completed_001",
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_qa_e2e_001",
            payment_status: "paid",
            amount_total: 1499,
            currency: "usd",
            payment_intent: {
              id: "pi_qa_e2e_001",
              latest_charge: "ch_qa_e2e_001",
            },
            metadata: {
              orderId: createdOrder.id,
              isDigital: "true",
            },
            customer_details: {
              email: "qa-buyer@thibut.com",
            },
          },
        },
      })
    );
    assert.equal(settlementRes.status, 200);

    // Verify settled Order, Payment, LicenseGrant (INV-010), Snapshot (INV-008), Earning, and Zero-Sum Ledger (INV-009)
    const settledOrder = qaDb.state.orders.get(createdOrder.id)!;
    assert.equal(settledOrder.status, "PAID");
    assert.equal(settledOrder.paymentStatus, "SUCCEEDED");
    assert.equal(qaDb.state.payments.size, 1);
    assert.equal(qaDb.state.snapshots.size, 1);
    assert.equal(qaDb.state.creatorEarnings.size, 1);
    assert.equal(qaDb.state.licenseGrants.size, 1);

    const grant = Array.from(qaDb.state.licenseGrants.values())[0]!;
    assert.equal(grant.orderItemId, createdOrderItem.id);
    assert.equal(
      grant.allowModelTraining,
      false,
      "INV-010: LicenseGrant.allowModelTraining must ALWAYS be false"
    );
    assert.equal(grant.revokedAt, null);

    const earning = Array.from(qaDb.state.creatorEarnings.values())[0]!;
    assert.equal(earning.status, "PENDING");
    assert.equal(earning.grossLicenseMinor, 499n);
    assert.equal(earning.netCreatorMinor, 499n);

    assert.equal(qaDb.state.ledgerTransactions.size, 1);
    const saleLedgerTx = Array.from(qaDb.state.ledgerTransactions.values())[0]!;
    const salePostings = qaDb.state.ledgerPostings.filter(
      (p) => p.transactionId === saleLedgerTx.id
    );
    assert.ok(salePostings.length >= 2);
    assert.equal(
      salePostings.reduce((sum, p) => sum + p.amountMinor, 0n),
      0n,
      "INV-009: Sale LedgerPosting sum must equal 0n"
    );

    // 5. Paid download via GET /api/download?token=... -> 4500x5400 @ 300 DPI RGBA transparent PNG
    const paidDownloadRes = await downloadGet(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(downloadToken)}`
      )
    );
    assert.equal(paidDownloadRes.status, 200);
    assert.equal(paidDownloadRes.headers.get("content-type"), "image/png");
    assert.match(
      paidDownloadRes.headers.get("cache-control") ?? "",
      /no-store/
    );

    const pngBuffer = Buffer.from(await paidDownloadRes.arrayBuffer());
    const ihdrWidth = pngBuffer.readUInt32BE(16);
    const ihdrHeight = pngBuffer.readUInt32BE(20);
    const bitDepth = pngBuffer[24];
    const colorType = pngBuffer[25];

    assert.equal(ihdrWidth, PRINT_MASTER_WIDTH);
    assert.equal(ihdrHeight, PRINT_MASTER_HEIGHT);
    assert.equal(ihdrWidth, 4500);
    assert.equal(ihdrHeight, 5400);
    assert.equal(bitDepth, 8);
    assert.equal(colorType, 6, "PNG colorType must be 6 (RGBA)");

    const phys = readPngPhysChunk(pngBuffer);
    assert.ok(phys, "PNG must contain a 300 DPI pHYs chunk");
    assert.equal(phys.ppuX, PRINT_MASTER_PIXELS_PER_METER);
    assert.equal(phys.ppuY, PRINT_MASTER_PIXELS_PER_METER);
    assert.equal(phys.ppuX, 11811);
    assert.equal(phys.ppuY, 11811);
    assert.equal(phys.unit, 1);
    assert.equal(phys.crcValid, true);
    assert.equal(PRINT_MASTER_DPI, 300);

    const decodedPng: PNG = PNG.sync.read(pngBuffer);
    assert.equal(decodedPng.width, 4500);
    assert.equal(decodedPng.height, 5400);

    // Corners must be 100% transparent (alpha === 0)
    for (const [cx, cy] of [
      [0, 0],
      [4499, 0],
      [0, 5399],
      [4499, 5399],
    ] as const) {
      const alpha = decodedPng.data[(cy * 4500 + cx) * 4 + 3];
      assert.equal(
        alpha,
        0,
        `Expected corner (${cx},${cy}) alpha === 0, got ${alpha}`
      );
    }

    // Center artwork must contain rendered non-transparent ink pixels
    let inkPixels = 0;
    for (let i = 3; i < decodedPng.data.length; i += 4) {
      if (decodedPng.data[i]! > 0) {
        inkPixels++;
      }
    }
    assert.ok(
      inkPixels > 1000,
      `Expected > 1000 rendered ink pixels in 4500x5400 master, got ${inkPixels}`
    );

    // 5b. Partial refund (500n of 1499n) MUST keep LicenseGrant active and /api/download returning 200 (R-102)!
    const partialRefundRes = await stripeWebhookPost(
      buildSignedStripeWebhook({
        id: "evt_qa_charge_partial_refund_001",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_qa_e2e_001",
            payment_intent: "pi_qa_e2e_001",
            amount: 1499,
            amount_refunded: 500,
            currency: "usd",
            refunds: {
              data: [
                {
                  id: "re_qa_partial_500",
                  amount: 500,
                  reason: "requested_by_customer",
                },
              ],
            },
          },
        },
      })
    );
    assert.equal(partialRefundRes.status, 200);
    assert.equal(
      qaDb.state.orders.get(createdOrder.id)?.status,
      "PARTIALLY_REFUNDED"
    );
    const partialDownloadRes = await downloadGet(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(downloadToken)}`
      )
    );
    assert.equal(
      partialDownloadRes.status,
      200,
      "Partial refund must NOT revoke active digital download license (R-102)"
    );

    // 6. Process full remaining Stripe charge.refunded webhook (500 + 999 = 1499) -> reverses earnings, revokes license, balances ledger, and revokes download (403)!
    const refundRes = await stripeWebhookPost(
      buildSignedStripeWebhook({
        id: "evt_qa_charge_refunded_001",
        object: "event",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_qa_e2e_001",
            payment_intent: "pi_qa_e2e_001",
            amount: 1499,
            amount_refunded: 1499,
            currency: "usd",
            refunds: {
              data: [
                {
                  id: "re_qa_partial_500",
                  amount: 500,
                  reason: "requested_by_customer",
                },
                {
                  id: "re_qa_e2e_001",
                  amount: 999,
                  reason: "requested_by_customer",
                },
              ],
            },
          },
        },
      })
    );
    assert.equal(refundRes.status, 200);

    const refundedOrder = qaDb.state.orders.get(createdOrder.id)!;
    const refundedGrant = Array.from(qaDb.state.licenseGrants.values())[0]!;
    const refundedEarning = Array.from(qaDb.state.creatorEarnings.values())[0]!;
    assert.equal(refundedOrder.status, "REFUNDED");
    assert.equal(refundedOrder.paymentStatus, "REFUNDED");
    assert.equal(qaDb.state.refunds.size, 2);
    assert.equal(refundedEarning.status, "REVERSED");
    assert.ok(
      refundedGrant.revokedAt instanceof Date,
      "LicenseGrant.revokedAt must be set on refund"
    );

    // Reversal ledger postings must sum to 0n and bring net account balances back to 0n
    assert.equal(qaDb.state.ledgerTransactions.size, 3);
    for (const txRow of qaDb.state.ledgerTransactions.values()) {
      const postings = qaDb.state.ledgerPostings.filter(
        (p) => p.transactionId === txRow.id
      );
      assert.equal(
        postings.reduce((sum, p) => sum + p.amountMinor, 0n),
        0n,
        `LedgerTransaction ${txRow.id} (${txRow.type}) must sum to 0n`
      );
    }
    for (const acc of qaDb.state.ledgerAccounts.values()) {
      assert.equal(
        acc.balanceMinor,
        0n,
        `After full refund, LedgerAccount ${acc.code} should net to 0n`
      );
    }

    // 7. Subsequent GET /api/download with the SAME unexpired JWT MUST now return HTTP 403!
    const postRefundDownloadRes = await downloadGet(
      new Request(
        `https://thibut.com/api/download?token=${encodeURIComponent(downloadToken)}`
      )
    );
    assert.equal(
      postRefundDownloadRes.status,
      403,
      "Refunded order must immediately revoke /api/download access with 403"
    );
  } finally {
    stripe.checkout.sessions.create = originalStripeCreate;
    inngest.send = originalInngestSend;
    if (savedDbUrl !== undefined) {
      process.env.DATABASE_URL = savedDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
    if (savedResendKey !== undefined) {
      process.env.RESEND_API_KEY = savedResendKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3: ROUND-2 REGRESSION GATE (R-000..R-602)
// ─────────────────────────────────────────────────────────────────────────────

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (/\.ts$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

test("QA Round-2 Regression Gate: fonts quarantine & tracing, zero mock/float/hex violations, API <300 LOC, CI/env/vercel/migrations/E2E/Postgres contracts", async () => {
  // 1. R-107: public/fonts removed; assets/fonts holds only verified fonts; next.config.ts narrows tracing to 3 render routes
  const publicFontsDir = path.join(REPO_ROOT, "public", "fonts");
  assert.equal(
    fs.existsSync(publicFontsDir),
    false,
    "public/fonts must not exist (R-107)"
  );

  const assetsFontsDir = path.join(REPO_ROOT, "assets", "fonts");
  assert.equal(
    fs.existsSync(assetsFontsDir),
    true,
    "assets/fonts must exist (R-107)"
  );
  const assetFontFiles = fs
    .readdirSync(assetsFontsDir)
    .filter((f) => /\.(ttf|otf|woff2)$/i.test(f));
  assert.ok(
    assetFontFiles.length >= 14,
    `Expected >= 14 approved font files in assets/fonts, got ${assetFontFiles.length}`
  );
  for (const requiredFont of [
    "UtmThuphapThienAn.ttf",
    "MaShanZheng-Regular.ttf",
    "YujiBoku-Regular.ttf",
    "NanumBrushScript-Regular.ttf",
  ]) {
    assert.ok(
      assetFontFiles.includes(requiredFont),
      `assets/fonts must contain approved font ${requiredFont}`
    );
  }
  for (const fileName of assetFontFiles) {
    assert.equal(
      isUnverifiedLegacyArchiveFile(fileName),
      false,
      `Unverified legacy archive font "${fileName}" must not reside in assets/fonts (R-107)`
    );
  }

  const nextConfigMod = await import("../next.config");
  const nextConfig = nextConfigMod.default;
  assert.deepEqual(
    nextConfig.outputFileTracingIncludes,
    {
      "/api/print-master": ["./assets/fonts/**/*"],
      "/api/download": ["./assets/fonts/**/*"],
      "/api/inngest": ["./assets/fonts/**/*"],
      // Keepsake editor (docs/KEEPSAKE_EDITOR_PLAN.md): the admin page lists the eligible fonts
      // and the admin-only font route streams them.
      "/admin/keepsake-editor": ["./assets/fonts/**/*"],
      "/admin/keepsake-editor/fonts/*": ["./assets/fonts/**/*"],
    },
    "next.config.ts must trace ./assets/fonts/**/* strictly into /api/print-master, /api/download, /api/inngest and the admin keepsake editor (R-107)"
  );

  // 2. R-108 & R-506: Zero MOCK_, aida-public, Number(*Minor), or toFixed(2) anywhere in src/
  const allSrcFiles = collectSourceFiles(SRC_ROOT);
  const floatMoneyRegex = /Number\([^)]*Minor\)|toFixed\(2\)/;
  for (const filePath of allSrcFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");

    assert.equal(
      content.includes("MOCK_"),
      false,
      `Banned mock identifier MOCK_ found in ${rel} (R-108)`
    );
    assert.equal(
      content.includes("aida-public"),
      false,
      `Expired hotlinked Stitch URL aida-public found in ${rel} (R-108)`
    );
    assert.equal(
      floatMoneyRegex.test(content),
      false,
      `Float money conversion Number(*Minor) or toFixed(2) found in ${rel} (R-506)`
    );
  }

  // 3. R-201: Zero Number( in src/lib/pricing/
  const pricingFiles = collectSourceFiles(
    path.join(SRC_ROOT, "lib", "pricing")
  );
  assert.ok(pricingFiles.length >= 2, "Expected pricing modules in src/lib/pricing");
  for (const filePath of pricingFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    assert.equal(
      content.includes("Number("),
      false,
      `Prohibited Number( conversion found in ${rel} (R-201)`
    );
  }

  // 4. R-510: Every .ts file under src/app/api/ is < 300 lines
  const apiTsFiles = collectTsFiles(path.join(SRC_ROOT, "app", "api"));
  assert.ok(apiTsFiles.length >= 20, "Expected >= 20 API route .ts files");
  for (const apiFile of apiTsFiles) {
    const rel = path.relative(REPO_ROOT, apiFile);
    const content = fs.readFileSync(apiFile, "utf8");
    const lineCount = content.split(/\r?\n/).length;
    assert.ok(
      lineCount < 300,
      `API module ${rel} has ${lineCount} lines; must be < 300 lines (R-510)`
    );
  }

  // 5. R-501: Zero [# arbitrary hex classes, zero undefined bg-bg-/text-text-/ring-offset-bg- classes,
  //    zero #RRGGBB inside className strings, and < 30 #RRGGBB literals outside globals.css
  const uiFiles = [
    ...collectSourceFiles(path.join(SRC_ROOT, "app")),
    ...collectSourceFiles(path.join(SRC_ROOT, "components")),
  ];
  const globalsCssAbs = path.join(SRC_ROOT, "app", "globals.css");
  const hexLiteralRegex = /#[0-9a-fA-F]{6}\b/g;
  const classNameHexRegex =
    /className\s*=\s*(?:"[^"]*#[0-9a-fA-F]{6}[^"]*"|'[^']*#[0-9a-fA-F]{6}[^']*'|`[^`]*#[0-9a-fA-F]{6}[^`]*`)/;
  let totalUiHexLiterals = 0;

  for (const filePath of uiFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");

    assert.equal(
      content.includes("[#"),
      false,
      `Arbitrary Tailwind hex class "[#" found in ${rel} (R-501)`
    );
    for (const undefinedToken of ["bg-bg-", "text-text-", "ring-offset-bg-"]) {
      assert.equal(
        content.includes(undefinedToken),
        false,
        `Undefined token class "${undefinedToken}" found in ${rel} (R-501)`
      );
    }
    assert.equal(
      classNameHexRegex.test(content),
      false,
      `Raw #RRGGBB hex literal inside className attribute in ${rel} (R-501)`
    );

    if (filePath !== globalsCssAbs) {
      const matches = content.match(hexLiteralRegex);
      if (matches) {
        totalUiHexLiterals += matches.length;
      }
    }
  }
  assert.ok(
    totalUiHexLiterals < 30,
    `Expected < 30 #RRGGBB literals across src/app & src/components (excl globals.css), got ${totalUiHexLiterals} (R-501)`
  );

  // 6. R-001, R-002, R-204, R-400, R-600, R-601: Repo config, migrations, E2E & Postgres integration suites
  const gitignoreContent = fs.readFileSync(
    path.join(REPO_ROOT, ".gitignore"),
    "utf8"
  );
  assert.match(gitignoreContent, /^!\.env\.example$/m);
  assert.match(gitignoreContent, /\.local-private-uploads/);
  assert.match(gitignoreContent, /\.quarantined-fonts/);

  const envExamplePath = path.join(REPO_ROOT, ".env.example");
  assert.equal(fs.existsSync(envExamplePath), true, ".env.example must exist (R-002)");
  const envExampleContent = fs.readFileSync(envExamplePath, "utf8");
  for (const requiredEnvKey of [
    "DATABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "STRIPE_SECRET_KEY=",
    "STRIPE_WEBHOOK_SECRET=",
    "PRINTFUL_API_KEY=",
    "PRINTFUL_WEBHOOK_SECRET=",
    "ADMIN_SESSION_SECRET=",
    "ADMIN_MASTER_PASSWORD=",
    "DEVICE_TRUST_SECRET=",
    "DOWNLOAD_TOKEN_SECRET=",
    "ANON_SESSION_SECRET=",
    "FULFILLMENT_SECRET_KEY=",
    "BLOB_READ_WRITE_TOKEN=",
    "RESEND_API_KEY=",
    "INNGEST_SIGNING_KEY=",
    "INNGEST_EVENT_KEY=",
    "OPENAI_API_KEY=",
    "FAL_KEY=",
  ]) {
    assert.ok(
      envExampleContent.includes(requiredEnvKey),
      `.env.example must document ${requiredEnvKey} (R-002)`
    );
  }

  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")
  ) as {
    engines?: { node?: string };
    scripts?: Record<string, string>;
  };
  assert.equal(pkgJson.engines?.node, ">=22.15");
  assert.equal(pkgJson.scripts?.postinstall, "prisma generate");

  const ciYamlPath = path.join(REPO_ROOT, ".github", "workflows", "ci.yml");
  assert.equal(fs.existsSync(ciYamlPath), true, ".github/workflows/ci.yml must exist (R-001)");
  const ciYaml = fs.readFileSync(ciYamlPath, "utf8");
  assert.match(ciYaml, /npm ci/);
  assert.match(ciYaml, /npx prisma generate/);
  assert.match(ciYaml, /npm run typecheck/);
  assert.match(ciYaml, /npx eslint --max-warnings=0/);
  assert.match(ciYaml, /npm test/);
  assert.match(ciYaml, /npm run build/);
  assert.match(ciYaml, /postgres:16/);
  assert.match(ciYaml, /npx prisma migrate deploy/);
  assert.match(ciYaml, /npm run test:db/);

  const vercelJsonPath = path.join(REPO_ROOT, "vercel.json");
  assert.equal(fs.existsSync(vercelJsonPath), true, "vercel.json must exist (R-400)");
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8")) as {
    functions?: Record<string, { memory?: number; maxDuration?: number }>;
  };
  for (const renderFn of [
    "src/app/api/print-master/route.ts",
    "src/app/api/download/route.ts",
    "src/app/api/inngest/route.ts",
  ]) {
    assert.equal(
      vercelConfig.functions?.[renderFn]?.memory,
      3009,
      `${renderFn} must configure 3009 MB memory in vercel.json (R-400)`
    );
    assert.equal(
      vercelConfig.functions?.[renderFn]?.maxDuration,
      60,
      `${renderFn} must configure maxDuration=60 in vercel.json (R-400)`
    );
  }

  const migration0002Path = path.join(
    REPO_ROOT,
    "prisma/migrations/0002_reaudit_hardening/migration.sql"
  );
  assert.equal(
    fs.existsSync(migration0002Path),
    true,
    "prisma/migrations/0002_reaudit_hardening/migration.sql must exist (R-204)"
  );
  const migration0002Sql = fs.readFileSync(migration0002Path, "utf8");
  assert.match(
    migration0002Sql,
    /CREATE TRIGGER enforce_ledger_posting_append_only[\s\S]*BEFORE UPDATE OR DELETE ON "LedgerPosting"/
  );
  assert.match(
    migration0002Sql,
    /CREATE TRIGGER enforce_ledger_transaction_append_only[\s\S]*BEFORE UPDATE OR DELETE ON "LedgerTransaction"/
  );
  assert.match(migration0002Sql, /ADD COLUMN "attempts" INTEGER/);
  assert.match(migration0002Sql, /ADD COLUMN "webEmbedAllowed" BOOLEAN/);

  const e2eSmokePath = path.join(REPO_ROOT, "e2e", "smoke.spec.ts");
  assert.equal(fs.existsSync(e2eSmokePath), true, "e2e/smoke.spec.ts must exist (R-601)");
  const e2eSmokeSrc = fs.readFileSync(e2eSmokePath, "utf8");
  assert.match(e2eSmokeSrc, /securitypolicyviolation/);
  assert.match(e2eSmokeSrc, /\/auth\/login/);
  assert.match(e2eSmokeSrc, /Escape/);

  const pgIntegrationPath = path.join(
    REPO_ROOT,
    "tests",
    "postgres-integration.integration.ts"
  );
  assert.equal(
    fs.existsSync(pgIntegrationPath),
    true,
    "tests/postgres-integration.integration.ts must exist (R-600)"
  );
  const pgIntegrationSrc = fs.readFileSync(pgIntegrationPath, "utf8");
  assert.match(pgIntegrationSrc, /enforce_ledger_posting_append_only/);
  assert.match(pgIntegrationSrc, /enforce_ledger_transaction_append_only/);
  assert.match(pgIntegrationSrc, /Promise\.all/);

  // 7. Verify all 5 Inngest functions registered in /api/inngest/route.ts, instrumentation.ts boot validation,
  //    zero eslint-disable comments, and clean globals.css @font-face rules
  const inngestLibMod = await import("@/lib/inngest");
  assert.equal(
    inngestLibMod.inngestFunctions.length,
    5,
    "inngestFunctions must contain all 5 Inngest functions (R-105, R-203, R-301)"
  );
  const inngestRouteSrc = fs.readFileSync(
    path.join(SRC_ROOT, "app", "api", "inngest", "route.ts"),
    "utf8"
  );
  assert.match(
    inngestRouteSrc,
    /functions:\s*inngestFunctions/,
    "/api/inngest/route.ts must pass inngestFunctions to serve()"
  );

  const instrumentationPath = path.join(SRC_ROOT, "instrumentation.ts");
  assert.equal(
    fs.existsSync(instrumentationPath),
    true,
    "src/instrumentation.ts must exist for boot-time env validation (R-002 / R-303)"
  );
  const instrumentationSrc = fs.readFileSync(instrumentationPath, "utf8");
  assert.match(instrumentationSrc, /validateServerEnv/);

  const globalsCssSrc = fs.readFileSync(globalsCssAbs, "utf8");
  assert.equal(
    globalsCssSrc.includes("url('/fonts/"),
    false,
    "globals.css must not reference deleted /fonts/* static paths (R-107)"
  );
  assert.ok(
    globalsCssSrc.includes("/api/fonts/utm-thuphap-thien-an"),
    "globals.css must load UTM ThuPhap Thien An via gated /api/fonts/[id]"
  );

  for (const filePath of allSrcFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    assert.equal(
      content.includes("eslint-disable"),
      false,
      `eslint-disable suppression is prohibited in ${rel}`
    );
  }
});
