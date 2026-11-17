"use client";

import { useEffect } from "react";

/**
 * Cosmetic UX Deterrence Component (NOT a security boundary — see T-094).
 *
 * NOTE: Client-side context-menu, drag, and shortcut interception is purely cosmetic UX
 * friction against casual right-click saving. Authoritative asset protection is enforced
 * strictly on the server:
 *   1. High-resolution 4500x5400 @ 300 DPI `PRINT_MASTER` assets are NEVER sent to unauthenticated
 *      browser clients; public gallery/studio views receive low-resolution previews only.
 *   2. Paid digital downloads require a cryptographically signed JWT (`DOWNLOAD_TOKEN_SECRET`)
 *      bound to a verified `PAID` / `SUCCEEDED` `OrderItem`.
 *   3. User-uploaded assets default to `visibility: PRIVATE` (INV-014).
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
