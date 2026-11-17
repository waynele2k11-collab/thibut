export type ScriptCategory =
  | "VIETNAMESE_THU_PHAP"
  | "JAPANESE_SHODO"
  | "CHINESE_CALLIGRAPHY"
  | "KOREAN_BRUSH";

export interface FontCatalogItem {
  id: string;
  name: string;
  familyName: string;
  aliases?: string[];
  category: ScriptCategory;
  categoryLabel: string;
  fileName: string;
  format: "ttf" | "otf" | "woff2" | "webfont";
  supportedScripts: string[];
  previewText: string;
  sourceUrl: string;
  sourceLabel: string;
  downloadUrl: string;
  license: string;
  licenseUrl?: string;
  commercialApproved: boolean;
  printExportAllowed: boolean;
  webEmbedAllowed: boolean;
  licenseVerifiedAt?: string | null;
  licenseVerifiedBy?: string | null;
  description: string;
  isWebFont?: boolean;
  cssFontFamily?: string;
  defaultEnabled: boolean;
}

export interface FontEntry extends FontCatalogItem {
  isDownloaded: boolean;
  isActiveOnFrontend: boolean;
  base64Data?: string;
}

export interface FontLicenseSubject {
  id?: string;
  name?: string;
  fileName?: string;
  commercialApproved: boolean;
  printExportAllowed: boolean;
  webEmbedAllowed?: boolean;
  licenseVerifiedAt?: string | Date | null;
}

export const DEFAULT_CALLIGRAPHY_FONT_ID = "utm-thuphap-thien-an" as const;
export const DEFAULT_CALLIGRAPHY_FONT_FAMILY = "UTM Thư Pháp Thiên Ân" as const;

/**
 * Authoritative default seal font (T-407).
 * Replaces legacy VNI-encoded "VNI Ong do" (which lacks U+5370 '印' glyph and commercial license verification)
 * with SIL OFL 1.1 verified "Ma Shan Zheng" (MaShanZheng-Regular.ttf).
 */
export const DEFAULT_SEAL_FONT_ID = "ma-shan-zheng" as const;
export const DEFAULT_SEAL_FONT_FAMILY = "Ma Shan Zheng" as const;

export const CATEGORY_LABELS: Record<ScriptCategory, string> = {
  VIETNAMESE_THU_PHAP: "Vietnamese Thư Pháp",
  JAPANESE_SHODO: "Japanese Shodō",
  CHINESE_CALLIGRAPHY: "Chinese Shūfǎ",
  KOREAN_BRUSH: "Korean Seoye",
};

/**
 * TB-CALLI-008 & T-407 Licensing Gate:
 * A font may ONLY be activated or used for commercial / print master rendering when:
 * - commercialApproved === true
 * - printExportAllowed === true
 * - Boolean(licenseVerifiedAt) === true
 */
export function isFontLicensedForPrint(font: FontLicenseSubject): boolean {
  return (
    font.commercialApproved === true &&
    font.printExportAllowed === true &&
    Boolean(font.licenseVerifiedAt)
  );
}

/**
 * R-107 Web-Embedding Gate:
 * Self-hosted font binary streaming (`/api/fonts/[id]`) is permitted ONLY when
 * commercial + print-export + web-embedding rights are all verified.
 */
export function isFontWebEmbeddable(font: FontLicenseSubject): boolean {
  return isFontLicensedForPrint(font) && font.webEmbedAllowed === true;
}

/**
 * Detects legacy unverified local archive font filenames (VNI-*, HL-*, HY-*, Fz-*, etc.)
 * which must remain commercialApproved=false, printExportAllowed=false until audited.
 */
export function isUnverifiedLegacyArchiveFile(fileName: string): boolean {
  const clean = fileName.trim();
  if (!clean) return false;
  return /^(VNI[-_]|VN[A-Za-z]|Vbut|Vong|HL[-_]|hl[a-z]|htf|HY[-_]|Fz[-_A-Za-z]|TMC[-_]|ThuPhap_|ThuphapXuan)/i.test(
    clean
  );
}

export const INITIAL_FONT_CATALOG: readonly FontCatalogItem[] = [
  // Vietnamese Thư Pháp
  {
    id: "utm-thuphap-thien-an",
    name: "UTM Thư Pháp Thiên Ân",
    familyName: "UTM ThuPhap Thien An",
    aliases: [
      "UTM Thư Pháp Thiên Ân",
      "UTM ThuPhap Thien An",
      "UtmThuphapThienAn",
      "UTM-ThuPhap-Thien_An.ttf",
      "UtmThuphapThienAn.ttf",
    ],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "UtmThuphapThienAn.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Thi Bút",
    sourceUrl: "https://www.fontspace.com/utm-thuphap-thien-an-font-f32777",
    sourceLabel: "FontSpace / Michael Dinh Kien",
    downloadUrl: "https://www.fontspace.com/get/family/nzldj",
    license: "Free for Personal & Commercial use",
    licenseUrl: "https://www.fontspace.com/utm-thuphap-thien-an-font-f32777",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "The gold-standard Vietnamese brush calligraphy typeface with sweeping dragon ascenders.",
    defaultEnabled: true,
  },
  {
    id: "great-vibes",
    name: "Long Vũ (Great Vibes)",
    familyName: "Great Vibes",
    aliases: ["Great Vibes", "Long Vũ", "Long Vu"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "GreatVibes-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Trọng Nghĩa",
    sourceUrl: "https://fonts.google.com/specimen/Great+Vibes",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description: "Grand dragon sweeping loop capitals with flowing flourishes.",
    defaultEnabled: true,
  },
  {
    id: "allura",
    name: "Lưu Thủy (Allura)",
    familyName: "Allura",
    aliases: ["Allura", "Lưu Thủy", "Luu Thuy"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "Allura-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Thi Bút",
    sourceUrl: "https://fonts.google.com/specimen/Allura",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/allura/Allura-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description: "Clean, lyrical calligraphic script with full Vietnamese diacritics.",
    defaultEnabled: true,
  },
  {
    id: "kaushan-script",
    name: "Phi Bạch (Kaushan Script)",
    familyName: "Kaushan Script",
    aliases: ["Kaushan Script", "Phi Bạch", "Phi Bach"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "KaushanScript-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Chí Hướng",
    sourceUrl: "https://fonts.google.com/specimen/Kaushan+Script",
    sourceLabel: "Google Fonts / Impallari Type",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/kaushanscript/KaushanScript-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Raw, uninhibited horsehair brush strokes with visible dry bristle texture.",
    defaultEnabled: true,
  },
  {
    id: "caveat-brush",
    name: "Mực Nho (Caveat Brush)",
    familyName: "Caveat Brush",
    aliases: ["Caveat Brush", "Mực Nho", "Muc Nho"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "CaveatBrush-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Tâm Đức",
    sourceUrl: "https://fonts.google.com/specimen/Caveat+Brush",
    sourceLabel: "Google Fonts / Impallari Type",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/caveatbrush/CaveatBrush-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Heavy sumi ink mass with strong pressure and authoritative brush impact.",
    defaultEnabled: true,
  },
  {
    id: "arizonia",
    name: "Phượng Vũ (Arizonia)",
    familyName: "Arizonia",
    aliases: ["Arizonia", "Phượng Vũ", "Phuong Vu"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "Arizonia-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Bình An",
    sourceUrl: "https://fonts.google.com/specimen/Arizonia",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/arizonia/Arizonia-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Delicate dancing phoenix curves inspired by Asian camel-hair brush elegance.",
    defaultEnabled: true,
  },
  {
    id: "alex-brush",
    name: "Khí Phách (Alex Brush)",
    familyName: "Alex Brush",
    aliases: ["Alex Brush", "Khí Phách", "Khi Phach"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "AlexBrush-Regular.ttf",
    format: "ttf",
    supportedScripts: ["LATIN", "VIETNAMESE"],
    previewText: "Phúc Lộc",
    sourceUrl: "https://fonts.google.com/specimen/Alex+Brush",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/alexbrush/AlexBrush-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description: "Classic poetic Vietnamese Thư Pháp script with clean rhythm.",
    defaultEnabled: true,
  },
  {
    id: "vni-ong-do",
    name: "VNI Ông Đồ (Legacy VNI Archive)",
    familyName: "VNI Ong do",
    aliases: ["VNI Ong do", "VNI-Ong_do", "vniongdo"],
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "VNI-Ong_do.ttf",
    format: "ttf",
    supportedScripts: ["LEGACY_VNI"],
    previewText: "Thi But",
    sourceUrl: "Local Archive",
    sourceLabel: "Local Archive (Unverified)",
    downloadUrl: "",
    license: "Local Archive (Unverified - Blocked for Commercial Print)",
    commercialApproved: false,
    printExportAllowed: false,
    webEmbedAllowed: false,
    licenseVerifiedAt: null,
    licenseVerifiedBy: null,
    description:
      "Legacy VNI-encoded font without Unicode or CJK seal glyph coverage; blocked from commercial print until license verification.",
    defaultEnabled: false,
  },

  // Japanese Shodō
  {
    id: "kokuryu",
    name: "KokuryuSou (黒龍草)",
    familyName: "Kokuryu",
    aliases: ["kokuryu", "KokuryuSou"],
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "",
    format: "webfont",
    supportedScripts: ["HAN", "HIRAGANA", "KATAKANA"],
    previewText: "黒龍",
    sourceUrl: "https://fonts.adobe.com/fonts/kokuryu",
    sourceLabel: "Adobe Fonts / Showashotai",
    downloadUrl: "",
    license: "Adobe Fonts Commercial Web License (Web Preview Only - Print Export Prohibited)",
    licenseUrl: "https://fonts.adobe.com/fonts/kokuryu#licensing-section",
    commercialApproved: true,
    printExportAllowed: false,
    webEmbedAllowed: false,
    licenseVerifiedAt: "2026-08-18",
    licenseVerifiedBy: "system-seed",
    description:
      "Japanese calligraphy web font by Showa Shotai via Typekit. Web-only license; server print master export is prohibited.",
    isWebFont: true,
    cssFontFamily: "kokuryu, sans-serif",
    defaultEnabled: false,
  },
  {
    id: "yuji-boku",
    name: "Yuji Boku (勇司 朴)",
    familyName: "Yuji Boku",
    aliases: ["Yuji Boku"],
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiBoku-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "HIRAGANA", "KATAKANA", "LATIN"],
    previewText: "諦めない",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Boku",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yujiboku/YujiBoku-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Heavy ink-dipped dry brush Shodō with classical sumi weight and broken flying white.",
    defaultEnabled: true,
  },
  {
    id: "yuji-syuku",
    name: "Yuji Syuku (勇司 宿)",
    familyName: "Yuji Syuku",
    aliases: ["Yuji Syuku"],
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiSyuku-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "HIRAGANA", "KATAKANA", "LATIN"],
    previewText: "武士道",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Syuku",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yujisyuku/YujiSyuku-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Classical restrained Kanji brushwork with sharp brush tip transitions.",
    defaultEnabled: true,
  },
  {
    id: "yuji-mai",
    name: "Yuji Mai (勇司 舞)",
    familyName: "Yuji Mai",
    aliases: ["Yuji Mai"],
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiMai-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "HIRAGANA", "KATAKANA", "LATIN"],
    previewText: "風林火山",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Mai",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/yujimai/YujiMai-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Flowing Kana and Kanji brush movement with dancing brush cadence.",
    defaultEnabled: true,
  },

  // Chinese Shūfǎ
  {
    id: "liu-jian-mao-cao",
    name: "Liu Jian Mao Cao (刘建毛草)",
    familyName: "Liu Jian Mao Cao",
    aliases: ["Liu Jian Mao Cao"],
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "LiuJianMaoCao-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "LATIN"],
    previewText: "海納百川",
    sourceUrl: "https://fonts.google.com/specimen/Liu+Jian+Mao+Cao",
    sourceLabel: "Google Fonts / Liu Jian",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Expressive cursive grass script (草書) with wild brush energy and dramatic ink pooling.",
    defaultEnabled: true,
  },
  {
    id: "long-cang",
    name: "Long Cang (龙苍)",
    familyName: "Long Cang",
    aliases: ["Long Cang"],
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "LongCang-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "LATIN"],
    previewText: "天道酬勤",
    sourceUrl: "https://fonts.google.com/specimen/Long+Cang",
    sourceLabel: "Google Fonts / Qiu Yin",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Master semi-cursive grass script calligraphy with powerful stroke rhythm.",
    defaultEnabled: true,
  },
  {
    id: "ma-shan-zheng",
    name: "Ma Shan Zheng (马善政)",
    familyName: "Ma Shan Zheng",
    aliases: ["Ma Shan Zheng", "MaShanZheng"],
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "MaShanZheng-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "LATIN"],
    previewText: "上善若水",
    sourceUrl: "https://fonts.google.com/specimen/Ma+Shan+Zheng",
    sourceLabel: "Google Fonts / Ma Shan Zheng",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Standard regular brush calligraphy (楷書) with authoritative balance and verified CJK seal glyph coverage (印).",
    defaultEnabled: true,
  },
  {
    id: "zhi-mang-xing",
    name: "Zhi Mang Xing (志芒星)",
    familyName: "Zhi Mang Xing",
    aliases: ["Zhi Mang Xing"],
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "ZhiMangXing-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HAN", "LATIN"],
    previewText: "大衛",
    sourceUrl: "https://fonts.google.com/specimen/Zhi+Mang+Xing",
    sourceLabel: "Google Fonts / Wei Zhimang",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Running script calligraphy (行書) with swift, connected strokes.",
    defaultEnabled: true,
  },

  // Korean Seoye
  {
    id: "nanum-brush-script",
    name: "Nanum Brush Script (나눔손글씨 붓)",
    familyName: "Nanum Brush Script",
    aliases: ["Nanum Brush Script"],
    category: "KOREAN_BRUSH",
    categoryLabel: "Korean Seoye",
    fileName: "NanumBrushScript-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HANGUL", "LATIN"],
    previewText: "영원한 사랑",
    sourceUrl: "https://fonts.google.com/specimen/Nanum+Brush+Script",
    sourceLabel: "Google Fonts / Naver Corp",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description:
      "Authentic Korean calligraphy brush script with lively Hangul stroke dynamics.",
    defaultEnabled: true,
  },
  {
    id: "east-sea-dokdo",
    name: "East Sea Dokdo (독도체)",
    familyName: "East Sea Dokdo",
    aliases: ["East Sea Dokdo"],
    category: "KOREAN_BRUSH",
    categoryLabel: "Korean Seoye",
    fileName: "EastSeaDokdo-Regular.ttf",
    format: "ttf",
    supportedScripts: ["HANGUL", "LATIN"],
    previewText: "희망과 꿈",
    sourceUrl: "https://fonts.google.com/specimen/East+Sea+Dokdo",
    sourceLabel: "Google Fonts / Yoon Design",
    downloadUrl:
      "https://raw.githubusercontent.com/google/fonts/main/ofl/eastseadokdo/EastSeaDokdo-Regular.ttf",
    license: "OFL-1.1 (SIL Open Font License)",
    licenseUrl: "https://openfontlicense.org",
    commercialApproved: true,
    printExportAllowed: true,
    webEmbedAllowed: true,
    licenseVerifiedAt: "2026-08-17",
    licenseVerifiedBy: "system-seed",
    description: "Heavy ancient stone-rubbing style Hangul brush script.",
    defaultEnabled: true,
  },
];
