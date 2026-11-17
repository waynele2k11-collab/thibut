import type { ScriptType } from "./types";

export class UnsupportedScriptError extends Error {
  public readonly status = 400 as const;
  public readonly inputSample: string;

  constructor(inputText: string, reason?: string) {
    const sample = inputText.trim().slice(0, 32);
    super(
      reason ??
        `Unsupported script detected for "${sample}" — silent typography fallback is prohibited (TB-CALLI-006)`
    );
    this.name = "UnsupportedScriptError";
    this.inputSample = sample;
  }
}

export interface ScriptCompatibilityResult {
  compatible: boolean;
  recommendedStylePackId: string;
  reason?: string;
  warning?: string;
}

const KANA_CHAR_RE = /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F]$/;
const HANGUL_CHAR_RE =
  /^[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]$/;
const HAN_CHAR_RE = /^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]$/;
const VIETNAMESE_DIACRITIC_CHAR_RE =
  /^[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]$/;
const ASCII_LATIN_LETTER_RE = /^[A-Za-z]$/;
const DIGIT_RE = /^[0-9]$/;
const NEUTRAL_PUNCT_OR_SPACE_RE =
  /^[\s\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E\u2010-\u2027\u3000-\u303F\uFF01-\uFF0F\uFF1A-\uFF20]$/;

type StyleTraditionBucket =
  | "VIETNAMESE_THU_PHAP"
  | "JAPANESE_SHODO"
  | "CHINESE_CALLIGRAPHY"
  | "KOREAN_BRUSH"
  | "PAN_ASIAN";

function classifyTargetTradition(targetId: string): StyleTraditionBucket {
  const lower = targetId.trim().toLowerCase();

  if (
    lower === "vietnamese_thu_phap" ||
    lower.startsWith("thi bút") ||
    lower.startsWith("thi but") ||
    lower.includes("utm") ||
    lower.includes("thư pháp") ||
    lower.includes("thu phap") ||
    lower.includes("great vibes") ||
    lower.includes("long vũ") ||
    lower.includes("long vu") ||
    lower.includes("allura") ||
    lower.includes("lưu thủy") ||
    lower.includes("luu thuy") ||
    lower.includes("kaushan") ||
    lower.includes("phi bạch") ||
    lower.includes("phi bach") ||
    lower.includes("caveat") ||
    lower.includes("mực nho") ||
    lower.includes("muc nho") ||
    lower.includes("arizonia") ||
    lower.includes("phượng vũ") ||
    lower.includes("phuong vu") ||
    lower.includes("alex brush") ||
    lower.includes("khí phách") ||
    lower.includes("khi phach")
  ) {
    return "VIETNAMESE_THU_PHAP";
  }

  if (
    lower === "japanese_shodo" ||
    lower === "shodō" ||
    lower === "shodo" ||
    lower.startsWith("japanese") ||
    lower.includes("yuji") ||
    lower.includes("boku") ||
    lower.includes("syuku") ||
    lower.includes("mai") ||
    lower.includes("kokuryu")
  ) {
    return "JAPANESE_SHODO";
  }

  if (
    lower === "chinese_calligraphy" ||
    lower.startsWith("chinese") ||
    lower.includes("liu jian") ||
    lower.includes("long cang") ||
    lower.includes("ma shan") ||
    lower.includes("zhi mang")
  ) {
    return "CHINESE_CALLIGRAPHY";
  }

  if (
    lower === "korean_brush" ||
    lower.startsWith("korean") ||
    lower.includes("nanum") ||
    lower.includes("dokdo") ||
    lower.includes("east sea")
  ) {
    return "KOREAN_BRUSH";
  }

  return "PAN_ASIAN";
}

/**
 * Classifies authoritative text into linguistic script families using strict
 * Unicode block analysis without silent fallback (TB-CALLI-006, T-402).
 */
export class ScriptDetector {
  public static detect(text: string): ScriptType {
    if (!text || text.trim().length === 0) {
      return "UNKNOWN";
    }

    const normalized = text.normalize("NFC").trim();
    if (!normalized) {
      return "UNKNOWN";
    }

    let hasKana = false;
    let hasHangul = false;
    let hasHan = false;
    let hasVietDiacritic = false;
    let hasAsciiLatin = false;
    let hasDigits = false;

    for (const ch of Array.from(normalized)) {
      if (NEUTRAL_PUNCT_OR_SPACE_RE.test(ch)) {
        continue;
      }
      if (DIGIT_RE.test(ch)) {
        hasDigits = true;
        continue;
      }
      if (KANA_CHAR_RE.test(ch)) {
        hasKana = true;
        continue;
      }
      if (HANGUL_CHAR_RE.test(ch)) {
        hasHangul = true;
        continue;
      }
      if (HAN_CHAR_RE.test(ch)) {
        hasHan = true;
        continue;
      }
      if (VIETNAMESE_DIACRITIC_CHAR_RE.test(ch)) {
        hasVietDiacritic = true;
        continue;
      }
      if (ASCII_LATIN_LETTER_RE.test(ch)) {
        hasAsciiLatin = true;
        continue;
      }

      // Any character outside the supported script blocks (Arabic, Thai, Cyrillic, emoji, etc.)
      return "UNKNOWN";
    }

    const hasCjkOrKanaOrHangul = hasKana || hasHangul || hasHan;

    // Mixed East Asian + Latin diacritics or mixed Hangul + Kana is unsupported in a single brush pass
    if (hasCjkOrKanaOrHangul && (hasVietDiacritic || (hasHangul && hasAsciiLatin))) {
      return "UNKNOWN";
    }
    if (hasHangul && hasKana) {
      return "UNKNOWN";
    }

    if (hasHangul) {
      return "KOREAN_HANGUL";
    }

    if (hasKana) {
      return "JAPANESE_MIXED";
    }

    if (hasHan) {
      if (hasAsciiLatin) {
        return "UNKNOWN";
      }
      return "HAN";
    }

    if (hasVietDiacritic) {
      return "VIETNAMESE_LATIN";
    }

    if (hasAsciiLatin || hasDigits) {
      return "LATIN";
    }

    return "UNKNOWN";
  }

  /**
   * Checks whether `script` is natively compatible with `stylePackId` (and optional `fontFamily`).
   * Returns `{ compatible: false, reason }` when script is `UNKNOWN` or incompatible with the target tradition/font.
   */
  public static isScriptCompatible(
    script: ScriptType,
    stylePackId: string,
    fontFamily?: string
  ): ScriptCompatibilityResult {
    if (script === "UNKNOWN") {
      const reason =
        "Script is UNKNOWN or unsupported for calligraphy rendering (TB-CALLI-006).";
      return {
        compatible: false,
        recommendedStylePackId: stylePackId,
        reason,
        warning: reason,
      };
    }

    const targets = fontFamily ? [stylePackId, fontFamily] : [stylePackId];

    for (const target of targets) {
      const bucket = classifyTargetTradition(target);
      if (bucket === "PAN_ASIAN") {
        continue;
      }

      if (bucket === "VIETNAMESE_THU_PHAP") {
        if (script !== "VIETNAMESE_LATIN" && script !== "LATIN") {
          const reason = `Script "${script}" is incompatible with Vietnamese/Latin Thư Pháp target "${target}".`;
          return {
            compatible: false,
            recommendedStylePackId:
              script === "KOREAN_HANGUL" ? "Korean 1" : "Shodō",
            reason,
            warning: reason,
          };
        }
      } else if (bucket === "JAPANESE_SHODO") {
        if (script !== "HAN" && script !== "JAPANESE_MIXED") {
          const reason = `Script "${script}" is incompatible with Japanese Shodō target "${target}".`;
          return {
            compatible: false,
            recommendedStylePackId:
              script === "KOREAN_HANGUL" ? "Korean 1" : "Thi Bút Brush",
            reason,
            warning: reason,
          };
        }
      } else if (bucket === "CHINESE_CALLIGRAPHY") {
        if (script !== "HAN") {
          const reason = `Script "${script}" is incompatible with Chinese Shūfǎ target "${target}".`;
          return {
            compatible: false,
            recommendedStylePackId:
              script === "JAPANESE_MIXED"
                ? "Shodō"
                : script === "KOREAN_HANGUL"
                  ? "Korean 1"
                  : "Thi Bút Brush",
            reason,
            warning: reason,
          };
        }
      } else if (bucket === "KOREAN_BRUSH") {
        if (script !== "KOREAN_HANGUL") {
          const reason = `Script "${script}" is incompatible with Korean Seoye target "${target}".`;
          return {
            compatible: false,
            recommendedStylePackId:
              script === "VIETNAMESE_LATIN" || script === "LATIN"
                ? "Thi Bút Brush"
                : "Shodō",
            reason,
            warning: reason,
          };
        }
      }
    }

    return {
      compatible: true,
      recommendedStylePackId: stylePackId,
    };
  }
}
