import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Thi Bút — Meaning Before Style",
  description:
    "Learn how Thi Bút transforms names, words, and personal stories into culturally meaningful calligraphy-inspired art.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-on-background selection:bg-secondary/20">
      <section className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop text-center">
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
          About Thi Bút
        </p>
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-background max-w-4xl mx-auto mb-8">
          Words carry meaning. <br className="hidden md:block" />
          Strokes give them character.
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Thi Bút transforms names, words, and personal stories into meaningful calligraphy-inspired art.
        </p>
      </section>

      <section className="py-24 bg-surface-container-low border-y border-surface-variant px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              What does <span lang="vi">Thi Bút</span> mean?
            </h2>
            <div className="space-y-8">
              <div>
                <p className="font-headline-md text-headline-md text-primary mb-2">
                  <span lang="vi">Thi</span> / <span lang="zh">詩</span>
                </p>
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  Poetry
                </p>
              </div>
              <div className="h-px w-16 bg-outline-variant" />
              <div>
                <p className="font-headline-md text-headline-md text-primary mb-2">
                  <span lang="vi">Bút</span> / <span lang="zh">筆</span>
                </p>
                <p className="font-body-lg text-body-lg text-on-surface-variant">
                  Pen · Brush
                </p>
              </div>
            </div>
            <p className="font-body-lg text-body-lg mt-12 text-on-surface">
              Together, <span lang="vi">Thi Bút</span> evokes the poetic brush — words expressed through artistic strokes.
            </p>
          </div>
          <div className="bg-surface-container-lowest border border-surface-variant rounded-lg flex items-center justify-center p-12">
            <div className="text-center">
              <span className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em]">
                Words Become Art.
              </span>
              <p className="font-body-lg text-body-lg mt-6 max-w-sm text-on-surface-variant">
                A name can carry identity. A phrase can carry conviction. A family name can carry history. Thi Bút gives those words a visual form.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto">
          <h2 className="font-label-caps text-label-caps uppercase text-center text-on-surface-variant mb-16">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {[
              {
                step: "01",
                title: "Enter Your Words",
                desc: "Name, phrase, or story.",
              },
              {
                step: "02",
                title: "Understand the Meaning",
                desc: "Explore phonetic, natural, or poetic interpretations where appropriate.",
              },
              {
                step: "03",
                title: "Choose Your Stroke",
                desc: "Select a visual expression inspired by calligraphy traditions and modern design.",
              },
              {
                step: "04",
                title: "Make It Yours",
                desc: "Create artwork for digital use, fine prints, or wearable garments.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-secondary mb-4">
                  {item.step}
                </span>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
                  {item.title}
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-tertiary-container text-on-tertiary px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-headline-md text-headline-md mb-6">
              Meaning Before Style.
            </h2>
            <p className="font-body-lg text-body-lg text-on-tertiary/85 mb-6">
              Beautiful lettering means little if the words are wrong.
            </p>
            <p className="font-body-md text-body-md text-on-tertiary-container mb-6">
              Thi Bút distinguishes between phonetic transliteration, literal translation, natural phrasing, poetic idiom, and cultural artistic rendering — and shows you what a phrase means before it becomes artwork (INV-011).
            </p>
          </div>

          <div className="bg-on-tertiary/5 rounded-lg p-8 md:p-10 border border-on-tertiary/15">
            <h3 className="font-label-caps text-label-caps text-on-tertiary-container uppercase mb-8">
              Example: The Name &ldquo;David&rdquo;
            </h3>
            <div className="space-y-8">
              <div>
                <p className="font-label-caps text-label-caps text-on-tertiary-container uppercase mb-2">
                  Original
                </p>
                <p className="font-headline-sm text-headline-sm">David</p>
              </div>
              <div className="h-px w-full bg-on-tertiary/15" />
              <div>
                <p className="font-label-caps text-label-caps text-on-tertiary-container uppercase mb-2">
                  Vietnamese Phonetic
                </p>
                <p lang="vi" className="font-headline-sm text-headline-sm">
                  Đa-vít
                </p>
              </div>
              <div className="h-px w-full bg-on-tertiary/15" />
              <div>
                <p className="font-label-caps text-label-caps text-on-tertiary-container uppercase mb-2">
                  Sino-Vietnamese Artistic Rendering
                </p>
                <p lang="zh" className="font-display-lg text-display-lg mb-2">
                  大衛
                </p>
                <p lang="vi" className="font-body-md text-body-md text-on-tertiary-container">
                  Đại Vệ
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-surface-container-low px-margin-mobile md:px-margin-desktop text-center border-t border-surface-variant">
        <h2 className="font-headline-md text-headline-md text-primary mb-10">
          What will your words become?
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link
            href="/custom"
            className="inline-flex items-center justify-center bg-primary text-on-primary px-8 py-4 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
          >
            Start a Custom Order{" "}
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Link>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center text-on-surface font-label-caps text-label-caps uppercase hover:text-secondary transition-colors motion-reduce:transition-none"
          >
            Explore the Gallery{" "}
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
