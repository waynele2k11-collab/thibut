import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verse Library — Blessings and Messages in Vietnamese and English",
  description:
    "Curated verses, blessings and messages for weddings, parents, grand openings, new homes, remembrance and recognition, in Vietnamese and English.",
  alternates: { canonical: "/verse-library" },
};

// Example selections from Business Requirements v1.0 §07. Each language has its own
// culturally appropriate wording; the English line is not a literal translation.
// The managed, searchable library (review status, attribution, versions) is Milestone 2.
const VERSES = [
  {
    occasion: "Wedding & Love",
    vi: ["Trăm năm tình nghĩa vẹn toàn,", "Trọn đời chung bước, muôn vàn yêu thương."],
    en: "Two hearts, one journey, a lifetime of love.",
  },
  {
    occasion: "Parents & Gratitude",
    vi: ["Công cha như núi Thái Sơn,", "Nghĩa mẹ như nước trong nguồn chảy ra."],
    en: "Your love is our greatest inheritance.",
  },
  {
    occasion: "Grand Opening",
    vi: ["Khai trương hồng phát, vạn sự hanh thông,", "tài lộc dồi dào, thành công rực rỡ."],
    en: "May this new beginning bring lasting success and prosperity.",
  },
  {
    occasion: "New Home",
    vi: ["An cư lạc nghiệp, gia đạo bình an,", "phúc lộc đầy nhà."],
    en: "New keys. New dreams. A lifetime of beautiful memories.",
  },
  {
    occasion: "Memorial",
    vi: ["Dẫu xa khuất bóng hình hài,", "tình thương còn mãi, chẳng phai tháng ngày."],
    en: "Forever loved, forever missed, forever in our hearts.",
  },
  {
    occasion: "Recognition",
    vi: ["Tôn vinh cống hiến,", "ghi dấu thành công."],
    en: "In recognition of your dedication, excellence, and outstanding achievement.",
  },
] as const;

export default function VerseLibraryPage() {
  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16 md:py-28">
        <header className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <Badge variant="seal" className="mb-6">
            Vietnamese · English
          </Badge>
          <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
            Verse Library
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Blessings, wishes and messages for your piece. Each language has its own
            wording, chosen for meaning rather than translated word for word.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter max-w-5xl mx-auto mb-16 md:mb-20">
          {VERSES.map((verse) => (
            <Card key={verse.occasion} className="p-6 md:p-8">
              <h2 className="font-label-caps text-label-caps uppercase text-secondary mb-4">
                {verse.occasion}
              </h2>
              <p
                lang="vi"
                className="font-headline-sm text-headline-sm text-primary mb-4"
              >
                {verse.vi.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant border-t border-surface-variant pt-4">
                {verse.en}
              </p>
            </Card>
          ))}
        </div>

        <section className="text-center pt-10 border-t border-surface-variant max-w-xl mx-auto">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
            Use a Verse, or Write Your Own
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            With a Custom Design you can choose one of these, edit it, supply your own
            message, or leave the piece without text.
          </p>
          <Link
            href="/custom"
            className="inline-flex items-center justify-center gap-2 min-h-12 bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            Start a Custom Design
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}
