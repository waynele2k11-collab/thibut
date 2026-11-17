import Image from "next/image";
import type { HeroSlide } from "./hero-data";

interface HeroArtworkProps {
  slide: HeroSlide;
}

export function HeroArtwork({ slide }: HeroArtworkProps) {
  return (
    <div
      className="absolute inset-0 select-none pointer-events-none"
      id={`slide-${slide.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${slide.id}`}
    >
      <Image
        src={slide.image}
        alt={slide.alt}
        fill
        sizes="(max-width: 768px) 92vw, 672px"
        className="object-cover object-[center_35%] md:object-center pointer-events-none"
        priority
      />

      <div className="absolute top-4 left-4 bg-tertiary-container/80 backdrop-blur-md text-on-tertiary font-label-caps text-label-caps px-3 py-1.5 rounded uppercase flex items-center gap-2 border border-on-tertiary/15">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
        {slide.artworkLabel}
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none select-none ${slide.containerStyle}`}
      >
        <span
          lang={slide.scriptLang}
          className={`${slide.scriptStyle} ${slide.textColor} text-[clamp(24px,12cqw,80px)]`}
        >
          {slide.primaryScript}
        </span>

        <span
          lang={slide.id === "heritage" ? "vi" : undefined}
          className="mt-[3cqw] font-label-caps uppercase tracking-widest px-[1.5cqw] py-[0.5cqw] rounded backdrop-blur-xs text-on-surface opacity-85 bg-surface-container-lowest/40 text-center text-[clamp(8px,3.5cqw,20px)]"
        >
          {slide.semanticTranslation}
        </span>

        {slide.hasSeal && (
          <div
            aria-hidden="true"
            className="mt-[3cqw] w-[5cqw] h-[5cqw] min-w-[20px] min-h-[20px] max-w-[40px] max-h-[40px] bg-secondary/90 text-[clamp(10px,2cqw,20px)] text-on-secondary flex items-center justify-center font-serif rounded-xs border border-secondary"
          >
            印
          </div>
        )}
      </div>
    </div>
  );
}
