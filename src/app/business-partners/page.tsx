import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { orderMailto } from "@/lib/catalog/contact";

export const metadata: Metadata = {
  title: "Business Partners — Recognition and Client Gifts",
  description:
    "ThiBút works with real estate agents, builders, salons, wedding planners, photographers, funeral homes, HR teams, schools, sports organizations and interior designers.",
  alternates: { canonical: "/business-partners" },
};

const PARTNERS = [
  "Real estate agents and builders",
  "Wedding planners and photographers",
  "Salons and local businesses",
  "Funeral homes",
  "HR departments and schools",
  "Sports organizations",
  "Interior designers",
] as const;

const USES = [
  "Closing gifts with the home, family name and date",
  "Grand opening pieces with your logo and a prosperity verse",
  "Awards, retirement and years-of-service recognition",
  "Reception artwork and branded décor",
] as const;

export default function BusinessPartnersPage() {
  const enquiry = orderMailto("Business Partner Enquiry");
  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-28">
        <header className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <Badge variant="seal" className="mb-6">
            ThiBút Business
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Business Partners
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">
            Made-to-order recognition pieces and client gifts for organizations that
            mark milestones on behalf of the people they serve.
          </p>
          <a
            href={enquiry}
            className="inline-flex items-center justify-center gap-2 min-h-12 w-full sm:w-auto bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Contact Us
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-5xl mx-auto mb-12">
          <Card className="p-6 md:p-8">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-5">
              Who We Work With
            </h2>
            <ul className="space-y-3">
              {PARTNERS.map((partner) => (
                <li
                  key={partner}
                  className="flex items-start gap-3 font-body-md text-body-md text-on-surface"
                >
                  <Check
                    className="w-5 h-5 text-secondary shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  {partner}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 md:p-8">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-5">
              What Partners Order
            </h2>
            <ul className="space-y-3">
              {USES.map((use) => (
                <li
                  key={use}
                  className="flex items-start gap-3 font-body-md text-body-md text-on-surface"
                >
                  <Check
                    className="w-5 h-5 text-secondary shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  {use}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <p className="font-body-md text-body-md text-on-surface-variant text-center max-w-2xl mx-auto mb-8">
          Partner accounts with saved logos, approved templates, volume pricing and
          bulk recipient lists are planned. Today, partner orders are arranged
          directly with our team by email.
        </p>
        <div className="flex justify-center">
          <Link
            href="/business"
            className="inline-flex items-center justify-center gap-2 min-h-12 border border-outline text-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Browse Business Designs
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
