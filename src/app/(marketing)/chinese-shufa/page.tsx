import { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Custom Chinese Calligraphy T-Shirt & Artwork",
  description: "Create personalized Chinese calligraphy apparel. Turn your name or favorite quote into traditional Shūfǎ brush lettering.",
  alternates: {
    canonical: "/chinese-shufa",
  },
};

export default function ChineseShufaPage() {
  return (
    <div className="w-full flex flex-col bg-[#FBF9F5] min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg text-4xl md:text-6xl text-on-background font-bold max-w-3xl leading-tight">
          Create Your Name in <span className="text-[#B3261E]">Chinese Calligraphy</span>
        </h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl">
          Transform your name or favorite quote into traditional Shūfǎ brush lettering. Instantly personalize a Chinese character shirt or art print.
        </p>
        
        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget 
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name or quote..."
            buttonText="Create My Shūfǎ →"
          />
        </div>
      </section>

      <section className="w-full bg-white border-t border-surface-variant py-20">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop prose prose-lg prose-headings:font-display-md text-on-surface-variant">
          <h2>Chinese Running Script vs Grass Script</h2>
          <p>
            When creating custom Chinese calligraphy, the style of the brush script drastically changes the feeling of the artwork.
          </p>
          <ul>
            <li><strong>Regular Script (Kaishu):</strong> Highly legible, balanced, and formal. Excellent for clear, bold statements.</li>
            <li><strong>Running Script (Xingshu):</strong> A semi-cursive style that flows naturally, resembling the swift handwriting of a master.</li>
            <li><strong>Grass Script (Caoshu):</strong> An expressive, highly cursive style where characters flow into each other in rapid, unbroken strokes. It prioritizes emotional expression over strict legibility.</li>
          </ul>

          <h3>What is Shūfǎ?</h3>
          <p>
            Shūfǎ (書法) is the revered art of Chinese calligraphy. For millennia, it has been considered one of the highest forms of fine art in Chinese culture, intimately connected with poetry and painting. The brush strokes capture the &ldquo;Qi&rdquo; (vital energy) of the artist.
          </p>
          
          <h3>Personalized Chinese Gifts</h3>
          <p>
            A custom Chinese calligraphy shirt featuring a deep philosophical quote or a carefully chosen name translation is a thoughtful, culturally rich gift for martial arts practitioners, language learners, and lovers of Asian art.
          </p>
        </div>
      </section>
    </div>
  );
}
