import Link from "next/link";
import { ArrowRight, Type, Sparkles, Layers, Eye, Palette, Package } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — From Words to Meaningful Art | Thi Bút",
  description: "Thi Bút transforms names, words, and personal expressions through a guided creative process.",
};

export default function HowItWorksPage() {
  const steps = [
    {
      num: "01",
      title: "Enter",
      icon: Type,
      description: "Input your name, meaningful word, personal mantra, or poetry in any language.",
    },
    {
      num: "02",
      title: "Interpret",
      icon: Sparkles,
      description: "Choose how your words should be represented: phonetic transliteration, literal translation, natural phrasing, or poetic heritage.",
    },
    {
      num: "03",
      title: "Style",
      icon: Palette,
      description: "Select an authentic calligraphy-inspired script, brush stroke density, and artistic style.",
    },
    {
      num: "04",
      title: "Preview",
      icon: Eye,
      description: "Inspect live variations, character stroke orders, semantic meanings, and cultural commentary.",
    },
    {
      num: "05",
      title: "Compose",
      icon: Layers,
      description: "Personalize the composition layout, background paper textures, gold foils, and artist seals.",
    },
    {
      num: "06",
      title: "Product",
      icon: Package,
      description: "Apply your finished artwork to a museum-grade digital export or 300 DPI physical streetwear & wall art.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            The Creative Journey
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            How It Works
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            From words to meaningful art.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Thi Bút transforms names, words, and personal expressions through a guided creative process:
          </p>

          {/* Linear Flow Indicator */}
          <div className="mt-8 py-4 px-6 bg-[#111111] border border-[#222222] rounded-full inline-flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-[#A8A399] tracking-wider">
            <span className="text-[#F6F1E7] font-bold">Enter</span>
            <span className="text-[#B3261E]">→</span>
            <span className="text-[#F6F1E7] font-bold">Interpret</span>
            <span className="text-[#B3261E]">→</span>
            <span className="text-[#F6F1E7] font-bold">Style</span>
            <span className="text-[#B3261E]">→</span>
            <span className="text-[#F6F1E7] font-bold">Preview</span>
            <span className="text-[#B3261E]">→</span>
            <span className="text-[#F6F1E7] font-bold">Compose</span>
            <span className="text-[#B3261E]">→</span>
            <span className="text-[#F6F1E7] font-bold">Product</span>
          </div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="p-8 bg-[#111111] border border-[#222222] rounded-2xl flex flex-col justify-between hover:border-[#444444] transition-all group"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="font-mono text-xs text-[#B3261E] font-bold">{step.num}</span>
                    <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#333333] flex items-center justify-center text-[#A8A399] group-hover:text-[#F6F1E7] group-hover:border-[#B3261E] transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="font-serif text-2xl font-bold mb-3">{step.title}</h3>
                  <p className="text-sm text-[#A8A399] leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto">
          <h3 className="font-serif text-2xl font-bold mb-4">Start Your Creation</h3>
          <p className="text-sm text-[#A8A399] mb-8">Choose how your words should be represented and apply your finished artwork to digital designs or physical products.</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#8e1f18] transition-colors rounded-sm shadow-lg"
          >
            Launch Creator Studio <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
