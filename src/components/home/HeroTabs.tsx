import { heroSlides, HeroSlideId } from "./hero-data";

type HeroTabsProps = {
  activeId: HeroSlideId;
  onChange: (id: HeroSlideId) => void;
};

export function HeroTabs({ activeId, onChange }: HeroTabsProps) {
  return (
    <div 
      className="relative z-20 flex flex-wrap justify-center gap-2 sm:gap-6 py-2 mb-4 mt-8"
      role="tablist"
      aria-label="Calligraphy Examples"
    >
      {heroSlides.map((slide) => {
        const isActive = activeId === slide.id;
        return (
          <button
            key={slide.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`slide-${slide.id}`}
            onClick={() => onChange(slide.id)}
            className={`px-3 py-2 text-xs tracking-wider uppercase transition-all duration-300 border-b-2 outline-none focus-visible:ring-2 focus-visible:ring-tb-red ${
              isActive 
                ? "border-tb-red text-tb-light-on-dark font-medium" 
                : "border-transparent text-[#888888] hover:text-tb-light-on-dark"
            }`}
          >
            {slide.index} {slide.label}
          </button>
        );
      })}
    </div>
  );
}
