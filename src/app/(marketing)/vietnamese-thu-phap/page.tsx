import type { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Create Your Name in Vietnamese Thư Pháp",
  description:
    "Transform your English name or words into beautiful, authentic Vietnamese Thư Pháp brush calligraphy. Keep your exact words or translate the meaning.",
  alternates: {
    canonical: "/vietnamese-thu-phap",
  },
};

export default function VietnameseThuPhapPage() {
  return (
    <main className="w-full flex flex-col bg-background text-on-background min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary max-w-3xl">
          Create Your Name or Words in{" "}
          <span className="text-secondary">
            Vietnamese <span lang="vi">Thư Pháp</span>
          </span>
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Experience the poetic beauty of traditional Vietnamese brush calligraphy. Enter your name, a favorite quote, or a meaningful word to see it instantly transformed.
        </p>

        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="e.g. Wayne, Love, Harmony..."
            buttonText="Create My Thư Pháp"
          />
        </div>
      </section>

      <section className="w-full bg-surface-container-lowest border-t border-surface-variant py-20">
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop space-y-6 font-body-md text-body-md text-on-surface-variant">
          <h2 className="font-headline-md text-headline-md text-primary">
            What is Vietnamese <span lang="vi">Thư Pháp</span>?
          </h2>
          <p>
            Unlike Chinese or Japanese calligraphy which uses Han characters, modern Vietnamese{" "}
            <span lang="vi">Thư Pháp</span> applies flowing brush techniques to the Latin-based Vietnamese alphabet (<span lang="vi">Quốc Ngữ</span>).
          </p>
          <p>
            This creates a distinctive synthesis: you can preserve your exact English or Vietnamese words while rendering them in an authentic East Asian brush aesthetic.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            Can English be written in Vietnamese <span lang="vi">Thư Pháp</span>?
          </h3>
          <p>
            Yes. Because modern Vietnamese <span lang="vi">Thư Pháp</span> works natively with Latin lettering and diacritics, Thi Bút preserves names such as &ldquo;Wayne&rdquo; while applying expressive Vietnamese calligraphic brush strokes.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            Meaningful Keepsakes &amp; <span lang="vi">Tết</span> Gifts
          </h3>
          <p>
            Whether you are looking for a personalized garment, a custom canvas print for your home, or a thoughtful gift for{" "}
            <span lang="vi">Tết</span> (Vietnamese New Year), custom{" "}
            <span lang="vi">Thư Pháp</span> art carries lasting cultural warmth.
          </p>
        </div>
      </section>
    </main>
  );
}
