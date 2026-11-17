import "server-only";
import type { LedgerAccountType, Prisma } from "@prisma/client";

export class LedgerImbalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerImbalanceError";
  }
}

export type StandardLedgerAccountCode =
  | "STRIPE_CLEARING"
  | "CREATOR_PAYABLE"
  | "PLATFORM_AI_REVENUE"
  | "PLATFORM_PRODUCT_REVENUE"
  | "FULFILLMENT_PAYABLE"
  | "TAX_PAYABLE"
  | "SHIPPING_REVENUE"
  | "REFUND_EXPENSE"
  | "DISPUTE_RESERVE";

export type LedgerAccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "REVENUE"
  | "EXPENSE";

export interface LedgerAccountSpec {
  code: StandardLedgerAccountCode;
  name: string;
  prismaType: LedgerAccountType;
  category: LedgerAccountCategory;
  ownerType: "PLATFORM" | "CREATOR";
}

export const STANDARD_LEDGER_ACCOUNTS: Record<
  StandardLedgerAccountCode,
  LedgerAccountSpec
> = {
  STRIPE_CLEARING: {
    code: "STRIPE_CLEARING",
    name: "Stripe Clearing (Asset)",
    prismaType: "STRIPE_CLEARING",
    category: "ASSET",
    ownerType: "PLATFORM",
  },
  CREATOR_PAYABLE: {
    code: "CREATOR_PAYABLE",
    name: "Creator Royalties Payable (Liability)",
    prismaType: "CREATOR_PAYABLE",
    category: "LIABILITY",
    ownerType: "CREATOR",
  },
  PLATFORM_AI_REVENUE: {
    code: "PLATFORM_AI_REVENUE",
    name: "Platform AI Personalization Revenue",
    prismaType: "PLATFORM_AI_REVENUE",
    category: "REVENUE",
    ownerType: "PLATFORM",
  },
  PLATFORM_PRODUCT_REVENUE: {
    code: "PLATFORM_PRODUCT_REVENUE",
    name: "Platform Product Revenue",
    prismaType: "PLATFORM_PRODUCT_REVENUE",
    category: "REVENUE",
    ownerType: "PLATFORM",
  },
  FULFILLMENT_PAYABLE: {
    code: "FULFILLMENT_PAYABLE",
    name: "Fulfillment Provider Payable (Liability)",
    prismaType: "FULFILLMENT_PAYABLE",
    category: "LIABILITY",
    ownerType: "PLATFORM",
  },
  TAX_PAYABLE: {
    code: "TAX_PAYABLE",
    name: "Sales Tax Payable (Liability)",
    prismaType: "TAX_PAYABLE",
    category: "LIABILITY",
    ownerType: "PLATFORM",
  },
  SHIPPING_REVENUE: {
    code: "SHIPPING_REVENUE",
    name: "Shipping Revenue",
    prismaType: "PLATFORM_REVENUE",
    category: "REVENUE",
    ownerType: "PLATFORM",
  },
  REFUND_EXPENSE: {
    code: "REFUND_EXPENSE",
    name: "Refunds & Disputes Expense",
    prismaType: "REFUND_LIABILITY",
    category: "EXPENSE",
    ownerType: "PLATFORM",
  },
  DISPUTE_RESERVE: {
    code: "DISPUTE_RESERVE",
    name: "Dispute Reserve Hold",
    prismaType: "REFUND_LIABILITY",
    category: "EXPENSE",
    ownerType: "PLATFORM",
  },
};

export interface DraftLedgerPosting {
  accountCode: StandardLedgerAccountCode;
  amountMinor: bigint;
  currency: string;
}

export interface OrderLedgerInput {
  id: string;
  orderNumber: string;
  currency: string;
  subtotalMinor: bigint;
  discountMinor?: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  fulfillmentStatus?: string;
}

export interface OrderItemLedgerInput {
  id: string;
  creatorId: string;
  artworkRevenueMinor: bigint;
  personalizationRevenueMinor: bigint;
  productRevenueMinor: bigint;
  fulfillmentCostMinor: bigint;
  creatorRoyaltyMinor: bigint;
  platformRevenueMinor: bigint;
  totalMinor: bigint;
}

export interface RefundPostingOptions {
  alreadyRefundedMinor?: bigint;
}

/**
 * Minimal structural subset of Prisma.TransactionClient used by LedgerService.
 * Prisma.TransactionClient satisfies this interface natively without casts.
 */
export type LedgerTxClient = Pick<
  Prisma.TransactionClient,
  "ledgerAccount" | "ledgerTransaction" | "ledgerPosting"
>;

/**
 * Enforces INV-009: Double-entry ledger postings MUST have >= 2 legs and sum to 0n.
 */
export function assertBalancedPostings(
  postings: ReadonlyArray<{ amountMinor: bigint; currency?: string }>
): void {
  if (postings.length < 2) {
    throw new LedgerImbalanceError(
      `Double-entry transaction requires at least 2 postings, received ${postings.length}`
    );
  }

  for (const p of postings) {
    if (typeof p.amountMinor !== "bigint") {
      throw new LedgerImbalanceError("Posting amountMinor must be a BigInt");
    }
    if (p.amountMinor === 0n) {
      throw new LedgerImbalanceError(
        "Zero-amount ledger postings are not permitted"
      );
    }
    if (p.currency && p.currency.toUpperCase() !== "USD") {
      throw new LedgerImbalanceError(
        `Unsupported ledger currency: ${p.currency}`
      );
    }
  }

  const sum = postings.reduce((acc, p) => acc + p.amountMinor, 0n);
  if (sum !== 0n) {
    throw new LedgerImbalanceError(
      `Ledger postings are unbalanced (INV-009): SUM(amountMinor) = ${sum.toString()}, expected 0`
    );
  }
}

function normalizeCurrency(currency: string): "USD" {
  const upper = currency.trim().toUpperCase();
  if (upper !== "USD") {
    throw new LedgerImbalanceError(
      `Unsupported order currency for ledger: ${currency}`
    );
  }
  return "USD";
}

function summarizeOrderComponents(
  order: OrderLedgerInput,
  items: ReadonlyArray<OrderItemLedgerInput>
) {
  const currency = normalizeCurrency(order.currency);
  const discountMinor = order.discountMinor ?? 0n;

  if (order.totalMinor <= 0n) {
    throw new LedgerImbalanceError("Order totalMinor must be positive");
  }

  const expectedOrderTotal =
    order.subtotalMinor - discountMinor + order.shippingMinor + order.taxMinor;
  if (expectedOrderTotal !== order.totalMinor) {
    throw new LedgerImbalanceError(
      `Order components do not reconcile to totalMinor: expected ${expectedOrderTotal.toString()}, got ${order.totalMinor.toString()}`
    );
  }

  const totalCreatorRoyalty = items.reduce(
    (acc, item) => acc + item.creatorRoyaltyMinor,
    0n
  );
  const totalAiRevenue = items.reduce(
    (acc, item) => acc + item.personalizationRevenueMinor,
    0n
  );
  const totalFulfillmentCost = items.reduce(
    (acc, item) => acc + item.fulfillmentCostMinor,
    0n
  );

  // Net merchandise revenue after creator royalty, AI fee, fulfillment cost, and any promo discount
  const netMerchandise = order.subtotalMinor - discountMinor;
  const platformProductRevenue =
    netMerchandise -
    totalCreatorRoyalty -
    totalAiRevenue -
    totalFulfillmentCost;

  return {
    currency,
    totalCreatorRoyalty,
    totalAiRevenue,
    totalFulfillmentCost,
    platformProductRevenue,
  };
}

/**
 * Pure builder for sale postings (Debit +totalMinor STRIPE_CLEARING; Credits across revenue & payables).
 */
export function buildOrderSalePostings(
  order: OrderLedgerInput,
  items: ReadonlyArray<OrderItemLedgerInput>
): DraftLedgerPosting[] {
  const {
    currency,
    totalCreatorRoyalty,
    totalAiRevenue,
    totalFulfillmentCost,
    platformProductRevenue,
  } = summarizeOrderComponents(order, items);

  const postings: DraftLedgerPosting[] = [
    {
      accountCode: "STRIPE_CLEARING",
      amountMinor: order.totalMinor, // Debit (+asset)
      currency,
    },
  ];

  if (totalCreatorRoyalty !== 0n) {
    postings.push({
      accountCode: "CREATOR_PAYABLE",
      amountMinor: -totalCreatorRoyalty, // Credit (-liability increase)
      currency,
    });
  }

  if (totalAiRevenue !== 0n) {
    postings.push({
      accountCode: "PLATFORM_AI_REVENUE",
      amountMinor: -totalAiRevenue, // Credit (-revenue)
      currency,
    });
  }

  if (platformProductRevenue !== 0n) {
    postings.push({
      accountCode: "PLATFORM_PRODUCT_REVENUE",
      amountMinor: -platformProductRevenue, // Credit (-revenue; positive if contra)
      currency,
    });
  }

  if (totalFulfillmentCost !== 0n) {
    postings.push({
      accountCode: "FULFILLMENT_PAYABLE",
      amountMinor: -totalFulfillmentCost, // Credit (-liability increase)
      currency,
    });
  }

  if (order.shippingMinor !== 0n) {
    postings.push({
      accountCode: "SHIPPING_REVENUE",
      amountMinor: -order.shippingMinor, // Credit (-revenue)
      currency,
    });
  }

  if (order.taxMinor !== 0n) {
    postings.push({
      accountCode: "TAX_PAYABLE",
      amountMinor: -order.taxMinor, // Credit (-liability increase)
      currency,
    });
  }

  assertBalancedPostings(postings);
  return postings;
}

/**
 * Pure builder for refund/dispute reversal postings (SUM(amountMinor) === 0n, R-102).
 */
export function buildOrderRefundPostings(
  order: OrderLedgerInput,
  refundAmountMinor: bigint,
  items: ReadonlyArray<OrderItemLedgerInput>,
  options?: RefundPostingOptions
): DraftLedgerPosting[] {
  const alreadyRefundedMinor = options?.alreadyRefundedMinor ?? 0n;
  if (refundAmountMinor <= 0n) {
    throw new LedgerImbalanceError(
      "Refund amountMinor must be strictly positive"
    );
  }
  if (alreadyRefundedMinor < 0n) {
    throw new LedgerImbalanceError("alreadyRefundedMinor cannot be negative");
  }
  if (alreadyRefundedMinor + refundAmountMinor > order.totalMinor) {
    throw new LedgerImbalanceError(
      `Cumulative refund (${(alreadyRefundedMinor + refundAmountMinor).toString()}) cannot exceed order total (${order.totalMinor.toString()})`
    );
  }

  const {
    currency,
    totalCreatorRoyalty,
    totalAiRevenue,
    totalFulfillmentCost,
  } = summarizeOrderComponents(order, items);

  const postings: DraftLedgerPosting[] = [
    {
      accountCode: "STRIPE_CLEARING",
      amountMinor: -refundAmountMinor, // Credit (-asset outflow)
      currency,
    },
  ];

  // Telescoping cumulative pro-rata allocation across all order components (R-102, INV-009):
  // Guarantees SUM(postings) === 0n on every partial step AND guarantees every revenue/payable
  // account nets to 0n when cumulative refunds reach order.totalMinor.
  const cumulativeBefore = alreadyRefundedMinor;
  const cumulativeAfter = alreadyRefundedMinor + refundAmountMinor;
  const orderTotal = order.totalMinor;

  const proRataCumulative = (componentTotal: bigint, cumulative: bigint): bigint => {
    if (componentTotal === 0n || cumulative <= 0n) {
      return 0n;
    }
    if (cumulative >= orderTotal) {
      return componentTotal;
    }
    return (componentTotal * cumulative) / orderTotal;
  };

  const creatorDelta =
    proRataCumulative(totalCreatorRoyalty, cumulativeAfter) -
    proRataCumulative(totalCreatorRoyalty, cumulativeBefore);
  const aiDelta =
    proRataCumulative(totalAiRevenue, cumulativeAfter) -
    proRataCumulative(totalAiRevenue, cumulativeBefore);
  const fulfillmentDelta =
    proRataCumulative(totalFulfillmentCost, cumulativeAfter) -
    proRataCumulative(totalFulfillmentCost, cumulativeBefore);
  const shippingDelta =
    proRataCumulative(order.shippingMinor, cumulativeAfter) -
    proRataCumulative(order.shippingMinor, cumulativeBefore);
  const taxDelta =
    proRataCumulative(order.taxMinor, cumulativeAfter) -
    proRataCumulative(order.taxMinor, cumulativeBefore);

  // Residual goes to PLATFORM_PRODUCT_REVENUE (which equals platformProductRevenue at cumulativeAfter === orderTotal)
  const productDelta =
    refundAmountMinor -
    (creatorDelta + aiDelta + fulfillmentDelta + shippingDelta + taxDelta);

  if (creatorDelta !== 0n) {
    postings.push({
      accountCode: "CREATOR_PAYABLE",
      amountMinor: creatorDelta,
      currency,
    });
  }
  if (aiDelta !== 0n) {
    postings.push({
      accountCode: "PLATFORM_AI_REVENUE",
      amountMinor: aiDelta,
      currency,
    });
  }
  if (productDelta !== 0n) {
    postings.push({
      accountCode: "PLATFORM_PRODUCT_REVENUE",
      amountMinor: productDelta,
      currency,
    });
  }
  if (fulfillmentDelta !== 0n) {
    const alreadyInProductionOrShipped =
      order.fulfillmentStatus === "IN_PRODUCTION" ||
      order.fulfillmentStatus === "SHIPPED" ||
      order.fulfillmentStatus === "DELIVERED";
    postings.push({
      accountCode: alreadyInProductionOrShipped
        ? "REFUND_EXPENSE"
        : "FULFILLMENT_PAYABLE",
      amountMinor: fulfillmentDelta,
      currency,
    });
  }
  if (shippingDelta !== 0n) {
    postings.push({
      accountCode: "SHIPPING_REVENUE",
      amountMinor: shippingDelta,
      currency,
    });
  }
  if (taxDelta !== 0n) {
    postings.push({
      accountCode: "TAX_PAYABLE",
      amountMinor: taxDelta,
      currency,
    });
  }

  // Merge any duplicate accountCode entries if e.g. REFUND_EXPENSE appeared twice
  const mergedMap = new Map<StandardLedgerAccountCode, bigint>();
  for (const p of postings) {
    mergedMap.set(
      p.accountCode,
      (mergedMap.get(p.accountCode) ?? 0n) + p.amountMinor
    );
  }

  const normalized: DraftLedgerPosting[] = [];
  for (const [accountCode, amountMinor] of mergedMap.entries()) {
    if (amountMinor !== 0n) {
      normalized.push({ accountCode, amountMinor, currency });
    }
  }

  assertBalancedPostings(normalized);
  return normalized;
}

/**
 * Pure builder for dispute hold postings (R-103): Credit STRIPE_CLEARING, Debit DISPUTE_RESERVE.
 */
export function buildOrderDisputeHoldPostings(
  order: Pick<OrderLedgerInput, "currency" | "totalMinor">,
  holdAmountMinor: bigint
): DraftLedgerPosting[] {
  const currency = normalizeCurrency(order.currency);
  if (holdAmountMinor <= 0n || holdAmountMinor > order.totalMinor) {
    throw new LedgerImbalanceError(
      `Invalid dispute hold amount (${holdAmountMinor.toString()}) for order total (${order.totalMinor.toString()})`
    );
  }
  const postings: DraftLedgerPosting[] = [
    {
      accountCode: "STRIPE_CLEARING",
      amountMinor: -holdAmountMinor,
      currency,
    },
    {
      accountCode: "DISPUTE_RESERVE",
      amountMinor: holdAmountMinor,
      currency,
    },
  ];
  assertBalancedPostings(postings);
  return postings;
}

/**
 * Pure builder for dispute release postings when dispute is won/reinstated or resolved (R-103).
 */
export function buildOrderDisputeReleasePostings(
  order: Pick<OrderLedgerInput, "currency" | "totalMinor">,
  releaseAmountMinor: bigint
): DraftLedgerPosting[] {
  const currency = normalizeCurrency(order.currency);
  if (releaseAmountMinor <= 0n || releaseAmountMinor > order.totalMinor) {
    throw new LedgerImbalanceError(
      `Invalid dispute release amount (${releaseAmountMinor.toString()}) for order total (${order.totalMinor.toString()})`
    );
  }
  const postings: DraftLedgerPosting[] = [
    {
      accountCode: "STRIPE_CLEARING",
      amountMinor: releaseAmountMinor,
      currency,
    },
    {
      accountCode: "DISPUTE_RESERVE",
      amountMinor: -releaseAmountMinor,
      currency,
    },
  ];
  assertBalancedPostings(postings);
  return postings;
}

async function ensureStandardLedgerAccounts(
  tx: LedgerTxClient,
  codes: ReadonlyArray<StandardLedgerAccountCode>
): Promise<Map<StandardLedgerAccountCode, { id: string }>> {
  const uniqueCodes = Array.from(new Set(codes));
  const map = new Map<StandardLedgerAccountCode, { id: string }>();

  for (const code of uniqueCodes) {
    const spec = STANDARD_LEDGER_ACCOUNTS[code];
    const account = await tx.ledgerAccount.upsert({
      where: { code: spec.code },
      update: {},
      create: {
        code: spec.code,
        name: spec.name,
        type: spec.prismaType,
        ownerType: spec.ownerType,
        balanceMinor: 0n,
        currency: "USD",
      },
      select: { id: true },
    });
    map.set(code, account);
  }

  return map;
}

async function commitLedgerPostings(
  tx: LedgerTxClient,
  params: {
    type:
      | "ORDER_SALE"
      | "ORDER_REFUND"
      | "DISPUTE_HOLD"
      | "DISPUTE_RELEASE";
    description: string;
    referenceType: "ORDER" | "REFUND" | "DISPUTE";
    referenceId: string;
    currency: "USD";
    postings: DraftLedgerPosting[];
  }
) {
  assertBalancedPostings(params.postings);

  const accountsByCode = await ensureStandardLedgerAccounts(
    tx,
    params.postings.map((p) => p.accountCode)
  );

  const ledgerTx = await tx.ledgerTransaction.create({
    data: {
      type: params.type,
      description: params.description,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      currency: params.currency,
    },
  });

  for (const posting of params.postings) {
    const account = accountsByCode.get(posting.accountCode);
    if (!account) {
      throw new LedgerImbalanceError(
        `Missing upserted LedgerAccount for code ${posting.accountCode}`
      );
    }

    await tx.ledgerPosting.create({
      data: {
        transactionId: ledgerTx.id,
        accountId: account.id,
        amountMinor: posting.amountMinor,
        currency: posting.currency,
      },
    });

    await tx.ledgerAccount.update({
      where: { id: account.id },
      data: {
        balanceMinor: {
          increment: posting.amountMinor,
        },
      },
    });
  }

  return ledgerTx;
}

/**
 * Posts balanced double-entry sale entries for a settled Order inside an active Prisma $transaction.
 */
export async function postOrderSaleLedger(
  tx: LedgerTxClient,
  order: OrderLedgerInput,
  items: ReadonlyArray<OrderItemLedgerInput>
) {
  const postings = buildOrderSalePostings(order, items);
  return commitLedgerPostings(tx, {
    type: "ORDER_SALE",
    description: `Order ${order.orderNumber} payment settlement`,
    referenceType: "ORDER",
    referenceId: order.id,
    currency: "USD",
    postings,
  });
}

/**
 * Posts balanced double-entry reversal entries for an Order refund or lost dispute inside $transaction.
 */
export async function postOrderRefundLedger(
  tx: LedgerTxClient,
  order: OrderLedgerInput,
  refundAmountMinor: bigint,
  items: ReadonlyArray<OrderItemLedgerInput>,
  options?: RefundPostingOptions
) {
  const postings = buildOrderRefundPostings(
    order,
    refundAmountMinor,
    items,
    options
  );
  return commitLedgerPostings(tx, {
    type: "ORDER_REFUND",
    description: `Order ${order.orderNumber} refund/dispute reversal`,
    referenceType: "REFUND",
    referenceId: order.id,
    currency: "USD",
    postings,
  });
}

/**
 * Posts balanced DISPUTE_RESERVE hold when a charge dispute is created or funds withdrawn (R-103).
 */
export async function postOrderDisputeHoldLedger(
  tx: LedgerTxClient,
  order: OrderLedgerInput,
  holdAmountMinor: bigint,
  disputeId: string
) {
  const postings = buildOrderDisputeHoldPostings(order, holdAmountMinor);
  return commitLedgerPostings(tx, {
    type: "DISPUTE_HOLD",
    description: `Order ${order.orderNumber} dispute hold (${disputeId})`,
    referenceType: "DISPUTE",
    referenceId: disputeId,
    currency: "USD",
    postings,
  });
}

/**
 * Releases DISPUTE_RESERVE hold when a dispute is won, reinstated, or settled (R-103).
 */
export async function postOrderDisputeReleaseLedger(
  tx: LedgerTxClient,
  order: OrderLedgerInput,
  releaseAmountMinor: bigint,
  disputeId: string
) {
  const postings = buildOrderDisputeReleasePostings(order, releaseAmountMinor);
  return commitLedgerPostings(tx, {
    type: "DISPUTE_RELEASE",
    description: `Order ${order.orderNumber} dispute hold release (${disputeId})`,
    referenceType: "DISPUTE",
    referenceId: disputeId,
    currency: "USD",
    postings,
  });
}
