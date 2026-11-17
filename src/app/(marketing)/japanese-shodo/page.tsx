import { Metadata } from "next";
import { HeroCreatorWidget } from "@/components/marketing/HeroCreatorWidget";

export const metadata: Metadata = {
  title: "Your Name in Japanese Calligraphy (Shodō)",
  description: "Turn your name into personalized Japanese brush artwork (Shodō). Choose to translate your name's meaning into Kanji or write it phonetically in Katakana.",
  alternates: {
    canonical: "/japanese-shodo",
  },
};

export default function JapaneseShodoPage() {
  return (
    <div className="w-full flex flex-col bg-[#FBF9F5] min-h-screen">
      <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-24 flex flex-col items-center text-center gap-8">
        <h1 className="font-display-lg text-4xl md:text-6xl text-on-background font-bold max-w-3xl leading-tight">
          Create Your Name in <span className="text-[#B3261E]">Japanese Calligraphy</span>
        </h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl">
          Turn your name into personalized Japanese brush artwork. Discover your Kanji meaning or translate your name phonetically.
        </p>
        
        <div className="w-full flex justify-center mt-4">
          <HeroCreatorWidget 
            defaultTradition="VIETNAMESE_THU_PHAP"
            placeholder="Enter your name (e.g., Wayne)..."
            buttonText="Create My Shodō →"
          />
        </div>
      </section>

      <section className="w-full bg-white border-t border-surface-variant py-20">
        <div className="max-w-4xl mx-auto px-margin-mobile md:px-margin-desktop prose prose-lg prose-headings:font-display-md text-on-surface-variant">
          <h2>Should I translate my name into Japanese or write it phonetically?</h2>
          <p>
            When writing a non-Japanese name in Japanese, you generally have two beautiful options in Shodō:
          </p>
          <ul>
            <li><strong>Phonetic (Katakana):</strong> This is the most accurate translation of how your name sounds. For example, &ldquo;Wayne&rdquo; becomes &ldquo;ウェイン&rdquo;.</li>
            <li><strong>Meaning (Kanji):</strong> You can select Kanji characters that match the underlying meaning or spirit of your name. This creates a deeply poetic piece of art.</li>
          </ul>

          <h3>What is Shodō?</h3>
          <p>
            Shodō (書道) is the traditional Japanese art of calligraphy. Written with a bamboo brush and sumi ink on rice paper, it emphasizes the vital energy (ki) and emotional state of the calligrapher in the moment the brush touches the paper.
          </p>
          
          <h3>Custom Japanese Calligraphy Gifts</h3>
          <p>
            A personalized Japanese name shirt or Shodō canvas print makes a unique, unforgettable gift for martial artists, anime fans, or anyone who appreciates minimalist Japanese aesthetics.
          </p>
        </div>
      </section>
    </div>
  );
}
