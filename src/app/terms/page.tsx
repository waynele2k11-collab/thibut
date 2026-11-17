import type { Metadata } from "next";
import { FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules that protect creators, customers, and Thi Bút.",
};

export default function TermsPage() {
  const sections = [
    {
      title: "1. Account Responsibilities",
      content:
        "Users must provide accurate registration details, maintain credential confidentiality, and accept responsibility for all activities occurring under their authenticated session.",
    },
    {
      title: "2. User-Generated Content",
      content:
        "You retain ownership of original text and images you submit. By uploading content, you grant Thi Bút a worldwide, non-exclusive license to process, render, mock up, and fulfill your custom merchandise.",
    },
    {
      title: "3. Intellectual Property",
      content:
        "All Thi Bút software, cultural interpretation algorithms, UI components, typography engines, and brand assets are the exclusive property of Thi Bút.",
    },
    {
      title: "4. Purchases and Payments",
      content:
        "Payments are processed securely via Stripe. By placing an order, you authorize the charge for the specified item subtotal, applicable taxes, shipping rates, and personalization fees.",
    },
    {
      title: "5. Personalized Products & Made-to-Order Nature",
      content:
        "Because each physical product is custom printed to order based on your personalized calligraphy specifications, items cannot be restocked or returned for buyer change of mind.",
    },
    {
      title: "6. Artist Licensing & Royalties",
      content:
        "Artist designs are licensed strictly under the permissions granted at checkout. Modifying, redistributing, or commercializing designs outside your purchased license tier is prohibited.",
    },
    {
      title: "7. Prohibited Uses",
      content:
        "You may not upload defamatory, hateful, abusive, sexually explicit, or infringing content. Misuse of the cultural generator to demean heritage traditions is strictly barred.",
    },
    {
      title: "8. Refunds and Fulfillment",
      content:
        "We replace or refund items that arrive damaged, defective, misprinted, or materially different from the confirmed digital proof. Inquiries must be submitted within 14 days of delivery.",
    },
    {
      title: "9. Platform Limitations & Warranties",
      content:
        "Thi Bút provides the studio services 'as is'. While our cultural engine strives for deep linguistic nuance, artistic interpretations may vary across dialectal traditions.",
    },
    {
      title: "10. Account Suspension and Termination",
      content:
        "Thi Bút reserves the right to suspend or terminate accounts that repeatedly violate intellectual property rights, engage in fraudulent chargebacks, or breach these terms.",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <FileCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Agreement &amp; Conditions
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Terms of Service
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            The rules that protect creators, customers, and Thi Bút.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            These Terms of Service govern your access to and use of the Thi Bút marketplace, studio tools, personalization APIs, and custom fulfillment services.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6 mb-20">
          {sections.map((section) => (
            <Card key={section.title} className="p-8">
              <h2 className="font-headline-sm text-headline-sm text-primary mb-3">
                {section.title}
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                {section.content}
              </p>
            </Card>
          ))}
        </div>

        <div className="text-center pt-8 border-t border-surface-variant max-w-xl mx-auto font-label-caps text-label-caps text-on-surface-variant">
          <p className="mb-2">Last Updated: August 2026</p>
          <p>For questions regarding our terms, reach out to legal@thibut.com.</p>
        </div>
      </div>
    </main>
  );
}
