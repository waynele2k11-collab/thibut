"use client";

// `ssr: false` is only allowed inside a Client Component (see
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md), so the server page renders this
// loader and the loader brings in the editor in the browser only.
import dynamic from "next/dynamic";
import type { EditorFont } from "./use-fonts";

const KeepsakeEditor = dynamic(
  () => import("./KeepsakeEditor").then((mod) => mod.KeepsakeEditor),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="font-body-md text-body-md text-on-surface-variant">
        Loading the editor…
      </p>
    ),
  }
);

export function KeepsakeEditorLoader({ fonts }: { fonts: EditorFont[] }) {
  return <KeepsakeEditor fonts={fonts} />;
}
