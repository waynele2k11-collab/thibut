import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Scale, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Legal & IP Policy",
  description:
    "Create with respect. Learn about Thi Bút's intellectual property, trademark, and copyright policies.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <Scale className="w-3.5 h-3.5" aria-hidden="true" />
            Compliance &amp; Integrity
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Legal
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Create with respect.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Thi Bút supports personal creativity while respecting intellectual property, trademarks, copyrights, cultural works, and artist rights.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-8 mb-20">
          <Card className="p-8 md:p-10">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-secondary" aria-hidden="true" />
              User Responsibilities &amp; Uploaded Content
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Users are strictly responsible for having all necessary rights, licenses, permissions, or clearances for any images, text, brand logos, custom artwork, or other source materials they upload to the studio or ask Thi Bút to reproduce.
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Thi Bút maintains automated moderation pipelines and human auditing to verify that uploaded content does not infringe on third-party copyrights or trademark registrations.
            </p>
          </Card>

          <Card className="p-8 md:p-10">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-3">
              <FileText className="w-6 h-6 text-secondary" aria-hidden="true" />
              Content Moderation &amp; Enforcement
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Thi Bút reserves the right to restrict, review, reject, or permanently remove any design, order, or user account that appears to violate applicable intellectual property laws, trademark rights, cultural sacredness policies, or our platform guidelines.
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Orders flagged for trademark infringement or prohibited content will be canceled and refunded in accordance with our fulfillment policies.
            </p>
          </Card>

          <Card className="p-8 md:p-10">
            <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-secondary" aria-hidden="true" />
              DMCA &amp; Rights Holder Inquiries
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              If you are a copyright owner, artist, or trademark holder and believe that content hosted on or produced through Thi Bút infringes upon your rights, please submit a detailed takedown notification to our legal department.
            </p>
            <p className="font-label-caps text-label-caps text-secondary">
              Direct Inquiries: legal@thibut.com
            </p>
          </Card>
        </div>

        <div className="text-center pt-8 border-t border-surface-variant max-w-xl mx-auto">
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-4">
            Related Policies
          </p>
          <div className="flex justify-center gap-6 font-label-caps text-label-caps uppercase">
            <Link
              href="/terms"
              className="text-primary hover:text-secondary transition-colors motion-reduce:transition-none underline"
            >
              Terms of Service →
            </Link>
            <Link
              href="/licensing"
              className="text-primary hover:text-secondary transition-colors motion-reduce:transition-none underline"
            >
              Licensing Terms →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
