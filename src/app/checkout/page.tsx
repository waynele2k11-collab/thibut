import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  loadCheckoutViewData,
  type CheckoutSearchParams,
} from "./checkoutLoader";
import {
  CheckoutLineCard,
  EmptyCheckoutView,
  FrozenLicenseCard,
  OrderSummaryCard,
} from "./CheckoutViews";

export const metadata: Metadata = {
  title: "Secure Checkout",
  description:
    "Review your items and server-verified pricing before payment.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<CheckoutSearchParams>;
}) {
  const params = await searchParams;
  const loaded = await loadCheckoutViewData(params);

  if (loaded.status === "empty") {
    return <EmptyCheckoutView title={loaded.title} message={loaded.message} />;
  }

  const {
    lines,
    shippingMinor: orderShippingMinor,
    licenseDisplay,
    checkoutPayload,
    backHref,
    backLabel,
  } = loaded;

  let artworkTotalMinor = 0n;
  let personalizationTotalMinor = 0n;
  let productTotalMinor = 0n;
  let taxTotalMinor = 0n;
  let subtotalMinor = 0n;

  for (const line of lines) {
    artworkTotalMinor += line.quote.artworkMinor;
    personalizationTotalMinor += line.quote.personalizationMinor;
    productTotalMinor += line.quote.productMinor;
    taxTotalMinor += line.quote.taxMinor;
    subtotalMinor += line.quote.subtotalMinor;
  }

  const shippingTotalMinor = orderShippingMinor;
  const grandTotalMinor = subtotalMinor + shippingTotalMinor + taxTotalMinor;

  const allDigital = lines.every((l) => l.isDigital);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md antialiased">
      <main className="grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-10">
        <header className="border-b border-surface-variant pb-6 flex flex-col gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-on-background transition-colors motion-reduce:transition-none w-fit"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
          <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-background">
            Secure Checkout
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Review your items and server-verified pricing before payment.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 flex flex-col gap-8">
            {lines.map((line) => (
              <CheckoutLineCard key={line.id} line={line} />
            ))}

            {licenseDisplay && (
              <FrozenLicenseCard licenseDisplay={licenseDisplay} />
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-8">
            <OrderSummaryCard
              artworkTotalMinor={artworkTotalMinor}
              personalizationTotalMinor={personalizationTotalMinor}
              productTotalMinor={productTotalMinor}
              shippingTotalMinor={shippingTotalMinor}
              taxTotalMinor={taxTotalMinor}
              grandTotalMinor={grandTotalMinor}
              allDigital={allDigital}
              checkoutPayload={checkoutPayload}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
