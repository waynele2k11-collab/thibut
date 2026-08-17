import { ArrowRight, Paintbrush, SlidersHorizontal, Truck } from "lucide-react";
import Link from "next/link";
import { Hero } from "@/components/home/Hero";

export default function Home() {
  return (
    <div className="bg-background text-on-background min-h-screen relative font-body-md">
      <div className="texture-overlay fixed inset-0 z-0" />

      {/* Main Content Canvas */}
      <main className="relative z-10 pb-section-gap">

        {/* ── Hero Section ── */}
        <section className="w-full">
          <Hero />
        </section>

        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-section-gap flex justify-center">
          <div className="w-16 h-px bg-outline-variant" />
        </div>

        {/* Featured Categories */}
        <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-section-gap" id="explore">
          <div className="flex justify-between items-end mb-12">
            <h2 className="font-headline-md text-headline-md text-primary">Curated Themes</h2>
            <a className="font-label-caps text-label-caps text-secondary hover:text-primary transition-colors flex items-center group" href="#">
              VIEW ALL <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Category 1 */}
            <a className="group block" href="#">
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest mb-6">
                <img alt="Personalized Name Hoodie" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="/mockups/hoodie.jpg" />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">Names & Identity</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Wear your story with personalized calligraphy on premium garments.</p>
            </a>

            {/* Category 2 */}
            <a className="group block" href="#">
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest mb-6">
                <img alt="Framed Poetry Print" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="/mockups/framed_print.jpg" />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">Poetry & Quotes</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Elevate your space with framed statements and timeless wisdom.</p>
            </a>

            {/* Category 3 */}
            <a className="group block" href="#">
              <div className="relative overflow-hidden aspect-[4/5] bg-surface-container-highest mb-6">
                <img alt="Heritage Seal Stamp" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="/mockups/seal.jpg" />
                <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">Heritage & Values</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Traditional art prints and intricate seal details honoring your legacy.</p>
            </a>
          </div>
        </section>

        <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-section-gap flex justify-center">
          <div className="w-16 h-px bg-outline-variant"></div>
        </div>

        {/* How It Works Section */}
        <section className="bg-surface-container-low py-section-gap">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="text-center mb-16">
              <h2 className="font-headline-md text-headline-md text-primary mb-4">The Process</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">From an artist's brush to a statement piece, understand the journey of personalization.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {/* Connecting Line (Desktop only) */}
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px bg-outline-variant z-0"></div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6 shadow-sm">
                  <Paintbrush className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">1. Select Artwork</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Browse exclusive calligraphy designs from master creators, finding the concept that resonates.</p>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6 shadow-sm">
                  <SlidersHorizontal className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">2. Personalize</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Choose your canvas—from premium apparel to fine prints—and customize the scale and placement.</p>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-background border border-surface-variant flex items-center justify-center mb-6 shadow-sm">
                  <Truck className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-3">3. Receive Excellence</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">Your personalized piece is meticulously crafted and delivered, ready to make a profound statement.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
