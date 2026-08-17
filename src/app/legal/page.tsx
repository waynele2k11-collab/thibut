import Link from "next/link";
import { ArrowRight, Scale, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal & IP Policy | Thi Bút",
  description: "Create with respect. Learn about Thi Bút's intellectual property, trademark, and copyright policies.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <Scale className="w-3.5 h-3.5 text-[#B3261E]" />
            Compliance & Integrity
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Legal
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            Create with respect.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Thi Bút supports personal creativity while respecting intellectual property, trademarks, copyrights, cultural works, and artist rights.
          </p>
        </div>

        {/* Content Section */}
        <div className="max-w-4xl mx-auto space-y-8 mb-20">
          <div className="p-8 md:p-10 bg-[#111111] border border-[#222222] rounded-2xl">
            <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-[#B3261E]" />
              User Responsibilities & Uploaded Content
            </h2>
            <p className="text-[#A8A399] text-base leading-relaxed mb-4">
              Users are strictly responsible for having all necessary rights, licenses, permissions, or clearances for any images, text, brand logos, custom artwork, or other source materials they upload to the studio or ask Thi Bút to reproduce.
            </p>
            <p className="text-[#A8A399] text-base leading-relaxed">
              Thi Bút maintains automated moderation pipelines and human auditing to verify that uploaded content does not infringe on third-party copyrights or trademark registrations.
            </p>
          </div>

          <div className="p-8 md:p-10 bg-[#111111] border border-[#222222] rounded-2xl">
            <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-3">
              <FileText className="w-6 h-6 text-[#B3261E]" />
              Content Moderation & Enforcement
            </h2>
            <p className="text-[#A8A399] text-base leading-relaxed mb-4">
              Thi Bút reserves the right to restrict, review, reject, or permanently remove any design, order, or user account that appears to violate applicable intellectual property laws, trademark rights, cultural sacredness policies, or our platform guidelines.
            </p>
            <p className="text-[#A8A399] text-base leading-relaxed">
              Orders flagged for trademark infringement or prohibited content will be canceled and refunded in accordance with our fulfillment policies.
            </p>
          </div>

          <div className="p-8 md:p-10 bg-[#111111] border border-[#222222] rounded-2xl">
            <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-[#B3261E]" />
              DMCA & Rights Holder Inquiries
            </h2>
            <p className="text-[#A8A399] text-base leading-relaxed mb-4">
              If you are a copyright owner, artist, or trademark holder and believe that content hosted on or produced through Thi Bút infringes upon your rights, please submit a detailed takedown notification to our legal department.
            </p>
            <p className="font-mono text-xs text-[#B3261E]">
              Direct Inquiries: legal@thibut.com
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-[#A8A399] mb-4">Related Policies</p>
          <div className="flex justify-center gap-6 text-sm font-mono">
            <Link href="/terms" className="text-[#F6F1E7] hover:text-[#B3261E] transition-colors underline">Terms of Service →</Link>
            <Link href="/licensing" className="text-[#F6F1E7] hover:text-[#B3261E] transition-colors underline">Licensing Terms →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
