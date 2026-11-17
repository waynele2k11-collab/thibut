"use client";

import { use, useEffect } from "react";
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

export default function CreateIndex({
  searchParams,
}: {
  searchParams: Promise<{
    text?: string;
    tradition?: string;
    treatment?: string;
  }>;
}) {
  const params = use(searchParams);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const searchProps = new URLSearchParams();
    if (params.text) searchProps.set("text", params.text);
    if (params.tradition) searchProps.set("tradition", params.tradition);
    if (params.treatment) searchProps.set("treatment", params.treatment);
    const queryString = searchProps.toString()
      ? `?${searchProps.toString()}`
      : "";

    const resolvedTradition =
      params.tradition &&
      VALID_TRADITIONS.has(params.tradition as ScriptCategory)
        ? (params.tradition as ScriptCategory)
        : undefined;

    ensureStudioSessionAction({
      ...(params.text?.trim()
        ? { inputText: params.text.trim().slice(0, 200) }
        : {}),
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
  }, [params, router]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-background text-on-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Preparing Calligraphy Studio...
        </p>
      </div>
    </div>
  );
}
