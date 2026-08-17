import Link from "next/link";
import { ArrowRight, HelpCircle, Mail, MessageSquare, Package, Type, Image as ImageIcon, Truck, ShieldCheck, UserCheck } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support & Help Center | Thi Bút",
  description: "Need help with your Thi Bút? Get assistance with design creation, language questions, orders, and licensing.",
};

export default function SupportPage() {
  const supportTopics = [
    {
      title: "Creating a Design",
      icon: Type,
      desc: "Guidance on entering phrases, selecting calligraphy styles, choosing layouts, and configuring aspect ratios.",
    },
    {
      title: "Language & Interpretation Questions",
      icon: HelpCircle,
      desc: "Questions about Vietnamese Hán-Nôm, Japanese Shodō, Korean Hangul, or classical poetic nuances.",
    },
    {
      title: "Uploaded Images & Backgrounds",
      icon: ImageIcon,
      desc: "File formats (PNG/JPEG), high-resolution requirements, DPI guidelines, and AI background generation.",
    },
    {
      title: "Orders & Customization",
      icon: Package,
      desc: "Order tracking, modifying pending orders before production, reviewing digital proofs, and billing questions.",
    },
    {
      title: "Shipping & Fulfillment",
      icon: Truck,
      desc: "Worldwide delivery estimates, carrier tracking numbers, packaging standards, and customs duties.",
    },
    {
      title: "Artist & Licensing Questions",
      icon: ShieldCheck,
      desc: "Commercial license inquiries, artist partnership applications, royalty payouts, and attribution guidelines.",
    },
    {
      title: "Account & Device Trust",
      icon: UserCheck,
      desc: "Password reset assistance, 6-digit device verification PIN delivery, and studio login security.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-[#B3261E]" />
            Help & Assistance
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Support
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            Need help with your Thi Bút?
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Our team is here to assist you with every step of the creative and fulfillment process.
          </p>
        </div>

        {/* Dual Primary CTA Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          {/* Action 1 */}
          <div className="p-8 md:p-10 bg-[#111111] border border-[#222222] rounded-2xl flex flex-col justify-between hover:border-[#333333] transition-all">
            <div>
              <div className="w-12 h-12 rounded-full bg-[#B3261E]/10 text-[#B3261E] flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-2xl font-bold mb-3">Visit Help Center</h2>
              <p className="text-sm text-[#A8A399] leading-relaxed mb-8">
                Browse our comprehensive library of tutorials, calligraphy guides, print sizing charts, and FAQs.
              </p>
            </div>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#F6F1E7] hover:text-[#B3261E] transition-colors"
            >
              Visit Help Center <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Action 2 */}
          <div className="p-8 md:p-10 bg-[#111111] border border-[#222222] rounded-2xl flex flex-col justify-between hover:border-[#333333] transition-all">
            <div>
              <div className="w-12 h-12 rounded-full bg-[#B3261E]/10 text-[#B3261E] flex items-center justify-center mb-6">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-2xl font-bold mb-3">Contact Support</h2>
              <p className="text-sm text-[#A8A399] leading-relaxed mb-8">
                Directly reach our studio artisans and customer care team for personalized order or design inquiries.
              </p>
            </div>
            <a
              href="mailto:support@thibut.com"
              className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-[#8e1f18] transition-colors rounded-sm shadow-md"
            >
              Contact Thi Bút Support <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Topics Breakdown */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#A8A399] mb-8 text-center">
            Common Support Categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <div
                  key={topic.title}
                  className="p-6 bg-[#111111]/80 border border-[#222222] rounded-xl flex items-start gap-4 hover:border-[#333333] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#B3261E] flex-shrink-0 mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold mb-1 text-[#F6F1E7]">{topic.title}</h3>
                    <p className="text-xs text-[#A8A399] leading-relaxed">{topic.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
