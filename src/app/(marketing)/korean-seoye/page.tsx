import { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Custom Korean Name Calligraphy (Seoye)",
  description: "Create a personalized Korean calligraphy shirt or artwork. Translate your name into Hangul brush lettering using the traditional Seoye aesthetic.",
  alternates: {
    canonical: "/korean-seoye",
  },
};

export default function KoreanSeoyePage() {
  return (
    <div className="w-full flex flex-col bg-[#FBF9F5] min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg text-4xl md:text-6xl text-on-background font-bold max-w-3xl leading-tight">
          Create Your Name in <span className="text-[#B3261E]">Korean Calligraphy</span>
        </h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl">
          Turn your name into authentic Hangul brush lettering. Personalize your own Korean Seoye artwork and apparel in seconds.
        </p>
        
        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget 
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name (e.g., Wayne)..."
            buttonText="Create My Hangul Art →"
          />
        </div>
      </section>

      <section className="w-full bg-white border-t border-surface-variant py-20">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop prose prose-lg prose-headings:font-display-md text-on-surface-variant">
          <h2>Hangul Transliteration vs Korean Translation</h2>
          <p>
            When writing a foreign name in Korean calligraphy, the most common and authentic approach is <strong>Hangul transliteration</strong>. This means we write out the phonetic sounds of your English name using the beautiful Hangul alphabet. 
          </p>
          <p>
            For example, the name "Wayne" becomes "웨인" (We-in), perfectly capturing the pronunciation while styling it in dynamic brush strokes.
          </p>

          <h3>What is Korean Seoye?</h3>
          <p>
            Seoye (서예) is the Korean tradition of calligraphy. While historically it utilized Hanja (Chinese characters), modern Seoye powerfully embraces the Hangul alphabet. Hangul brush calligraphy is known for its dynamic stroke dynamics, balanced geometry, and lively rhythm.
          </p>
          
          <h3>Personalized Korean Gifts</h3>
          <p>
            Whether you are celebrating a graduation, creating team apparel, or designing a meaningful gift, a custom Hangul name T-shirt offers a highly personal connection to Korean culture.
          </p>
        </div>
      </section>
    </div>
  );
}
