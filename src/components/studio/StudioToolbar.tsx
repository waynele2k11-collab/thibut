"use client";

import {
  CircleDot,
  Maximize2,
  MoveHorizontal,
  MoveVertical,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { StudioLayoutMode } from "@/lib/studio/studioStore";

export interface StudioToolbarProps {
  isLocked: boolean;
  viewMode: "RAW_ART" | "MOCKUP";
  onChangeViewMode: (mode: "RAW_ART" | "MOCKUP") => void;
  layoutMode: StudioLayoutMode;
  onChangeLayoutMode: (mode: StudioLayoutMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onResetTransform: () => void;
}

export function StudioToolbar({
  isLocked,
  viewMode,
  onChangeViewMode,
  layoutMode,
  onChangeLayoutMode,
  onZoomIn,
  onZoomOut,
  onRotate,
  onResetTransform,
}: StudioToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-variant shrink-0 z-10 overflow-x-auto scrollbar-hide">
      <div
        role="group"
        aria-label="Preview surface"
        className="inline-flex items-center bg-surface-container-low border border-surface-variant rounded-lg p-0.5 shrink-0"
      >
        <button
          type="button"
          aria-pressed={viewMode === "RAW_ART"}
          onClick={() => onChangeViewMode("RAW_ART")}
          className={`min-h-9 px-2.5 sm:px-3 py-1.5 rounded font-label-caps text-[11px] sm:text-label-caps uppercase whitespace-nowrap transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
            viewMode === "RAW_ART"
              ? "bg-surface-container-lowest text-primary border border-outline-variant"
              : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Washi
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "MOCKUP"}
          onClick={() => onChangeViewMode("MOCKUP")}
          className={`min-h-9 px-2.5 sm:px-3 py-1.5 rounded font-label-caps text-[11px] sm:text-label-caps uppercase whitespace-nowrap transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
            viewMode === "MOCKUP"
              ? "bg-surface-container-lowest text-primary border border-outline-variant"
              : "text-on-surface-variant hover:text-primary"
          }`}
        >
          Product
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div
          role="group"
          aria-label="Calligraphy orientation"
          className="inline-flex items-center bg-surface-container-low border border-surface-variant rounded-lg p-0.5"
        >
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onChangeLayoutMode("VERTICAL")}
            aria-label="Vertical scroll layout"
            aria-pressed={layoutMode === "VERTICAL"}
            title="Vertical Scroll"
            className={`min-h-9 min-w-9 flex items-center justify-center rounded transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              layoutMode === "VERTICAL"
                ? "bg-surface-container-lowest text-primary border border-outline-variant"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <MoveVertical className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onChangeLayoutMode("HORIZONTAL")}
            aria-label="Horizontal banner layout"
            aria-pressed={layoutMode === "HORIZONTAL"}
            title="Horizontal Banner"
            className={`min-h-9 min-w-9 flex items-center justify-center rounded transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              layoutMode === "HORIZONTAL"
                ? "bg-surface-container-lowest text-primary border border-outline-variant"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <MoveHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onChangeLayoutMode("EMBLEM")}
            aria-label="Zen circle emblem layout"
            aria-pressed={layoutMode === "EMBLEM"}
            title="Zen Emblem"
            className={`min-h-9 min-w-9 flex items-center justify-center rounded transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              layoutMode === "EMBLEM"
                ? "bg-surface-container-lowest text-primary border border-outline-variant"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <CircleDot className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div
          role="group"
          aria-label="Artwork transform controls"
          className="hidden sm:inline-flex items-center bg-surface-container-low border border-surface-variant rounded-lg p-0.5"
        >
          <button
            type="button"
            disabled={isLocked}
            onClick={onZoomOut}
            aria-label="Scale artwork smaller"
            title="Scale Down"
            className="min-h-9 min-w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <ZoomOut className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={onZoomIn}
            aria-label="Scale artwork larger"
            title="Scale Up"
            className="min-h-9 min-w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <ZoomIn className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={onRotate}
            aria-label="Rotate artwork 90 degrees"
            title="Rotate 90°"
            className="min-h-9 min-w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={onResetTransform}
            aria-label="Center and reset artwork position"
            title="Center & Reset"
            className="min-h-9 min-w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-lowest transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <Maximize2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          disabled={isLocked}
          onClick={onResetTransform}
          aria-label="Center and reset artwork position"
          className="sm:hidden min-h-9 min-w-9 flex items-center justify-center rounded-lg bg-surface-container-low border border-surface-variant text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
