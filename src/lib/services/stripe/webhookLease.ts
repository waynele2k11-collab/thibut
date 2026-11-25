import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000; // 5 minutes (R-104)
export const WEBHOOK_ALERT_ATTEMPT_THRESHOLD = 5;

export type WebhookLeaseClaimResult =
  | { outcome: "CLAIMED"; attempts: number }
  | { outcome: "ALREADY_PROCESSED"; status: string }
  | { outcome: "IN_PROGRESS" };

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Race-free WebhookEvent lease acquisition & stale PROCESSING recovery (INV-007, R-104).
 */
export async function claimWebhookEventLease(params: {
  provider: "STRIPE";
  externalEventId: string;
  eventType: string;
  payloadJson: Prisma.InputJsonValue;
  now?: Date;
}): Promise<WebhookLeaseClaimResult> {
  const now = params.now ?? new Date();

  try {
    await prisma.webhookEvent.create({
      data: {
        provider: params.provider,
        externalEventId: params.externalEventId,
        eventType: params.eventType,
        payloadJson: params.payloadJson,
        status: "PROCESSING",
        attempts: 1,
      },
    });
    return { outcome: "CLAIMED", attempts: 1 };
  } catch (err: unknown) {
    if (!isPrismaUniqueConstraintError(err)) {
      throw err;
    }
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider: params.provider,
        externalEventId: params.externalEventId,
      },
    },
  });

  if (!existing) {
    return { outcome: "IN_PROGRESS" };
  }

  if (existing.status === "PROCESSED" || existing.status === "IGNORED") {
    return { outcome: "ALREADY_PROCESSED", status: existing.status };
  }

  const existingAttempts =
    typeof (existing as { attempts?: unknown }).attempts === "number"
      ? (existing as { attempts: number }).attempts
      : 1;
  const nextAttempts = existingAttempts + 1;

  if (existing.status === "FAILED" || existing.status === "PENDING") {
    const claimed = await prisma.webhookEvent.updateMany({
      where: {
        provider: params.provider,
        externalEventId: params.externalEventId,
        status: { in: ["FAILED", "PENDING"] },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        updatedAt: now,
      },
    });

    if (claimed.count !== 1) {
      return { outcome: "IN_PROGRESS" };
    }

    if (nextAttempts > WEBHOOK_ALERT_ATTEMPT_THRESHOLD) {
      console.error(
        `[Webhook Alert] ${params.provider} event ${params.externalEventId} exceeded retry threshold (attempts=${nextAttempts})`
      );
    }

    return { outcome: "CLAIMED", attempts: nextAttempts };
  }

  if (existing.status === "PROCESSING") {
    const lastTouched =
      (existing as { updatedAt?: Date | null }).updatedAt ?? existing.receivedAt;
    const staleCutoff = new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS);

    if (lastTouched.getTime() >= staleCutoff.getTime()) {
      return { outcome: "IN_PROGRESS" };
    }

    const reclaimed = await prisma.webhookEvent.updateMany({
      where: {
        provider: params.provider,
        externalEventId: params.externalEventId,
        status: "PROCESSING",
        updatedAt: { lt: staleCutoff },
      },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        updatedAt: now,
      },
    });

    if (reclaimed.count !== 1) {
      return { outcome: "IN_PROGRESS" };
    }

    if (nextAttempts > WEBHOOK_ALERT_ATTEMPT_THRESHOLD) {
      console.error(
        `[Webhook Alert] ${params.provider} stale event ${params.externalEventId} exceeded retry threshold (attempts=${nextAttempts})`
      );
    }

    return { outcome: "CLAIMED", attempts: nextAttempts };
  }

  return { outcome: "IN_PROGRESS" };
}
