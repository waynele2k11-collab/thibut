"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Save, ShoppingCart } from "lucide-react";

export interface StudioToolbarProps {
  variant: "desktop" | "mobile";
  isAdmin: boolean;
  isLocked: boolean;
  viewMode: "RAW_ART" | "MOCKUP";
  onChangeViewMode: (mode: "RAW_ART" | "MOCKUP") => void;
  layoutMode: "HORIZONTAL" | "VERTICAL";
  onChangeLayoutMode: (mode: "HORIZONTAL" | "VERTICAL") => void;
  isSaving: boolean;
  onSave: () => void;
  isAddingToCart: boolean;
  onAddToCart: () => void;
}

export function StudioToolbar({
  variant,
  isAdmin,
  isLocked,
  viewMode,
  onChangeViewMode,
  layoutMode,
  onChangeLayoutMode,
  isSaving,
  onSave,
  isAddingToCart,
  onAddToCart,
}: StudioToolbarProps) {
  const isDesktop = variant === "desktop";

  return (
    <div
      className={
        isDesktop
          ? "hidden lg:flex absolute top-5 left-1/2 -translate-x-1/2 z-10 items-center gap-3 bg-surface-container-lowest/95 backdrop-blur-md px-4 py-2 border border-surface-variant rounded-lg"
          : "lg:hidden absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between bg-surface-container-lowest/95 backdrop-blur-md px-3 py-2 border-t border-surface-variant gap-2"
      }
    >
      <Link
        href={isAdmin ? "/admin/gallery" : "/"}
        aria-label="Exit Studio"
        className="p-2 rounded text-on-surface-variant hover:text-on-background transition-colors motion-reduce:transition-none"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
      </Link>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      <div
        className={`flex bg-surface-container-low border border-surface-variant rounded p-0.5 ${
          isDesktop ? "" : "flex-1 max-w-[168px]"
        }`}
      >
        <button
          type="button"
          onClick={() => onChangeViewMode("RAW_ART")}
          className={`${
            isDesktop ? "px-3.5 py-1.5 text-xs" : "flex-1 py-1.5 text-[11px]"
          } font-label-caps uppercase rounded transition-colors motion-reduce:transition-none cursor-pointer ${
            viewMode === "RAW_ART"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          {isDesktop ? "Raw Art" : "Art"}
        </button>
        <button
          type="button"
          onClick={() => onChangeViewMode("MOCKUP")}
          className={`${
            isDesktop ? "px-3.5 py-1.5 text-xs" : "flex-1 py-1.5 text-[11px]"
          } font-label-caps uppercase rounded transition-colors motion-reduce:transition-none cursor-pointer ${
            viewMode === "MOCKUP"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          {isDesktop ? "Mockup" : "Mock"}
        </button>
      </div>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      <div className="flex bg-surface-container-low border border-surface-variant rounded p-0.5">
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onChangeLayoutMode("VERTICAL")}
          aria-label="Vertical layout"
          aria-pressed={layoutMode === "VERTICAL"}
          className={`px-2.5 py-1.5 text-xs rounded transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 ${
            layoutMode === "VERTICAL"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          ⬇
        </button>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onChangeLayoutMode("HORIZONTAL")}
          aria-label="Horizontal layout"
          aria-pressed={layoutMode === "HORIZONTAL"}
          className={`px-2.5 py-1.5 text-xs rounded transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50 ${
            layoutMode === "HORIZONTAL"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          ➡
        </button>
      </div>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || isLocked}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-outline-variant bg-surface-container-lowest text-on-background hover:bg-surface-container-low transition-colors motion-reduce:transition-none text-xs font-label-caps uppercase disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <Loader2
            className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{isSaving ? "Saving" : "Save"}</span>
      </button>

      {!isAdmin && (
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAddingToCart || isLocked}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-secondary text-on-secondary hover:opacity-90 transition-opacity motion-reduce:transition-none text-xs font-label-caps uppercase disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isAddingToCart ? (
            <Loader2
              className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>
            {isAddingToCart
              ? "Adding"
              : isDesktop
                ? "Add to Cart"
                : "Cart"}
          </span>
        </button>
      )}
    </div>
  );
}
