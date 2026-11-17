"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ensureStudioSessionAction } from "@/app/actions/composition";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";

const VALID_TRADITIONS = new Set<ScriptCategory>([
  "VIETNAMESE_THU_PHAP",
  "JAPANESE_SHODO",
  "CHINESE_CALLIGRAPHY",
  "KOREAN_BRUSH",
]);

export interface CreateSessionBootstrapProps {
  text?: string;
  tradition?: string;
  treatment?: string;
  galleryId?: string;
}

export function CreateSessionBootstrap({
  text,
  tradition,
  treatment,
  galleryId,
}: CreateSessionBootstrapProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const searchProps = new URLSearchParams();
    if (text) searchProps.set("text", text);
    if (tradition) searchProps.set("tradition", tradition);
    if (treatment) searchProps.set("treatment", treatment);
    if (galleryId) searchProps.set("galleryId", galleryId);
    const queryString = searchProps.toString()
      ? `?${searchProps.toString()}`
      : "";

    const resolvedTradition =
      tradition && VALID_TRADITIONS.has(tradition as ScriptCategory)
        ? (tradition as ScriptCategory)
        : undefined;

    ensureStudioSessionAction({
      ...(text?.trim() ? { inputText: text.trim().slice(0, 200) } : {}),
      ...(resolvedTradition ? { culturalStyle: resolvedTradition } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        const targetId =
          res.ok && res.sessionId ? res.sessionId : crypto.randomUUID();
        router.replace(`/create/${targetId}${queryString}`);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace(`/create/${crypto.randomUUID()}${queryString}`);
      });

    return () => {
      cancelled = true;
    };
  }, [text, tradition, treatment, galleryId, router]);

  return (
    <main className="w-full min-h-[80vh] flex items-center justify-center bg-background text-on-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2
          className="w-8 h-8 text-secondary animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Preparing Calligraphy Studio...
        </p>
      </div>
    </main>
  );
}
