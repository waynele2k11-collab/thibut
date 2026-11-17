import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { stripe } from "@/lib/stripe";

const testPostgresUrl = process.env.TEST_POSTGRES_URL?.trim();

if (!testPostgresUrl) {
  test(
    "R-600: PostgreSQL integration suite (triggers, unique constraints, 10x concurrent Stripe webhooks)",
    { skip: "TEST_POSTGRES_URL not set" },
    () => {}
  );
} else {
  const pg = new PrismaClient({
    datasources: {
      db: { url: testPostgresUrl },
    },
  });
  globalThis.prismaGlobalV2 = pg;

  test.after(async () => {
    await pg.$disconnect();
  });

  test("R-600 / INV-009: enforce_ledger_transaction_zero_sum rejects unbalanced postings at COMMIT and accepts zero-sum transactions", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const debitAcc = await pg.ledgerAccount.create({
      data: {
        code: `TEST_CASH_${suffix}`,
        name: "Integration Cash",
        type: "STRIPE_CLEARING",
        ownerType: "PLATFORM",
        currency: "USD",
      },
    });
    const creditAcc = await pg.ledgerAccount.create({
      data: {
        code: `TEST_REV_${suffix}`,
        name: "Integration Revenue",
        type: "PLATFORM_PRODUCT_REVENUE",
        ownerType: "PLATFORM",
        currency: "USD",
      },
    });

    // 1. Unbalanced posting (+500n alone) MUST fail at COMMIT via deferred constraint trigger
    await assert.rejects(
      async () => {
        await pg.$transaction(async (tx) => {
          const ltx = await tx.ledgerTransaction.create({
            data: {
              type: "TEST_UNBALANCED",
              description: "Should fail at commit",
              currency: "USD",
            },
          });
          await tx.ledgerPosting.create({
            data: {
              transactionId: ltx.id,
              accountId: debitAcc.id,
              amountMinor: 500n,
              currency: "USD",
            },
          });
        });
      },
      /INV-009 violation/
    );

    // 2. Balanced postings (+1499n and -1499n) commit cleanly
    const balancedTx = await pg.$transaction(async (tx) => {
      const ltx = await tx.ledgerTransaction.create({
        data: {
          type: "TEST_BALANCED",
          description: "Valid zero-sum transaction",
          currency: "USD",
        },
      });
      await tx.ledgerPosting.create({
        data: {
          transactionId: ltx.id,
          accountId: debitAcc.id,
          amountMinor: 1499n,
          currency: "USD",
        },
      });
      await tx.ledgerPosting.create({
        data: {
          transactionId: ltx.id,
          accountId: creditAcc.id,
          amountMinor: -1499n,
          currency: "USD",
        },
      });
      return ltx;
    });

    const savedPostings = await pg.ledgerPosting.findMany({
      where: { transactionId: balancedTx.id },
    });
    assert.equal(savedPostings.length, 2);
    assert.equal(
      savedPostings.reduce((acc, p) => acc + p.amountMinor, 0n),
      0n
    );
  });

  test("R-600 / R-204: enforce_ledger_posting_append_only and enforce_ledger_transaction_append_only reject UPDATE and DELETE", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const accA = await pg.ledgerAccount.create({
      data: {
        code: `TEST_IMMUT_A_${suffix}`,
        name: "Immutability A",
        type: "STRIPE_CLEARING",
        ownerType: "PLATFORM",
        currency: "USD",
      },
    });
    const accB = await pg.ledgerAccount.create({
      data: {
        code: `TEST_IMMUT_B_${suffix}`,
        name: "Immutability B",
        type: "CREATOR_PAYABLE",
        ownerType: "CREATOR",
        currency: "USD",
      },
    });

    const { ledgerTx, postingA } = await pg.$transaction(async (tx) => {
      const createdTx = await tx.ledgerTransaction.create({
        data: {
          type: "ORDER_SALE",
          description: "Append-only verification",
          currency: "USD",
        },
      });
      const pA = await tx.ledgerPosting.create({
        data: {
          transactionId: createdTx.id,
          accountId: accA.id,
          amountMinor: 1000n,
          currency: "USD",
        },
      });
      await tx.ledgerPosting.create({
        data: {
          transactionId: createdTx.id,
          accountId: accB.id,
          amountMinor: -1000n,
          currency: "USD",
        },
      });
      return { ledgerTx: createdTx, postingA: pA };
    });

    await assert.rejects(
      () =>
        pg.ledgerPosting.update({
          where: { id: postingA.id },
          data: { amountMinor: 999n },
        }),
      /Ledger immutability violation/
    );

    await assert.rejects(
      () =>
        pg.ledgerPosting.delete({
          where: { id: postingA.id },
        }),
      /Ledger immutability violation/
    );

    await assert.rejects(
      () =>
        pg.ledgerTransaction.update({
          where: { id: ledgerTx.id },
          data: { description: "Tampered description" },
        }),
      /Ledger immutability violation/
    );

    await assert.rejects(
      () =>
        pg.ledgerTransaction.delete({
          where: { id: ledgerTx.id },
        }),
      /Ledger immutability violation/
    );
  });

  test("R-600: WebhookEvent, Refund.providerRefundId, and Payment.providerChargeId enforce DB unique constraints", async () => {
    const suffix = crypto.randomUUID();
    const extEventId = `evt_unique_${suffix}`;

    await pg.webhookEvent.create({
      data: {
        provider: "STRIPE",
        externalEventId: extEventId,
        eventType: "checkout.session.completed",
        payloadJson: { id: extEventId },
        status: "PROCESSED",
      },
    });

    await assert.rejects(
      () =>
        pg.webhookEvent.create({
          data: {
            provider: "STRIPE",
            externalEventId: extEventId,
            eventType: "checkout.session.completed",
            payloadJson: { id: extEventId },
            status: "PROCESSING",
          },
        }),
      (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
    );

    const order = await pg.order.create({
      data: {
        orderNumber: `TB-UNIQ-${suffix.slice(0, 8).toUpperCase()}`,
        currency: "USD",
        status: "PAID",
        paymentStatus: "SUCCEEDED",
        fulfillmentStatus: "PENDING",
        subtotalMinor: 1499n,
        discountMinor: 0n,
        shippingMinor: 0n,
        taxMinor: 0n,
        totalMinor: 1499n,
      },
    });

    const chargeId = `ch_unique_${suffix}`;
    const payment = await pg.payment.create({
      data: {
        orderId: order.id,
        provider: "stripe",
        providerChargeId: chargeId,
        amountMinor: 1499n,
        currency: "USD",
        status: "SUCCEEDED",
      },
    });

    await assert.rejects(
      () =>
        pg.payment.create({
          data: {
            orderId: order.id,
            provider: "stripe",
            providerChargeId: chargeId,
            amountMinor: 1499n,
            currency: "USD",
            status: "SUCCEEDED",
          },
        }),
      (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
    );

    const refundProviderId = `re_unique_${suffix}`;
    await pg.refund.create({
      data: {
        orderId: order.id,
        paymentId: payment.id,
        providerRefundId: refundProviderId,
        amountMinor: 500n,
        status: "SUCCEEDED",
      },
    });

    await assert.rejects(
      () =>
        pg.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            providerRefundId: refundProviderId,
            amountMinor: 500n,
            status: "SUCCEEDED",
          },
        }),
      (err: unknown) =>
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
    );
  });

  test("R-600 & INV-007: 10 concurrent Promise.all deliveries of the same Stripe webhook settle Order exactly once", async () => {
    const webhookSecret = "whsec_pg_integration_concurrent_secret_key";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    process.env.DOWNLOAD_TOKEN_SECRET =
      "pg-integration-download-secret-min-32-chars!!";

    const { inngest } = await import("@/lib/inngest");
    const origInngestSend = inngest.send.bind(inngest);
    inngest.send = (async () => ({ ids: ["evt-pg-mock"] })) as typeof inngest.send;

    try {
      const { POST: stripeWebhookPost } = await import(
        "@/app/api/webhooks/stripe/route"
      );

      const suffix = crypto.randomUUID().slice(0, 8);
      const creatorUser = await pg.user.create({
        data: {
          email: `pg-creator-${suffix}@thibut.com`,
          name: "PG Creator",
          status: "ACTIVE",
        },
      });
      const creator = await pg.creatorProfile.create({
        data: {
          userId: creatorUser.id,
          slug: `pg-creator-${suffix}`,
          displayName: "PG Master",
          status: "ACTIVE",
        },
      });
      const design = await pg.design.create({
        data: {
          creatorId: creator.id,
          slug: `pg-design-${suffix}`,
          title: "PG Brush Scroll",
          status: "PUBLISHED",
          visibility: "PUBLIC",
        },
      });
      const designVersion = await pg.designVersion.create({
        data: {
          designId: design.id,
          versionNumber: 1,
        },
      });
      const offer = await pg.licenseOffer.create({
        data: {
          designId: design.id,
          type: "PERSONAL_DIGITAL",
          priceMinor: 499n,
          currency: "USD",
          active: true,
          allowDigitalDownload: true,
        },
      });

      const order = await pg.order.create({
        data: {
          orderNumber: `TB-PG-${suffix.toUpperCase()}`,
          buyerEmail: `pg-buyer-${suffix}@thibut.com`,
          currency: "USD",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          fulfillmentStatus: "PENDING",
          subtotalMinor: 1499n,
          discountMinor: 0n,
          shippingMinor: 0n,
          taxMinor: 0n,
          totalMinor: 1499n,
        },
      });

      await pg.orderItem.create({
        data: {
          orderId: order.id,
          creatorId: creator.id,
          designId: design.id,
          designVersionId: designVersion.id,
          licenseOfferId: offer.id,
          quantity: 1,
          placement: "front",
          artworkRevenueMinor: 499n,
          personalizationRevenueMinor: 300n,
          productRevenueMinor: 700n,
          fulfillmentCostMinor: 0n,
          creatorRoyaltyMinor: 499n,
          platformRevenueMinor: 1000n,
          totalMinor: 1499n,
        },
      });

      const eventPayload = JSON.stringify({
        id: `evt_pg_concurrent_${suffix}`,
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: `cs_pg_concurrent_${suffix}`,
            payment_status: "paid",
            amount_total: 1499,
            currency: "usd",
            payment_intent: {
              id: `pi_pg_${suffix}`,
              latest_charge: `ch_pg_${suffix}`,
            },
            metadata: {
              orderId: order.id,
              isDigital: "true",
            },
            customer_details: {
              email: `pg-buyer-${suffix}@thibut.com`,
            },
          },
        },
      });

      const signature = stripe.webhooks.generateTestHeaderString({
        payload: eventPayload,
        secret: webhookSecret,
      });

      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          stripeWebhookPost(
            new Request("http://localhost:3000/api/webhooks/stripe", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "stripe-signature": signature,
              },
              body: eventPayload,
            })
          )
        )
      );

      const statuses = responses.map((r) => r.status);
      assert.ok(
        statuses.every((s) => s === 200 || s === 409),
        `Expected only 200 or 409 under 10x concurrency, got ${JSON.stringify(statuses)}`
      );
      assert.ok(
        statuses.includes(200),
        "At least one concurrent delivery must settle with 200"
      );

      const settledOrder = await pg.order.findUnique({
        where: { id: order.id },
      });
      assert.equal(settledOrder?.status, "PAID");
      assert.equal(settledOrder?.paymentStatus, "SUCCEEDED");

      const payments = await pg.payment.findMany({
        where: { orderId: order.id },
      });
      assert.equal(payments.length, 1, "Must create exactly 1 Payment row");

      const ledgerTxs = await pg.ledgerTransaction.findMany({
        where: { referenceType: "ORDER", referenceId: order.id },
        include: { postings: true },
      });
      assert.equal(
        ledgerTxs.length,
        1,
        "Must create exactly 1 ORDER_SALE LedgerTransaction"
      );
      assert.equal(
        ledgerTxs[0]!.postings.reduce((acc, p) => acc + p.amountMinor, 0n),
        0n
      );
    } finally {
      inngest.send = origInngestSend;
    }
  });
}
