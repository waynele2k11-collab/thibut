"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

interface MobileStudioSheetProps {
  children: ReactNode;
}

const SNAP_RATIOS = {
  collapsed: 0.44,
  half: 0.66,
  full: 0.94,
};

type SnapKey = keyof typeof SNAP_RATIOS;

export function MobileStudioSheet({ children }: MobileStudioSheetProps) {
  const [winHeight, setWinHeight] = useState(0);
  const [snapKey, setSnapKey] = useState<SnapKey>("collapsed");
  const [isDragging, setIsDragging] = useState(false);
  const [liveOffset, setLiveOffset] = useState(0);
  const dragStartY = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const update = () => setWinHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (winHeight === 0) return null;

  const snapHeight = winHeight * SNAP_RATIOS[snapKey];
  const translateY = winHeight - snapHeight + liveOffset;

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const clientY = e.touches[0]?.clientY ?? dragStartY.current;
    const delta = clientY - dragStartY.current;
    setLiveOffset(
      Math.max(-winHeight * 0.12, Math.min(winHeight * 0.45, delta))
    );
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (liveOffset < -winHeight * 0.08) {
      setSnapKey(snapKey === "collapsed" ? "half" : "full");
    } else if (liveOffset > winHeight * 0.08) {
      setSnapKey(snapKey === "full" ? "half" : "collapsed");
    }
    setLiveOffset(0);
  };

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-30 lg:hidden bg-surface-container-low rounded-t-xl border-t border-surface-variant"
      // R-509 justified runtime style: touch-dragged viewport height & vertical sheet snap offset
      style={{
        height: `${winHeight}px`,
        transform: `translateY(${translateY}px)`,
        transition:
          isDragging || prefersReducedMotion
            ? "none"
            : "transform 300ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      <div
        className="pt-3 pb-2 px-4 cursor-grab active:cursor-grabbing select-none touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet-handle" />
      </div>

      <div className="overflow-y-auto overscroll-contain h-full pb-[calc(env(safe-area-inset-bottom,0px)+84px)]">
        {children}
      </div>
    </div>
  );
}
