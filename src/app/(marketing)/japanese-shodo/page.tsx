import type { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Your Name in Japanese Calligraphy (Shodō)",
  description:
    "Turn your name into personalized Japanese brush artwork (Shodō). Choose to translate your name's meaning into Kanji or write it phonetically in Katakana.",
  alternates: {
    canonical: "/japanese-shodo",
  },
};

export default function JapaneseShodoPage() {
  return (
    <main className="w-full flex flex-col bg-background text-on-background min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary max-w-3xl">
          Create Your Name in{" "}
          <span className="text-secondary">Japanese Calligraphy</span>
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Turn your name into personalized Japanese brush artwork. Discover your Kanji meaning or render your name phonetically.
        </p>

        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name (e.g., Wayne)..."
            buttonText="Create My Shodō"
          />
        </div>
      </section>

      <section className="w-full bg-surface-container-lowest border-t border-surface-variant py-20">
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop space-y-6 font-body-md text-body-md text-on-surface-variant">
          <h2 className="font-headline-md text-headline-md text-primary">
            Should I translate my name into Japanese or write it phonetically?
          </h2>
          <p>
            When writing a non-Japanese name in Japanese, you have two expressive options in Shodō:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-on-surface">Phonetic (Katakana):</strong>{" "}
              Captures how your name sounds. For example, &ldquo;Wayne&rdquo; becomes &ldquo;<span lang="ja">ウェイン</span>&rdquo;.
            </li>
            <li>
              <strong className="text-on-surface">Meaning (Kanji):</strong>{" "}
              Selects Kanji characters matching the underlying meaning or spirit of your name.
            </li>
          </ul>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            What is Shodō?
          </h3>
          <p>
            Shodō (<span lang="ja">書道</span>) is the traditional Japanese art of calligraphy. Written with a bamboo brush and sumi ink on washi paper, it emphasizes the vital energy and presence of the calligrapher.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            Custom Japanese Calligraphy Gifts
          </h3>
          <p>
            A personalized Japanese name shirt or Shodō canvas print makes an unforgettable gift for martial artists, travelers, or anyone who appreciates minimalist Japanese aesthetics.
          </p>
        </div>
      </section>
    </main>
  );
}
