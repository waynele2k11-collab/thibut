import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { formatUsdMinor } from "@/lib/pricing/quote";
import {
  ANON_SESSION_COOKIE,
  signDownloadToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Verify your Thi Bút payment confirmation and fulfillment status.",
  robots: { index: false, follow: false },
};

interface SuccessSearchParams {
  session_id?: string;
  order?: string;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SuccessSearchParams>;
}) {
  const { session_id, order: orderNumberParam } = await searchParams;
  const cleanSessionId = session_id?.trim() || undefined;
  const cleanOrderNumber = orderNumberParam?.trim() || undefined;

  const cookieStore = await cookies();
  const anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) {
      userId = data.user.id;
    }
  } catch {
    userId = null;
  }

  const dbOrder =
    cleanSessionId || cleanOrderNumber
      ? await prisma.order.findFirst({
          where: {
            ...(cleanSessionId && cleanOrderNumber
              ? {
                  OR: [
                    { stripeCheckoutSessionId: cleanSessionId },
                    { orderNumber: cleanOrderNumber },
                  ],
                }
              : cleanSessionId
                ? { stripeCheckoutSessionId: cleanSessionId }
                : { orderNumber: cleanOrderNumber }),
          },
          include: {
            items: {
              include: {
                snapshot: true,
                licenseGrant: true,
              },
            },
          },
        })
      : null;

  let stripePaymentStatus: string | null = null;
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (
    dbOrder &&
    dbOrder.status === "PENDING_PAYMENT" &&
    cleanSessionId &&
    stripeSecret &&
    stripeSecret !== "sk_test_placeholder"
  ) {
    try {
      const retrieved = await stripe.checkout.sessions.retrieve(cleanSessionId);
      stripePaymentStatus = retrieved.payment_status ?? null;
    } catch {
      stripePaymentStatus = null;
    }
  }

  if (!dbOrder) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased items-center justify-center">
        <main className="max-w-lg w-full px-margin-mobile py-16 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 bg-surface-container-low border border-surface-variant rounded-lg flex items-center justify-center">
            <HelpCircle className="w-8 h-8 text-on-surface-variant" aria-hidden="true" />
          </div>
          <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background">
            Order Not Found
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            We could not verify an order matching this checkout link. If you
            recently completed a payment, please check your confirmation email
            or review your order history.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/orders"
              className="border border-outline-variant text-on-background px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors"
            >
              My Orders
            </Link>
            <Link
              href="/"
              className="bg-primary text-on-primary px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors flex items-center gap-2"
            >
              Return Home <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isCancelledOrRefunded =
    dbOrder.status === "CANCELLED" ||
    dbOrder.status === "REFUNDED" ||
    dbOrder.paymentStatus === "FAILED" ||
    dbOrder.paymentStatus === "CANCELLED" ||
    dbOrder.paymentStatus === "REFUNDED";

  const isConfirmedPaid =
    !isCancelledOrRefunded &&
    (dbOrder.paymentStatus === "SUCCEEDED" ||
      dbOrder.paymentStatus === "PARTIALLY_REFUNDED" ||
      dbOrder.paymentStatus === "DISPUTED" ||
      dbOrder.status === "PAID" ||
      dbOrder.status === "PARTIALLY_REFUNDED" ||
      dbOrder.status === "PROCESSING" ||
      dbOrder.status === "PARTIALLY_FULFILLED" ||
      dbOrder.status === "FULFILLED" ||
      dbOrder.status === "COMPLETED");

  if (isCancelledOrRefunded) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased items-center justify-center">
        <main className="max-w-lg w-full px-margin-mobile py-16 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 bg-error-container border border-error rounded-lg flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-error" aria-hidden="true" />
          </div>
          <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background">
            Payment Not Completed
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Order <strong>{dbOrder.orderNumber}</strong> currently has status{" "}
            <span className="uppercase font-medium text-on-background">
              {dbOrder.status.replace(/_/g, " ")}
            </span>
            . No production job has been dispatched.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/cart"
              className="bg-primary text-on-primary px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors"
            >
              Return to Cart
            </Link>
            <Link
              href="/custom"
              className="border border-outline-variant text-on-background px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors"
            >
              Custom Keepsakes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (isConfirmedPaid) {
    const ownsOrder = Boolean(
      (userId && dbOrder.buyerId === userId) ||
        (!dbOrder.buyerId && anonId && dbOrder.anonymousSessionId === anonId) ||
        (cleanSessionId && dbOrder.stripeCheckoutSessionId === cleanSessionId)
    );

    const digitalDownloads: Array<{
      itemId: string;
      title: string;
      href: string;
    }> = [];

    if (ownsOrder) {
      for (const item of dbOrder.items) {
        const isDigitalEligible =
          (!item.catalogVariantId ||
            item.licenseGrant?.licenseType === "PERSONAL_DIGITAL") &&
          !item.licenseGrant?.revokedAt;
        if (isDigitalEligible && item.personalizationVersionId) {
          try {
            const token = await signDownloadToken({
              orderId: dbOrder.id,
              orderItemId: item.id,
            });
            digitalDownloads.push({
              itemId: item.id,
              title: item.snapshot?.designTitle ?? "300 DPI Digital Master",
              href: `/api/download?token=${encodeURIComponent(token)}`,
            });
          } catch {
            // Skip signing if DOWNLOAD_TOKEN_SECRET is unset in minimal dev env
          }
        }
      }
    }

    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased items-center justify-center">
        <main className="max-w-xl w-full px-margin-mobile py-16 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 bg-surface-container-low border border-surface-variant rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>

          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
            Payment Confirmed
          </h1>

          <p className="font-body-md text-body-md text-on-surface-variant">
            Your order <strong>{dbOrder.orderNumber}</strong> (
            {formatUsdMinor(dbOrder.totalMinor)}) has been verified and locked
            for fulfillment.
          </p>

          {digitalDownloads.length > 0 && (
            <section className="w-full border border-secondary/35 bg-surface-container-lowest p-5 rounded-lg text-left space-y-3">
              <p className="font-label-caps text-label-caps uppercase text-secondary">
                Instant 300 DPI Archival Download Ready
              </p>
              {digitalDownloads.map((dl) => (
                <a
                  key={dl.itemId}
                  href={dl.href}
                  className="w-full min-h-12 px-5 py-3 rounded bg-secondary text-on-secondary hover:opacity-95 font-label-caps text-label-caps uppercase flex items-center justify-between gap-3 transition-opacity motion-reduce:transition-none"
                >
                  <span className="truncate">Download {dl.title} (PNG)</span>
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </section>
          )}

          <section className="w-full border border-surface-variant bg-surface-container-lowest p-6 rounded-lg text-left flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-surface-variant pb-3">
              <span className="font-label-caps text-[11px] uppercase text-on-surface-variant">
                Order Reference
              </span>
              <span className="font-body-md text-body-md text-on-background font-medium">
                {dbOrder.orderNumber}
              </span>
            </div>
            {dbOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-on-surface-variant">
                  {item.snapshot?.designTitle ?? "Personalized Calligraphy"} ×{" "}
                  {item.quantity}
                </span>
                <span className="text-on-background font-medium">
                  {formatUsdMinor(item.totalMinor)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-surface-variant pt-3">
              <span className="font-headline-sm text-base text-on-background">
                Total Paid
              </span>
              <span className="font-headline-sm text-base text-secondary">
                {formatUsdMinor(dbOrder.totalMinor)}
              </span>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <Link
              href="/orders"
              className="border border-outline-variant text-on-background px-6 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors"
            >
              Order History &amp; Library
            </Link>
            <Link
              href="/"
              className="bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors duration-300 flex items-center gap-2"
            >
              Continue Exploring <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased items-center justify-center">
      <main className="max-w-xl w-full px-margin-mobile py-16 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 bg-surface-container-low border border-surface-variant rounded-lg flex items-center justify-center">
          <Clock className="w-8 h-8 text-secondary" aria-hidden="true" />
        </div>

        <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background">
          Confirming Your Payment
        </h1>

        <p className="font-body-md text-body-md text-on-surface-variant">
          {stripePaymentStatus === "paid"
            ? `Stripe reported payment received for order ${dbOrder.orderNumber} (${formatUsdMinor(dbOrder.totalMinor)}). We are finalizing your order ledger and print master now.`
            : `Order ${dbOrder.orderNumber} (${formatUsdMinor(dbOrder.totalMinor)}) is currently awaiting payment confirmation from Stripe.`}
        </p>

        <section className="w-full border border-surface-variant bg-surface-container-lowest p-5 rounded-lg text-left flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-label-caps text-[11px] uppercase text-on-surface-variant">
              Order Status
            </span>
            <span className="font-label-caps text-[11px] uppercase text-secondary">
              Pending Payment Settlement
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-label-caps text-[11px] uppercase text-on-surface-variant">
              Order Number
            </span>
            <span className="font-body-md text-body-md text-on-background">
              {dbOrder.orderNumber}
            </span>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href={`/checkout/success?${new URLSearchParams({
              ...(cleanSessionId ? { session_id: cleanSessionId } : {}),
              order: dbOrder.orderNumber,
            }).toString()}`}
            className="bg-primary text-on-primary px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-tint transition-colors"
          >
            Refresh Status
          </Link>
          <Link
            href="/"
            className="border border-outline-variant text-on-background px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors flex items-center gap-2"
          >
            Return Home <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
    </div>
  );
}
