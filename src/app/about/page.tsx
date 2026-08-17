import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export const metadata = {
  title: "About Thi Bút — Meaning Before Style",
  description: "Learn how Thi Bút transforms names, words, and personal stories into culturally meaningful calligraphy-inspired art.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-on-background selection:bg-secondary selection:text-on-secondary">
      
      {/* 1. HERO */}
      <section className="pt-32 pb-24 px-margin-mobile md:px-margin-desktop text-center">
        <h1 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-8">
          About Thi Bút
        </h1>
        <h2 className="font-display-lg text-display-lg md:text-[80px] leading-[0.9] text-on-background max-w-4xl mx-auto mb-12">
          Words carry meaning. <br className="hidden md:block" />
          Strokes give them character.
        </h2>
        <p className="font-body text-body-xl md:text-[24px] text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
          Thi Bút transforms names, words, and personal stories into meaningful calligraphy-inspired art.
        </p>
      </section>

      {/* 2. WHAT DOES THI BÚT MEAN? */}
      <section className="py-24 bg-surface px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-6">
              What does Thi Bút mean?
            </h3>
            <div className="space-y-8">
              <div>
                <p className="font-display-md text-display-md mb-2">Thi / 詩</p>
                <p className="font-body text-body-lg text-on-surface-variant">Poetry</p>
              </div>
              <div className="h-px w-16 bg-surface-variant" />
              <div>
                <p className="font-display-md text-display-md mb-2">Bút / 筆</p>
                <p className="font-body text-body-lg text-on-surface-variant">Pen · Brush</p>
              </div>
            </div>
            <p className="font-body text-body-lg mt-12 leading-relaxed">
              Together, Thi Bút evokes the poetic brush — words expressed through artistic strokes.
            </p>
          </div>
          <div className="relative aspect-square md:aspect-[4/3] bg-background rounded-3xl overflow-hidden flex items-center justify-center p-12">
             <div className="text-center">
               <span className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em]">Words Become Art.</span>
               <p className="font-body text-body-lg mt-6 max-w-sm text-on-surface-variant">
                 A name can carry identity. A phrase can carry conviction. A family name can carry history. Thi Bút gives those words a visual form.
               </p>
             </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-32 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto">
          <h3 className="font-label-caps text-label-caps uppercase tracking-widest text-center text-on-surface-variant mb-20">
            How it works
          </h3>
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
                desc: "Create artwork for digital use, display, or wearable products as those options become available.",
              },
            ].map((item, i) => (
              <div key={i} className="flex flex-col">
                <span className="font-display-sm text-display-sm text-secondary mb-6">{item.step}</span>
                <h4 className="font-display-md text-title-lg mb-4">{item.title}</h4>
                <p className="font-body text-body-md text-on-surface-variant leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. CULTURAL INTEGRITY */}
      <section className="py-32 bg-on-background text-background px-margin-mobile md:px-margin-desktop">
        <div className="max-w-container-max mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="font-display-lg text-display-md mb-8">Meaning Before Style.</h2>
            <p className="font-body text-body-lg text-surface-variant leading-relaxed mb-8">
              Beautiful lettering means little if the words are wrong.
            </p>
            <p className="font-body text-body-md text-surface-variant leading-relaxed mb-8">
              Thi Bút distinguishes between phonetic transliteration, literal translation, natural phrasing, poetic idiom, and cultural artistic rendering — and shows you what a phrase means before it becomes artwork.
            </p>
            <p className="font-body text-body-md text-surface-variant leading-relaxed">
              Thi Bút uses technology to assist interpretation and composition while keeping meaning, language, and design choices visible to the customer.
            </p>
          </div>
          
          <div className="bg-background/10 rounded-3xl p-8 md:p-12 border border-surface-variant/20">
            <h3 className="font-label-caps text-label-caps text-surface-variant uppercase tracking-widest mb-10">
              Example: The Name "David"
            </h3>
            <div className="space-y-10">
              <div>
                <p className="font-label-caps text-label-caps text-surface-variant uppercase mb-2">Original</p>
                <p className="font-display-md text-title-lg">David</p>
              </div>
              <div className="h-px w-full bg-surface-variant/20" />
              <div>
                <p className="font-label-caps text-label-caps text-surface-variant uppercase mb-2">Vietnamese Phonetic</p>
                <p className="font-display-md text-title-lg">Đa-vít</p>
              </div>
              <div className="h-px w-full bg-surface-variant/20" />
              <div>
                <p className="font-label-caps text-label-caps text-surface-variant uppercase mb-2">Sino-Vietnamese Artistic Rendering</p>
                <p className="font-display-md text-[40px] leading-none mb-2">大衛</p>
                <p className="font-body text-body-md text-surface-variant">Đại Vệ</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BRAND PRINCIPLE */}
      <section className="py-32 px-margin-mobile md:px-margin-desktop text-center">
        <h2 className="font-display-md text-display-md md:text-display-lg max-w-4xl mx-auto leading-tight mb-8">
          Your words remain yours.<br/>
          Thi Bút helps you give them form.
        </h2>
        <p className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em]">
          Meaning first. Strokes second.
        </p>
      </section>

      {/* 6. FINAL CTA */}
      <section className="py-32 bg-surface px-margin-mobile md:px-margin-desktop text-center border-t border-surface-variant">
        <h2 className="font-display-md text-headline-lg mb-12">
          What will your words become?
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <Link 
            href="/create" 
            className="inline-flex items-center justify-center bg-secondary text-on-secondary px-10 py-4 rounded-full font-label-caps text-label-caps uppercase hover:bg-secondary/90 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Create Your Thi Bút <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link 
            href="/gallery" 
            className="inline-flex items-center justify-center text-on-surface font-label-caps text-label-caps uppercase hover:text-secondary transition-colors"
          >
            Explore the Gallery <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>
    </main>
  );
}
