"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BackgroundResponseSchema = z.object({
  success: z.boolean().optional(),
  assetId: z.string().uuid().optional(),
  error: z.string().optional(),
});

export const ATMOSPHERIC_BACKGROUND_PRESETS = [
  {
    key: "zen-ivory",
    name: "Zen Ivory",
    subtitle: "Warm handmade washi grain",
    mood: "Calm",
    palette: "Ivory / Ink",
    intensity: "Minimal",
  },
  {
    key: "sumi-mist",
    name: "Sumi Mist",
    subtitle: "Diffused ink wash clouds",
    mood: "Mysterious",
    palette: "Beige / Black",
    intensity: "Medium",
  },
  {
    key: "bamboo-shadow",
    name: "Bamboo Shadow",
    subtitle: "Soft shoji leaf silhouette",
    mood: "Spiritual",
    palette: "Soft Gold",
    intensity: "Minimal",
  },
] as const;

export interface BackgroundLayerControlsProps {
  locked: boolean;
  backgroundAssetId: string | null;
  backgroundFillMode: "cover" | "contain";
  onChangeBackgroundAsset: (assetId: string | null) => void;
  onChangeBackgroundFillMode: (fillMode: "cover" | "contain") => void;
}

export function BackgroundLayerControls({
  locked,
  backgroundAssetId,
  backgroundFillMode,
  onChangeBackgroundAsset,
  onChangeBackgroundFillMode,
}: BackgroundLayerControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePresetLoading, setActivePresetLoading] = useState<string | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  const isBusy = Boolean(activePresetLoading) || isUploading;

  const handleGeneratePreset = async (
    preset: (typeof ATMOSPHERIC_BACKGROUND_PRESETS)[number]
  ) => {
    if (locked || isBusy) return;
    setActivePresetLoading(preset.key);
    setFeedbackMessage(null);

    try {
      const res = await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetKey: preset.key,
          mood: preset.mood,
          palette: preset.palette,
          intensity: preset.intensity,
        }),
      });

      const raw: unknown = await res.json().catch(() => ({}));
      const parsed = BackgroundResponseSchema.safeParse(raw);

      if (res.ok && parsed.success && parsed.data.assetId) {
        onChangeBackgroundAsset(parsed.data.assetId);
        setFeedbackMessage({
          tone: "info",
          text: `Applied ${preset.name} private atmospheric layer.`,
        });
        return;
      }

      setFeedbackMessage({
        tone: "error",
        text:
          (parsed.success && parsed.data.error) ||
          "Atmospheric generator unavailable — upload a custom image or keep Pure Washi.",
      });
    } catch {
      setFeedbackMessage({
        tone: "error",
        text: "Unable to reach background generator.",
      });
    } finally {
      setActivePresetLoading(null);
    }
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || locked || isBusy) return;

    setIsUploading(true);
    setFeedbackMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/uploads/background", {
        method: "POST",
        body: formData,
      });

      const raw: unknown = await res.json().catch(() => ({}));
      const parsed = BackgroundResponseSchema.safeParse(raw);

      if (res.ok && parsed.success && parsed.data.assetId) {
        onChangeBackgroundAsset(parsed.data.assetId);
        setFeedbackMessage({
          tone: "info",
          text: "Private photo uploaded (INV-014 encrypted & non-public).",
        });
        return;
      }

      setFeedbackMessage({
        tone: "error",
        text:
          (parsed.success && parsed.data.error) ||
          "Upload rejected — please choose a PNG, JPEG, or WebP under 10 MB.",
      });
    } catch {
      setFeedbackMessage({
        tone: "error",
        text: "Failed to upload private background image.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="pt-4 border-t border-surface-variant space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block">
            Background &amp; Private Art Layer
          </span>
          <span className="font-body-md text-xs text-on-surface-variant">
            Pure transparent print, AI wash, or private photo (INV-014)
          </span>
        </div>
        {backgroundAssetId && <Badge variant="seal">Layer Active</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={locked || isBusy}
          onClick={() => {
            onChangeBackgroundAsset(null);
            setFeedbackMessage(null);
          }}
          className={`min-h-11 p-2.5 rounded-lg border text-left transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60 ${
            !backgroundAssetId
              ? "border-2 border-primary bg-surface-container-lowest"
              : "border-surface-variant bg-surface-container-lowest hover:border-outline"
          }`}
        >
          <span className="font-label-caps text-[11px] uppercase text-on-background block">
            Pure Transparent
          </span>
          <span className="font-body-md text-[11px] text-on-surface-variant">
            Clean garment / archival print
          </span>
        </button>

        {ATMOSPHERIC_BACKGROUND_PRESETS.map((preset) => {
          const loadingThis = activePresetLoading === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              disabled={locked || isBusy}
              onClick={() => handleGeneratePreset(preset)}
              className="min-h-11 p-2.5 rounded-lg border border-surface-variant bg-surface-container-lowest hover:border-primary text-left transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-60"
            >
              <span className="font-label-caps text-[11px] uppercase text-on-background inline-flex items-center gap-1">
                {loadingThis ? (
                  <Loader2
                    className="w-3 h-3 animate-spin motion-reduce:animate-none text-secondary"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles
                    className="w-3 h-3 text-secondary"
                    aria-hidden="true"
                  />
                )}
                <span>{preset.name}</span>
              </span>
              <span className="font-body-md text-[11px] text-on-surface-variant block">
                {preset.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelected}
          className="sr-only"
          aria-label="Upload private background image"
          disabled={locked || isBusy}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={locked || isBusy}
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
        >
          {isUploading ? (
            <Loader2
              className="w-4 h-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ImagePlus className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{isUploading ? "Uploading..." : "Upload Private Photo"}</span>
        </Button>

        {backgroundAssetId && (
          <>
            <div
              role="group"
              aria-label="Background fit mode"
              className="inline-flex rounded border border-outline-variant bg-surface-container-lowest p-0.5"
            >
              <button
                type="button"
                disabled={locked}
                aria-pressed={backgroundFillMode === "contain"}
                onClick={() => onChangeBackgroundFillMode("contain")}
                className={`px-2.5 py-1.5 rounded font-label-caps text-[10px] uppercase cursor-pointer ${
                  backgroundFillMode === "contain"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Fit
              </button>
              <button
                type="button"
                disabled={locked}
                aria-pressed={backgroundFillMode === "cover"}
                onClick={() => onChangeBackgroundFillMode("cover")}
                className={`px-2.5 py-1.5 rounded font-label-caps text-[10px] uppercase cursor-pointer ${
                  backgroundFillMode === "cover"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Fill
              </button>
            </div>

            <button
              type="button"
              disabled={locked}
              onClick={() => onChangeBackgroundAsset(null)}
              aria-label="Remove background layer"
              className="min-h-9 min-w-9 rounded border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-error flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {feedbackMessage && (
        <p
          role="status"
          className={`font-body-md text-xs ${
            feedbackMessage.tone === "error"
              ? "text-error"
              : "text-on-surface-variant"
          }`}
        >
          {feedbackMessage.text}
        </p>
      )}
    </section>
  );
}
