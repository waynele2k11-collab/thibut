"use client";

import { useRef, useState, useEffect, ReactNode } from "react";

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
  const [winHeight, setWinHeight] = useState(0); // 0 = SSR/not mounted yet
  const [snapKey, setSnapKey] = useState<SnapKey>("collapsed");
  const [isDragging, setIsDragging] = useState(false);
  const [liveOffset, setLiveOffset] = useState(0);
  const dragStartY = useRef(0);

  // Measure window height only on the client
  useEffect(() => {
    const update = () => setWinHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Don't render sheet until we have client height (avoids SSR mismatch)
  if (winHeight === 0) return null;

  const snapHeight = winHeight * SNAP_RATIOS[snapKey];
  const translateY = winHeight - snapHeight + liveOffset;

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Clamp: can't drag further up than full, or more than 45% down
    setLiveOffset(Math.max(-winHeight * 0.12, Math.min(winHeight * 0.45, delta)));
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
      className="fixed left-0 right-0 bottom-0 z-30 md:hidden bg-[#F6F1E8] rounded-t-2xl shadow-2xl border-t border-stone-200"
      style={{
        height: `${winHeight}px`,
        transform: `translateY(${translateY}px)`,
        transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {/* Drag handle */}
      <div
        className="pt-3 pb-2 px-4 cursor-grab active:cursor-grabbing select-none touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet-handle" />
      </div>

      {/* Scrollable inspector content */}
      <div
        className="overflow-y-auto overscroll-contain h-full"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 80px)" }}
      >
        {children}
      </div>
    </div>
  );
}
