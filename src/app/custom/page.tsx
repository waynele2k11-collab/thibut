import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CreditCard,
  Gem,
  ImageUp,
  PackageCheck,
  PenTool,
  ScanEye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { orderMailto } from "@/lib/catalog/contact";
import { RESIN_KEEPSAKE_PRODUCT_SLUG } from "@/lib/catalog/divisions";
import {
  getCatalogDesign,
  getKeepsakePriceTable,
} from "@/lib/catalog/keepsakeCatalog";

export const metadata: Metadata = {
  title: "Custom Design — Your Photo, Our Design, Your Approval",
  description:
    "Send your photos and wording. A ThiBút designer composes a personalized crystal-look resin keepsake, you approve the proof, then we produce and ship it.",
  alternates: { canonical: "/custom" },
};

const ORDER_SUBJECT = "Custom Design Order";

const FORMATS: {
  name: string;
  price: string | null;
  priceNote: string;
  summary: string;
  points: string[];
}[] = [
  {
    name: "Single-Sided",
    price: "1×",
    priceNote: "Base price for your chosen size",
    summary: "One custom design on the front.",
    points: [
      "One composed artwork",
      "Your photo, names, date and wording",
      "Digital proof before production",
    ],
  },
  {
    name: "Double-Sided",
    price: null,
    priceNote: "Of the single-sided price for the same size",
    summary: "Two custom designs, front and back.",
    points: [
      "Two composed artworks",
      "A different photo or message on each side",
      "Digital proof of both sides before production",
    ],
  },
];

const OCCASIONS = ["Wedding", "Family", "Memorial", "Another occasion"] as const;

const STEPS = [
  {
    num: "01",
    title: "Choose product and size",
    icon: Gem,
    description:
      "Pick single-sided or double-sided, a size, and the occasion: wedding, family, memorial, or something else.",
  },
  {
    num: "02",
    title: "Upload photos and personalization",
    icon: ImageUp,
    description:
      "Send your portraits with the names, dates and wording you would like, and tell us whether the text should be in English or Vietnamese.",
  },
  {
    num: "03",
    title: "Place order and pay",
    icon: CreditCard,
    description:
      "Payment is collected before any custom artwork begins, so your designer can start right away.",
  },
  {
    num: "04",
    title: "We design your artwork",
    icon: PenTool,
    description:
      "A Thi Bút designer composes the piece by hand, checks faces and spelling, and prepares a realistic preview.",
  },
  {
    num: "05",
    title: "Review and approve",
    icon: ScanEye,
    description:
      "You receive a digital proof and can request changes. One revision round is included with every order.",
  },
  {
    num: "06",
    title: "Production and shipping",
    icon: PackageCheck,
    description:
      "Only approved artwork goes to film printing and resin casting. Every piece is quality-checked before it ships.",
  },
] as const;

export default async function CustomKeepsakePage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const { design: designSlug } = await searchParams;
  const [priceTable, inspiration] = await Promise.all([
    getKeepsakePriceTable(RESIN_KEEPSAKE_PRODUCT_SLUG),
    designSlug ? getCatalogDesign(designSlug) : Promise.resolve(null),
  ]);
  const orderEmail = orderMailto(
    inspiration ? `${ORDER_SUBJECT} — based on ${inspiration.title}` : ORDER_SUBJECT
  );
  const fromLabel = priceTable?.sizes[0]?.singleLabel ?? null;

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-28">
        <header className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <Badge variant="seal" className="mb-6">
            Made to Order
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Custom Design
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Your photo. Our design. Your approval.
          </p>
          {fromLabel && (
            <p className="font-label-caps text-label-caps uppercase text-on-surface mb-6">
              From {fromLabel}
            </p>
          )}
          {inspiration && (
            <p className="font-body-md text-body-md text-on-surface mb-6">
              Starting from:{" "}
              <Link
                href={`/design/${inspiration.slug}`}
                className="underline underline-offset-4 hover:text-secondary"
              >
                {inspiration.title}
              </Link>
            </p>
          )}
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
            Send us your photos and your words. A ThiBút designer composes the artwork
            for a crystal-look resin keepsake, and nothing is produced until you approve
            the proof.
          </p>
          <a
            href={orderEmail}
            className="inline-flex items-center justify-center gap-2 min-h-12 w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Start a Custom Order
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <p className="mt-4">
            <Link
              href="/personal"
              className="inline-flex items-center justify-center min-h-11 px-4 font-label-caps text-label-caps uppercase text-secondary hover:text-primary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded"
            >
              See sample designs
            </Link>
          </p>
        </header>

        <section
          aria-labelledby="custom-formats"
          className="max-w-5xl mx-auto mb-16 md:mb-20"
        >
          <h2
            id="custom-formats"
            className="font-headline-md text-headline-md text-primary text-center mb-8"
          >
            Choose Your Format
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            {FORMATS.map((format) => (
              <Card key={format.name} className="p-8 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-primary">
                      {format.name}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                      {format.summary}
                    </p>
                  </div>
                  <p className="font-display-lg-mobile text-display-lg-mobile text-secondary shrink-0">
                    {format.price ?? priceTable?.multiplierLabel ?? "—"}
                  </p>
                </div>
                <p className="font-label-caps text-label-caps uppercase text-on-surface-variant pb-4 mb-4 border-b border-surface-variant leading-normal">
                  {format.priceNote}
                </p>
                <ul className="space-y-3">
                  {format.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 font-body-md text-body-md text-on-surface"
                    >
                      <Check
                        className="w-5 h-5 text-secondary shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant w-full sm:w-auto text-center sm:mr-2">
              Made for
            </span>
            {OCCASIONS.map((occasion) => (
              <Badge key={occasion} variant="outline">
                {occasion}
              </Badge>
            ))}
          </div>
        </section>

        {priceTable && (
        <section
          aria-labelledby="custom-pricing"
          className="max-w-3xl mx-auto mb-16 md:mb-20"
        >
          <h2
            id="custom-pricing"
            className="font-headline-md text-headline-md text-primary text-center mb-8"
          >
            Sizes &amp; Pricing
          </h2>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-surface-variant">
                  <th
                    scope="col"
                    className="px-4 md:px-8 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    className="px-4 md:px-8 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant text-right leading-normal"
                  >
                    Single-Sided
                  </th>
                  <th
                    scope="col"
                    className="px-4 md:px-8 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant text-right leading-normal"
                  >
                    Double-Sided
                  </th>
                </tr>
              </thead>
              <tbody>
                {priceTable.sizes.map((size) => (
                  <tr
                    key={size.variantId}
                    className="border-b border-surface-variant last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-4 md:px-8 py-5 font-body-md text-body-md text-on-surface font-normal whitespace-nowrap"
                    >
                      {size.size}
                    </th>
                    <td className="px-4 md:px-8 py-5 font-headline-sm text-headline-sm text-primary text-right">
                      {size.singleLabel}
                    </td>
                    <td className="px-4 md:px-8 py-5 font-headline-sm text-headline-sm text-primary text-right">
                      {size.doubleLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="font-body-md text-body-md text-on-surface-variant text-center mt-4">
            Illustrative launch prices. Custom Design includes a digital proof and one
            revision round; shipping is quoted with your order.
          </p>
        </section>
        )}

        <section
          aria-labelledby="custom-steps"
          className="max-w-5xl mx-auto mb-16 md:mb-20"
        >
          <h2
            id="custom-steps"
            className="font-headline-md text-headline-md text-primary text-center mb-8"
          >
            How a Custom Order Works
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.num} className="flex">
                  <Card className="p-8 w-full">
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-label-caps text-label-caps text-secondary">
                        {step.num}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-surface-container-low border border-surface-variant flex items-center justify-center text-primary">
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </div>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                      {step.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {step.description}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
            Ready to Begin?
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Email us your format, size and occasion. We reply with a quote and
            how to send your photos.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <a
              href={orderEmail}
              className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              Start a Custom Order
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <Link
              href="/support"
              className="inline-flex items-center justify-center min-h-12 border border-outline text-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              Ask a Question
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
