import Link from "next/link";
import { ArrowRight, ShieldCheck, CheckCircle2, Lock, FileText } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licensing & Permissions | Thi Bút",
  description: "Know what you can create, use, and sell. Licensing determines how artwork may be used.",
};

export default function LicensingPage() {
  const licenseTiers = [
    {
      title: "Personal Products",
      desc: "One-time manufacturing on physical merchandise (streetwear hoodies, tees, fine art prints, mugs, tote bags) for personal ownership or gift giving.",
      badge: "Standard",
    },
    {
      title: "Personal Digital Use",
      desc: "High-resolution digital downloads (300 DPI transparent PNGs, wallpaper exports) for personal devices and non-commercial social profiles.",
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
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <Lock className="w-3.5 h-3.5 text-[#B3261E]" />
            Usage Rights & Transparency
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Licensing
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            Know what you can create, use, and sell.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Licensing determines how artwork may be used. Depending on the artwork and creator permissions, a design may be available across multiple tiers. Not every artwork supports every type of modification or commercial use.
          </p>
        </div>

        {/* Core Principles */}
        <div className="p-8 md:p-12 bg-[#111111] border border-[#222222] rounded-2xl mb-16 shadow-xl max-w-4xl mx-auto">
          <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#B3261E]" />
            Immutable License Snapshots
          </h2>
          <p className="text-[#A8A399] text-base leading-relaxed mb-6">
            Thi Bút displays available permissions and license terms before applicable purchases. At the time of order completion, the exact license permissions, purchase price, and rights are permanently frozen in an immutable database snapshot.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-[#F6F1E7]/90 pt-4 border-t border-[#222222]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A9E48]" /> Transparent Royalty Distribution
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A9E48]" /> Permanent Cryptographic License ID
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A9E48]" /> Clear Commercial Use Disclosures
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0A9E48]" /> Artist Modification Controls
            </div>
          </div>
        </div>

        {/* License Tiers List */}
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#A8A399] mb-8 text-center">
            Standard License Categories
          </h2>
          <div className="space-y-4">
            {licenseTiers.map((tier) => (
              <div
                key={tier.title}
                className="p-6 bg-[#111111] border border-[#222222] rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-[#333333] transition-colors"
              >
                <div className="space-y-1">
                  <h3 className="font-serif text-xl font-bold">{tier.title}</h3>
                  <p className="text-sm text-[#A8A399] max-w-xl">{tier.desc}</p>
                </div>
                <span className="self-start sm:self-center px-3 py-1 bg-[#1A1A1A] border border-[#333333] text-xs font-mono text-[#F6F1E7] uppercase tracking-wider rounded-md">
                  {tier.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto">
          <h3 className="font-serif text-2xl font-bold mb-4">Explore the Collection</h3>
          <p className="text-sm text-[#A8A399] mb-8">Browse curated gallery pieces with transparent licensing and print-ready options.</p>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#8e1f18] transition-colors rounded-sm shadow-lg"
          >
            Visit Art Gallery <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
