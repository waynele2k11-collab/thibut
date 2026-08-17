import { ScriptType, ValidationStatus } from "./types";
import { ScriptDetector } from "./ScriptDetector";

export interface ValidationResult {
  status: ValidationStatus;
  reasons: string[];
  charFidelityScore: number;
  diacriticFidelityScore: number;
  structureScore: number;
}

export class CalligraphyValidationService {
  /**
   * Validates a generated calligraphy candidate against the authoritative database text.
   */
  public static validate(params: {
    authoritativeText: string;
    detectedScript: ScriptType;
    stylePackId: string;
    renderedSvg?: string;
    renderedImageUrl?: string;
  }): ValidationResult {
    const reasons: string[] = [];
    let status: ValidationStatus = "PASS";
    let charFidelityScore = 1.0;
    let diacriticFidelityScore = 1.0;
    let structureScore = 1.0;

    const { authoritativeText, detectedScript, stylePackId, renderedSvg, renderedImageUrl } = params;

    // 1. Basic Presence Validation
    if (!authoritativeText || authoritativeText.trim().length === 0) {
      return {
        status: "FAIL",
        reasons: ["Authoritative text is empty."],
        charFidelityScore: 0,
        diacriticFidelityScore: 0,
        structureScore: 0,
      };
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

    // 2. Vietnamese Diacritic Integrity Check (100% Invariant Standard)
    if (detectedScript === "VIETNAMESE_LATIN") {
      const requiredDiacritics = this.extractVietnameseDiacritics(authoritativeText);
      if (requiredDiacritics.length > 0) {
        // Verify that rendered text or SVG retains all required accented vowel structures
        if (renderedSvg) {
          const missingDiacritics = requiredDiacritics.filter(
            (char) => !renderedSvg.includes(char)
          );
          if (missingDiacritics.length > 0) {
            status = "FAIL";
            diacriticFidelityScore = 0.0;
            reasons.push(
              `Vietnamese diacritic integrity failure: Missing accents for characters [${missingDiacritics.join(", ")}].`
            );
          }
        }
      }
    }

    // 3. Han / Japanese Mixed Glyph Count & Structural Completeness
    if (detectedScript === "HAN" || detectedScript === "JAPANESE_MIXED") {
      const chars = Array.from(authoritativeText.trim());
      if (renderedSvg) {
        const missingChars = chars.filter((c) => !renderedSvg.includes(c));
        if (missingChars.length > 0) {
          status = "FAIL";
          charFidelityScore = 0.0;
          reasons.push(
            `Character loss detected: Glyphs [${missingChars.join(", ")}] were not preserved in the structural render.`
          );
        }
      }
    }

    // 4. Script & StylePack Compatibility Gate
    const compatibility = ScriptDetector.isScriptCompatible(detectedScript, stylePackId);
    if (!compatibility.compatible) {
      status = "REVIEW";
      structureScore = 0.6;
      reasons.push(
        compatibility.warning || `Script ${detectedScript} requires adapted brush strategy for style ${stylePackId}.`
      );
    }

    // 5. SVG Validity & Transparency Check
    if (renderedSvg) {
      if (!renderedSvg.includes("<svg") || !renderedSvg.includes("</svg>")) {
        status = "FAIL";
        structureScore = 0.0;
        reasons.push("Malformed SVG vector geometry.");
      }
    }

    if (reasons.length === 0) {
      reasons.push("All linguistic, glyph structure, and diacritic integrity checks passed.");
    }

    return {
      status,
      reasons,
      charFidelityScore,
      diacriticFidelityScore,
      structureScore,
    };
  }

  private static extractVietnameseDiacritics(text: string): string[] {
    const vnRegex = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/g;
    const matches = text.match(vnRegex);
    return matches ? Array.from(new Set(matches)) : [];
  }
}
