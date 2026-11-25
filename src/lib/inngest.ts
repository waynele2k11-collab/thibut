/**
 * INNGEST CLIENT + DURABLE BACKGROUND PIPELINES (T-203, T-400, T-409)
 *
 * 1. `generatePersonalizationJob` (`"personalization/requested"`):
 *    - Enforces `PolicyGuard` (`allowAIRestyle`, `allowDerivative`, `INV-010`, `INV-012`) before any artwork derivative.
 *    - Renders calligraphy strictly via `CalligraphyService` (NEVER `visual-provider` raster text — `TB-CALLI-002`).
 * 2. `processOrderFulfillment` (`"order/placed"`):
 *    - Every physical item is made in-house (BRD v1.0 §10). There is no outside fulfilment provider.
 *    - Sends the order confirmation and moves the order to `IN_PRODUCTION`.
 *    - A physical item whose product is not `IN_HOUSE` is never treated as in-house and never
 *      skipped: the order is marked `FAILED` and the job fails (`OrderFulfillmentUnsupportedError`).
 */

import { Inngest, NonRetriableError } from "inngest";
import { z } from "zod";
import {
  culturalIntelligence,
  type CulturalAnalysisInput,
  type SupportedTargetLanguage,
} from "@/lib/ai/cultural-provider";
import { interpretationEngine } from "@/lib/ai/InterpretationEngine";
import { visualAI } from "@/lib/ai/visual-provider";
import { CalligraphyService } from "@/lib/calligraphy/CalligraphyService";
import {
  sendDigitalDownloadEmail,
  sendOrderConfirmationEmail,
  type DigitalDownloadEmailParams,
} from "@/lib/email";
import prisma from "@/lib/prisma";
import { CulturalKnowledgeService } from "@/lib/services/CulturalKnowledgeService";
import { PolicyGuard } from "@/lib/services/PolicyGuard";

export interface InngestStepRunner {
  run<T>(id: string, fn: () => Promise<T> | T): Promise<T>;
}

export class OrderFulfillmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderFulfillmentValidationError";
  }
}

/** The one sentence logged and thrown when an order holds a physical item that is not made in-house. */
export const UNSUPPORTED_FULFILMENT_MESSAGE =
  "Order has a physical item that is not made in-house. No outside fulfilment provider exists. The order was marked FAILED for a person to handle.";

/**
 * Thrown by `executeOrderFulfillmentJob` after it has marked the order `FAILED`. The message is
 * fixed text: it carries no customer data. Retrying cannot help, so the Inngest function turns
 * it into a `NonRetriableError`.
 */
export class OrderFulfillmentUnsupportedError extends Error {
  readonly orderId: string;
  readonly unsupportedItemCount: number;
  constructor(orderId: string, unsupportedItemCount: number) {
    super(UNSUPPORTED_FULFILMENT_MESSAGE);
    this.name = "OrderFulfillmentUnsupportedError";
    this.orderId = orderId;
    this.unsupportedItemCount = unsupportedItemCount;
  }
}

// ── Inngest client singleton ──────────────────────────────────────────────────
export const inngest = new Inngest({
  id: "thibut",
  ...(process.env.INNGEST_EVENT_KEY
    ? { eventKey: process.env.INNGEST_EVENT_KEY }
    : {}),
});

// ── Schemas ───────────────────────────────────────────────────────────────────

export const PersonalizationJobEventSchema = z.object({
  sessionId: z.string().uuid(),
  interpretationId: z.string().uuid().optional(),
  inputText: z.string().trim().min(1).max(500).optional(),
  targetLanguage: z
    .enum(["Vietnamese", "Japanese", "Chinese", "Korean"])
    .optional(),
  mode: z.enum(["NAME", "QUOTE", "STORY", "CREATOR_ART"]).optional(),
  designId: z.string().uuid().optional(),
  stylePack: z.string().trim().min(1).max(80),
  composition: z.string().trim().min(1).max(60),
  creatorArtworkUrl: z.string().url().optional(),
  aiRestyle: z.boolean().optional(),
});

export type PersonalizationRequestedPayload = z.infer<
  typeof PersonalizationJobEventSchema
>;

export const OrderPlacedEventSchema = z.object({
  orderId: z.string().trim().min(1),
});

export const OrderPaidEventSchema = z.object({
  orderId: z.string().trim().min(1),
  orderNumber: z.string().trim().min(1),
  buyerEmail: z.string().email().nullable().optional(),
  hasPhysicalItems: z.boolean().default(false),
  digitalItems: z
    .array(
      z.object({
        orderItemId: z.string().trim().min(1),
        productName: z.string().trim().min(1),
      })
    )
    .default([]),
});

export type OrderPaidEventPayload = z.infer<typeof OrderPaidEventSchema>;

// ── 1. Personalization Job Handler (T-400, T-409) ────────────────────────────

export async function executeGeneratePersonalizationJob(params: {
  event: { data: unknown };
  step: InngestStepRunner;
}) {
  const payload = PersonalizationJobEventSchema.parse(params.event.data);
  const { step } = params;

  const resolvedContext = await step.run(
    "resolve-authoritative-interpretation",
    async () => {
      const session = await prisma.personalizationSession.findUnique({
        where: { id: payload.sessionId },
      });

      const effectiveDesignId = payload.designId ?? session?.designId ?? null;
      const effectiveMode = payload.mode ?? session?.mode ?? "QUOTE";
      const wantsRestyle = Boolean(
        payload.aiRestyle || payload.creatorArtworkUrl
      );

      // Enforce creator policy BEFORE any restyling or calligraphy rendering (T-409, INV-010, INV-012)
      await PolicyGuard.enforcePersonalizationContext({
        designId: effectiveDesignId,
        mode: effectiveMode,
        textTreatment: session?.textTreatment ?? undefined,
        hasCalligraphy: true,
        aiRestyle: wantsRestyle,
        derivative: wantsRestyle,
      });

      if (payload.interpretationId) {
        const interp = await prisma.interpretation.findUnique({
          where: { id: payload.interpretationId },
        });
        if (!interp || interp.sessionId !== payload.sessionId) {
          throw new Error(
            "Authoritative interpretation not found for session"
          );
        }

        const rawSourceText = session?.inputText ?? interp.text;
        const existingPk = await prisma.phraseKnowledge.findFirst({
          where: {
            normalizedInput:
              CulturalKnowledgeService.normalizeInput(rawSourceText),
            targetLanguage: interp.language,
            interpretationType: interp.type,
            renderedText: interp.text,
          },
          select: { id: true },
        });

        return {
          effectiveDesignId,
          interpretationId: interp.id,
          phraseKnowledgeId: existingPk?.id ?? interp.id,
          authoritativeText: interp.text,
          targetLanguage: interp.language,
        };
      }

      const rawInputText = payload.inputText ?? session?.inputText;
      const targetLanguage: SupportedTargetLanguage =
        payload.targetLanguage ??
        ((session?.targetLanguage as SupportedTargetLanguage | null) ||
          "Japanese");

      if (!rawInputText) {
        throw new Error(
          "Personalization job requires either interpretationId or inputText"
        );
      }

      const analysisInput: CulturalAnalysisInput = {
        inputText: rawInputText,
        targetLanguage,
        mode: effectiveMode,
      };

      const analysis = await culturalIntelligence.analyze(analysisInput);
      const primary =
        analysis.interpretations.find((i) => i.recommended) ??
        analysis.interpretations[0];

      const classifiedType = interpretationEngine.classifyInput(rawInputText);
      const storedPk = await CulturalKnowledgeService.storeGenerated({
        rawInput: rawInputText,
        inputType: classifiedType,
        sourceLanguage: analysis.inputAnalysis.detectedLanguage,
        targetLanguage: primary.language,
        interpretationType: primary.type,
        renderedText: primary.text,
        romanization: primary.romanization,
        meaning: primary.meaning,
        explanation: primary.warning,
        confidence: primary.confidence,
        verificationStatus: "GENERATED",
        source: "AI",
      });

      return {
        effectiveDesignId,
        interpretationId: null as string | null,
        phraseKnowledgeId: storedPk.id,
        authoritativeText: primary.text,
        targetLanguage: primary.language,
      };
    }
  );

  let creatorDerivativeUrl: string | null = null;
  if (payload.creatorArtworkUrl) {
    const derivative = await step.run("restyle-creator-artwork", async () => {
      if (!resolvedContext.effectiveDesignId) {
        await PolicyGuard.assertPermission(null, "allowAIRestyle");
      }
      return visualAI.generateCreatorArtworkDerivative({
        designId: resolvedContext.effectiveDesignId ?? "",
        creatorArtworkUrl: payload.creatorArtworkUrl!,
        styleTheme: payload.stylePack,
      });
    });
    creatorDerivativeUrl = derivative.imageUrl;
  }

  // Generate calligraphy candidates strictly via CalligraphyService (T-400, TB-CALLI-002)
  const renderResult = await step.run(
    "render-calligraphy-candidates",
    async () => {
      return CalligraphyService.renderCalligraphy({
        phraseKnowledgeId: resolvedContext.phraseKnowledgeId,
        authoritativeText: resolvedContext.authoritativeText,
        targetLanguage: resolvedContext.targetLanguage,
        stylePackId: payload.stylePack,
        orientationPreference:
          payload.composition === "Vertical" ? "VERTICAL" : "HORIZONTAL",
        variationCount: 6,
      });
    }
  );

  await step.run("store-personalization-results", async () => {
    await prisma.personalizationSession.update({
      where: { id: payload.sessionId },
      data: {
        status: "READY",
        ...(resolvedContext.interpretationId
          ? { selectedInterpretationId: resolvedContext.interpretationId }
          : {}),
      },
    });
    return { sessionId: payload.sessionId, status: "READY" as const };
  });

  return {
    sessionId: payload.sessionId,
    status: "READY" as const,
    rendererVersion: renderResult.rendererVersion,
    script: renderResult.script,
    creatorDerivativeUrl,
    candidates: renderResult.candidates.map((c, index) => ({
      id: c.id,
      index: index + 1,
      imageUrl: c.previewAssetUrl,
      stylePack: c.stylePackId,
      variationType: c.variationType,
      variationName: c.variationName,
      provider: c.provider,
      seed: c.seed,
      validationStatus: c.validationStatus,
    })),
  };
}

export const generatePersonalizationJob = inngest.createFunction(
  {
    id: "personalization-pipeline",
    name: "Personalization Pipeline",
    triggers: [{ event: "personalization/requested" }],
  },
  async ({ event, step }) =>
    executeGeneratePersonalizationJob({
      event: { data: event.data },
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// Backwards-compatible alias
export const personalizationPipeline = generatePersonalizationJob;

export async function triggerPersonalizationPipeline(
  data: PersonalizationRequestedPayload
): Promise<string> {
  const validated = PersonalizationJobEventSchema.parse(data);
  const result = await inngest.send({
    name: "personalization/requested",
    data: validated,
  });
  return (result as { ids?: string[] }).ids?.[0] ?? "queued";
}

// ── 2. Order Fulfillment Pipeline (T-203) ────────────────────────────────────

export async function executeOrderFulfillmentJob(params: {
  event: { data: unknown };
  step: InngestStepRunner;
}) {
  const { orderId } = OrderPlacedEventSchema.parse(params.event.data);
  const { step } = params;

  // Step 1: Load the order with its buyer and each item's product
  const order = await step.run("fetch-order", async () => {
    const found = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        items: {
          include: {
            catalogVariant: {
              include: {
                product: true,
              },
            },
            snapshot: true,
          },
        },
      },
    });

    if (!found) {
      throw new Error(`Order ${orderId} not found`);
    }
    return found;
  });

  if (order.fulfillmentStatus !== "PENDING") {
    return {
      skipped: true as const,
      reason: "Order not in PENDING state",
      providerOrderId: order.externalFulfillmentId ?? null,
    };
  }

  if (order.items.length === 0) {
    throw new OrderFulfillmentValidationError(
      `Order ${order.id} has no items to fulfill`
    );
  }

  // A digital item has neither a product nor a variant; the "order/paid" job delivers it.
  // Everything else is a physical item and must be made in-house (BRD v1.0 §10).
  const physicalItems = order.items.filter(
    (item) => Boolean(item.catalogVariantId) || Boolean(item.catalogProductId)
  );
  if (physicalItems.length === 0) {
    return {
      skipped: true as const,
      reason: "Order has no physical items",
      providerOrderId: order.externalFulfillmentId ?? null,
    };
  }

  const inHouseItems = physicalItems.filter(
    (item) => item.catalogVariant?.product?.fulfillmentMode === "IN_HOUSE"
  );
  const unsupportedItems = physicalItems.filter(
    (item) => item.catalogVariant?.product?.fulfillmentMode !== "IN_HOUSE"
  );

  // Never treat an unknown item as in-house and never skip it: fail the whole order, visibly.
  if (unsupportedItems.length > 0) {
    await step.run("mark-order-unfulfillable", async () => {
      await prisma.order.update({
        where: { id: order.id },
        data: { fulfillmentStatus: "FAILED" },
      });
      return { fulfillmentStatus: "FAILED" as const };
    });
    console.error(`[Order Fulfilment] ${UNSUPPORTED_FULFILMENT_MESSAGE}`, {
      orderId: order.id,
      unsupportedItemCount: unsupportedItems.length,
    });
    throw new OrderFulfillmentUnsupportedError(order.id, unsupportedItems.length);
  }

  await step.run("notify-in-house-order", async () => {
    const recipientEmail = order.buyer?.email ?? order.buyerEmail ?? null;
    if (!recipientEmail) {
      return { sent: false as const, reason: "no-recipient-email" };
    }
    const result = await sendOrderConfirmationEmail({
      email: recipientEmail,
      orderNumber: order.orderNumber,
      items: inHouseItems.map((item) => ({
        title: item.snapshot?.designTitle ?? "ThiBút keepsake",
        detail: [
          item.snapshot?.productName,
          item.snapshot?.size,
          item.placement === "both" ? "Double-sided" : "Single-sided",
        ]
          .filter((part): part is string => Boolean(part))
          .join(" · "),
        quantity: item.quantity,
      })),
    });
    return { sent: result.sent };
  });

  await step.run("start-in-house-production", async () => {
    await prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: "IN_PRODUCTION" },
    });
    return { fulfillmentStatus: "IN_PRODUCTION" as const };
  });

  return {
    success: true as const,
    providerOrderId: null,
    fulfillmentStatus: "IN_PRODUCTION" as const,
  };
}

export const processOrderFulfillment = inngest.createFunction(
  {
    id: "process-order-fulfillment",
    name: "Process Order Fulfillment",
    triggers: [{ event: "order/placed" }],
  },
  async ({ event, step }) => {
    try {
      return await executeOrderFulfillmentJob({
        event: { data: event.data },
        step: {
          run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
            (await step.run(id, fn)) as T,
        },
      });
    } catch (err: unknown) {
      if (err instanceof OrderFulfillmentUnsupportedError) {
        // The order is already marked FAILED; a retry would only find it "not PENDING".
        throw new NonRetriableError(err.message, { cause: err });
      }
      throw err;
    }
  }
);

export async function triggerOrderFulfillment(
  orderId: string
): Promise<string> {
  const validated = OrderPlacedEventSchema.parse({ orderId });
  const result = await inngest.send({
    name: "order/placed",
    data: validated,
  });
  return (result as { ids?: string[] }).ids?.[0] ?? "queued";
}

// ── 3. Durable Post-Commit Order Paid Side Effects (R-203) ───────────────────

export async function executeDeliverOrderPaidEffects(params: {
  event: { data: unknown };
  step: InngestStepRunner;
  emailSender?: (
    input: DigitalDownloadEmailParams
  ) => Promise<{ sent: boolean; downloadLink: string }>;
}) {
  const payload = OrderPaidEventSchema.parse(params.event.data);
  const { step } = params;
  const emailSender = params.emailSender ?? sendDigitalDownloadEmail;

  const sentItemIds: string[] = [];
  if (payload.buyerEmail && payload.digitalItems.length > 0) {
    for (const item of payload.digitalItems) {
      await step.run(`send-digital-email-${item.orderItemId}`, async () =>
        emailSender({
          email: payload.buyerEmail!,
          orderNumber: payload.orderNumber,
          orderId: payload.orderId,
          orderItemId: item.orderItemId,
          productName: item.productName,
        })
      );
      sentItemIds.push(item.orderItemId);
    }
  }

  return {
    orderId: payload.orderId,
    emailsDispatched: sentItemIds.length,
    sentItemIds,
  };
}

export const deliverOrderPaidEffects = inngest.createFunction(
  {
    id: "deliver-order-paid-effects",
    name: "Deliver Order Paid Effects",
    retries: 5,
    triggers: [{ event: "order/paid" }],
  },
  async ({ event, step }) =>
    executeDeliverOrderPaidEffects({
      event: { data: event.data },
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// ── 4. Hourly Abandoned Pending Order Cleanup Cron (R-105) ───────────────────

export const PENDING_ORDER_TTL_MS = 24 * 60 * 60 * 1000;

export async function executeCleanupExpiredPendingOrders(params: {
  step: InngestStepRunner;
  now?: Date;
}) {
  const { step } = params;
  const now = params.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - PENDING_ORDER_TTL_MS);

  return step.run("cancel-expired-pending-orders", async () => {
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        createdAt: { lt: staleCutoff },
      },
      include: {
        items: {
          include: {
            personalizationVersion: true,
          },
        },
      },
      take: 250,
    });

    if (expiredOrders.length === 0) {
      return { cancelledOrders: 0, unlockedSessions: 0, revertedCarts: 0 };
    }

    const orderIds = expiredOrders.map((o) => o.id);
    const sessionIds = Array.from(
      new Set(
        expiredOrders.flatMap((o) =>
          o.items
            .map((i) => i.personalizationVersion?.sessionId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      )
    );

    const linkedQuotes = await prisma.priceQuote.findMany({
      where: { orderId: { in: orderIds } },
      select: { cartId: true },
    });
    const cartIds = Array.from(
      new Set(
        linkedQuotes
          .map((q) => q.cartId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    );

    return prisma.$transaction(async (tx) => {
      const cancelled = await tx.order.updateMany({
        where: {
          id: { in: orderIds },
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "CANCELLED",
          paymentStatus: "CANCELLED",
          cancelledAt: now,
        },
      });

      const unlocked =
        sessionIds.length > 0
          ? await tx.personalizationSession.updateMany({
              where: {
                id: { in: sessionIds },
                status: "CHECKED_OUT",
              },
              data: { status: "SELECTED" },
            })
          : { count: 0 };

      const reverted =
        cartIds.length > 0
          ? await tx.cart.updateMany({
              where: {
                id: { in: cartIds },
                status: "CHECKOUT",
              },
              data: { status: "ACTIVE" },
            })
          : { count: 0 };

      return {
        cancelledOrders: cancelled.count,
        unlockedSessions: unlocked.count,
        revertedCarts: reverted.count,
      };
    });
  });
}

export const cleanupExpiredPendingOrders = inngest.createFunction(
  {
    id: "cleanup-expired-pending-orders",
    name: "Cleanup Expired Pending Orders",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) =>
    executeCleanupExpiredPendingOrders({
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

// ── 5. Stale Unversioned Draft Session Cleanup Cron (R-301) ──────────────────

export const STALE_DRAFT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function executeCleanupStaleDraftSessions(params: {
  step: InngestStepRunner;
  now?: Date;
}) {
  const { step } = params;
  const now = params.now ?? new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DRAFT_SESSION_TTL_MS);

  return step.run("delete-stale-draft-sessions", async () => {
    const staleSessions = await prisma.personalizationSession.findMany({
      where: {
        status: "DRAFT",
        createdAt: { lt: staleCutoff },
        versions: { none: {} },
      },
      select: { id: true },
      take: 500,
    });

    if (staleSessions.length === 0) {
      return { deletedSessions: 0 };
    }

    const sessionIds = staleSessions.map((s) => s.id);
    return prisma.$transaction(async (tx) => {
      const comps = await tx.userComposition.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      if (comps.length > 0) {
        const compIds = comps.map((c) => c.id);
        await tx.userCompositionLayer.deleteMany({
          where: { compositionId: { in: compIds } },
        });
        await tx.userComposition.deleteMany({
          where: { id: { in: compIds } },
        });
      }
      await tx.personalizationCandidate.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      await tx.interpretation.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
      const deleted = await tx.personalizationSession.deleteMany({
        where: {
          id: { in: sessionIds },
          status: "DRAFT",
          versions: { none: {} },
        },
      });
      return { deletedSessions: deleted.count };
    });
  });
}

export const cleanupStaleDraftSessions = inngest.createFunction(
  {
    id: "cleanup-stale-draft-sessions",
    name: "Cleanup Stale Draft Sessions",
    triggers: [{ cron: "15 3 * * *" }],
  },
  async ({ step }) =>
    executeCleanupStaleDraftSessions({
      step: {
        run: async <T>(id: string, fn: () => Promise<T> | T): Promise<T> =>
          (await step.run(id, fn)) as T,
      },
    })
);

export const inngestFunctions = [
  generatePersonalizationJob,
  processOrderFulfillment,
  deliverOrderPaidEffects,
  cleanupExpiredPendingOrders,
  cleanupStaleDraftSessions,
];
