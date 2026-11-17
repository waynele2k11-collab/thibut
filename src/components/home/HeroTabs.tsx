"use client";

import * as React from "react";
import { computeNextTabValue } from "@/components/ui/tabs";
import { heroSlides, type HeroSlideId } from "./hero-data";

interface HeroTabsProps {
  activeId: HeroSlideId;
  onChange: (id: HeroSlideId) => void;
}

const SLIDE_IDS: readonly HeroSlideId[] = heroSlides.map((s) => s.id);

export function HeroTabs({ activeId, onChange }: HeroTabsProps) {
  const buttonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentId: HeroSlideId
  ) => {
    const nextValue = computeNextTabValue(SLIDE_IDS, currentId, event.key);
    if (!nextValue) return;
    event.preventDefault();
    const typedId = nextValue as HeroSlideId;
    buttonRefs.current[typedId]?.focus();
    onChange(typedId);
  };

  return (
    <div
      className="relative z-20 flex flex-wrap justify-center gap-2 sm:gap-6 py-2 mb-6 mt-8"
      role="tablist"
      aria-label="Calligraphy Examples"
    >
      {heroSlides.map((slide) => {
        const isActive = activeId === slide.id;
        return (
          <button
            key={slide.id}
            ref={(el) => {
              buttonRefs.current[slide.id] = el;
            }}
            id={`tab-${slide.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`slide-${slide.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(slide.id)}
            onKeyDown={(e) => handleKeyDown(e, slide.id)}
            className={`px-3 py-2 font-label-caps text-label-caps uppercase transition-colors duration-300 motion-reduce:transition-none border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-t ${
              isActive
                ? "border-secondary text-primary font-bold"
                : "border-transparent text-on-surface-variant hover:text-secondary"
            }`}
          >
            {slide.index} {slide.label}
          </button>
        );
      })}
    </div>
  );
}
