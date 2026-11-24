import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cultural Guide — Meaning Before Strokes",
  description:
    "Explore the languages, writing traditions, transliterations, and cultural interpretations used throughout Thi Bút.",
};

export default function CulturalGuidePage() {
  const interpretationModes = [
    {
      title: "Phonetic Rendering",
      description:
        "Transliterating names and sounds into native writing scripts (Katakana, Hangul, or Quốc Ngữ) while preserving original pronunciation.",
      example: "David → デイビッド (Deibiddo) / 세라 (Sera)",
    },
    {
      title: "Literal Translation",
      description:
        "Direct word-for-word semantic translation capturing exact dictionary definitions.",
      example: "Strength → Sức Mạnh / 力量",
      exampleLang: "vi",
    },
    {
      title: "Natural Interpretation",
      description:
        "Idiomatic phrasing that sounds organic and authentic to native speakers of the culture.",
      example: "Never Give Up → 諦めない (Akiramenai)",
    },
    {
      title: "Poetic Expression",
      description:
        "Metaphorical, lyrical, and philosophical interpretations drawn from classical literature and Zen poetry.",
      example: "Still Mind → 心不變 (A heart unchanged amidst turbulence)",
    },
    {
      title: "Heritage Study",
      description:
        "Historical root analysis of family names, Hán-Nôm characters, and ancestral clan seal traditions.",
      example: "Nguyễn → 阮 / Trần → 陳 with authentic cinnabar seal",
      exampleLang: "vi",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-20 md:py-28">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="seal" className="mb-6 gap-1.5">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            Cultural Intelligence
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Cultural Guide
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary italic mb-6">
            Meaning before strokes.
          </p>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Explore the languages, writing traditions, transliterations, and cultural interpretations used throughout Thi Bút. Learn the difference between phonetic rendering, literal translation, natural interpretation, poetic expression, and culturally inspired artwork.
          </p>
        </div>

        <Card className="p-8 md:p-12 mb-20 max-w-4xl mx-auto bg-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-secondary" aria-hidden="true" />
            The Visibility Principle
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Thi Bút makes cultural distinctions visible so you understand what your words mean before they become art. We bridge calligraphy traditions across Vietnamese{" "}
            <span lang="vi">Hán-Nôm</span> &amp; <span lang="vi">Quốc Ngữ</span>, Japanese Shodō, Korean Hangul, and Chinese brushwork with thoughtful modern design.
          </p>
        </Card>

        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-8 text-center">
            Interpretation Framework
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {interpretationModes.map((mode, idx) => (
              <Card
                key={mode.title}
                className="p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="font-label-caps text-label-caps text-secondary mb-2">
                    0{idx + 1}
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                    {mode.title}
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mb-4">
                    {mode.description}
                  </p>
                </div>
                <div
                  lang={mode.exampleLang}
                  className="pt-4 border-t border-surface-variant font-mono text-xs text-on-surface"
                >
                  <span className="text-on-surface-variant">Example: </span>
                  {mode.example}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
            Bring Your Words Into a Keepsake
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Our designers set your names, dates and chosen wording into a custom crystal keepsake.
          </p>
          <Link
            href="/custom"
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Start a Custom Order <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
