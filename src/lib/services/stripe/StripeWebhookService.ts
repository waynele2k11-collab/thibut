import "server-only";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { z } from "zod";
import { sendDigitalDownloadEmail } from "@/lib/email";
import prisma from "@/lib/prisma";
import {
  postOrderDisputeHoldLedger,
  postOrderDisputeReleaseLedger,
  postOrderRefundLedger,
  postOrderSaleLedger,
} from "@/lib/services/LedgerService";
import { claimWebhookEventLease } from "@/lib/services/stripe/webhookLease";

export const QUOTE_SETTLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export class StripeWebhookValidationError extends Error {
  public readonly publicMessage: string;

  constructor(publicMessage: string, internalMessage?: string) {
    super(internalMessage ?? publicMessage);
    this.name = "StripeWebhookValidationError";
    this.publicMessage = publicMessage;
  }
}

export const StripeEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export type StripeEventEnvelope = z.infer<typeof StripeEventEnvelopeSchema>;

const ExpandableIdSchema = z.union([
  z.string().min(1),
  z
    .object({
      id: z.string().min(1),
      latest_charge: z
        .union([z.string().min(1), z.object({ id: z.string().min(1) })])
        .nullable()
        .optional(),
    })
    .passthrough(),
]);

const CheckoutSessionCompletedSchema = z
  .object({
    id: z.string().min(1),
    payment_status: z.string(),
    amount_total: z.number().int().nullable().optional(),
    currency: z.string().nullable().optional(),
    payment_intent: ExpandableIdSchema.nullable().optional(),
    metadata: z.record(z.string(), z.string().optional()).nullable().optional(),
    total_details: z
      .object({
        amount_tax: z.number().int().nonnegative().nullable().optional(),
        amount_shipping: z.number().int().nonnegative().nullable().optional(),
        amount_discount: z.number().int().nonnegative().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    customer_details: z
      .object({
        email: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        address: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    collected_information: z
      .object({
        shipping_details: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const CheckoutSessionExpiredOrFailedSchema = z
  .object({
    id: z.string().min(1),
    metadata: z.record(z.string(), z.string().optional()).nullable().optional(),
  })
  .passthrough();

const ChargeRefundedSchema = z
  .object({
    id: z.string().min(1),
    amount: z.number().int().nonnegative(),
    amount_refunded: z.number().int().nonnegative(),
    currency: z.string().optional(),
    payment_intent: ExpandableIdSchema.nullable().optional(),
    refunds: z
      .object({
        data: z.array(
          z
            .object({
              id: z.string().min(1),
              amount: z.number().int().nonnegative(),
              reason: z.string().nullable().optional(),
              created: z.number().int().optional(),
            })
            .passthrough()
        ),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const DisputeSchema = z
  .object({
    id: z.string().min(1),
    amount: z.number().int().nonnegative(),
    currency: z.string().optional(),
    status: z.string(),
    reason: z.string().nullable().optional(),
    charge: ExpandableIdSchema.nullable().optional(),
    payment_intent: ExpandableIdSchema.nullable().optional(),
  })
  .passthrough();

type DisputeEventType =
  | "charge.dispute.created"
  | "charge.dispute.funds_withdrawn"
  | "charge.dispute.funds_reinstated"
  | "charge.dispute.closed";

interface PostCommitOrderEffects {
  didSettle: boolean;
  orderId: string;
  orderNumber: string;
  buyerEmail: string | null;
  hasPhysicalItems: boolean;
  digitalItems: Array<{ orderItemId: string; productName: string }>;
}

function extractExpandableId(
  value: z.infer<typeof ExpandableIdSchema> | null | undefined
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id;
}

function extractChargeIdFromPaymentIntent(
  value: z.infer<typeof ExpandableIdSchema> | null | undefined
): string | null {
  if (!value || typeof value === "string") return null;
  const lc = value.latest_charge;
  if (!lc) return null;
  return typeof lc === "string" ? lc : lc.id;
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function markStripeWebhookProcessed(
  tx: Pick<Prisma.TransactionClient, "webhookEvent">,
  eventId: string
): Promise<void> {
  await tx.webhookEvent.update({
    where: {
      provider_externalEventId: {
        provider: "STRIPE",
        externalEventId: eventId,
      },
    },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });
}

async function unlockAbandonedCheckoutResources(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    sessionIds: string[];
    metadataCartId?: string | null;
  }
): Promise<void> {
  await tx.order.update({
    where: { id: params.orderId },
    data: {
      status: "CANCELLED",
      paymentStatus: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  if (params.sessionIds.length > 0) {
    for (const sessionId of params.sessionIds) {
      await tx.personalizationSession.updateMany({
        where: { id: sessionId },
        data: { status: "SELECTED" },
      });
    }
  }

  const cartIds = new Set<string>();
  if (params.metadataCartId && params.metadataCartId.trim().length > 0) {
    cartIds.add(params.metadataCartId.trim());
  }

  const quoteDelegate = tx.priceQuote as unknown as { findFirst?: unknown };
  if (typeof quoteDelegate?.findFirst === "function") {
    const linkedQuote = await tx.priceQuote.findFirst({
      where: { orderId: params.orderId },
      orderBy: { createdAt: "desc" },
    });
    if (linkedQuote?.cartId) {
      cartIds.add(linkedQuote.cartId);
    }
  }

  const cartDelegate = tx.cart as unknown as {
    updateMany?: unknown;
    update?: unknown;
  };
  if (cartIds.size > 0) {
    if (typeof cartDelegate?.updateMany === "function") {
      await tx.cart.updateMany({
        where: {
          id: { in: Array.from(cartIds) },
          status: "CHECKOUT",
        },
        data: { status: "ACTIVE" },
      });
    } else if (typeof cartDelegate?.update === "function") {
      for (const cartId of cartIds) {
        await tx.cart
          .update({
            where: { id: cartId },
            data: { status: "ACTIVE" },
          })
          .catch(() => undefined);
      }
    }
  }
}

async function loadAlreadyRefundedMinor(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<bigint> {
  const refundDelegate = tx.refund as unknown as { findMany?: unknown };
  if (typeof refundDelegate.findMany !== "function") {
    return 0n;
  }
  const existingRows = await tx.refund.findMany({
    where: { orderId },
  });
  let sum = 0n;
  for (const row of existingRows) {
    if (row.status === "SUCCEEDED") {
      sum += row.amountMinor;
    }
  }
  return sum;
}

async function adjustCreatorEarningsProRata(
  tx: Prisma.TransactionClient,
  params: {
    orderItemIds: string[];
    orderTotalMinor: bigint;
    cumulativeRefundedMinor: bigint;
  }
): Promise<void> {
  if (params.orderItemIds.length === 0 || params.orderTotalMinor <= 0n) {
    return;
  }
  const earningDelegate = tx.creatorEarning as unknown as {
    findMany?: unknown;
    update?: unknown;
  };
  if (
    typeof earningDelegate.findMany === "function" &&
    typeof earningDelegate.update === "function"
  ) {
    const earnings = await tx.creatorEarning.findMany({
      where: { orderItemId: { in: params.orderItemIds } },
    });
    for (const earning of earnings) {
      if (earning.status === "REVERSED" || earning.status === "TRANSFERRED") {
        continue;
      }
      const adjustmentMinor = -(
        (earning.grossLicenseMinor * params.cumulativeRefundedMinor) /
        params.orderTotalMinor
      );
      const rawNet = earning.grossLicenseMinor + adjustmentMinor;
      const netCreatorMinor = rawNet > 0n ? rawNet : 0n;
      await tx.creatorEarning.update({
        where: { id: earning.id },
        data: {
          adjustmentMinor,
          netCreatorMinor,
        },
      });
    }
  }
}

async function reverseAllCreatorEarnings(
  tx: Prisma.TransactionClient,
  orderItemIds: string[]
): Promise<void> {
  if (orderItemIds.length === 0) {
    return;
  }
  const earningDelegate = tx.creatorEarning as unknown as {
    findMany?: unknown;
    update?: unknown;
  };
  if (
    typeof earningDelegate.findMany === "function" &&
    typeof earningDelegate.update === "function"
  ) {
    const earnings = await tx.creatorEarning.findMany({
      where: { orderItemId: { in: orderItemIds } },
    });
    for (const earning of earnings) {
      await tx.creatorEarning.update({
        where: { id: earning.id },
        data: {
          status: "REVERSED",
          adjustmentMinor: -earning.grossLicenseMinor,
          netCreatorMinor: 0n,
        },
      });
    }
  } else {
    await tx.creatorEarning.updateMany({
      where: { orderItemId: { in: orderItemIds } },
      data: { status: "REVERSED", netCreatorMinor: 0n },
    });
  }
}

async function handleCheckoutSessionCompleted(
  eventId: string,
  rawSession: Record<string, unknown>
): Promise<PostCommitOrderEffects> {
  const parsed = CheckoutSessionCompletedSchema.safeParse(rawSession);
  if (!parsed.success) {
    throw new StripeWebhookValidationError(
      "Invalid checkout.session.completed payload",
      parsed.error.message
    );
  }
  const session = parsed.data;

  if (session.payment_status !== "paid") {
    throw new StripeWebhookValidationError(
      "Checkout session is not paid",
      `Expected payment_status="paid", received "${session.payment_status}"`
    );
  }

  const metadataOrderId = session.metadata?.orderId?.trim();
  if (!metadataOrderId) {
    throw new StripeWebhookValidationError(
      "Missing orderId in checkout session metadata"
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: metadataOrderId },
    include: {
      items: {
        include: {
          catalogVariant: {
            include: { product: true },
          },
          personalizationVersion: true,
          licenseGrant: true,
          earning: true,
          snapshot: true,
        },
      },
    },
  });

  if (!order) {
    throw new StripeWebhookValidationError(
      "Referenced order not found",
      `Order not found for id=${metadataOrderId}`
    );
  }

  const sessionCurrency = (session.currency ?? "").trim().toUpperCase();
  const orderCurrency = order.currency.trim().toUpperCase();
  if (sessionCurrency !== "USD" || orderCurrency !== "USD") {
    throw new StripeWebhookValidationError(
      "Order currency mismatch",
      `Currency mismatch: session=${sessionCurrency}, order=${orderCurrency}`
    );
  }

  // R-205: Enforce PriceQuote.expiresAt (> 24h past expiry rejects settlement & cancels order)
  const quoteDelegate = prisma.priceQuote as unknown as { findFirst?: unknown };
  let linkedQuote: { id: string; cartId: string | null; expiresAt: Date } | null =
    null;
  if (typeof quoteDelegate?.findFirst === "function") {
    linkedQuote = await prisma.priceQuote.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, cartId: true, expiresAt: true },
    });

    if (
      linkedQuote &&
      order.status === "PENDING_PAYMENT" &&
      linkedQuote.expiresAt.getTime() + QUOTE_SETTLEMENT_GRACE_MS < Date.now()
    ) {
      const sessionIds = Array.from(
        new Set(
          [
            session.metadata?.personalizationSessionId,
            ...order.items.map((i) => i.personalizationVersion?.sessionId),
          ].filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      await prisma.$transaction(async (tx) => {
        await unlockAbandonedCheckoutResources(tx, {
          orderId: order.id,
          sessionIds,
          metadataCartId: session.metadata?.cartId ?? linkedQuote?.cartId,
        });
      });

      throw new StripeWebhookValidationError(
        "Order price quote has expired",
        `Quote ${linkedQuote.id} expired >24h before settlement`
      );
    }
  }

  // R-202: Reconcile optional Stripe Tax + Shipping total_details while rejecting tampered totals
  const reportedTaxMinor =
    session.total_details?.amount_tax !== null &&
    session.total_details?.amount_tax !== undefined
      ? BigInt(session.total_details.amount_tax)
      : order.taxMinor;
  const reportedShippingMinor =
    session.total_details?.amount_shipping !== null &&
    session.total_details?.amount_shipping !== undefined
      ? BigInt(session.total_details.amount_shipping)
      : order.shippingMinor;

  if (reportedShippingMinor < order.shippingMinor || reportedTaxMinor < 0n) {
    throw new StripeWebhookValidationError(
      "Order total mismatch",
      "Reported shipping or tax is below authoritative quote floor"
    );
  }

  const expectedTotalMinor =
    order.subtotalMinor -
    order.discountMinor +
    reportedShippingMinor +
    reportedTaxMinor;
  const paidAmountMinor = BigInt(session.amount_total ?? -1);

  if (paidAmountMinor !== expectedTotalMinor) {
    throw new StripeWebhookValidationError(
      "Order total mismatch",
      `Stripe amount_total (${paidAmountMinor.toString()}) !== expectedTotalMinor (${expectedTotalMinor.toString()})`
    );
  }

  const designIds = Array.from(
    new Set(order.items.map((i) => i.designId).filter((id) => id.length > 0))
  );
  const licenseOfferIds = Array.from(
    new Set(
      order.items
        .map((i) => i.licenseOfferId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const [designs, explicitOffers] = await Promise.all([
    designIds.length > 0
      ? prisma.design.findMany({
          where: { id: { in: designIds } },
          include: {
            creator: true,
            policyVersions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
            },
            licenses: {
              where: { active: true },
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : Promise.resolve([]),
    licenseOfferIds.length > 0
      ? prisma.licenseOffer.findMany({
          where: { id: { in: licenseOfferIds } },
        })
      : Promise.resolve([]),
  ]);

  const designById = new Map(designs.map((d) => [d.id, d]));
  const offerById = new Map(explicitOffers.map((o) => [o.id, o]));

  const resolvedBuyerEmail =
    session.customer_details?.email ?? order.buyerEmail ?? null;
  const rawShipping =
    session.collected_information?.shipping_details ??
    session.customer_details?.address ??
    null;
  const resolvedShippingJson: Prisma.InputJsonValue | undefined = rawShipping
    ? toJsonValue(rawShipping)
    : order.shippingAddressJson !== null &&
        order.shippingAddressJson !== undefined
      ? (order.shippingAddressJson as Prisma.InputJsonValue)
      : undefined;

  const providerPaymentId =
    extractExpandableId(session.payment_intent) ?? session.id;
  const providerChargeId = extractChargeIdFromPaymentIntent(
    session.payment_intent
  );

  const metadataIsDigital = session.metadata?.isDigital === "true";
  const digitalItems: Array<{ orderItemId: string; productName: string }> = [];
  let hasPhysicalItems = false;

  for (const item of order.items) {
    const isItemDigital =
      metadataIsDigital || (!item.catalogVariantId && !item.catalogProductId);
    if (isItemDigital) {
      const design = designById.get(item.designId);
      digitalItems.push({
        orderItemId: item.id,
        productName:
          session.metadata?.productName ||
          design?.title ||
          "Thi Bút Digital Artwork",
      });
    } else {
      hasPhysicalItems = true;
    }
  }

  let didSettle = false;

  await prisma.$transaction(async (tx) => {
    if (order.status === "PAID" && order.paymentStatus === "SUCCEEDED") {
      await markStripeWebhookProcessed(tx, eventId);
      return;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "SUCCEEDED",
        placedAt: new Date(),
        currency: "USD",
        buyerEmail: resolvedBuyerEmail,
        shippingMinor: reportedShippingMinor,
        taxMinor: reportedTaxMinor,
        totalMinor: expectedTotalMinor,
        ...(resolvedShippingJson !== undefined
          ? { shippingAddressJson: resolvedShippingJson }
          : {}),
      },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: "stripe",
        providerPaymentId,
        ...(providerChargeId ? { providerChargeId } : {}),
        amountMinor: expectedTotalMinor,
        currency: "USD",
        status: "SUCCEEDED",
        capturedAt: new Date(),
      },
    });

    for (const item of order.items) {
      const design = designById.get(item.designId);
      const latestPolicy = design?.policyVersions?.[0] ?? null;
      const isItemDigital =
        metadataIsDigital || (!item.catalogVariantId && !item.catalogProductId);

      let resolvedOffer =
        (item.licenseOfferId ? offerById.get(item.licenseOfferId) : undefined) ??
        design?.licenses?.[0] ??
        null;

      if (!resolvedOffer && design) {
        resolvedOffer = await tx.licenseOffer.create({
          data: {
            designId: design.id,
            type: isItemDigital ? "PERSONAL_DIGITAL" : "PERSONAL_PRODUCT",
            priceMinor: item.creatorRoyaltyMinor,
            currency: "USD",
            active: true,
            allowDigitalDownload: isItemDigital,
            allowResale: false,
            allowCommercialUse: false,
          },
        });
      }

      const frozenPermissions = {
        allowName: latestPolicy?.allowName ?? true,
        allowQuote: latestPolicy?.allowQuote ?? true,
        allowTranslation: latestPolicy?.allowTranslation ?? true,
        allowCalligraphy: latestPolicy?.allowCalligraphy ?? true,
        allowAIRestyle: latestPolicy?.allowAIRestyle ?? false,
        allowCommercial: Boolean(
          (resolvedOffer?.allowCommercialUse ?? false) &&
            (latestPolicy?.allowCommercialUse ?? false)
        ),
        allowModelTraining: false as const, // INV-010: strictly FALSE
      };

      const frozenLicenseTerms = {
        licenseOfferId: resolvedOffer?.id ?? null,
        licenseType:
          resolvedOffer?.type ??
          (isItemDigital ? "PERSONAL_DIGITAL" : "PERSONAL_PRODUCT"),
        termsVersion: resolvedOffer?.termsVersion ?? 1,
        allowDigitalDownload:
          resolvedOffer?.allowDigitalDownload ?? isItemDigital,
        allowResale: resolvedOffer?.allowResale ?? false,
        allowCommercialUse: frozenPermissions.allowCommercial,
        allowModelTraining: false,
        priceMinor: item.creatorRoyaltyMinor.toString(),
        currency: "USD",
      };

      if (!item.licenseGrant && resolvedOffer) {
        await tx.licenseGrant.create({
          data: {
            orderItemId: item.id,
            licenseOfferId: resolvedOffer.id,
            buyerId: order.buyerId ?? null,
            creatorId: item.creatorId,
            designId: item.designId,
            designVersionId: item.designVersionId,
            licenseType: resolvedOffer.type,
            priceMinor: item.creatorRoyaltyMinor,
            currency: "USD",
            allowName: frozenPermissions.allowName,
            allowQuote: frozenPermissions.allowQuote,
            allowTranslation: frozenPermissions.allowTranslation,
            allowCalligraphy: frozenPermissions.allowCalligraphy,
            allowAIRestyle: frozenPermissions.allowAIRestyle,
            allowCommercial: frozenPermissions.allowCommercial,
            allowModelTraining: false, // INV-010
            termsSnapshot: frozenLicenseTerms,
            permissionsSnapshot: frozenPermissions,
          },
        });
      }

      if (!item.snapshot) {
        const variant = item.catalogVariant;
        const variantLabelParts = [variant?.color, variant?.size].filter(
          (v): v is string => Boolean(v)
        );

        await tx.orderItemSnapshot.create({
          data: {
            orderItemId: item.id,
            designTitle: design?.title ?? "Thi Bút Custom Design",
            creatorName: design?.creator?.displayName ?? "Thi Bút Studio",
            productName:
              variant?.product?.name ??
              (isItemDigital ? "Digital Master Download" : null),
            variantName:
              variantLabelParts.length > 0
                ? variantLabelParts.join(" / ")
                : null,
            color: variant?.color ?? null,
            size: variant?.size ?? null,
            licenseTermsJson: frozenLicenseTerms,
            personalizationJson: item.personalizationVersion
              ? toJsonValue({
                  personalizationVersionId: item.personalizationVersion.id,
                  inputSnapshot: item.personalizationVersion.inputSnapshot,
                  interpretationSnapshot:
                    item.personalizationVersion.interpretationSnapshot,
                  styleSnapshot: item.personalizationVersion.styleSnapshot,
                })
              : undefined,
            printPlacementJson: {
              placement: item.placement,
            },
            pricingJson: {
              quantity: item.quantity,
              artworkRevenueMinor: item.artworkRevenueMinor.toString(),
              personalizationRevenueMinor:
                item.personalizationRevenueMinor.toString(),
              productRevenueMinor: item.productRevenueMinor.toString(),
              fulfillmentCostMinor: item.fulfillmentCostMinor.toString(),
              creatorRoyaltyMinor: item.creatorRoyaltyMinor.toString(),
              platformRevenueMinor: item.platformRevenueMinor.toString(),
              totalMinor: item.totalMinor.toString(),
              currency: "USD",
            },
          },
        });
      }

      if (!item.earning && item.creatorId) {
        await tx.creatorEarning.create({
          data: {
            creatorId: item.creatorId,
            orderItemId: item.id,
            status: "PENDING",
            grossLicenseMinor: item.creatorRoyaltyMinor,
            adjustmentMinor: 0n,
            netCreatorMinor: item.creatorRoyaltyMinor,
            currency: "USD",
          },
        });
      }
    }

    await postOrderSaleLedger(tx, updatedOrder, order.items);

    const metadataSessionId = session.metadata?.personalizationSessionId?.trim();
    if (metadataSessionId) {
      await tx.personalizationSession.updateMany({
        where: { id: metadataSessionId },
        data: { status: "CHECKED_OUT" },
      });
    }

    const cartIdToConvert =
      session.metadata?.cartId?.trim() ?? linkedQuote?.cartId ?? null;
    const cartDelegate = tx.cart as unknown as { updateMany?: unknown };
    if (cartIdToConvert && typeof cartDelegate?.updateMany === "function") {
      await tx.cart.updateMany({
        where: { id: cartIdToConvert },
        data: { status: "CONVERTED" },
      });
    }

    await markStripeWebhookProcessed(tx, eventId);
    didSettle = true;
  });

  return {
    didSettle,
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerEmail: resolvedBuyerEmail,
    hasPhysicalItems,
    digitalItems,
  };
}

async function runWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * R-203: Post-commit side effects MUST NEVER mark a committed PAID order's WebhookEvent as FAILED.
 */
async function dispatchPostCommitOrderEffects(
  effects: PostCommitOrderEffects
): Promise<void> {
  if (!effects.didSettle) {
    return;
  }

  let inngestPaidDispatched = false;
  try {
    const { inngest } = await import("@/lib/inngest");
    if (effects.digitalItems.length > 0 && effects.buyerEmail) {
      await runWithRetry(() =>
        inngest.send({
          name: "order/paid",
          data: {
            orderId: effects.orderId,
            orderNumber: effects.orderNumber,
            buyerEmail: effects.buyerEmail,
            hasPhysicalItems: effects.hasPhysicalItems,
            digitalItems: effects.digitalItems,
          },
        })
      );
      inngestPaidDispatched = true;
    }

    if (effects.hasPhysicalItems) {
      await runWithRetry(() =>
        inngest.send({
          name: "order/placed",
          data: { orderId: effects.orderId },
        })
      );
    }
  } catch (inngestErr: unknown) {
    console.error(
      `[Stripe Webhook] Post-commit Inngest dispatch error for order ${effects.orderId} (order remains PAID):`,
      inngestErr
    );
  }

  // Direct email fallback if Inngest cloud event key is unconfigured or Inngest dispatch threw
  if (
    !inngestPaidDispatched &&
    effects.buyerEmail &&
    effects.digitalItems.length > 0
  ) {
    for (const item of effects.digitalItems) {
      try {
        await runWithRetry(() =>
          sendDigitalDownloadEmail({
            email: effects.buyerEmail!,
            orderNumber: effects.orderNumber,
            orderId: effects.orderId,
            orderItemId: item.orderItemId,
            productName: item.productName,
          })
        );
      } catch (emailErr: unknown) {
        console.error(
          `[Stripe Webhook] Fallback digital download email failed for item ${item.orderItemId}:`,
          emailErr
        );
      }
    }
  }
}

async function handleCheckoutSessionExpiredOrFailed(
  eventId: string,
  rawSession: Record<string, unknown>
): Promise<void> {
  const parsed = CheckoutSessionExpiredOrFailedSchema.safeParse(rawSession);
  if (!parsed.success) {
    throw new StripeWebhookValidationError(
      "Invalid checkout session expiration payload",
      parsed.error.message
    );
  }
  const session = parsed.data;
  const metadataOrderId = session.metadata?.orderId?.trim();

  let order = metadataOrderId
    ? await prisma.order.findUnique({
        where: { id: metadataOrderId },
        include: {
          items: {
            include: { personalizationVersion: true },
          },
        },
      })
    : null;

  const orderDelegate = prisma.order as unknown as { findFirst?: unknown };
  if (!order && typeof orderDelegate.findFirst === "function") {
    order = await prisma.order.findFirst({
      where: { stripeCheckoutSessionId: session.id },
      include: {
        items: {
          include: { personalizationVersion: true },
        },
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (order && order.status === "PENDING_PAYMENT") {
      const sessionIds = Array.from(
        new Set(
          [
            session.metadata?.personalizationSessionId,
            ...order.items.map((i) => i.personalizationVersion?.sessionId),
          ].filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      );

      await unlockAbandonedCheckoutResources(tx, {
        orderId: order.id,
        sessionIds,
        metadataCartId: session.metadata?.cartId ?? null,
      });
    }

    await markStripeWebhookProcessed(tx, eventId);
  });
}

async function locateOrderPayment(params: {
  chargeId: string | null;
  paymentIntentId: string | null;
}) {
  const orConditions: Prisma.PaymentWhereInput[] = [];
  if (params.chargeId) {
    orConditions.push({ providerChargeId: params.chargeId });
  }
  if (params.paymentIntentId) {
    orConditions.push({ providerPaymentId: params.paymentIntentId });
  }

  if (orConditions.length === 0) {
    throw new StripeWebhookValidationError(
      "Unable to locate payment reference on refund/dispute event"
    );
  }

  const payment = await prisma.payment.findFirst({
    where: { OR: orConditions },
    include: {
      order: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!payment || !payment.order) {
    throw new StripeWebhookValidationError(
      "Payment or Order not found for refund/dispute"
    );
  }

  return payment;
}

/**
 * R-102: Partial vs Full Refund processing across ALL entries in charge.refunds.data.
 */
async function handleChargeRefunded(
  eventId: string,
  rawObject: Record<string, unknown>
): Promise<void> {
  const parsed = ChargeRefundedSchema.safeParse(rawObject);
  if (!parsed.success) {
    throw new StripeWebhookValidationError(
      "Invalid charge.refunded payload",
      parsed.error.message
    );
  }
  const charge = parsed.data;
  const chargeId = charge.id;
  const paymentIntentId = extractExpandableId(charge.payment_intent);

  const rawEntries = charge.refunds?.data ?? [];
  const candidateRefunds: Array<{
    providerRefundId: string;
    amountMinor: bigint;
    reason: string;
    created: number;
  }> =
    rawEntries.length > 0
      ? [...rawEntries]
          .sort((a, b) => (a.created ?? 0) - (b.created ?? 0))
          .map((entry) => ({
            providerRefundId: entry.id,
            amountMinor: BigInt(entry.amount),
            reason: entry.reason ?? "requested_by_customer",
            created: entry.created ?? 0,
          }))
      : [
          {
            providerRefundId: `refund:${charge.id}:${charge.amount_refunded}`,
            amountMinor: BigInt(charge.amount_refunded),
            reason: "requested_by_customer",
            created: 0,
          },
        ];

  const positiveRefunds = candidateRefunds.filter((r) => r.amountMinor > 0n);
  if (positiveRefunds.length === 0) {
    throw new StripeWebhookValidationError("Refund amount must be positive");
  }

  const payment = await locateOrderPayment({ chargeId, paymentIntentId });
  const order = payment.order;
  const orderItemIds = order.items.map((item) => item.id);

  await prisma.$transaction(async (tx) => {
    const hasRefundFindMany =
      typeof (tx.refund as unknown as { findMany?: unknown }).findMany ===
      "function";
    let alreadyRefundedMinor = await loadAlreadyRefundedMinor(tx, order.id);
    let runningRefundedMinor = alreadyRefundedMinor;
    let newTotalDeltaMinor = 0n;

    for (const entry of positiveRefunds) {
      const existing = await tx.refund.findUnique({
        where: { providerRefundId: entry.providerRefundId },
      });
      if (existing) {
        if (!hasRefundFindMany) {
          alreadyRefundedMinor += existing.amountMinor;
          runningRefundedMinor += existing.amountMinor;
        }
        continue;
      }

      const remainingCapacity =
        order.totalMinor > runningRefundedMinor
          ? order.totalMinor - runningRefundedMinor
          : 0n;
      const clampedMinor =
        entry.amountMinor > remainingCapacity
          ? remainingCapacity
          : entry.amountMinor;

      await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          providerRefundId: entry.providerRefundId,
          amountMinor: clampedMinor,
          reason: entry.reason,
          status: "SUCCEEDED",
          processedAt: new Date(),
        },
      });

      runningRefundedMinor += clampedMinor;
      newTotalDeltaMinor += clampedMinor;
    }

    if (newTotalDeltaMinor > 0n) {
      const cumulativeRefundedMinor = alreadyRefundedMinor + newTotalDeltaMinor;
      const isFullRefund = cumulativeRefundedMinor >= order.totalMinor;

      if (isFullRefund) {
        await reverseAllCreatorEarnings(tx, orderItemIds);
        if (orderItemIds.length > 0) {
          await tx.licenseGrant.updateMany({
            where: {
              orderItemId: { in: orderItemIds },
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "REFUNDED",
            ...(chargeId && !payment.providerChargeId
              ? { providerChargeId: chargeId }
              : {}),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
          },
        });
      } else {
        await adjustCreatorEarningsProRata(tx, {
          orderItemIds,
          orderTotalMinor: order.totalMinor,
          cumulativeRefundedMinor,
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "PARTIALLY_REFUNDED",
            ...(chargeId && !payment.providerChargeId
              ? { providerChargeId: chargeId }
              : {}),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PARTIALLY_REFUNDED",
            paymentStatus: "PARTIALLY_REFUNDED",
          },
        });
      }

      await postOrderRefundLedger(
        tx,
        order,
        newTotalDeltaMinor,
        order.items,
        { alreadyRefundedMinor }
      );
    }

    await markStripeWebhookProcessed(tx, eventId);
  });
}

/**
 * R-103: Full Dispute Lifecycle (created, funds_withdrawn, funds_reinstated, closed won/lost).
 */
async function handleChargeDispute(
  eventId: string,
  eventType: DisputeEventType,
  rawObject: Record<string, unknown>
): Promise<void> {
  const parsed = DisputeSchema.safeParse(rawObject);
  if (!parsed.success) {
    throw new StripeWebhookValidationError(
      `Invalid ${eventType} payload`,
      parsed.error.message
    );
  }
  const dispute = parsed.data;
  const disputeAmountMinor = BigInt(dispute.amount);
  if (disputeAmountMinor <= 0n) {
    throw new StripeWebhookValidationError("Dispute amount must be positive");
  }

  const chargeId = extractExpandableId(dispute.charge);
  const paymentIntentId = extractExpandableId(dispute.payment_intent);
  const payment = await locateOrderPayment({ chargeId, paymentIntentId });
  const order = payment.order;
  const orderItemIds = order.items.map((item) => item.id);

  const holdKey = `dispute_hold:${dispute.id}`;
  const releaseKey = `dispute_release:${dispute.id}`;
  const lostKey = `dispute:${dispute.id}`;

  const isHoldEvent =
    eventType === "charge.dispute.created" ||
    eventType === "charge.dispute.funds_withdrawn";
  const isWonOrReinstated =
    eventType === "charge.dispute.funds_reinstated" ||
    (eventType === "charge.dispute.closed" &&
      (dispute.status === "won" || dispute.status === "warning_closed"));
  const isLost =
    eventType === "charge.dispute.closed" && dispute.status === "lost";

  await prisma.$transaction(async (tx) => {
    const alreadyRefundedMinor = await loadAlreadyRefundedMinor(tx, order.id);
    const existingHold = await tx.refund.findUnique({
      where: { providerRefundId: holdKey },
    });
    const existingRelease = await tx.refund.findUnique({
      where: { providerRefundId: releaseKey },
    });
    const existingLost = await tx.refund.findUnique({
      where: { providerRefundId: lostKey },
    });

    if (isHoldEvent) {
      if (!existingHold && !existingLost && order.status !== "REFUNDED") {
        const remainingCapacity =
          order.totalMinor > alreadyRefundedMinor
            ? order.totalMinor - alreadyRefundedMinor
            : 0n;
        const holdMinor =
          disputeAmountMinor > remainingCapacity
            ? remainingCapacity
            : disputeAmountMinor;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "DISPUTED",
            ...(chargeId && !payment.providerChargeId
              ? { providerChargeId: chargeId }
              : {}),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "DISPUTED",
          },
        });

        if (orderItemIds.length > 0) {
          await tx.creatorEarning.updateMany({
            where: {
              orderItemId: { in: orderItemIds },
            },
            data: { status: "HELD" },
          });
        }

        if (holdMinor > 0n) {
          await tx.refund.create({
            data: {
              orderId: order.id,
              paymentId: payment.id,
              providerRefundId: holdKey,
              amountMinor: holdMinor,
              reason: dispute.reason ?? eventType,
              status: "DISPUTE_HOLD",
              processedAt: new Date(),
            },
          });

          await postOrderDisputeHoldLedger(tx, order, holdMinor, dispute.id);
        }
      }
    } else if (isWonOrReinstated) {
      if (existingHold && !existingRelease && existingHold.amountMinor > 0n) {
        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            providerRefundId: releaseKey,
            amountMinor: existingHold.amountMinor,
            reason: dispute.reason ?? eventType,
            status: "DISPUTE_RELEASED",
            processedAt: new Date(),
          },
        });

        await postOrderDisputeReleaseLedger(
          tx,
          order,
          existingHold.amountMinor,
          dispute.id
        );
      }

      if (order.status !== "REFUNDED" && !existingLost) {
        const restoredPayStatus =
          order.status === "PARTIALLY_REFUNDED"
            ? "PARTIALLY_REFUNDED"
            : "SUCCEEDED";

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: restoredPayStatus },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: restoredPayStatus },
        });

        if (orderItemIds.length > 0) {
          await tx.creatorEarning.updateMany({
            where: { orderItemId: { in: orderItemIds } },
            data: { status: "PENDING" },
          });
        }
      }
    } else if (isLost) {
      if (!existingLost) {
        if (existingHold && !existingRelease && existingHold.amountMinor > 0n) {
          await tx.refund.create({
            data: {
              orderId: order.id,
              paymentId: payment.id,
              providerRefundId: releaseKey,
              amountMinor: existingHold.amountMinor,
              reason: "dispute_closed_lost_release_hold",
              status: "DISPUTE_RELEASED",
              processedAt: new Date(),
            },
          });

          await postOrderDisputeReleaseLedger(
            tx,
            order,
            existingHold.amountMinor,
            dispute.id
          );
        }

        const remainingCapacity =
          order.totalMinor > alreadyRefundedMinor
            ? order.totalMinor - alreadyRefundedMinor
            : 0n;
        const reversalDeltaMinor =
          disputeAmountMinor > remainingCapacity
            ? remainingCapacity
            : disputeAmountMinor;

        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            providerRefundId: lostKey,
            amountMinor: reversalDeltaMinor,
            reason: dispute.reason ?? eventType,
            status: "SUCCEEDED",
            processedAt: new Date(),
          },
        });

        await reverseAllCreatorEarnings(tx, orderItemIds);

        if (orderItemIds.length > 0) {
          await tx.licenseGrant.updateMany({
            where: {
              orderItemId: { in: orderItemIds },
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "REFUNDED",
            ...(chargeId && !payment.providerChargeId
              ? { providerChargeId: chargeId }
              : {}),
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
          },
        });

        if (reversalDeltaMinor > 0n) {
          await postOrderRefundLedger(
            tx,
            order,
            reversalDeltaMinor,
            order.items,
            { alreadyRefundedMinor }
          );
        }
      }
    }

    await markStripeWebhookProcessed(tx, eventId);
  });
}

export type StripeWebhookProcessOutcome =
  | { httpStatus: 200; body: { received: true } }
  | { httpStatus: 409; body: { received: true; inProgress: true } };

export async function processVerifiedStripeWebhook(
  constructedEvent: Stripe.Event,
  rawBody: string
): Promise<StripeWebhookProcessOutcome> {
  const envelopeParsed = StripeEventEnvelopeSchema.safeParse(constructedEvent);
  if (!envelopeParsed.success) {
    throw new StripeWebhookValidationError(
      "Invalid Stripe event structure",
      envelopeParsed.error.message
    );
  }
  const event = envelopeParsed.data;

  let payloadJson: Prisma.InputJsonValue;
  try {
    payloadJson = JSON.parse(rawBody) as Prisma.InputJsonValue;
  } catch {
    payloadJson = toJsonValue(constructedEvent);
  }

  const lease = await claimWebhookEventLease({
    provider: "STRIPE",
    externalEventId: event.id,
    eventType: event.type,
    payloadJson,
  });

  if (lease.outcome === "ALREADY_PROCESSED") {
    return { httpStatus: 200, body: { received: true } };
  }
  if (lease.outcome === "IN_PROGRESS") {
    return { httpStatus: 409, body: { received: true, inProgress: true } };
  }

  try {
    if (event.type === "checkout.session.completed") {
      const postCommitEffects = await handleCheckoutSessionCompleted(
        event.id,
        event.data.object
      );
      await dispatchPostCommitOrderEffects(postCommitEffects);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await handleCheckoutSessionExpiredOrFailed(event.id, event.data.object);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(event.id, event.data.object);
    } else if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.funds_withdrawn" ||
      event.type === "charge.dispute.funds_reinstated" ||
      event.type === "charge.dispute.closed"
    ) {
      await handleChargeDispute(event.id, event.type, event.data.object);
    } else {
      await prisma.webhookEvent.update({
        where: {
          provider_externalEventId: {
            provider: "STRIPE",
            externalEventId: event.id,
          },
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    }

    return { httpStatus: 200, body: { received: true } };
  } catch (err: unknown) {
    console.error(`[Stripe Webhook] Error processing event ${event.id}:`, err);

    await prisma.webhookEvent
      .update({
        where: {
          provider_externalEventId: {
            provider: "STRIPE",
            externalEventId: event.id,
          },
        },
        data: {
          status: "FAILED",
        },
      })
      .catch((updateErr: unknown) => {
        console.error(
          "[Stripe Webhook] Failed to mark event FAILED:",
          updateErr
        );
      });

    throw err;
  }
}
