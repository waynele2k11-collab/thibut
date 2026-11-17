import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { sendDigitalDownloadEmail } from "@/lib/email";
import {
  postOrderRefundLedger,
  postOrderSaleLedger,
} from "@/lib/services/LedgerService";

class StripeWebhookValidationError extends Error {
  public readonly publicMessage: string;

  constructor(publicMessage: string, internalMessage?: string) {
    super(internalMessage ?? publicMessage);
    this.name = "StripeWebhookValidationError";
    this.publicMessage = publicMessage;
  }
}

const StripeEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

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
        shipping_details: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
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

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
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

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function handleCheckoutSessionCompleted(
  eventId: string,
  rawSession: Record<string, unknown>
): Promise<{
  orderId: string;
  orderNumber: string;
  buyerEmail: string | null;
  hasPhysicalItems: boolean;
  digitalItems: Array<{ orderItemId: string; productName: string }>;
}> {
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
    throw new StripeWebhookValidationError("Missing orderId in checkout session metadata");
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

  const paidAmountMinor = BigInt(session.amount_total ?? -1);
  if (paidAmountMinor !== order.totalMinor) {
    throw new StripeWebhookValidationError(
      "Order total mismatch",
      `Stripe amount_total (${paidAmountMinor.toString()}) !== order.totalMinor (${order.totalMinor.toString()})`
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

  const resolvedBuyerEmail = session.customer_details?.email ?? order.buyerEmail ?? null;
  const rawShipping =
    session.collected_information?.shipping_details ??
    session.customer_details?.address ??
    null;
  const resolvedShippingJson: Prisma.InputJsonValue | undefined = rawShipping
    ? toJsonValue(rawShipping)
    : order.shippingAddressJson !== null && order.shippingAddressJson !== undefined
      ? (order.shippingAddressJson as Prisma.InputJsonValue)
      : undefined;

  const providerPaymentId =
    extractExpandableId(session.payment_intent) ?? session.id;
  const providerChargeId = extractChargeIdFromPaymentIntent(session.payment_intent);

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

  await prisma.$transaction(async (tx) => {
    // Idempotent guard inside transaction if order was already settled
    if (order.status === "PAID" && order.paymentStatus === "SUCCEEDED") {
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
        amountMinor: order.totalMinor,
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
        allowDigitalDownload: resolvedOffer?.allowDigitalDownload ?? isItemDigital,
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
              variantLabelParts.length > 0 ? variantLabelParts.join(" / ") : null,
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
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerEmail: resolvedBuyerEmail,
    hasPhysicalItems,
    digitalItems,
  };
}

async function handleRefundOrDispute(
  eventId: string,
  eventType: "charge.refunded" | "charge.dispute.created" | "charge.dispute.closed",
  rawObject: Record<string, unknown>
): Promise<void> {
  let chargeId: string | null = null;
  let paymentIntentId: string | null = null;
  let providerRefundId: string;
  let refundAmountMinor: bigint;
  let reason: string | null = null;
  const isDispute = eventType !== "charge.refunded";

  if (eventType === "charge.refunded") {
    const parsed = ChargeRefundedSchema.safeParse(rawObject);
    if (!parsed.success) {
      throw new StripeWebhookValidationError(
        "Invalid charge.refunded payload",
        parsed.error.message
      );
    }
    const charge = parsed.data;
    chargeId = charge.id;
    paymentIntentId = extractExpandableId(charge.payment_intent);
    const latestRefund = charge.refunds?.data?.[0];
    providerRefundId =
      latestRefund?.id ?? `refund:${charge.id}:${charge.amount_refunded}`;
    refundAmountMinor = BigInt(latestRefund?.amount ?? charge.amount_refunded);
    reason = latestRefund?.reason ?? "requested_by_customer";
  } else {
    const parsed = DisputeSchema.safeParse(rawObject);
    if (!parsed.success) {
      throw new StripeWebhookValidationError(
        `Invalid ${eventType} payload`,
        parsed.error.message
      );
    }
    const dispute = parsed.data;

    // If a dispute closes in merchant's favor, mark webhook processed without reversing funds
    if (
      eventType === "charge.dispute.closed" &&
      (dispute.status === "won" || dispute.status === "warning_closed")
    ) {
      await prisma.webhookEvent.update({
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
      return;
    }

    chargeId = extractExpandableId(dispute.charge);
    paymentIntentId = extractExpandableId(dispute.payment_intent);
    providerRefundId = `dispute:${dispute.id}`;
    refundAmountMinor = BigInt(dispute.amount);
    reason = dispute.reason ?? eventType;
  }

  if (refundAmountMinor <= 0n) {
    throw new StripeWebhookValidationError("Refund amount must be positive");
  }

  const orConditions: Prisma.PaymentWhereInput[] = [];
  if (chargeId) {
    orConditions.push({ providerChargeId: chargeId });
  }
  if (paymentIntentId) {
    orConditions.push({ providerPaymentId: paymentIntentId });
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

  const order = payment.order;
  const clampedRefundMinor =
    refundAmountMinor > order.totalMinor ? order.totalMinor : refundAmountMinor;
  const orderItemIds = order.items.map((item) => item.id);

  await prisma.$transaction(async (tx) => {
    const existingRefund = await tx.refund.findUnique({
      where: { providerRefundId },
    });

    if (!existingRefund) {
      await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          providerRefundId,
          amountMinor: clampedRefundMinor,
          reason,
          status: "SUCCEEDED",
          processedAt: new Date(),
        },
      });

      if (orderItemIds.length > 0) {
        await tx.creatorEarning.updateMany({
          where: { orderItemId: { in: orderItemIds } },
          data: { status: "REVERSED" },
        });

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
          status: isDispute ? "DISPUTED" : "REFUNDED",
          ...(chargeId && !payment.providerChargeId
            ? { providerChargeId: chargeId }
            : {}),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
          paymentStatus: isDispute ? "DISPUTED" : "REFUNDED",
        },
      });

      await postOrderRefundLedger(tx, order, clampedRefundMinor, order.items);
    }

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
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Webhook configuration error" }, { status: 500 });
  }

  let constructedEvent: Stripe.Event;
  try {
    constructedEvent = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const envelopeParsed = StripeEventEnvelopeSchema.safeParse(constructedEvent);
  if (!envelopeParsed.success) {
    return Response.json({ error: "Invalid Stripe event structure" }, { status: 400 });
  }
  const event = envelopeParsed.data;

  let payloadJson: Prisma.InputJsonValue;
  try {
    payloadJson = JSON.parse(body) as Prisma.InputJsonValue;
  } catch {
    payloadJson = toJsonValue(constructedEvent);
  }

  // Race-free idempotency (INV-007): insert PROCESSING first; handle P2002 explicitly
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "STRIPE",
        externalEventId: event.id,
        eventType: event.type,
        payloadJson,
        status: "PROCESSING",
      },
    });
  } catch (err: unknown) {
    if (!isPrismaUniqueConstraintError(err)) {
      console.error("[Stripe Webhook] Failed to record WebhookEvent:", err);
      return Response.json({ error: "Webhook persistence error" }, { status: 500 });
    }

    const existing = await prisma.webhookEvent.findUnique({
      where: {
        provider_externalEventId: {
          provider: "STRIPE",
          externalEventId: event.id,
        },
      },
    });

    if (existing?.status === "PROCESSED") {
      return Response.json({ received: true }, { status: 200 });
    }

    if (existing?.status === "FAILED" || existing?.status === "PENDING") {
      await prisma.webhookEvent.update({
        where: {
          provider_externalEventId: {
            provider: "STRIPE",
            externalEventId: event.id,
          },
        },
        data: {
          status: "PROCESSING",
        },
      });
    } else {
      return Response.json({ received: true, inProgress: true }, { status: 409 });
    }
  }

  try {
    if (event.type === "checkout.session.completed") {
      const postCommitEffects = await handleCheckoutSessionCompleted(
        event.id,
        event.data.object
      );

      // Post-commit side effects ONLY after DB transaction succeeds
      if (postCommitEffects.buyerEmail && postCommitEffects.digitalItems.length > 0) {
        for (const item of postCommitEffects.digitalItems) {
          try {
            await sendDigitalDownloadEmail({
              email: postCommitEffects.buyerEmail,
              orderNumber: postCommitEffects.orderNumber,
              orderId: postCommitEffects.orderId,
              orderItemId: item.orderItemId,
              productName: item.productName,
            });
          } catch (emailErr: unknown) {
            console.error(
              `[Stripe Webhook] Digital download email dispatch failed for item ${item.orderItemId}:`,
              emailErr
            );
          }
        }
      }

      if (postCommitEffects.hasPhysicalItems) {
        const { inngest } = await import("@/lib/inngest");
        await inngest.send({
          name: "order/placed",
          data: { orderId: postCommitEffects.orderId },
        });
      }
    } else if (
      event.type === "charge.refunded" ||
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.closed"
    ) {
      await handleRefundOrDispute(event.id, event.type, event.data.object);
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

    return Response.json({ received: true }, { status: 200 });
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
        console.error("[Stripe Webhook] Failed to mark event FAILED:", updateErr);
      });

    if (err instanceof StripeWebhookValidationError) {
      return Response.json({ error: err.publicMessage }, { status: 400 });
    }

    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
