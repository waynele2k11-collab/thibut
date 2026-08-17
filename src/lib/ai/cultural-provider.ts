/**
 * CULTURAL INTELLIGENCE PROVIDER
 * 
 * Priority chain:
 *   1. Google Gemini 2.0 Flash  — FREE (1500 req/day), great CJK/Vietnamese
 *   2. OpenAI GPT-4.1           — Paid, highest accuracy
 *   3. Curated offline fallback — Always available
 * 
 * Uses Structured Outputs / JSON Schema on both providers for type-safe results.
 * Architecture: AIProvider adapter pattern per SYSTEM_ARCHITECTURE §27
 */

import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────────────────

export const InterpretationSchema = z.object({
  interpretations: z.array(
    z.object({
      type: z.enum(["ORIGINAL", "PHONETIC", "SCRIPT_TRANSLITERATION", "CULTURAL", "LITERAL", "NATURAL", "POETIC", "IDIOMATIC"]),
      language: z.string(),
      text: z.string(),
      romanization: z.string().optional(),
      meaning: z.string(),
      confidence: z.number().min(0).max(1),
      warning: z.string().optional(),
      recommended: z.boolean(),
      recommendedStyles: z.array(z.string()).optional(),
      culturalContext: z.string().optional(),
    })
  ),
  inputAnalysis: z.object({
    detectedLanguage: z.string(),
    inputType: z.enum(["NAME", "WORD", "PHRASE", "SENTENCE", "STORY"]),
    intent: z.string().optional(),
    themes: z.array(z.string()).optional(),
  }),
});

export type InterpretationResult = z.infer<typeof InterpretationSchema>;

// ── System Prompt (shared) ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Cultural Intelligence Engine for Thi Bút, an AI-powered calligraphy marketplace.

Your role is to translate, transliterate, and culturally interpret human text across Asian languages for artistic calligraphy products.

Rules:
1. NEVER misrepresent phonetic transliteration as semantic meaning
2. Clearly distinguish TRANSLITERATION (sound) vs TRANSLATION (meaning)
3. Flag cultural concerns with a "warning" field
4. For POETIC type: use classical 4-character idioms (Yojijukugo for Japanese, Chéngyǔ for Chinese, Saja-seong-eo for Korean, Ca dao for Vietnamese)
5. Report confidence honestly (0.0–1.0)
6. Recommend calligraphy styles matching cultural context of the interpretation
7. For NAME mode: always include TRANSLITERATION showing how the name sounds in the target script

Supported languages: Vietnamese, Japanese (Kanji/Kana), Chinese (Simplified & Traditional), Korean (Hangul)`;

// ── JSON Schema for Structured Outputs ───────────────────────────────────────

const OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    interpretations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["ORIGINAL", "PHONETIC", "SCRIPT_TRANSLITERATION", "CULTURAL", "LITERAL", "NATURAL", "POETIC", "IDIOMATIC"] },
          language: { type: "string" },
          text: { type: "string" },
          romanization: { type: "string" },
          meaning: { type: "string" },
          confidence: { type: "number" },
          warning: { type: "string" },
          recommended: { type: "boolean" },
          recommendedStyles: { type: "array", items: { type: "string" } },
          culturalContext: { type: "string" },
        },
        required: ["type", "language", "text", "meaning", "confidence", "recommended"],
      },
    },
    inputAnalysis: {
      type: "object",
      properties: {
        detectedLanguage: { type: "string" },
        inputType: { type: "string", enum: ["NAME", "WORD", "PHRASE", "SENTENCE", "STORY"] },
        intent: { type: "string" },
        themes: { type: "array", items: { type: "string" } },
      },
      required: ["detectedLanguage", "inputType"],
    },
  },
  required: ["interpretations", "inputAnalysis"],
};

// ── Input Type ────────────────────────────────────────────────────────────────

export interface CulturalAnalysisInput {
  inputText: string;
  targetLanguage: "Vietnamese" | "Japanese" | "Chinese" | "Korean";
  mode: "NAME" | "QUOTE" | "STORY" | "CREATOR_ART";
  detectedInputLanguage?: string; // Auto-detected by client
  requestedTypes?: Array<"ORIGINAL" | "PHONETIC" | "SCRIPT_TRANSLITERATION" | "CULTURAL" | "LITERAL" | "NATURAL" | "POETIC" | "IDIOMATIC">;
}

// Languages where input == target (already in calligraphy script)
const SAME_LANGUAGE_MAP: Record<string, string[]> = {
  Vietnamese: ["Vietnamese", "vi"],
  Japanese:   ["Japanese", "ja"],
  Chinese:    ["Chinese", "zh", "zh-CN", "zh-TW"],
  Korean:     ["Korean", "ko"],
};

function isSameLanguage(detected: string | undefined, target: string): boolean {
  if (!detected) return false;
  return SAME_LANGUAGE_MAP[target]?.some(
    (code) => detected.toLowerCase().startsWith(code.toLowerCase())
  ) ?? false;
}

function buildUserPrompt(input: CulturalAnalysisInput): string {
  const sameLang = isSameLanguage(input.detectedInputLanguage, input.targetLanguage);

  if (sameLang) {
    // Input is ALREADY in the target language — don't translate, just present calligraphy style options
    return `The user has provided text that is ALREADY written in ${input.targetLanguage}.
Do NOT translate it. Instead, provide calligraphy presentation options:

Input text: "${input.inputText}"
Mode: ${input.mode}

Return 3-4 interpretations of type NATURAL or POETIC:
- NATURAL: Present the text as-is for direct calligraphy rendering. Explain its meaning/cultural context.
- POETIC: Suggest a classical equivalent (Ca dao for Vietnamese, Yojijukugo for Japanese, etc.) that captures the same spirit.
- IDIOMATIC: Suggest the most authentic calligraphy-ready version of this text.

For each, provide romanization (Romanized Vietnamese / Romaji / Pinyin / Romanized Korean as appropriate).`;
  }

  // NAME Pipeline
  if (input.mode === "NAME") {
    const types = input.requestedTypes ?? ["ORIGINAL", "PHONETIC", "SCRIPT_TRANSLITERATION", "CULTURAL"];
    return `Analyze and interpret the following name for calligraphy art production:

Input text (Name): "${input.inputText}"
Detected input language: ${input.detectedInputLanguage ?? "unknown"}
Target language for calligraphy: ${input.targetLanguage}
Mode: ${input.mode}
Requested interpretation types: ${types.join(", ")}

Return exactly one interpretation for each requested type:
- ORIGINAL: The name exactly as provided, but formatted for display.
- PHONETIC: The phonetic spelling of the name to help the artist understand pronunciation.
- SCRIPT_TRANSLITERATION: The name transliterated phonetically into the target language script (e.g., Katakana for Japanese, Hangul for Korean).
- CULTURAL: A culturally meaningful, artistic rendering or equivalent of the name in the target language (optional but highly recommended if a good match exists).

Mark the single best one (usually SCRIPT_TRANSLITERATION or CULTURAL) as recommended=true.`;
  }

  // QUOTE/STORY/PHRASE Pipeline
  const types = input.requestedTypes ?? ["LITERAL", "NATURAL", "POETIC"];
  return `Analyze and interpret the following text for calligraphy art production:

Input text: "${input.inputText}"
Detected input language: ${input.detectedInputLanguage ?? "unknown"}
Target language for calligraphy: ${input.targetLanguage}
Mode: ${input.mode}
Requested interpretation types: ${types.join(", ")}

Return exactly one interpretation for each requested type:
- LITERAL: A direct, literal word-for-word translation.
- NATURAL: A fluent, conversational phrasing in the target language.
- POETIC: A highly artistic, classical idiom (e.g. Yojijukugo for Japanese, Chéngyǔ for Chinese, Ca dao for Vietnamese, Saja-seong-eo for Korean) that captures the meaning.

Mark the single best one (usually NATURAL or POETIC) as recommended=true.`;
}

// ── 1. Gemini Provider (FREE tier — primary) ──────────────────────────────────

async function analyzeWithGemini(input: CulturalAnalysisInput): Promise<InterpretationResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await genai.models.generateContent({
    model: "models/gemini-3-flash-preview",
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: OUTPUT_JSON_SCHEMA,
      temperature: 0.3,
    },
    contents: buildUserPrompt(input),
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini: empty response");

  return InterpretationSchema.parse(JSON.parse(raw));
}

// ── 2. OpenAI Provider (paid — secondary) ────────────────────────────────────

async function analyzeWithOpenAI(input: CulturalAnalysisInput): Promise<InterpretationResult> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT + "\n\nYou MUST respond in valid JSON format matching this schema:\n" + JSON.stringify(OUTPUT_JSON_SCHEMA, null, 2) },
      { role: "user", content: buildUserPrompt(input) },
    ],
    temperature: 0.3,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("OpenAI: empty response");

  return InterpretationSchema.parse(JSON.parse(raw));
}

// ── Provider Cascade ──────────────────────────────────────────────────────────

export class CulturalIntelligenceProvider {
  async analyze(input: CulturalAnalysisInput): Promise<InterpretationResult> {
    const isRateLimit = (err: unknown) => {
      const msg = (err instanceof Error ? err.message : String(err));
      return msg.includes("429") || msg.includes("quota") || msg.includes("rate limit") || msg.includes("RATE_LIMIT");
    };

    // 1. Try Gemini (free)
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log("[Cultural AI] Using Gemini 3 Flash");
        return await analyzeWithGemini(input);
      } catch (err) {
        if (isRateLimit(err)) {
          console.warn("[Cultural AI] Gemini rate-limited, trying OpenAI");
        } else {
          console.warn("[Cultural AI] Gemini error, trying OpenAI:", (err as Error).message?.slice(0, 80));
        }
      }
    }

    // 2. Try OpenAI (paid)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("[Cultural AI] Using GPT-4o");
        return await analyzeWithOpenAI(input);
      } catch (err) {
        if (isRateLimit(err)) throw new Error("QUOTA_EXCEEDED");
        throw err;
      }
    }

    // Both providers unavailable
    throw new Error("QUOTA_EXCEEDED");
  }
}

export const culturalIntelligence = new CulturalIntelligenceProvider();
