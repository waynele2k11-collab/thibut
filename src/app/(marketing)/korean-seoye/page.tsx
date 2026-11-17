import type { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Custom Korean Name Calligraphy (Seoye)",
  description:
    "Create a personalized Korean calligraphy shirt or artwork. Translate your name into Hangul brush lettering using the traditional Seoye aesthetic.",
  alternates: {
    canonical: "/korean-seoye",
  },
};

export default function KoreanSeoyePage() {
  return (
    <main className="w-full flex flex-col bg-background text-on-background min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary max-w-3xl">
          Create Your Name in{" "}
          <span className="text-secondary">Korean Calligraphy</span>
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Turn your name into authentic Hangul brush lettering. Personalize your own Korean Seoye artwork and apparel in seconds.
        </p>

        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name (e.g., Wayne)..."
            buttonText="Create My Hangul Art"
          />
        </div>
      </section>

      <section className="w-full bg-surface-container-lowest border-t border-surface-variant py-20">
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop space-y-6 font-body-md text-body-md text-on-surface-variant">
          <h2 className="font-headline-md text-headline-md text-primary">
            Hangul Transliteration vs Korean Translation
          </h2>
          <p>
            When writing a foreign name in Korean calligraphy, the most authentic approach is{" "}
            <strong className="text-on-surface">Hangul transliteration</strong>—writing the phonetic sounds of your name using the Hangul alphabet.
          </p>
          <p>
            For example, &ldquo;Wayne&rdquo; becomes &ldquo;<span lang="ko">웨인</span>&rdquo; (We-in), preserving pronunciation while styling it in dynamic brush strokes.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            What is Korean Seoye?
          </h3>
          <p>
            Seoye (<span lang="ko">서예</span>) is the Korean tradition of calligraphy. Modern Seoye embraces the Hangul alphabet with expressive stroke weight, balanced geometry, and lively rhythm.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            Personalized Korean Gifts
          </h3>
          <p>
            Whether celebrating a milestone, creating team apparel, or designing a meaningful keepsake, a custom Hangul name piece offers a personal connection to Korean calligraphy.
          </p>
        </div>
      </section>
    </main>
  );
}
