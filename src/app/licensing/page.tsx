import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Licensing & Permissions",
  description:
    "Know what you can create, use, and sell. Licensing determines how artwork may be used.",
};

export default function LicensingPage() {
  const licenseTiers = [
    {
      title: "Personal Products",
      desc: "One-time manufacturing on physical merchandise (hoodies, tees, fine art prints, mugs, tote bags) for personal ownership or gift giving.",
      badge: "Standard",
    },
    {
      title: "Personal Digital Use",
      desc: "High-resolution digital downloads (4500×5400 px @ 300 DPI transparent PNGs) for personal devices and non-commercial profiles.",
      badge: "Included",
    },
    {
      title: "Personalized Editions",
      desc: "Unique custom adaptations modifying source text, calligraphy overlays, recoloring, and layout composition under creator guidelines.",
      badge: "Custom",
    },
    {
      title: "Commercial Merchandise",
      desc: "Small-batch retail or brand merchandise sales. Requires an explicit Commercial License grant from the original artist.",
      badge: "Extended",
    },
    {
      title: "Limited or Extended Licenses",
      desc: "Enterprise, broadcast, or brand identity rights negotiated directly with verified master creators.",
      badge: "Enterprise",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            Usage Rights &amp; Transparency
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Licensing
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Know what you can create, use, and sell.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Licensing determines how artwork may be used. Depending on the artwork and creator permissions, a design may be available across multiple tiers. Not every artwork supports every type of modification or commercial use.
          </p>
        </div>

        <Card className="p-8 md:p-12 mb-16 max-w-4xl mx-auto bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-secondary" aria-hidden="true" />
            Immutable License Snapshots (INV-004)
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Thi Bút displays available permissions and license terms before applicable purchases. At order completion, the exact license permissions, purchase price, and rights are permanently frozen in an immutable database snapshot.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-label-caps text-label-caps uppercase text-on-surface pt-4 border-t border-surface-variant">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Transparent Royalty Distribution
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Permanent Cryptographic License ID
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Clear Commercial Use Disclosures
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Artist Modification Controls
            </div>
          </div>
        </Card>

        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-8 text-center">
            Standard License Categories
          </h2>
          <div className="space-y-4">
            {licenseTiers.map((tier) => (
              <Card
                key={tier.title}
                className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4"
              >
                <div className="space-y-1">
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    {tier.title}
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant max-w-xl">
                    {tier.desc}
                  </p>
                </div>
                <Badge variant="secondary" className="self-start sm:self-center">
                  {tier.badge}
                </Badge>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
            Explore the Collection
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Browse curated gallery pieces with transparent licensing and print-ready options.
          </p>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Visit Art Gallery{" "}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
