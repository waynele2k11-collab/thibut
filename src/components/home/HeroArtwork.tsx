import Image from "next/image";
import { HeroSlide } from "./hero-data";

type HeroArtworkProps = {
  slide: HeroSlide;
};

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
        className="object-cover object-[center_35%] md:object-center pointer-events-none"
        priority
      />
      
      {/* Subtitle tag overlay */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-[#F6F1E7] text-[10px] sm:text-xs px-3 py-1.5 rounded uppercase tracking-widest flex items-center gap-2 border border-white/10">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        {slide.artworkLabel}
      </div>

      {/* Responsive Print Canvas Overlay - Scales identically to a flattened image */}
      <div className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none select-none drop-shadow-sm ${slide.containerStyle}`}>
        
        {/* Primary Calligraphy Script */}
        <span 
          className={`${slide.scriptStyle} ${slide.textColor}`}
          style={{ fontSize: 'clamp(24px, 12cqw, 80px)' }}
        >
          {slide.primaryScript}
        </span>
        
        {/* Translation / Meaning Subtitle */}
        <span 
          className="mt-[3cqw] font-mono uppercase tracking-widest px-[1.5cqw] py-[0.5cqw] rounded backdrop-blur-sm text-[#333333] opacity-80 font-semibold bg-white/20 text-center"
          style={{ fontSize: 'clamp(8px, 3.5cqw, 20px)' }}
        >
          {slide.semanticTranslation}
        </span>
        
        {/* Vermilion Chop Seal */}
        {slide.hasSeal && (
          <div className="mt-[3cqw] w-[5cqw] h-[5cqw] min-w-[20px] min-h-[20px] max-w-[40px] max-h-[40px] bg-tb-red/90 text-[clamp(10px,2cqw,20px)] text-tb-light-on-dark flex items-center justify-center font-serif rounded-sm shadow-sm border border-tb-red">
            印
          </div>
        )}
      </div>
    </div>
  );
}
