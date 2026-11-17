import type { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Custom Chinese Calligraphy T-Shirt & Artwork",
  description:
    "Create personalized Chinese calligraphy apparel. Turn your name or favorite quote into traditional Shūfǎ brush lettering.",
  alternates: {
    canonical: "/chinese-shufa",
  },
};

export default function ChineseShufaPage() {
  return (
    <main className="w-full flex flex-col bg-background text-on-background min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary max-w-3xl">
          Create Your Name in{" "}
          <span className="text-secondary">Chinese Calligraphy</span>
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Transform your name or favorite quote into traditional Shūfǎ brush lettering. Instantly personalize a Chinese character shirt or art print.
        </p>

        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name or quote..."
            buttonText="Create My Shūfǎ"
          />
        </div>
      </section>

      <section className="w-full bg-surface-container-lowest border-t border-surface-variant py-20">
        <div className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop space-y-6 font-body-md text-body-md text-on-surface-variant">
          <h2 className="font-headline-md text-headline-md text-primary">
            Chinese Running Script vs Grass Script
          </h2>
          <p>
            When creating custom Chinese calligraphy, the style of the brush script shapes the feeling of the artwork.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-on-surface">Regular Script (Kaishu):</strong>{" "}
              Highly legible, balanced, and formal. Excellent for clear, bold statements.
            </li>
            <li>
              <strong className="text-on-surface">Running Script (Xingshu):</strong>{" "}
              A semi-cursive style that flows naturally, resembling the swift handwriting of a master.
            </li>
            <li>
              <strong className="text-on-surface">Grass Script (Caoshu):</strong>{" "}
              An expressive, cursive style where characters flow into each other in rapid strokes.
            </li>
          </ul>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            What is Shūfǎ?
          </h3>
          <p>
            Shūfǎ (<span lang="zh">書法</span>) is the revered art of Chinese calligraphy. For millennia, it has been considered one of the highest forms of fine art in Chinese culture, intimately connected with poetry and painting.
          </p>

          <h3 className="font-headline-sm text-headline-sm text-primary pt-4">
            Personalized Chinese Gifts
          </h3>
          <p>
            A custom Chinese calligraphy shirt featuring a philosophical quote or a carefully chosen name interpretation is a thoughtful, culturally rich gift for martial arts practitioners, language learners, and lovers of Asian art.
          </p>
        </div>
      </section>
    </main>
  );
}
