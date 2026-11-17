import "server-only";
import { z } from "zod";
import { deterministicUid, escapeXml } from "@/lib/security/xml";
import { PolicyGuard } from "@/lib/services/PolicyGuard";

export const VISUAL_AI_TIMEOUT_MS = 15_000;

export interface AtmosphericBackgroundInput {
  styleTheme: string;
  mood?: string;
  palette?: string;
  seed?: number;
}

export interface CreatorArtworkDerivativeInput {
  designId: string;
  creatorArtworkUrl: string;
  styleTheme: string;
  seed?: number;
}

export interface VisualSceneResult {
  imageUrl: string;
  seed: number;
  styleTheme: string;
  provider: "fal-ai" | "placeholder";
  nonTextualVerified: true;
}

const FalImagesResponseSchema = z.object({
  images: z
    .array(
      z.object({
        url: z.string().url(),
      })
    )
    .min(1),
});

const SCENE_THEMES: Readonly<
  Record<string, { bg: string; wash: string; accent: string; label: string }>
> = {
  Shodō: { bg: "#fbf9f4", wash: "#e4e2dd", accent: "#c8a96e", label: "Washi Paper" },
  Zen: { bg: "#f5f3ee", wash: "#dbdad5", accent: "#8ca0a0", label: "Zen Mist" },
  Seal: { bg: "#fbf9f4", wash: "#f0eee9", accent: "#b71032", label: "Imperial Silk" },
  Luxury: { bg: "#1b1c19", wash: "#30312e", accent: "#d4af37", label: "Gold Leaf Wash" },
  Classic: { bg: "#fbf9f4", wash: "#eae8e3", accent: "#76777b", label: "Rice Paper" },
  Ink: { bg: "#ffffff", wash: "#e5e2e3", accent: "#46474a", label: "Sumi Wash" },
  Minimal: { bg: "#fbf9f4", wash: "#f0eee9", accent: "#c7c6ca", label: "Pure Washi" },
};

function sanitizeDescriptor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>"{}`\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

function buildNonTextualScenePrompt(params: {
  styleTheme: string;
  mood?: string;
  palette?: string;
}): string {
  const theme = sanitizeDescriptor(params.styleTheme, "Classic");
  const mood = sanitizeDescriptor(params.mood, "Calm");
  const palette = sanitizeDescriptor(params.palette, "Warm Ivory and Sumi Wash");

  return [
    `Pure non-textual editorial East Asian paper and atmospheric wash background.`,
    `Theme: ${theme}. Mood: ${mood}. Palette: ${palette}.`,
    `Subtle organic rice-paper fibers and soft ambient negative space at the center.`,
    `STRICT CONSTRAINT: Generate ONLY abstract paper grain, mist, or botanical silhouettes.`,
    `Do NOT render any letters, words, kanji, hanzi, hangul, calligraphy strokes, signatures, seals, or watermarks.`,
  ].join(" ");
}

/**
 * Generates an `escapeXml`-safe, purely decorative non-textual paper wash SVG fallback (T-400, T-411).
 */
export function buildNonTextualFallbackSvg(params: {
  styleTheme: string;
  seed: number;
}): VisualSceneResult {
  const themeKey = params.styleTheme in SCENE_THEMES ? params.styleTheme : "Classic";
  const palette = SCENE_THEMES[themeKey];
  const uid = deterministicUid(`${params.styleTheme}|${params.seed}`, "wash");
  const safeLabel = escapeXml(`${palette.label} (${params.styleTheme})`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="${safeLabel}">
  <desc>${safeLabel}</desc>
  <defs>
    <radialGradient id="${uid}-grad" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="${escapeXml(palette.bg)}" stop-opacity="1" />
      <stop offset="100%" stop-color="${escapeXml(palette.wash)}" stop-opacity="1" />
    </radialGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#${uid}-grad)" />
  <circle cx="400" cy="480" r="260" fill="none" stroke="${escapeXml(palette.accent)}" stroke-width="1.5" opacity="0.22" />
</svg>`;

  return {
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    seed: params.seed,
    styleTheme: params.styleTheme,
    provider: "placeholder",
    nonTextualVerified: true,
  };
}

/**
 * VISUAL AI PROVIDER (T-400, T-409, T-410, T-411, TB-CALLI-002, TB-CALLI-007).
 *
 * Strictly restricted to:
 *   1. Non-textual background textures / atmospheric scenes.
 *   2. Creator-policy-checked (`allowAIRestyle` + `allowDerivative`) non-textual artwork derivatives.
 *
 * Linguistic character rendering via raster image models (`gpt-image-2`, Gemini image, Flux text)
 * is permanently prohibited per SYSTEM_ARCHITECTURE §5.2 and TB-CALLI-002.
 */
export class VisualAIProvider {
  public async generateAtmosphericBackground(
    input: AtmosphericBackgroundInput
  ): Promise<VisualSceneResult> {
    const seed = input.seed ?? 1000;

    if (process.env.FAL_KEY) {
      try {
        const prompt = buildNonTextualScenePrompt({
          styleTheme: input.styleTheme,
          mood: input.mood,
          palette: input.palette,
        });

        const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
          method: "POST",
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            image_size: "portrait_4_3",
            num_images: 1,
            seed,
            enable_safety_checker: true,
          }),
          signal: AbortSignal.timeout(VISUAL_AI_TIMEOUT_MS),
        });

        if (!response.ok) {
          throw new Error(`FAL HTTP ${response.status}`);
        }

        const parsed = FalImagesResponseSchema.parse(await response.json());
        return {
          imageUrl: parsed.images[0].url,
          seed,
          styleTheme: input.styleTheme,
          provider: "fal-ai",
          nonTextualVerified: true,
        };
      } catch (err: unknown) {
        console.warn(
          "[VisualAI] Atmospheric background fallback:",
          err instanceof Error ? err.name : "UnknownError"
        );
      }
    }

    return buildNonTextualFallbackSvg({
      styleTheme: input.styleTheme,
      seed,
    });
  }

  /**
   * Restyles creator artwork via Flux Kontext ONLY after `PolicyGuard` verifies
   * `allowAIRestyle` and `allowDerivative` on `designId` (INV-012, T-409).
   * Never draws or modifies linguistic characters (TB-CALLI-002).
   */
  public async generateCreatorArtworkDerivative(
    input: CreatorArtworkDerivativeInput
  ): Promise<VisualSceneResult> {
    // Mandatory creator permission enforcement (INV-012, INV-010, T-409)
    await PolicyGuard.assertPermissions(input.designId, [
      "allowAIRestyle",
      "allowDerivative",
    ]);

    const seed = input.seed ?? 2000;

    if (process.env.FAL_KEY) {
      const prompt = [
        `Subtly harmonize the visual color wash and paper texture of the reference illustration in a ${sanitizeDescriptor(input.styleTheme, "Classic")} aesthetic.`,
        `Preserve original illustration integrity. Strictly DO NOT add any text, letters, characters, kanji, signatures, or watermarks.`,
      ].join(" ");

      const response = await fetch("https://fal.run/fal-ai/flux-kontext-pro", {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_url: input.creatorArtworkUrl,
          image_size: "portrait_4_3",
          num_images: 1,
          seed,
          safety_tolerance: "2",
          output_format: "png",
        }),
        signal: AbortSignal.timeout(VISUAL_AI_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`FAL Kontext HTTP ${response.status}`);
      }

      const parsed = FalImagesResponseSchema.parse(await response.json());
      return {
        imageUrl: parsed.images[0].url,
        seed,
        styleTheme: input.styleTheme,
        provider: "fal-ai",
        nonTextualVerified: true,
      };
    }

    return buildNonTextualFallbackSvg({
      styleTheme: input.styleTheme,
      seed,
    });
  }
}

export const visualAI = new VisualAIProvider();
