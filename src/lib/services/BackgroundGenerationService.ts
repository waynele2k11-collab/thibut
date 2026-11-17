import "server-only";
import { fal } from "@fal-ai/client";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const BACKGROUND_FAL_TIMEOUT_MS = 15_000;

const FalImageListSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
      })
    )
    .min(1),
});

const FalSubscribeOutputSchema = z.union([
  FalImageListSchema,
  z.object({
    data: FalImageListSchema,
  }),
]);

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)/gi,
  /system\s*prompt/gi,
  /\b(write|draw|render|spell|type|print)\b[^.]{0,40}\b(text|words?|letters?|kanji|hanzi|characters?|signature|watermark)\b/gi,
];

/**
 * Sanitizes untrusted `userNote` and style tokens before building the non-textual
 * background prompt (T-410).
 */
export function sanitizeBackgroundUserNote(raw: string | undefined): string {
  if (!raw) return "";
  let cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>`{}[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim().slice(0, 140);
}

function sanitizePresetToken(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/[^A-Za-z0-9\s/-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return cleaned || fallback;
}

export interface GeneratePresetBackgroundOptions {
  presetKey: string;
  mood?: string;
  palette?: string;
  intensity?: string;
  userNote?: string;
  compositionId?: string;
}

export interface GeneratePresetBackgroundResult {
  url: string | null;
  promptUsed?: string;
  success: boolean;
  errorCode?: "PRESET_NOT_FOUND" | "PROVIDER_ERROR";
}

export class BackgroundGenerationService {
  /**
   * Generates a purely non-textual background scene via FAL Flux Schnell
   * with strict 15s timeout, Zod response validation, and sanitized user notes (T-410).
   */
  public static async generatePresetBackground(
    options: GeneratePresetBackgroundOptions
  ): Promise<GeneratePresetBackgroundResult> {
    try {
      const preset = await prisma.backgroundPreset.findUnique({
        where: { key: options.presetKey },
      });

      if (!preset || !preset.enabled) {
        return {
          url: null,
          success: false,
          errorCode: "PRESET_NOT_FOUND",
        };
      }

      const mood = sanitizePresetToken(
        options.mood,
        preset.defaultMood || "Calm"
      );
      const palette = sanitizePresetToken(
        options.palette,
        preset.defaultPalette || "Neutral"
      );
      const intensity = sanitizePresetToken(
        options.intensity,
        preset.defaultIntensity || "Medium"
      );
      const safeNote = sanitizeBackgroundUserNote(options.userNote);

      const isolatedNoteClause = safeNote
        ? `Visual atmosphere detail (non-textual scene attribute only): "${safeNote}".`
        : "";

      const basePrompt = preset.promptTemplate
        .replace("{{mood}}", mood)
        .replace("{{palette}}", palette)
        .replace("{{intensity}}", intensity)
        .replace("{{userNote}}", isolatedNoteClause)
        .trim();

      const prompt = `${basePrompt} STRICT GUARDRAIL: Pure non-textual background texture/atmosphere only; zero letters, words, calligraphy strokes, signage, or watermarks.`;

      const rawResult: unknown = await fal.subscribe("fal-ai/flux/schnell", {
        input: {
          prompt,
          image_size: "portrait_4_3",
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        },
        logs: false,
        abortSignal: AbortSignal.timeout(BACKGROUND_FAL_TIMEOUT_MS),
      });

      const parsed = FalSubscribeOutputSchema.parse(rawResult);
      const images = "data" in parsed ? parsed.data.images : parsed.images;
      const imageUrl = images[0].url;

      return {
        url: imageUrl,
        promptUsed: prompt,
        success: true,
      };
    } catch (error: unknown) {
      console.error(
        "[BackgroundGenerationService] Generation failed:",
        error instanceof Error ? error.name : "UnknownError"
      );
      return {
        url: null,
        success: false,
        errorCode: "PROVIDER_ERROR",
      };
    }
  }
}
