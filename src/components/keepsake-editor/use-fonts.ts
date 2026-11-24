"use client";

// Keepsake editor: loads the eligible fonts with the FontFace API from the admin-only font route.
// This is the only place the editor asks the server for anything, and it asks for font files only.
import { useEffect, useState } from "react";

export type EditorFont = {
  id: string;
  name: string;
  covered: string;
  /** A one-line note about the font's licence, shown in the font picker. */
  note?: string;
};
export type FontStatus = "loading" | "ready" | "error";

export const FONT_ROUTE = "/admin/keepsake-editor/fonts";

/** The CSS family the editor registers for a font id. Prefixed so it cannot clash with site fonts. */
export function editorFontFamily(fontId: string): string {
  return `KE ${fontId}`;
}

export function useEditorFonts(fonts: readonly EditorFont[]): Record<string, FontStatus> {
  const [status, setStatus] = useState<Record<string, FontStatus>>({});

  useEffect(() => {
    let cancelled = false;
    for (const font of fonts) {
      const family = editorFontFamily(font.id);
      // A face registered by an earlier run of this effect is reused, never added twice.
      const existing = Array.from(document.fonts).find((face) => face.family.replace(/["']/g, "") === family);
      const face = existing ?? new FontFace(family, `url(${FONT_ROUTE}/${encodeURIComponent(font.id)})`);
      face
        .load()
        .then((loaded) => {
          if (!existing) document.fonts.add(loaded);
          if (!cancelled) setStatus((prev) => ({ ...prev, [font.id]: "ready" }));
        })
        .catch(() => {
          if (!cancelled) setStatus((prev) => ({ ...prev, [font.id]: "error" }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [fonts]);

  return status;
}
