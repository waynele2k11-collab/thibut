import { HeroCreateInput } from "./HeroCreateInput";
import { HeroInteractive } from "./HeroInteractive";

export function Hero() {
  return (
    <div className="w-full flex flex-col items-center bg-background text-on-background pt-8 md:pt-20 pb-12 md:pb-section-gap px-margin-mobile md:px-margin-desktop relative selection:bg-secondary/20 overflow-hidden border-b border-surface-variant">
      <div className="relative z-20 flex flex-col items-center text-center max-w-3xl mx-auto mb-6">
        <p className="font-label-caps text-label-caps uppercase text-secondary mb-4">
          Thi Bút · Cultural Calligraphy Studio
        </p>
        <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-5">
          Words Become Art.
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mx-auto">
          Turn your name, words, or story into meaningful calligraphy and wearable art.
        </p>
      </div>

      <HeroCreateInput />
      <HeroInteractive />
    </div>
  );
}
