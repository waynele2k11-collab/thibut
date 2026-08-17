import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles, Compass } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cultural Guide — Meaning Before Strokes | Thi Bút",
  description: "Explore the languages, writing traditions, transliterations, and cultural interpretations used throughout Thi Bút.",
};

export default function CulturalGuidePage() {
  const interpretationModes = [
    {
      title: "Phonetic Rendering",
      description: "Transliterating names and sounds into native writing scripts (e.g. Katakana, Hangul, or Quốc Ngữ) while preserving original pronunciation.",
      example: "David → デイビッド (Deibiddo) / 세라 (Sera)",
    },
    {
      title: "Literal Translation",
      description: "Direct word-for-word semantic translation capturing exact dictionary definitions.",
      example: "Strength → Sức Mạnh / 力量",
    },
    {
      title: "Natural Interpretation",
      description: "Idiomatic phrasing that sounds organic and authentic to native speakers of the culture.",
      example: "Never Give Up → 諦めない (Akiramenai)",
    },
    {
      title: "Poetic Expression",
      description: "Metaphorical, lyrical, and philosophical interpretations drawn from classical literature and Zen poetry.",
      example: "Still Mind → 心不變 (A heart unchanged amidst turbulence)",
    },
    {
      title: "Heritage Study",
      description: "Historical root analysis of family names, ancient Hán-Nôm characters, and ancestral clan seal traditions.",
      example: "Nguyễn → 阮 / Trần → 陳 with authentic cinnabar seal",
    },
  ];

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F6F1E7] selection:bg-[#B3261E] selection:text-white">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#222222] via-[#0B0B0B] to-[#0B0B0B] opacity-40 pointer-events-none" />

      <div className="relative z-10 max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#333333] bg-[#111111] text-[#A8A399] font-mono text-xs uppercase tracking-widest mb-6">
            <Compass className="w-3.5 h-3.5 text-[#B3261E]" />
            Cultural Intelligence
          </div>
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Cultural Guide
          </h1>
          <p className="font-serif text-2xl md:text-3xl text-[#B3261E] italic mb-8">
            Meaning before strokes.
          </p>
          <p className="font-sans text-base md:text-lg text-[#A8A399] leading-relaxed">
            Explore the languages, writing traditions, transliterations, and cultural interpretations used throughout Thi Bút. Learn the difference between phonetic rendering, literal translation, natural interpretation, poetic expression, and culturally inspired artwork.
          </p>
        </div>

        {/* Core Philosophy Callout */}
        <div className="p-8 md:p-12 bg-[#111111] border border-[#222222] rounded-2xl mb-20 shadow-xl max-w-4xl mx-auto">
          <h2 className="font-serif text-2xl font-bold mb-4 flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-[#B3261E]" />
            The Visibility Principle
          </h2>
          <p className="text-[#A8A399] text-base leading-relaxed">
            Thi Bút is designed to make cultural distinctions visible so you understand what your words mean before they become art. We bridge ancient calligraphy traditions across Vietnamese Hán-Nôm, Japanese Shodō, Korean Hangul, and Chinese brushwork with thoughtful modern aesthetics.
          </p>
        </div>

        {/* Interpretation Modes Grid */}
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#A8A399] mb-8 text-center">
            Interpretation Framework
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {interpretationModes.map((mode, idx) => (
              <div
                key={mode.title}
                className="p-6 bg-[#111111]/80 border border-[#222222] rounded-xl hover:border-[#333333] transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="font-mono text-xs text-[#B3261E] mb-2 tracking-wider">0{idx + 1}</div>
                  <h3 className="font-serif text-xl font-bold mb-3">{mode.title}</h3>
                  <p className="text-sm text-[#A8A399] leading-relaxed mb-4">{mode.description}</p>
                </div>
                <div className="pt-4 border-t border-[#222222]/80 font-mono text-xs text-[#F6F1E7]/80">
                  <span className="text-[#666666]">Example: </span>{mode.example}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-8 border-t border-[#222222] max-w-xl mx-auto">
          <h3 className="font-serif text-2xl font-bold mb-4">Experience Your Words in Ink</h3>
          <p className="text-sm text-[#A8A399] mb-8">Discover how your personal name or meaningful quote renders across different calligraphy schools.</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-[#B3261E] text-white px-8 py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#8e1f18] transition-colors rounded-sm shadow-lg"
          >
            Create Your Thi Bút <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
