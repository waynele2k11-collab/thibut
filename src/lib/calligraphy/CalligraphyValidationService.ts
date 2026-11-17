import {
  FontLicenseError,
  FontNotFoundError,
  FontRegistryService,
} from "@/lib/fonts/FontRegistryService";
import type { ScriptType, ValidationStatus } from "./types";
import { ScriptDetector, UnsupportedScriptError } from "./ScriptDetector";

export interface ValidationResult {
  status: ValidationStatus;
  reasons: string[];
  charFidelityScore: number;
  diacriticFidelityScore: number;
  structureScore: number;
}

export interface ValidateCalligraphyParams {
  authoritativeText: string;
  detectedScript?: ScriptType;
  stylePackId: string;
  fontFamily?: string;
  renderedSvg?: string;
  renderedImageUrl?: string;
}

const VIETNAMESE_DIACRITIC_EXTRACT_RE =
  /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/g;

const HANGUL_SYLLABLE_EXTRACT_RE = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g;

const HAN_OR_KANA_EXTRACT_RE =
  /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;

const VECTOR_PATH_OUTLINE_RE = /<path\b[^>]*\bd="[^"]*[MLCQZmlcqz][^"]*"/;

function inferDefaultFontForValidation(
  stylePackId: string,
  script: ScriptType
): string {
  const lower = stylePackId.trim().toLowerCase();

  if (lower.includes("arizonia") || lower.includes("phượng vũ") || lower.includes("phuong vu")) {
    return "Arizonia-Regular.ttf";
  }
  if (lower.includes("great") || lower.includes("vibes") || lower.includes("long vũ") || lower.includes("long vu")) {
    return "GreatVibes-Regular.ttf";
  }
  if (lower.includes("allura") || lower.includes("lưu thủy") || lower.includes("luu thuy")) {
    return "Allura-Regular.ttf";
  }
  if (lower.includes("kaushan") || lower.includes("phi bạch") || lower.includes("phi bach")) {
    return "KaushanScript-Regular.ttf";
  }
  if (lower.includes("caveat") || lower.includes("mực nho") || lower.includes("muc nho")) {
    return "CaveatBrush-Regular.ttf";
  }
  if (lower.includes("alex") || lower.includes("khí phách") || lower.includes("khi phach")) {
    return "AlexBrush-Regular.ttf";
  }
  if (lower === "japanese 2" || lower.includes("syuku")) {
    return "YujiSyuku-Regular.ttf";
  }
  if (lower === "japanese 3" || lower.includes("mai")) {
    return "YujiMai-Regular.ttf";
  }
  if (lower === "japanese 1" || lower === "shodō" || lower === "shodo" || lower.includes("boku")) {
    return "YujiBoku-Regular.ttf";
  }
  if (lower === "chinese 1" || lower.includes("liu jian")) {
    return "LiuJianMaoCao-Regular.ttf";
  }
  if (lower === "chinese 2" || lower.includes("long cang")) {
    return "LongCang-Regular.ttf";
  }
  if (lower === "chinese 3" || lower.includes("ma shan")) {
    return "MaShanZheng-Regular.ttf";
  }
  if (lower === "chinese 4" || lower.includes("zhi mang")) {
    return "ZhiMangXing-Regular.ttf";
  }
  if (lower === "korean 2" || lower.includes("dokdo") || lower.includes("east sea")) {
    return "EastSeaDokdo-Regular.ttf";
  }
  if (lower === "korean 1" || lower.includes("nanum")) {
    return "NanumBrushScript-Regular.ttf";
  }

  switch (script) {
    case "VIETNAMESE_LATIN":
    case "LATIN":
      return "UtmThuphapThienAn.ttf";
    case "JAPANESE_MIXED":
      return "YujiBoku-Regular.ttf";
    case "KOREAN_HANGUL":
      return "NanumBrushScript-Regular.ttf";
    case "HAN":
      return "YujiBoku-Regular.ttf";
    default:
      throw new UnsupportedScriptError(stylePackId);
  }
}

export class CalligraphyValidationService {
  /**
   * Validates a generated calligraphy candidate against authoritative DB text
   * using real OpenType glyph coverage (`charToGlyphIndex(ch) > 0` via `@shuding/opentype.js`).
   *
   * - Throws `UnsupportedScriptError` for `UNKNOWN` scripts (TB-CALLI-006).
   * - Rejects missing glyphs for Han, Japanese Kana/Kanji, Vietnamese diacritics, and Korean Hangul (`\uAC00-\uD7A3`).
   * - Marks raster-only / unverified candidates as `REVIEW` so they NEVER auto-pass to customers (TB-CALLI-003).
   */
  public static async validate(
    params: ValidateCalligraphyParams
  ): Promise<ValidationResult> {
    const reasons: string[] = [];
    let status: ValidationStatus = "PASS";
    let charFidelityScore = 1.0;
    let diacriticFidelityScore = 1.0;
    let structureScore = 1.0;

    const {
      authoritativeText,
      detectedScript,
      stylePackId,
      fontFamily,
      renderedSvg,
      renderedImageUrl,
    } = params;

    if (!authoritativeText || authoritativeText.trim().length === 0) {
      return {
        status: "FAIL",
        reasons: ["Authoritative text is empty."],
        charFidelityScore: 0,
        diacriticFidelityScore: 0,
        structureScore: 0,
      };
    }

    const normalizedText = authoritativeText.normalize("NFC").trim();
    const actualScript = ScriptDetector.detect(normalizedText);
    const effectiveScript =
      detectedScript === "UNKNOWN" ? "UNKNOWN" : actualScript;

    // TB-CALLI-006: Unsupported scripts MUST NOT silently fall back
    if (effectiveScript === "UNKNOWN") {
      throw new UnsupportedScriptError(normalizedText);
    }

    if (!renderedSvg && !renderedImageUrl) {
      return {
        status: "FAIL",
        reasons: ["No rendered asset (SVG or Image URL) provided."],
        charFidelityScore: 0,
        diacriticFidelityScore: 0,
        structureScore: 0,
      };
    }

    // 1. Script & StylePack / Font Compatibility Gate
    const compatibility = ScriptDetector.isScriptCompatible(
      effectiveScript,
      stylePackId,
      fontFamily
    );
    if (!compatibility.compatible) {
      status = "FAIL";
      charFidelityScore = 0.0;
      structureScore = 0.0;
      reasons.push(
        compatibility.reason ??
          `Script "${effectiveScript}" is incompatible with style "${stylePackId}".`
      );
    }

    // 2. Raster-only / Non-Vector Candidates Gate (TB-CALLI-003)
    if (!renderedSvg) {
      if (status !== "FAIL") {
        status = "REVIEW";
      }
      structureScore = Math.min(structureScore, 0.5);
      reasons.push(
        "Candidate lacks verifiable vector glyph geometry (raster-only asset); gated for human review (TB-CALLI-003)."
      );
      return {
        status,
        reasons,
        charFidelityScore,
        diacriticFidelityScore,
        structureScore,
      };
    }

    // 3. Structural SVG & Zero Embedded Font / Network Import Check (T-405, TB-CALLI-006)
    if (!renderedSvg.includes("<svg") || !renderedSvg.includes("</svg>")) {
      status = "FAIL";
      structureScore = 0.0;
      reasons.push("Malformed SVG vector geometry.");
    }
    if (/@import\s+url\(/i.test(renderedSvg) || /fonts\.googleapis\.com/i.test(renderedSvg)) {
      status = "FAIL";
      structureScore = 0.0;
      reasons.push(
        "External network @import font fallback is prohibited in calligraphy SVGs (TB-CALLI-006)."
      );
    }
    if (/@font-face\s*\{/i.test(renderedSvg)) {
      status = "FAIL";
      structureScore = 0.0;
      reasons.push(
        "Embedded base64 @font-face font binaries are prohibited in candidate SVGs (T-405)."
      );
    }
    if (!VECTOR_PATH_OUTLINE_RE.test(renderedSvg)) {
      status = "FAIL";
      structureScore = 0.0;
      reasons.push(
        "SVG lacks deterministic <path d=\"...\"> glyph outlines (TB-CALLI-003)."
      );
    }

    // 4. Real OpenType Font Glyph Coverage Validation (T-402, TB-CALLI-003)
    const targetFont =
      fontFamily ?? inferDefaultFontForValidation(stylePackId, effectiveScript);

    try {
      const hasAllGlyphs = await FontRegistryService.hasGlyphCoverage(
        targetFont,
        normalizedText
      );
      const parsedFont = await FontRegistryService.parseOpenTypeFont(targetFont);

      if (effectiveScript === "VIETNAMESE_LATIN") {
        const requiredDiacritics = this.extractUniqueMatches(
          normalizedText,
          VIETNAMESE_DIACRITIC_EXTRACT_RE
        );
        const missingDiacritics = requiredDiacritics.filter((ch) => {
          const idx = parsedFont.charToGlyphIndex(ch);
          if (idx <= 0) return true;
          return parsedFont.getPath(ch, 0, 0, 100).toPathData(2).trim().length === 0;
        });

        if (missingDiacritics.length > 0) {
          status = "FAIL";
          diacriticFidelityScore = 0.0;
          charFidelityScore = 0.0;
          reasons.push(
            `Vietnamese diacritic glyph failure in "${targetFont}": missing [${missingDiacritics.join(", ")}].`
          );
        }
      }

      if (effectiveScript === "KOREAN_HANGUL") {
        const requiredHangul = this.extractUniqueMatches(
          normalizedText,
          HANGUL_SYLLABLE_EXTRACT_RE
        );
        const missingHangul = requiredHangul.filter((ch) => {
          const idx = parsedFont.charToGlyphIndex(ch);
          if (idx <= 0) return true;
          return parsedFont.getPath(ch, 0, 0, 100).toPathData(2).trim().length === 0;
        });

        if (missingHangul.length > 0) {
          status = "FAIL";
          charFidelityScore = 0.0;
          reasons.push(
            `Korean Hangul syllable glyph failure in "${targetFont}": missing [${missingHangul.join(", ")}].`
          );
        }
      }

      if (effectiveScript === "HAN" || effectiveScript === "JAPANESE_MIXED") {
        const requiredCjk = this.extractUniqueMatches(
          normalizedText,
          HAN_OR_KANA_EXTRACT_RE
        );
        const missingCjk = requiredCjk.filter((ch) => {
          const idx = parsedFont.charToGlyphIndex(ch);
          if (idx <= 0) return true;
          return parsedFont.getPath(ch, 0, 0, 100).toPathData(2).trim().length === 0;
        });

        if (missingCjk.length > 0) {
          status = "FAIL";
          charFidelityScore = 0.0;
          reasons.push(
            `CJK / Kana glyph failure in "${targetFont}": missing [${missingCjk.join(", ")}].`
          );
        }
      }

      if (!hasAllGlyphs) {
        status = "FAIL";
        charFidelityScore = 0.0;
        reasons.push(
          `Font "${targetFont}" lacks full OpenType glyph coverage for authoritative text.`
        );
      }
    } catch (err: unknown) {
      if (err instanceof FontNotFoundError || err instanceof FontLicenseError) {
        status = "FAIL";
        charFidelityScore = 0.0;
        structureScore = 0.0;
        reasons.push(err.message);
      } else {
        throw err;
      }
    }

    if (reasons.length === 0) {
      reasons.push(
        "All OpenType glyph coverage, vector outline, and diacritic integrity checks passed."
      );
    }

    return {
      status,
      reasons,
      charFidelityScore,
      diacriticFidelityScore,
      structureScore,
    };
  }

  private static extractUniqueMatches(text: string, regex: RegExp): string[] {
    const matches = text.match(regex);
    return matches ? Array.from(new Set(matches)) : [];
  }
}
