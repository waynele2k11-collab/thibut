import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How It Works — Buy Now or Custom Design",
  description:
    "Two ways to order from ThiBút: buy a ready-made design as shown, or commission a custom design with a proof you approve before production.",
  alternates: { canonical: "/how-it-works" },
};

const MODELS = [
  {
    name: "Buy Now",
    summary: "A ready-made design, exactly as shown.",
    steps: [
      "Choose a design from Personal, Business or Living.",
      "Select a size and single or double-sided artwork.",
      "Add to cart and pay.",
      "We produce your piece to order.",
      "We quality-check, pack and ship it with tracking.",
    ],
    note: "Unchanged catalog artwork does not need a proof.",
    href: "/personal",
    cta: "Shop Designs",
  },
  {
    name: "Custom Design",
    summary: "A composition made from your photos, logo and words.",
    steps: [
      "Choose a design as inspiration, or start from scratch.",
      "Send your photos or logo and the names, dates and wording.",
      "Submit and pay. Design work begins after payment.",
      "A designer prepares a proof and checks likeness and spelling.",
      "You approve, or request changes. One revision round is included.",
      "Only the approved artwork is produced, checked and shipped.",
    ],
    note: "Nothing personalized is manufactured without your approval.",
    href: "/custom",
    cta: "Start a Custom Design",
  },
] as const;

const STAGES = [
  ["Order submitted", "We record your configuration, uploads and requirements."],
  ["Designing", "A designer prepares artwork from approved assets."],
  ["Internal review", "We verify likeness, spelling, dimensions and print feasibility."],
  ["Proof ready", "You receive a flat proof and a simulated product preview."],
  ["Approved", "Your approval locks the exact production artwork."],
  ["In production", "Film printing and clear resin casting."],
  ["Quality control", "We inspect alignment, finish, dimensions, bubbles and damage."],
  ["Shipped", "Packed, dispatched and tracked."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-28">
        <header className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <Badge variant="seal" className="mb-6">
            Made to Order
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            How It Works
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Every ThiBút piece is made to order from artwork printed on transparent
            film and cast in clear resin. There are two ways to order.
          </p>
        </header>

        <section
          aria-label="Ways to order"
          className="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-5xl mx-auto mb-16 md:mb-20"
        >
          {MODELS.map((model) => (
            <Card key={model.name} className="p-6 md:p-8 flex flex-col">
              <h2 className="font-headline-md text-headline-md text-primary mb-2">
                {model.name}
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                {model.summary}
              </p>
              <ol className="space-y-3 mb-6">
                {model.steps.map((step, index) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 font-body-md text-body-md text-on-surface"
                  >
                    <span className="font-label-caps text-label-caps text-secondary pt-1.5 w-5 shrink-0">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="font-body-md text-body-md text-on-surface-variant border-t border-surface-variant pt-4 mb-6">
                {model.note}
              </p>
              <Link
                href={model.href}
                className="mt-auto inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              >
                {model.cta}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </Card>
          ))}
        </section>

        <section aria-labelledby="order-stages" className="max-w-3xl mx-auto">
          <h2
            id="order-stages"
            className="font-headline-md text-headline-md text-primary text-center mb-8"
          >
            From Order to Delivery
          </h2>
          <ol className="border border-surface-variant rounded-lg bg-surface-container-lowest divide-y divide-surface-variant">
            {STAGES.map(([stage, action], index) => (
              <li key={stage} className="flex items-start gap-4 p-4 md:p-5">
                <span className="font-label-caps text-label-caps text-secondary pt-1.5 w-6 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    {stage}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    {action}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="font-body-md text-body-md text-on-surface-variant text-center mt-6">
            The design, review and approval stages apply to Custom Design orders.
          </p>
        </section>
      </div>
    </main>
  );
}
