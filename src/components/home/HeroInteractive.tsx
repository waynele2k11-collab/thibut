"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { heroSlides, type HeroSlideId } from "./hero-data";
import { HeroTabs } from "./HeroTabs";
import { HeroArtwork } from "./HeroArtwork";

export function HeroInteractive() {
  const [activeId, setActiveId] = useState<HeroSlideId>("name");
  const [isHoveredOrFocused, setIsHoveredOrFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const activeIndex = heroSlides.findIndex((s) => s.id === activeId);
  const activeSlide = heroSlides[activeIndex >= 0 ? activeIndex : 0]!;

  const goToNext = useCallback(() => {
    setActiveId((currentId) => {
      const idx = heroSlides.findIndex((s) => s.id === currentId);
      return heroSlides[(idx + 1) % heroSlides.length]!.id;
    });
  }, []);

  const goToPrev = useCallback(() => {
    setActiveId((currentId) => {
      const idx = heroSlides.findIndex((s) => s.id === currentId);
      return heroSlides[(idx - 1 + heroSlides.length) % heroSlides.length]!.id;
    });
  }, []);

  const handleDragEnd = (
    ...[, { offset }]: [MouseEvent | TouchEvent | PointerEvent, PanInfo]
  ) => {
    const swipe = offset.x;
    if (swipe < -50) goToNext();
    else if (swipe > 50) goToPrev();
  };

  useEffect(() => {
    if (isHoveredOrFocused || userPaused || prefersReducedMotion) return;
    const interval = setInterval(goToNext, 5500);
    return () => clearInterval(interval);
  }, [isHoveredOrFocused, userPaused, prefersReducedMotion, goToNext]);

  return (
    <div
      className="flex flex-col w-full"
      onMouseEnter={() => setIsHoveredOrFocused(true)}
      onMouseLeave={() => setIsHoveredOrFocused(false)}
      onFocus={() => setIsHoveredOrFocused(true)}
      onBlur={() => setIsHoveredOrFocused(false)}
    >
      <div className="flex items-center justify-center gap-3">
        <HeroTabs activeId={activeId} onChange={setActiveId} />
        {!prefersReducedMotion && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-pressed={userPaused}
            aria-label={userPaused ? "Resume example rotation" : "Pause example rotation"}
            className="mt-4 p-2 rounded border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {userPaused ? (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Pause className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <div className="relative w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto aspect-[3/4] rounded-lg overflow-hidden bg-surface-container-high border border-surface-variant z-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
            drag={prefersReducedMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          >
            <HeroArtwork slide={activeSlide} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
