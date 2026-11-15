import { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Create Your Name in Vietnamese Thư Pháp",
  description: "Transform your English name or words into beautiful, authentic Vietnamese Thư Pháp brush calligraphy. Keep your exact words or translate the meaning.",
  alternates: {
    canonical: "/vietnamese-thu-phap",
  },
};

export default function VietnameseThuPhapPage() {
  return (
    <div className="w-full flex flex-col bg-[#FBF9F5] min-h-screen">
      {/* Hero Section */}
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg text-4xl md:text-6xl text-on-background font-bold max-w-3xl leading-tight">
          Create Your Name or Words in <span className="text-[#B3261E]">Vietnamese Thư Pháp</span>
        </h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl">
          Experience the poetic beauty of traditional Vietnamese brush calligraphy. Enter your name, a favorite quote, or a meaningful word to see it instantly transformed.
        </p>
        
        {/* The Live Interactive Creator Widget */}
        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget 
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="e.g. Wayne, Love, Harmony..."
            buttonText="Create My Thư Pháp →"
          />
        </div>
      </section>

      {/* Educational Content Section (SEO Text) */}
      <section className="w-full bg-white border-t border-surface-variant py-20">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop prose prose-lg prose-headings:font-display-md text-on-surface-variant">
          <h2>What is Vietnamese Thư Pháp?</h2>
          <p>
            Unlike Chinese or Japanese calligraphy which uses Han characters, modern Vietnamese Thư Pháp applies the ancient, flowing brush techniques of traditional calligraphy to the Latin-based Vietnamese alphabet (Quốc Ngữ).
          </p>
          <p>
            This creates a unique and beautiful synthesis: you can preserve your exact English name or English words, while rendering them in an authentic Asian brush aesthetic.
          </p>

          <h3>Can English be written in Vietnamese Thư Pháp?</h3>
          <p>
            Yes. Modern Vietnamese Thư Pháp commonly works with the Latin-based Vietnamese Quốc Ngữ alphabet, so Latin lettering can be styled with Vietnamese calligraphic brush characteristics. Thi Bút can preserve an English name such as “Wayne” while applying a Vietnamese-inspired brush treatment.
          </p>
          
          <h3>Perfect for Meaningful Gifts</h3>
          <p>
            Whether you are looking for a personalized T-shirt, a custom canvas print for your living room, or a unique gift for Tết (Vietnamese New Year), custom Thư Pháp art carries deep emotional weight and cultural elegance.
          </p>
        </div>
      </section>
    </div>
  );
}
