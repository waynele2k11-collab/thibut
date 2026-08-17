import Link from "next/link";
import { ArrowRight, FileCheck, Shield, AlertTriangle } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Thi Bút",
  description: "The rules that protect creators, customers, and Thi Bút.",
};

export default function TermsPage() {
  const sections = [
    {
      title: "1. Account Responsibilities",
      content: "Users must provide accurate registration details, maintain credential confidentiality, and accept responsibility for all activities occurring under their authenticated session.",
    },
    {
      title: "2. User-Generated Content",
      content: "You retain ownership of original text and images you submit. By uploading content, you grant Thi Bút a worldwide, non-exclusive license to process, render, mock up, and fulfill your custom merchandise.",
    },
    {
      title: "3. Intellectual Property",
      content: "All Thi Bút software, cultural interpretation algorithms, UI components, typography engines, and brand assets are the exclusive property of Thi Bút.",
    },
    {
      title: "4. Purchases and Payments",
      content: "Payments are processed securely via Stripe. By placing an order, you authorize the charge for the specified item subtotal, applicable taxes, shipping rates, and personalization fees.",
    },
    {
      title: "5. Personalized Products & Made-to-Order Nature",
      content: "Because each physical product is custom printed to order based on your personalized calligraphy specifications, items cannot be restocked or returned for buyer change of mind.",
    },
    {
      title: "6. Artist Licensing & Royalties",
      content: "Artist designs are licensed strictly under the permissions granted at checkout. Modifying, redistributing, or commercializing designs outside your purchased license tier is prohibited.",
    },
    {
      title: "7. Prohibited Uses",
      content: "You may not upload defamatory, hateful, abusive, sexually explicit, or infringing content. Misuse of the cultural generator to demean heritage traditions is strictly barred.",
    },
    {
      title: "8. Refunds and Fulfillment",
      content: "We replace or refund items that arrive damaged, defective, misprinted, or materially different from the confirmed digital proof. Inquiries must be submitted within 14 days of delivery.",
    },
    {
      title: "9. Platform Limitations & Warranties",
      content: "Thi Bút provides the studio services 'as is'. While our cultural engine strives for deep linguistic nuance, artistic interpretations may vary across dialectal traditions.",
    },
    {
      title: "10. Account Suspension and Termination",
      content: "Thi Bút reserves the right to suspend or terminate accounts that repeatedly violate intellectual property rights, engage in fraudulent chargebacks, or breach these terms.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <FileCheck className="w-3.5 h-3.5 text-[#B3261E]" />
            Agreement & Conditions
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Terms of Service
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            The rules that protect creators, customers, and Thi Bút.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            These Terms of Service govern your access to and use of the Thi Bút marketplace, studio tools, personalization APIs, and custom fulfillment services.
          </p>
        </div>

        {/* Section List */}
        <div className="max-w-4xl mx-auto space-y-6 mb-20">
          {sections.map((section) => (
            <div
              key={section.title}
              className="p-8 bg-[#111111] border border-[#222222] rounded-xl hover:border-[#333333] transition-colors"
            >
              <h2 className="font-serif text-xl font-bold mb-3 text-[#F6F1E7]">
                {section.title}
              </h2>
              <p className="text-sm text-[#A8A399] leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto text-xs font-mono text-[#666666]">
          <p className="mb-2">Last Updated: August 2026</p>
          <p>For questions regarding our terms, reach out to legal@thibut.com.</p>
        </div>
      </div>
    </main>
  );
}
