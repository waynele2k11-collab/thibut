import { HeroCreateInput } from "./HeroCreateInput";
import { HeroInteractive } from "./HeroInteractive";

export function Hero() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center bg-tb-ink text-tb-light-on-dark pt-12 md:pt-24 pb-16 px-4 sm:px-6 relative selection:bg-tb-red selection:text-white overflow-hidden">
      
      {/* Background Texture/Glow (Subtle) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2a2a] via-[#0B0B0B] to-[#0B0B0B] opacity-50 pointer-events-none" />

      {/* 1. Hero Content & Headlines */}
      <div className="relative z-20 flex flex-col items-center text-center max-w-3xl mx-auto mb-6">
        <h1 className="font-vn-dancing text-6xl sm:text-7xl md:text-8xl font-bold tracking-normal mb-6">
          Words Become <span className="text-transparent bg-clip-text bg-gradient-to-r from-tb-light-on-dark to-tb-muted">Art.</span>
        </h1>
        <p className="text-base sm:text-lg text-tb-muted leading-relaxed max-w-xl mx-auto font-light">
          Turn your name, words, or story into meaningful calligraphy and wearable art.
        </p>
      </div>

      {/* 2. Primary Conversion Element */}
      <HeroCreateInput />

      {/* 3. Interactive Stage (Tabs + Artwork Slider) */}
      <HeroInteractive />

    </div>
  );
}
