import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  PrintfulProvider,
  PrintfulWebhookPayloadSchema,
} from "@/lib/fulfillment/PrintfulProvider";
import {
  SecurityConfigError,
  timingSafeEqualString,
  verifyHmacSha256,
} from "@/lib/security/tokens";

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

function authenticatePrintfulWebhook(req: Request, rawBodyText: string): boolean {
  const configuredSecret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!configuredSecret || configuredSecret.trim().length < 16) {
    return false;
  }

  const signatureHeader =
    req.headers.get("x-pf-webhook-signature") ??
    req.headers.get("x-pf-signature") ??
    req.headers.get("x-printful-signature");

  if (signatureHeader !== null) {
    try {
      return verifyHmacSha256(
        rawBodyText,
        signatureHeader,
        "PRINTFUL_WEBHOOK_SECRET"
      );
    } catch (err: unknown) {
      if (err instanceof SecurityConfigError) {
        return false;
      }
      return false;
    }
  }

  let urlToken: string | null = null;
  try {
    const parsedUrl = new URL(req.url);
    urlToken =
      parsedUrl.searchParams.get("secret") ?? parsedUrl.searchParams.get("token");
  } catch {
    urlToken = null;
  }

  const providedToken = req.headers.get("x-webhook-secret") ?? urlToken;
  if (!providedToken) {
    return false;
  }

  return timingSafeEqualString(providedToken, configuredSecret);
}

export async function POST(req: Request) {
  const rawBodyText = await req.text();

  if (!authenticatePrintfulWebhook(req, rawBodyText)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBodyText);
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const validated = PrintfulWebhookPayloadSchema.safeParse(parsedBody);
  if (!validated.success) {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const provider = new PrintfulProvider();
  const event = await provider.parseWebhook(validated.data, rawBodyText);

  // Race-free idempotency (INV-007): insert WebhookEvent first; treat P2002 as 200 duplicate
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: "PRINTFUL",
        externalEventId: event.externalEventId,
        eventType: event.rawType,
        payloadJson: validated.data as Prisma.InputJsonValue,
        status: "PROCESSING",
      },
    });
  } catch (err: unknown) {
    if (isPrismaUniqueConstraintError(err)) {
      return Response.json(
        { received: true, duplicate: true },
        { status: 200 }
      );
    }
    console.error("[Printful Webhook] Failed to record WebhookEvent:", err);
    return Response.json(
      { error: "Webhook persistence error" },
      { status: 500 }
    );
  }

  try {
    if (event.type === "IGNORED") {
      await prisma.webhookEvent.updateMany({
        where: {
          provider: "PRINTFUL",
          externalEventId: event.externalEventId,
        },
        data: {
          status: "IGNORED",
          processedAt: new Date(),
        },
      });
      return Response.json({ received: true, ignored: true }, { status: 200 });
    }

    switch (event.type) {
      case "MOCKUP_COMPLETED": {
        break;
      }

      case "ORDER_SHIPPED": {
        if (event.orderExternalId) {
          const order = await prisma.order.findUnique({
            where: { orderNumber: event.orderExternalId },
          });
          if (order) {
            await prisma.order.update({
              where: { id: order.id },
              data: { fulfillmentStatus: "SHIPPED" },
            });
          }
        }
        break;
      }

      case "ORDER_FAILED":
      case "ORDER_CANCELED": {
        if (event.orderExternalId) {
          const order = await prisma.order.findUnique({
            where: { orderNumber: event.orderExternalId },
          });
          if (order) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                fulfillmentStatus:
                  event.type === "ORDER_FAILED" ? "FAILED" : "CANCELLED",
              },
            });
          }
        }
        break;
      }

      default:
        break;
    }

    await prisma.webhookEvent.updateMany({
      where: {
        provider: "PRINTFUL",
        externalEventId: event.externalEventId,
      },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return Response.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[Printful Webhook] Processing error:", error);

    await prisma.webhookEvent
      .updateMany({
        where: {
          provider: "PRINTFUL",
          externalEventId: event.externalEventId,
        },
        data: {
          status: "FAILED",
        },
      })
      .catch(() => undefined);

    return Response.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
