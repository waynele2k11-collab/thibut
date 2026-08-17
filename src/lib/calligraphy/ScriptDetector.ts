import { ScriptType } from "./types";

/**
 * Accurately classifies text into linguistic script families
 * using Unicode code-point block analysis.
 */
export class ScriptDetector {
  public static detect(text: string): ScriptType {
    if (!text || text.trim().length === 0) {
      return "UNKNOWN";
    }

    const trimmed = text.trim();

    // 1. Japanese Kana check (Hiragana \u3040-\u309F or Katakana \u30A0-\u30FF)
    const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed);
    
    // 2. Korean Hangul check (\uAC00-\uD7AF or \u1100-\u11FF)
    const hasHangul = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(trimmed);
    if (hasHangul) {
      return "KOREAN_HANGUL";
    }

    // 3. Han ideographs (\u4E00-\u9FFF or \u3400-\u4DBF)
    const hasHan = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(trimmed);

    if (hasKana && hasHan) {
      return "JAPANESE_MIXED";
    }
    if (hasKana) {
      return "JAPANESE_MIXED";
    }
    if (hasHan) {
      return "HAN";
    }

    // 4. Vietnamese Latin Diacritic check
    // Vietnamese uses specific vowels with horn, hook, breve, and tone combinations:
    // à, á, ả, ã, ạ, ă, ắ, ằ, ẳ, ẵ, ặ, â, ấ, ầ, ẩ, ẫ, ậ, đ, è, é, ẻ, ẽ, ẹ, ê, ế, ề, ể, ễ, ệ,
    // ì, í, ỉ, ĩ, ị, ò, ó, ỏ, õ, ọ, ô, ố, ồ, ổ, ỗ, ộ, ơ, ớ, ờ, ở, ỡ, ợ,
    // ù, ú, ủ, ũ, ụ, ư, ứ, ừ, ử, ữ, ự, ỳ, ý, ỷ, ỹ, ỵ
    const vietnameseDiacritics = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/i;
    
    if (vietnameseDiacritics.test(trimmed)) {
      return "VIETNAMESE_LATIN";
    }

    // 5. English / Standard Latin
    const isLatin = /^[A-Za-z0-9\s.,!?'"()\-]+$/.test(trimmed);
    if (isLatin) {
      return "ENGLISH_LATIN";
    }

    return "UNKNOWN";
  }

  /**
   * Check if a style pack is compatible with the detected script.
   */
  public static isScriptCompatible(script: ScriptType, stylePackId: string): {
    compatible: boolean;
    recommendedStylePackId: string;
    warning?: string;
  } {
    const isEastAsianStyle = ["Shodō", "Ink", "Zen", "Seal"].includes(stylePackId);
    
    if (script === "VIETNAMESE_LATIN" || script === "ENGLISH_LATIN") {
      if (isEastAsianStyle) {
        return {
          compatible: true,
          recommendedStylePackId: "Thi Bút Brush",
          warning: `Style "${stylePackId}" is adapted for Latin script using authentic Thư Pháp brush kinetics.`,
        };
      }
    }

    return {
      compatible: true,
      recommendedStylePackId: stylePackId,
    };
  }
}
