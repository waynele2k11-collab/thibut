import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  Layers,
  Package,
  Palette,
  Sparkles,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "How It Works — From Words to Meaningful Art",
  description:
    "Thi Bút transforms names, words, and personal expressions through a guided creative process.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      num: "01",
      title: "Enter",
      icon: Type,
      description:
        "Input your name, meaningful word, personal mantra, or poetry in any language.",
    },
    {
      num: "02",
      title: "Interpret",
      icon: Sparkles,
      description:
        "Choose how your words should be represented: phonetic transliteration, literal translation, natural phrasing, or poetic heritage.",
    },
    {
      num: "03",
      title: "Style",
      icon: Palette,
      description:
        "Select an authentic calligraphy-inspired script, brush stroke density, and artistic style.",
    },
    {
      num: "04",
      title: "Preview",
      icon: Eye,
      description:
        "Inspect live variations, character fidelity, semantic meanings, and cultural commentary.",
    },
    {
      num: "05",
      title: "Compose",
      icon: Layers,
      description:
        "Personalize the composition layout, ink pigments, and cinnabar chop seals.",
    },
    {
      num: "06",
      title: "Product",
      icon: Package,
      description:
        "Apply your finished artwork to a 300 DPI digital master or physical garments and wall art.",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6">
            The Creative Journey
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            How It Works
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            From words to meaningful art.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Thi Bút transforms names, words, and personal expressions through a guided creative process:
          </p>

          <div className="mt-8 py-3.5 px-6 bg-surface-container-lowest border border-surface-variant rounded-lg inline-flex flex-wrap items-center justify-center gap-2 font-label-caps text-label-caps uppercase text-on-surface">
            <span>Enter</span>
            <span className="text-secondary" aria-hidden="true">
              →
            </span>
            <span>Interpret</span>
            <span className="text-secondary" aria-hidden="true">
              →
            </span>
            <span>Style</span>
            <span className="text-secondary" aria-hidden="true">
              →
            </span>
            <span>Preview</span>
            <span className="text-secondary" aria-hidden="true">
              →
            </span>
            <span>Compose</span>
            <span className="text-secondary" aria-hidden="true">
              →
            </span>
            <span>Product</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card
                key={step.num}
                className="p-8 flex flex-col justify-between hover:border-outline transition-colors motion-reduce:transition-none"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="font-label-caps text-label-caps text-secondary">
                      {step.num}
                    </span>
                    <div className="w-10 h-10 rounded-full bg-surface-container-low border border-surface-variant flex items-center justify-center text-primary">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-primary mb-3">
                    {step.title}
                  </h2>
                  <p className="font-body-md text-sm text-on-surface-variant leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
            Start Your Creation
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Choose how your words should be represented and apply your finished artwork to digital designs or physical products.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Launch Studio <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
