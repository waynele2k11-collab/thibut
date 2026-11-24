import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Lock,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CheckoutButton,
  type CheckoutRequestPayload,
} from "./CheckoutButton";
import type {
  CheckoutLineDisplay,
  FrozenLicenseDisplay,
} from "./checkoutLoader";

export function EmptyCheckoutView({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased">
      <main className="grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-16 h-16 rounded-lg bg-surface-container-low border border-surface-variant flex items-center justify-center">
          <ShoppingBag
            className="w-7 h-7 text-on-surface-variant"
            aria-hidden="true"
          />
        </div>
        <h1 className="font-display-lg-mobile md:font-headline-md text-display-lg-mobile md:text-headline-md text-on-background">
          {title}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          {message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/custom"
            className="bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Custom Keepsakes
          </Link>
          <Link
            href="/cart"
            className="border border-outline-variant text-on-background px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
          >
            View Cart
          </Link>
        </div>
      </main>
    </div>
  );
}

export function CheckoutLineCard({ line }: { line: CheckoutLineDisplay }) {
  const isVietnamese = line.interpretationType
    .toUpperCase()
    .includes("VIETNAMESE");

  return (
    <Card className="p-6 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="w-32 h-32 rounded bg-surface-container-low border border-surface-variant overflow-hidden shrink-0 relative flex items-center justify-center">
          {line.catalogImageUrl && (
            <Image
              src={line.catalogImageUrl}
              alt={line.designTitle}
              fill
              sizes="128px"
              className="object-cover pointer-events-none select-none"
            />
          )}
          {line.mockupUrl && (
            <Image
              src={line.mockupUrl}
              alt={line.productTitle}
              fill
              unoptimized
              className="object-cover pointer-events-none select-none"
            />
          )}
          {line.previewSvgUri && (
            <Image
              src={line.previewSvgUri}
              alt={line.renderedPhrase}
              width={102}
              height={102}
              unoptimized
              className={
                line.mockupUrl
                  ? "relative z-10 w-3/5 h-3/5 object-contain pointer-events-none select-none"
                  : "w-4/5 h-4/5 object-contain pointer-events-none select-none"
              }
            />
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-background">
                {line.designTitle}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                {line.productTitle}
              </p>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-background shrink-0">
              {formatUsdMinor(line.quote.subtotalMinor)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{line.variantBadge}</Badge>
            <Badge variant="secondary">{line.placementLabel}</Badge>
            <Badge variant="secondary">Qty: {line.quantity}</Badge>
          </div>

          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant pt-1 flex items-center gap-1.5">
            {line.catalogImageUrl ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Made to order · catalog artwork as shown</span>
              </>
            ) : line.isDigital ? (
              <>
                <Download className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                <span>Instant 4500×5400 px @ 300 DPI Master</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>Print-Ready 4500×5400 px @ 300 DPI Master</span>
              </>
            )}
          </p>
        </div>
      </div>

      {!line.catalogImageUrl && (
      <div className="border-t border-surface-variant pt-5 flex flex-col gap-2">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Cultural Meaning &amp; Romanization
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container-low border border-surface-variant rounded p-4">
          <div>
            <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              Input Phrase
            </p>
            <p className="font-body-md text-body-md text-on-background">
              &ldquo;{line.inputPhrase}&rdquo;
            </p>
          </div>
          <div>
            <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
              Calligraphy Script ({line.interpretationType})
            </p>
            <p
              lang={isVietnamese ? "vi" : undefined}
              className="font-body-md text-body-md text-on-background"
            >
              {line.renderedPhrase}
            </p>
          </div>
          {line.romanization && (
            <div>
              <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                Romanization
              </p>
              <p className="font-body-md text-body-md text-on-background">
                {line.romanization}
              </p>
            </div>
          )}
          {line.meaning && (
            <div className="sm:col-span-2">
              <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                Cultural Meaning
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant italic">
                &ldquo;{line.meaning}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>
      )}
    </Card>
  );
}

export function FrozenLicenseCard({
  licenseDisplay,
}: {
  licenseDisplay: FrozenLicenseDisplay;
}) {
  return (
    <Card className="p-6 md:p-8 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 border-b border-surface-variant pb-4">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-background">
            {licenseDisplay.licenseLabel}
          </h2>
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mt-1">
            {licenseDisplay.versionLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant shrink-0">
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span className="font-label-caps text-[10px] uppercase">
            Immutable Snapshot
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {licenseDisplay.permissions.map((perm) => (
          <div key={perm.label} className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                perm.allowed ? "bg-primary" : "bg-surface-container-highest"
              }`}
              aria-hidden="true"
            />
            <span
              className={`font-label-caps text-[11px] uppercase ${
                perm.allowed ? "text-on-background" : "text-outline"
              }`}
            >
              {perm.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function OrderSummaryCard({
  artworkTotalMinor,
  personalizationTotalMinor,
  productTotalMinor,
  shippingTotalMinor,
  taxTotalMinor,
  grandTotalMinor,
  allDigital,
  checkoutPayload,
}: {
  artworkTotalMinor: bigint;
  personalizationTotalMinor: bigint;
  productTotalMinor: bigint;
  shippingTotalMinor: bigint;
  taxTotalMinor: bigint;
  grandTotalMinor: bigint;
  allDigital: boolean;
  checkoutPayload: CheckoutRequestPayload | null;
}) {
  return (
    <Card className="p-6 md:p-8 flex flex-col gap-5">
      <h2 className="font-headline-sm text-headline-sm text-on-background">
        Order Summary
      </h2>

      <div className="flex flex-col gap-3 border-b border-surface-variant pb-5">
        <div className="flex justify-between items-center">
          <span className="font-body-md text-body-md text-on-surface-variant">
            Artwork License Royalty
          </span>
          <span className="font-body-md text-body-md text-on-background">
            {formatUsdMinor(artworkTotalMinor)}
          </span>
        </div>

        {personalizationTotalMinor > 0n && (
          <div className="flex justify-between items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">
              AI &amp; Brush Personalization
            </span>
            <span className="font-body-md text-body-md text-on-background">
              {formatUsdMinor(personalizationTotalMinor)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="font-body-md text-body-md text-on-surface-variant">
            {allDigital
              ? "High-Res Digital Master (300 DPI)"
              : "Merchandise & Print Production"}
          </span>
          <span className="font-body-md text-body-md text-on-background">
            {formatUsdMinor(productTotalMinor)}
          </span>
        </div>

        {shippingTotalMinor > 0n && (
          <div className="flex justify-between items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Shipping
            </span>
            <span className="font-body-md text-body-md text-on-background">
              {formatUsdMinor(shippingTotalMinor)}
            </span>
          </div>
        )}

        {taxTotalMinor > 0n && (
          <div className="flex justify-between items-center">
            <span className="font-body-md text-body-md text-on-surface-variant">
              Estimated Tax
            </span>
            <span className="font-body-md text-body-md text-on-background">
              {formatUsdMinor(taxTotalMinor)}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-baseline">
        <span className="font-headline-sm text-headline-sm text-on-background">
          Total (USD)
        </span>
        <span className="font-headline-md text-headline-md text-secondary">
          {formatUsdMinor(grandTotalMinor)}
        </span>
      </div>

      {checkoutPayload && <CheckoutButton payload={checkoutPayload} />}

      <div className="flex items-center justify-center gap-2 text-on-surface-variant pt-1">
        <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
        <span className="font-label-caps text-label-caps uppercase">
          Stripe Encrypted · Server-Verified Quote
        </span>
      </div>

      <p className="font-label-caps text-[11px] text-on-surface-variant text-center leading-relaxed">
        By completing this purchase, your personalization version and license terms are permanently frozen on your order record and cannot be altered after checkout.
      </p>
    </Card>
  );
}
