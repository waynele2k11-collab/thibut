/**
 * VISUAL AI PROVIDER
 * 
 * Generates 6 calligraphy candidate images per personalization session.
 * 
 * Priority chain:
 *   1. Gemini 2.0 Flash Image Generation  — free tier
 *   2. fal.ai Flux Kontext Pro             — $0.04/image, highest quality
 *   3. Styled placeholder (SVG)            — always works, no key needed
 * 
 * Architecture: VisualAIProvider adapter per SYSTEM_ARCHITECTURE §27
 */

export interface CalligraphyGenerationInput {
  originalText: string;
  interpretedText: string;
  romanization?: string;
  meaning?: string;
  culturalStyle: string;
  textTreatment: "KEEP_ORIGINAL" | "TRANSLATE";
  stylePack: string;
  targetLanguage?: string | null;
  creatorArtworkUrl?: string;
  variationSeed?: number;
}

export interface CalligraphyCandidate {
  imageUrl: string;
  seed: number;
  stylePack: string;
  variationNote: string;
  generationPrompt: string;
  provider: "gemini" | "fal-ai" | "openai" | "placeholder";
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// ── Style prompt map ──────────────────────────────────────────────────────────

const STYLE_PROMPT_MAP: Record<string, string> = {
  "Classic":  "elegant Vietnamese thư pháp brush calligraphy, ink on washi paper, warm ivory background, traditional Vietnamese artistic lettering",
  "Shodō":    "traditional Japanese Shodō brush calligraphy, bold sumi ink strokes, white washi paper, vertical composition, Zen aesthetic",
  "Ink":      "expressive heavy sumi ink brush strokes, bold East Asian calligraphy, dramatic ink wash, high contrast black on white",
  "Zen":      "minimal Zen calligraphy, restrained brushwork, negative space, single graceful ink stroke, pure white ground",
  "Seal":     "Chinese seal script (Zhuanshu), deep crimson red on ivory, carved stone chop aesthetic, bold angular strokes",
  "Modern":   "contemporary Asian typography, clean modern brush strokes, minimalist composition, editorial art direction",
  "Luxury":   "luxury calligraphy, black ink with gold leaf accents, premium ivory paper, high-end fashion editorial aesthetic",
  "Street":   "bold oversized East Asian brush lettering, urban energy, thick expressive strokes, street art meets traditional calligraphy",
  "Minimal":  "highly restrained single-character calligraphy, extreme negative space, paper-and-ink stillness, museum-quality presentation",
};

const COMPOSITION_MAP: Record<string, string> = {
  "Vertical":  "vertical top-to-bottom layout, traditional East Asian scroll orientation",
  "Centered":  "centered symmetrical composition, balanced",
  "LeftChest": "compact small logo-sized design, tight composition, suitable for left chest placement",
  "FullBack":  "large statement design, full back placement, bold visual impact",
  "Sleeve":    "narrow vertical band, sleeve-width composition, sequential characters",
};

function buildPrompt(input: CalligraphyGenerationInput, variationNote?: string): string {
  // Apply Latin Fallback if necessary
  let effectiveStyle = input.stylePack;
  if ((input.targetLanguage === "Vietnamese" || input.targetLanguage === "English") && effectiveStyle === "Shodō") {
    effectiveStyle = "Thi Bút Brush";
  }

  const styleDesc = STYLE_PROMPT_MAP[effectiveStyle] ?? STYLE_PROMPT_MAP["Classic"];
  const culturalStyleStr = input.culturalStyle.replace(/_/g, ' ').toLowerCase();

  if (input.textTreatment === "KEEP_ORIGINAL") {
    return [
      `The exact artwork text is: "${input.originalText}".`,
      `Preserve these exact words. Do not translate. Do not replace words. Do not add foreign-language characters.`,
      `Render the English lettering using a visual language inspired by ${culturalStyleStr} brush calligraphy.`,
      `${styleDesc},`,
      `transparent or white background, print-ready artwork, no watermarks, no people,`,
      `ultra high quality professional calligraphy art, museum quality.`,
      variationNote ?? "",
    ].join(" ").trim();
  }

  return [
    `${styleDesc},`,
    `showing the text "${input.interpretedText}"${input.romanization ? ` (${input.romanization})` : ""},`,
    input.meaning ? `meaning: "${input.meaning}",` : "",
    `transparent or white background, print-ready artwork, no watermarks, no people,`,
    `ultra high quality professional calligraphy art, museum quality.`,
    variationNote ?? "",
  ].join(" ").trim();
}

// ── 1. Gemini Image Generation ─────────────────────────────────────────────────

async function generateWithGemini(
  input: CalligraphyGenerationInput,
  count: number
): Promise<CalligraphyCandidate[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const variationNotes = [
    "very bold strokes, high contrast",
    "delicate fine strokes, subtle ink wash",
    "medium weight, balanced composition",
    "expressive gestural brushwork",
    "geometric structured style",
    "flowing cursive style",
  ];

  const results: CalligraphyCandidate[] = [];
  const seed = input.variationSeed ?? Date.now();

  await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const prompt = buildPrompt(input, variationNotes[i % variationNotes.length]);
      try {
        // gemini-3-flash-preview supports image generation via generateContent
        // with responseModalities: ["IMAGE", "TEXT"]
        const response = await genai.models.generateContent({
          model: "models/gemini-3-flash-preview",
          config: {
            responseModalities: ["IMAGE", "TEXT"],
            temperature: 1.0,
          },
          contents: `Generate a professional calligraphy artwork image: ${prompt}. Output only the image.`,
        });

        // Extract image bytes from response parts
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/")) as any;
        if (!imagePart?.inlineData?.data) throw new Error("No image in response");

        const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        results[i] = {
          imageUrl: dataUrl,
          seed: seed + i,
          stylePack: input.stylePack,
          variationNote: variationNotes[i % variationNotes.length],
          generationPrompt: prompt,
          provider: "gemini",
        };
      } catch (err) {
        console.warn(`[VisualAI] Gemini candidate ${i + 1} failed:`, (err as Error).message?.slice(0, 80));
      }
    })
  );

  return results.filter(Boolean);
}

// ── 2. fal.ai Flux Kontext Pro ────────────────────────────────────────────────

async function generateWithFal(
  input: CalligraphyGenerationInput,
  count: number
): Promise<CalligraphyCandidate[]> {
  const seed = input.variationSeed ?? Math.floor(Math.random() * 99999);
  const results: CalligraphyCandidate[] = [];

  await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const candidateSeed = seed + i * 1000;
      const prompt = buildPrompt(input);
      try {
        const body: Record<string, unknown> = {
          prompt,
          image_size: "portrait_4_3",
          num_images: 1,
          seed: candidateSeed,
          safety_tolerance: "2",
          output_format: "jpeg",
        };

        // Flux Kontext: if creator artwork provided, use as context image
        if (input.creatorArtworkUrl) {
          body.image_url = input.creatorArtworkUrl;
        }

        const response = await fetch(
          input.creatorArtworkUrl
            ? "https://fal.run/fal-ai/flux-kontext-pro"
            : "https://fal.run/fal-ai/flux-pro",
          {
            method: "POST",
            headers: {
              Authorization: `Key ${process.env.FAL_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) throw new Error(`fal.ai ${response.status}`);
        const data = await response.json();
        const imageUrl = data.images?.[0]?.url;
        if (!imageUrl) throw new Error("No image URL in response");

        results[i] = {
          imageUrl,
          seed: candidateSeed,
          stylePack: input.stylePack,
          variationNote: "default fal-ai generation",
          generationPrompt: prompt,
          provider: "fal-ai",
        };
      } catch (err) {
        console.warn(`[VisualAI] fal.ai candidate ${i + 1} failed:`, (err as Error).message?.slice(0, 60));
      }
    })
  );

  return results.filter(Boolean);
}

// ── 3. OpenAI DALL-E 2 ────────────────────────────────────────────────────────

async function generateWithOpenAI(
  input: CalligraphyGenerationInput,
  count: number
): Promise<CalligraphyCandidate[]> {
  const seed = input.variationSeed ?? Math.floor(Math.random() * 99999);
  const results: CalligraphyCandidate[] = [];

  await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const candidateSeed = seed + i * 1000;
      const variationNote = VARIATION_NOTES[i % VARIATION_NOTES.length];
      const prompt = buildPrompt(input, variationNote);
      try {
        const response = await openai.images.generate({
          model: "gpt-image-2",
          prompt: prompt.slice(0, 1000),
          n: 1,
          size: "1024x1024",
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data in response");
        const imageUrl = `data:image/png;base64,${b64}`;

        results[i] = {
          imageUrl,
          seed: candidateSeed,
          stylePack: input.stylePack,
          variationNote: variationNote,
          generationPrompt: prompt,
          provider: "openai",
        };
      } catch (err) {
        console.warn(`[VisualAI] OpenAI candidate ${i + 1} failed:`, (err as Error).message?.slice(0, 100));
      }
    })
  );

  return results.filter(Boolean);
}

// ── 4. Styled SVG Placeholder (CJK-safe inline SVG) ─────────────────────────

const STYLE_THEMES: Record<string, { bg: string; ink: string; accent: string; label: string }> = {
  "Shodō":   { bg: "#f8f5f0", ink: "#1a1209", accent: "#c8a96e", label: "書道" },
  "Zen":     { bg: "#f5f5f0", ink: "#2c2c2c", accent: "#8ca0a0", label: "禅" },
  "Seal":    { bg: "#fff8f0", ink: "#9b1c1c", accent: "#cc2222", label: "篆" },
  "Luxury":  { bg: "#1a1209", ink: "#d4af37", accent: "#f0cc66", label: "奢" },
  "Street":  { bg: "#111111", ink: "#ffffff", accent: "#ff4444", label: "街" },
  "Modern":  { bg: "#f0f0f0", ink: "#222222", accent: "#4477ff", label: "現" },
  "Classic": { bg: "#fdf6e3", ink: "#3d2b1f", accent: "#c8a96e", label: "古" },
  "Ink":     { bg: "#ffffff", ink: "#000000", accent: "#555555", label: "墨" },
  "Minimal": { bg: "#fafafa", ink: "#333333", accent: "#aaaaaa", label: "極" },
  "Thi Bút Brush": { bg: "transparent", ink: "#222222", accent: "#cc2222", label: "THI BÚT BRUSH" },
};

const VARIATION_NOTES = [
  "Controlled / balanced",
  "Bold / energetic",
  "Dry brush / expressive",
  "Heavy ink saturation",
  "Minimal / restrained",
  "Swift continuous stroke",
];

function placeholderCandidate(input: CalligraphyGenerationInput, index: number): CalligraphyCandidate {
  let effectiveStyle = input.stylePack;
  if ((input.targetLanguage === "Vietnamese" || input.targetLanguage === "English") && effectiveStyle === "Shodō") {
    effectiveStyle = "Thi Bút Brush";
  }

  const theme = STYLE_THEMES[effectiveStyle] ?? STYLE_THEMES["Classic"];
  const text = input.interpretedText;
  const variationNote = VARIATION_NOTES[index % VARIATION_NOTES.length];
  
  // The placeholder must now be PURE ARTWORK, not a composed card.
  // We use a simple transparent background and just render the text.
  // If we are falling back to Thi But Brush, we show a brushy font representation if possible.
  
  const isLatin = /^[A-Za-z0-9\s.,'?!ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]+$/.test(text);

  const fontSizeBase = text.length <= 4 ? 120 : text.length <= 8 ? 80 : 50;
  
  // Create distinct visual permutations so the 6 mocks don't look identical
  const visualVariants = [
    { fw: "400", ls: 0, opacity: 1, rotate: 0, sealX: 400, sealY: 400, size: 1 },
    { fw: "900", ls: 4, opacity: 0.9, rotate: -3, sealX: 410, sealY: 380, size: 1.1 },
    { fw: "300", ls: 8, opacity: 0.8, rotate: 2, sealX: 380, sealY: 420, size: 0.95 },
    { fw: "700", ls: -2, opacity: 0.95, rotate: 5, sealX: 390, sealY: 390, size: 1.05 },
    { fw: "200", ls: 12, opacity: 0.75, rotate: -2, sealX: 420, sealY: 410, size: 0.9 },
    { fw: "500", ls: 2, opacity: 1, rotate: -5, sealX: 370, sealY: 430, size: 1.15 },
  ];
  const vv = visualVariants[index % visualVariants.length];
  
  const fontSize = fontSizeBase * vv.size;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <rect width="500" height="500" fill="transparent"/>
  
  <!-- "Offline" warning badge for development if it's supposed to be an AI generation -->
  <rect x="20" y="20" width="220" height="24" fill="#ffecb3" rx="4"/>
  <text x="130" y="36" font-family="sans-serif" font-size="10" fill="#cc7700" text-anchor="middle" font-weight="bold">AI RENDERER OFFLINE (DEV)</text>
  
  <!-- The raw artwork stroke representation -->
  <text
    x="250" y="250"
    font-family="${isLatin ? "'Dancing Script', 'Caveat', cursive, serif" : "'Noto Serif CJK SC', 'Noto Serif JP', serif"}"
    font-size="${fontSize}"
    fill="${theme.ink}"
    text-anchor="middle"
    dominant-baseline="central"
    font-weight="${vv.fw}"
    letter-spacing="${vv.ls}"
    opacity="${vv.opacity}"
    transform="rotate(${vv.rotate}, 250, 250)"
  >${text}</text>
  
  <!-- Red seal accent to act as the signature -->
  <rect x="${vv.sealX}" y="${vv.sealY}" width="40" height="40" fill="${theme.accent}" opacity="0.85" rx="2" transform="rotate(${vv.rotate * -2}, ${vv.sealX+20}, ${vv.sealY+20})"/>
  <text x="${vv.sealX + 20}" y="${vv.sealY + 26}" font-family="serif" font-size="16" fill="white" text-anchor="middle" opacity="0.95" transform="rotate(${vv.rotate * -2}, ${vv.sealX+20}, ${vv.sealY+20})">${theme.label.substring(0, 1)}</text>
</svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return {
    imageUrl: dataUrl,
    seed: (input.variationSeed ?? 0) + index,
    stylePack: effectiveStyle,
    variationNote: variationNote,
    generationPrompt: buildPrompt(input, variationNote),
    provider: "placeholder",
  };
}

// ── Main Provider ─────────────────────────────────────────────────────────────

export class VisualAIProvider {
  async generateCalligraphyCandidates(
    input: CalligraphyGenerationInput,
    count: number = 6
  ): Promise<CalligraphyCandidate[]> {
    // 1. Try OpenAI DALL-E 2
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`[VisualAI] Generating ${count} variations with OpenAI DALL-E 2...`);
        const candidates = await generateWithOpenAI(input, count);
        if (candidates.length >= Math.floor(count / 2)) {
          console.log(`[VisualAI] OpenAI generated ${candidates.length}/${count} candidates`);
          while (candidates.length < count) {
            candidates.push(placeholderCandidate(input, candidates.length));
          }
          return candidates;
        }
      } catch (err) {
        console.error("[VisualAI] OpenAI generation failed:", err);
      }
    }

    // 2. Try Gemini image generation (free)
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("[VisualAI] Trying Gemini Imagen 3...");
        const candidates = await generateWithGemini(input, count);
        if (candidates.length >= Math.floor(count / 2)) {
          console.log(`[VisualAI] Gemini generated ${candidates.length}/${count} candidates`);
          while (candidates.length < count) {
            candidates.push(placeholderCandidate(input, candidates.length));
          }
          return candidates;
        }
        console.warn(`[VisualAI] Gemini only returned ${candidates.length}/${count}, trying fal.ai`);
      } catch (err) {
        console.warn("[VisualAI] Gemini image generation failed:", (err as Error).message?.slice(0, 80));
      }
    }

    // 3. Try fal.ai Flux Kontext Pro
    if (process.env.FAL_KEY) {
      try {
        console.log("[VisualAI] Trying fal.ai Flux Kontext Pro...");
        const candidates = await generateWithFal(input, count);
        if (candidates.length > 0) {
          console.log(`[VisualAI] fal.ai generated ${candidates.length}/${count} candidates`);
          while (candidates.length < count) {
            candidates.push(placeholderCandidate(input, candidates.length));
          }
          return candidates;
        }
      } catch (err) {
        console.warn("[VisualAI] fal.ai failed:", (err as Error).message?.slice(0, 80));
      }
    }

    // 4. Styled placeholders (always works — good enough for UI dev)
    console.log("[VisualAI] Using styled placeholders (add OPENAI_API_KEY, GEMINI_API_KEY or FAL_KEY for real images)");
    return Array.from({ length: count }, (_, i) => placeholderCandidate(input, i));
  }
}

export const visualAI = new VisualAIProvider();
