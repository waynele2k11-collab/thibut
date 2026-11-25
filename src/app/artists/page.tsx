import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Feather } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Artists & Creators — Attribution & Control",
  description:
    "Thi Bút features original work from selected artists and creators. Artists maintain complete control over how their work is offered.",
};

export default function ArtistsPage() {
  const creatorControls = [
    "Personalization Permissions (Names, Quotes, Phrasings)",
    "Calligraphy & Character Overlays",
    "Translation & Cultural Interpretation Rules",
    "Recoloring & Palette Customizations",
    "Derivative Compositions & Layout Styling",
    "Physical Merchandise & Apparel Catalog Selection",
    "Commercial Licensing Rights & Pricing",
    "Direct Stripe Automated Royalty Payouts",
  ];

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <Feather className="w-3.5 h-3.5" aria-hidden="true" />
            Creator First Marketplace
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Artists
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Art deserves attribution and control.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Thi Bút features original work from selected artists and creators. Artists maintain control over how their work may be offered, including permissions for personalization, translation, calligraphy overlays, recoloring, derivative compositions, merchandise, and commercial licensing.
          </p>
        </div>

        <Card className="p-8 md:p-12 mb-16 max-w-4xl mx-auto text-center bg-surface-container-low">
          <span className="font-label-caps text-label-caps text-secondary uppercase">
            Our Core Mission
          </span>
          <h2 className="font-headline-md text-headline-md text-primary mt-4 mb-6">
            &ldquo;Artists create the art. <br className="hidden sm:block" />
            Thi Bút helps introduce it to the world.&rdquo;
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
            We handle cultural interpretation engines, automated 300 DPI print-master rendering, worldwide Printful fulfillment, and secure customer billing so creators can focus on original artistic expression.
          </p>
        </Card>

        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-8 text-center">
            Artist Control Matrix
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatorControls.map((ctrl) => (
              <Card
                key={ctrl}
                className="p-5 flex items-center gap-3 font-body-md text-sm text-on-surface"
              >
                <div className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
                <span>{ctrl}</span>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
            Join the Creator Studio
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Are you a calligrapher, typographer, or visual artist? Partner with Thi Bút to publish personalizable collections.
          </p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Apply as an Artist <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
