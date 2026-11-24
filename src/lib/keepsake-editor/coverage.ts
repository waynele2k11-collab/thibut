// Keepsake editor: which characters a font can draw. Pure.

const TONE_MARKS = ["̀", "́", "̉", "̃", "̣"]; // grave, acute, hook above, tilde, dot below
const VOWEL_BASES = ["a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y"];

function buildVietnameseLetters(): string {
  const lower: string[] = [];
  for (const base of VOWEL_BASES) {
    if (base.normalize("NFD").length > 1) lower.push(base); // ă â ê ô ơ ư
    for (const mark of TONE_MARKS) lower.push((base + mark).normalize("NFC"));
  }
  lower.push("đ");
  const upper = lower.map((ch) => ch.toUpperCase());
  return [...lower, ...upper].join("");
}

/** All 134 Vietnamese letters that carry a diacritic, in both cases. */
export const VIETNAMESE_LETTERS: string = buildVietnameseLetters();

const BASIC_LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
/** Punctuation a verse needs. A font must have these to be offered. */
const REQUIRED_PUNCTUATION = ".,;:!?'\"()-";
/** Punctuation that is checked and reported, but not required of a font. */
const OPTIONAL_PUNCTUATION = "&/+*%#@=…–—‘’“”·•♥♡";

/** Characters a font must have to be offered in the editor. */
export const VIETNAMESE_REQUIRED_SET: string = BASIC_LATIN + DIGITS + REQUIRED_PUNCTUATION + VIETNAMESE_LETTERS;

/** Every character the editor knows how to check. A character outside this set counts as missing. */
export const VIETNAMESE_TEST_SET: string = VIETNAMESE_REQUIRED_SET + OPTIONAL_PUNCTUATION;

/** The characters of the test set that the font has. The server calls this with a parsed font. */
export function coveredChars(hasGlyph: (ch: string) => boolean): string {
  return Array.from(VIETNAMESE_TEST_SET)
    .filter((ch) => hasGlyph(ch))
    .join("");
}

/**
 * Characters of `text` that the font cannot draw: unique, in order of first appearance.
 * Whitespace is ignored. The text is compared in NFC, the form it is drawn in.
 */
export function missingChars(text: string, covered: string): string[] {
  const have = new Set(Array.from(covered));
  const missing: string[] = [];
  for (const ch of Array.from(text.normalize("NFC"))) {
    if (/\s/u.test(ch)) continue;
    if (!have.has(ch) && !missing.includes(ch)) missing.push(ch);
  }
  return missing;
}

export function coversVietnamese(covered: string): boolean {
  const have = new Set(Array.from(covered));
  return Array.from(VIETNAMESE_REQUIRED_SET).every((ch) => have.has(ch));
}

export function missingGlyphMessage(missing: string[]): string {
  return `This font has no glyph for: ${missing.join(", ")}`;
}
