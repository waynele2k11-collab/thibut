"use client";

import { useEffect } from "react";

/**
 * Global Anti-Scrape & Image Protection Component
 * Prevents unauthorized image downloading, dragging, context-menu saving,
 * and keyboard shortcuts for image extraction.
 */
export function AntiScrapeProtection() {
  useEffect(() => {
    // 1. Disable Context Menu (Right Click) on all images and canvas elements
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isProtectedElement =
        target.tagName === "IMG" ||
        target.tagName === "PICTURE" ||
        target.tagName === "CANVAS" ||
        target.tagName === "SVG" ||
        target.closest(".protected-media") ||
        target.closest("[data-protected-image]");

      if (isProtectedElement) {
        e.preventDefault();
      }
    };

    // 2. Disable Dragging of Images / Artwork
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.tagName === "IMG" ||
        target.tagName === "CANVAS" ||
        target.tagName === "SVG" ||
        target.closest(".protected-media")
      ) {
        e.preventDefault();
      }
    };

    // 3. Block Save Shortcut (Ctrl+S / Cmd+S) on Protected Media
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName !== "INPUT" && activeElement.tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
