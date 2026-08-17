"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { heroSlides, HeroSlideId } from "./hero-data";
import { HeroTabs } from "./HeroTabs";
import { HeroArtwork } from "./HeroArtwork";

export function HeroInteractive() {
  const [activeId, setActiveId] = useState<HeroSlideId>("name");
  const [isPaused, setIsPaused] = useState(false);

  const activeIndex = heroSlides.findIndex((s) => s.id === activeId);
  const activeSlide = heroSlides[activeIndex];

  const goToNext = useCallback(() => {
    setActiveId((currentId) => {
      const idx = heroSlides.findIndex((s) => s.id === currentId);
      return heroSlides[(idx + 1) % heroSlides.length].id;
    });
  }, []);

  const goToPrev = useCallback(() => {
    setActiveId((currentId) => {
      const idx = heroSlides.findIndex((s) => s.id === currentId);
      return heroSlides[(idx - 1 + heroSlides.length) % heroSlides.length].id;
    });
  }, []);

  const handleDragEnd = (e: any, { offset }: any) => {
    const swipe = offset.x;
    if (swipe < -50) goToNext();
    else if (swipe > 50) goToPrev();
  };

  // 5-6s Auto Slider that respects pause state
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(goToNext, 5500);
    return () => clearInterval(interval);
  }, [isPaused, goToNext]);

  return (
    <div 
      className="flex flex-col w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <HeroTabs activeId={activeId} onChange={setActiveId} />

      <div className="relative w-full max-w-md md:max-w-xl lg:max-w-2xl mx-auto aspect-[3/4] rounded-2xl md:rounded-3xl overflow-hidden bg-[#111111] border border-[#222222] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeSlide.id} 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            drag="x"
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
