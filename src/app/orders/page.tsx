import type { Metadata } from "next";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Package,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { generateInstantSvgUri } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import { DEFAULT_CALLIGRAPHY_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { adaptLegacyComposition } from "@/lib/print/types";
import {
  ANON_SESSION_COOKIE,
  signDownloadToken,
  verifyAnonSessionToken,
} from "@/lib/security/tokens";
import { DEFAULT_INK_HEX } from "@/lib/studio/inkPalette";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "My Orders & Digital Masters",
  description:
    "Track your personalized calligraphy shipments and download 300 DPI archival digital masters.",
  robots: { index: false, follow: false },
};

function orderStatusBadgeVariant(status: string): BadgeVariant {
  if (
    status === "PAID" ||
    status === "FULFILLED" ||
    status === "COMPLETED" ||
    status === "PROCESSING"
  ) {
    return "default";
  }
  if (status === "REFUNDED" || status === "CANCELLED") {
    return "error";
  }
  return "secondary";
}

function buildOrderPreviewUri(
  styleSnapshot: unknown,
  fallbackTitle: string
): string {
  try {
    if (styleSnapshot) {
      const comp = adaptLegacyComposition(styleSnapshot);
      const cal = comp.layers.find((l) => l.type === "calligraphy");
      const seal = comp.layers.find((l) => l.type === "seal");
      return generateInstantSvgUri({
        text: cal?.text || fallbackTitle || "Thi Bút",
        fontFamily: cal?.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        layout: cal?.layout || "VERTICAL",
        inkColor: cal?.colorHex || comp.color || DEFAULT_INK_HEX,
        hasSeal: Boolean(seal),
        sealText: seal?.sealText,
        sealFontFamily: seal?.fontFamily,
      });
    }
  } catch {
    // Fallback
  }
  return generateInstantSvgUri({
    text: fallbackTitle.slice(0, 16) || "Thi Bút",
    fontFamily: DEFAULT_CALLIGRAPHY_FONT_FAMILY,
    layout: "VERTICAL",
    inkColor: DEFAULT_INK_HEX,
    hasSeal: true,
  });
}

export default async function BuyerOrdersPage() {
  const cookieStore = await cookies();
  const anonId = await verifyAnonSessionToken(
    cookieStore.get(ANON_SESSION_COOKIE)?.value
  );

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user?.id) {
      userId = data.user.id;
      userEmail = data.user.email ?? null;
    }
  } catch {
    userId = null;
  }

  const orders =
    userId || anonId
      ? await prisma.order.findMany({
          where: userId
            ? { buyerId: userId }
            : { anonymousSessionId: anonId, buyerId: null },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            items: {
              include: {
                snapshot: true,
                licenseGrant: true,
                personalizationVersion: true,
              },
            },
          },
        })
      : [];

  const enrichedOrders = await Promise.all(
    orders.map(async (order) => {
      const isPaidAndActive =
        (order.paymentStatus === "SUCCEEDED" ||
          order.paymentStatus === "PARTIALLY_REFUNDED" ||
          order.paymentStatus === "DISPUTED") &&
        order.status !== "PENDING_PAYMENT" &&
        order.status !== "REFUNDED" &&
        order.status !== "CANCELLED";

      const itemsWithLinks = await Promise.all(
        order.items.map(async (item) => {
          const isDigitalEligible =
            isPaidAndActive &&
            (!item.catalogVariantId ||
              item.licenseGrant?.licenseType === "PERSONAL_DIGITAL") &&
            !item.licenseGrant?.revokedAt &&
            Boolean(item.personalizationVersionId);

          let downloadHref: string | null = null;
          if (isDigitalEligible) {
            try {
              const token = await signDownloadToken({
                orderId: order.id,
                orderItemId: item.id,
              });
              downloadHref = `/api/download?token=${encodeURIComponent(token)}`;
            } catch {
              downloadHref = null;
            }
          }

          const previewUri = buildOrderPreviewUri(
            item.personalizationVersion?.styleSnapshot,
            item.snapshot?.designTitle ?? "Thi Bút"
          );

          return {
            item,
            downloadHref,
            previewUri,
            isDigitalItem: !item.catalogVariantId,
          };
        })
      );

      return { order, itemsWithLinks };
    })
  );

  return (
    <div className="min-h-screen bg-background text-on-background">
      <main className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop py-14 space-y-10">
        <header className="border-b border-surface-variant pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
              {userEmail ? `Signed in as ${userEmail}` : "Browser Session Archive"}
            </p>
            <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-primary">
              Orders &amp; Digital Library
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Track custom print production and download 4500 × 5400 px (300 DPI) archival masters.
            </p>
          </div>
          {!userId && (
            <Link
              href="/auth/login?next=/orders"
              className="font-label-caps text-label-caps uppercase text-secondary hover:underline"
            >
              Sign in to sync across devices →
            </Link>
          )}
        </header>

        {enrichedOrders.length === 0 ? (
          <Card className="p-12 flex flex-col items-center justify-center text-center gap-4 bg-surface-container-lowest">
            <div className="w-16 h-16 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center">
              <ScrollText
                className="w-7 h-7 text-on-surface-variant"
                aria-hidden="true"
              />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-primary">
              No orders in this collection yet
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
              Orders you place appear here with their production and shipping status. Custom Design orders are handled by email for now.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/personal"
                className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
              >
                Browse Designs
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                href="/custom"
                className="inline-flex items-center gap-2 border border-outline-variant text-on-background px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
              >
                Custom Design
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {enrichedOrders.map(({ order, itemsWithLinks }) => (
              <Card key={order.id} className="p-6 space-y-5 bg-surface-container-lowest">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-variant">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-headline-sm text-lg text-primary">
                        {order.orderNumber}
                      </span>
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                      {order.fulfillmentStatus !== "PENDING" && (
                        <Badge variant="outline">
                          <Package className="w-3 h-3 mr-1" aria-hidden="true" />
                          {order.fulfillmentStatus.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="font-body-md text-xs text-on-surface-variant">
                      Placed{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                      }).format(order.createdAt)}
                    </p>
                    {order.trackingNumber && (
                      <p className="font-body-md text-body-md text-on-surface">
                        Tracking: {order.trackingCarrier ? `${order.trackingCarrier} ` : ""}
                        {order.trackingNumber}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="font-label-caps text-[10px] uppercase text-on-surface-variant block">
                      Total
                    </span>
                    <span className="font-headline-sm text-xl text-primary">
                      {formatUsdMinor(order.totalMinor)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {itemsWithLinks.map(
                    ({ item, downloadHref, previewUri, isDigitalItem }) => {
                      const title =
                        item.snapshot?.designTitle ??
                        "Personalized Calligraphy";
                      const productMeta = isDigitalItem
                        ? "4500 × 5400 px · 300 DPI Archival PNG"
                        : [
                            item.snapshot?.productName ?? "Physical Medium",
                            item.snapshot?.color,
                            item.snapshot?.size
                              ? `Size ${item.snapshot.size}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface-container-low border border-surface-variant"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-16 h-16 rounded bg-surface-container-lowest border border-surface-variant p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                              <Image
                                src={previewUri}
                                alt={title}
                                width={56}
                                height={56}
                                unoptimized
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-body-md text-sm font-semibold text-on-background truncate">
                                {title} × {item.quantity}
                              </p>
                              <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                                {productMeta}
                              </p>
                              {item.licenseGrant && (
                                <p className="font-label-caps text-[10px] uppercase text-on-surface-variant mt-1 inline-flex items-center gap-1">
                                  <ShieldCheck
                                    className="w-3 h-3 text-primary"
                                    aria-hidden="true"
                                  />
                                  {item.licenseGrant.licenseType.replace(
                                    /_/g,
                                    " "
                                  )}
                                  {item.licenseGrant.revokedAt
                                    ? " (Revoked)"
                                    : ""}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="font-body-md text-sm font-medium text-on-background">
                              {formatUsdMinor(item.totalMinor)}
                            </span>
                            {downloadHref && (
                              <a
                                href={downloadHref}
                                className="min-h-10 px-4 py-2 rounded bg-secondary text-on-secondary hover:opacity-95 font-label-caps text-[11px] uppercase inline-flex items-center gap-1.5 transition-opacity motion-reduce:transition-none"
                              >
                                <Download
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                                <span>300 DPI PNG</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
