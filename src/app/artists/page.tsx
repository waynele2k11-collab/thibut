import Link from "next/link";
import { ArrowRight, Feather, ShieldCheck, DollarSign, Sliders, Check } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artists & Creators — Attribution & Control | Thi Bút",
  description: "Thi Bút features original work from selected artists and creators. Artists maintain complete control over how their work is offered.",
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
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <Feather className="w-3.5 h-3.5 text-[#B3261E]" />
            Creator First Marketplace
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Artists
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            Art deserves attribution and control.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Thi Bút features original work from selected artists and creators. Artists maintain control over how their work may be offered, including permissions for personalization, translation, calligraphy overlays, recoloring, derivative compositions, merchandise, and commercial licensing.
          </p>
        </div>

        {/* Our Goal Callout */}
        <div className="p-8 md:p-12 bg-[#111111] border border-[#222222] rounded-2xl mb-16 shadow-xl max-w-4xl mx-auto text-center">
          <span className="font-mono text-xs text-[#B3261E] uppercase tracking-widest">Our Core Mission</span>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mt-4 mb-6">
            "Artists create the art. <br className="hidden sm:block" />
            Thi Bút helps introduce it to the world."
          </h2>
          <p className="text-[#A8A399] text-base max-w-2xl mx-auto leading-relaxed">
            We handle cultural interpretation engines, automated 300 DPI print-master rendering, worldwide Printful fulfillment, and secure customer billing so creators can focus purely on original artistic expression.
          </p>
        </div>

        {/* Granular Control List */}
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#A8A399] mb-8 text-center">
            Artist Control Matrix
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatorControls.map((ctrl) => (
              <div
                key={ctrl}
                className="p-5 bg-[#111111] border border-[#222222] rounded-xl flex items-center gap-3 text-sm text-[#F6F1E7]"
              >
                <div className="w-6 h-6 rounded-full bg-[#B3261E]/20 text-[#B3261E] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>{ctrl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Artist Onboarding CTA */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto">
          <h3 className="font-serif text-2xl font-bold mb-4">Join the Creator Studio</h3>
          <p className="text-sm text-[#A8A399] mb-8">Are you a calligrapher, typographer, or visual artist? Partner with Thi Bút to publish interactive, personalizable collections.</p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#8e1f18] transition-colors rounded-sm shadow-lg"
          >
            Apply as an Artist <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
