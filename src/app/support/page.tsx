import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  HelpCircle,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Package,
  ShieldCheck,
  Truck,
  Type,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Support & Help Center",
  description:
    "Need help with your Thi Bút? Get assistance with design creation, language questions, orders, and licensing.",
};

export default function SupportPage() {
  const supportTopics = [
    {
      title: "Creating a Design",
      icon: Type,
      desc: "Guidance on entering phrases, selecting calligraphy styles, choosing layouts, and configuring placements.",
    },
    {
      title: "Language & Interpretation Questions",
      icon: HelpCircle,
      desc: "Questions about Vietnamese Thư Pháp, Japanese Shodō, Korean Hangul, or classical poetic nuances.",
    },
    {
      title: "Uploaded Images & Backgrounds",
      icon: ImageIcon,
      desc: "File formats (PNG/JPEG), high-resolution requirements, DPI guidelines, and AI background generation.",
    },
    {
      title: "Orders & Customization",
      icon: Package,
      desc: "Order tracking, reviewing digital proofs, and billing questions.",
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
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Help &amp; Assistance
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Support
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Need help with your Thi Bút?
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Our team is here to assist you with every step of the creative and fulfillment process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          <Card className="p-8 md:p-10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-headline-sm text-headline-sm text-primary mb-3">
                How Custom Orders Work
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant mb-8">
                See the six steps from sending your photos to approval and shipping, with sizes and prices.
              </p>
            </div>
            <Link
              href="/custom"
              className="inline-flex items-center gap-2 font-label-caps text-label-caps uppercase text-primary hover:text-secondary transition-colors motion-reduce:transition-none"
            >
              See the Process{" "}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </Card>

          <Card className="p-8 md:p-10 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-6">
                <Mail className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="font-headline-sm text-headline-sm text-primary mb-3">
                Contact Support
              </h2>
              <p className="font-body-md text-sm text-on-surface-variant mb-8">
                Directly reach our studio artisans and customer care team for personalized order or design inquiries.
              </p>
            </div>
            <a
              href="mailto:support@thibut.com"
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none w-fit"
            >
              Contact Thi Bút Support{" "}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </Card>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-8 text-center">
            Common Support Categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {supportTopics.map((topic) => {
              const Icon = topic.icon;
              return (
                <Card
                  key={topic.title}
                  className="p-6 flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-container-low border border-surface-variant flex items-center justify-center text-secondary shrink-0 mt-0.5">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-base text-primary mb-1">
                      {topic.title}
                    </h3>
                    <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                      {topic.desc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
