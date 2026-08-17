/**
 * POST /api/personalization/detect-language
 * 
 * Fast lightweight language detection for the Step 1 input field.
 * Uses client-side heuristics first, Gemini as fallback.
 * Returns detected language + suggested target language.
 * 
 * Body: { text }
 * Returns: { detectedLanguage, detectedScript, suggestedTarget, confidence }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
});

// ── Client-side-equivalent heuristics (fast, no API needed) ──────────────────

function detectByScript(text: string): {
  detectedLanguage: string;
  detectedScript: string;
  suggestedTarget: string;
  confidence: number;
} | null {
  const clean = text.trim();

  // Hangul
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(clean)) {
    return { detectedLanguage: "Korean", detectedScript: "Hangul", suggestedTarget: "Korean", confidence: 0.99 };
  }

  // Japanese (Hiragana or Katakana — strong signal)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(clean)) {
    return { detectedLanguage: "Japanese", detectedScript: "Kana", suggestedTarget: "Japanese", confidence: 0.99 };
  }

  // CJK Unified Ideographs — could be Chinese or Japanese Kanji
  // Presence of hiragana/katakana already caught above. Pure CJK → Chinese
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(clean) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(clean)) {
    return { detectedLanguage: "Chinese", detectedScript: "Hanzi", suggestedTarget: "Chinese", confidence: 0.92 };
  }

  // Vietnamese diacritics — highly specific Unicode characters
  if (/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(clean)) {
    return { detectedLanguage: "Vietnamese", detectedScript: "Latin", suggestedTarget: "Vietnamese", confidence: 0.97 };
  }

  return null; // Needs AI detection
}

export async function POST(req: NextRequest) {
  let body: { text: string };
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fast path — script heuristics (no API call needed)
  const heuristic = detectByScript(body.text);
  if (heuristic && heuristic.confidence >= 0.95) {
    return NextResponse.json(heuristic);
  }

  // Slow path — Gemini for ambiguous cases (plain Latin, short strings, names)
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const response = await genai.models.generateContent({
        model: "models/gemini-3-flash-preview",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              detectedLanguage: { type: "string" },
              detectedScript: { type: "string" },
              suggestedTarget: {
                type: "string",
                enum: ["Vietnamese", "Japanese", "Chinese", "Korean"],
              },
              confidence: { type: "number" },
              reasoning: { type: "string" },
            },
            required: ["detectedLanguage", "detectedScript", "suggestedTarget", "confidence"],
          },
          temperature: 0.1,
        },
        contents: `Detect the language of this text and suggest which calligraphy target language would be most suitable for it as art:

Text: "${body.text}"

Rules:
- If the text IS already in Vietnamese/Japanese/Chinese/Korean → suggestedTarget = that same language
- If the text is English or another Latin-script language → suggest the most culturally/spiritually appropriate calligraphy language based on the meaning/tone (e.g. motivational quotes → Japanese, family/nature themes → Vietnamese or Chinese)
- If ambiguous Latin text → default suggestedTarget to "Japanese"

Return: detectedLanguage (full name e.g. "English"), detectedScript, suggestedTarget (one of: Vietnamese, Japanese, Chinese, Korean), confidence (0-1)`,
      });

      const raw = response.text;
      if (raw) {
        const result = JSON.parse(raw);
        return NextResponse.json(result);
      }
    } catch (err) {
      console.warn("[detect-language] Gemini failed:", (err as Error).message?.slice(0, 60));
    }
  }

  // Fallback — return heuristic result or default
  if (heuristic) return NextResponse.json(heuristic);
  return NextResponse.json({
    detectedLanguage: "English",
    detectedScript: "Latin",
    suggestedTarget: "Japanese",
    confidence: 0.5,
  });
}
