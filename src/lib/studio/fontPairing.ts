import type {
  StrokePresetOption,
  VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  INITIAL_FONT_CATALOG,
  isFontLicensedForPrint,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";

export interface StudioFontOption {
  id: string;
  name: string;
  familyName: string;
  category: ScriptCategory;
  categoryLabel: string;
  supportedScripts: string[];
  previewText: string;
  description: string;
}

export interface GalleryRemixContext {
  galleryItemId: string;
  title: string;
  subtitle: string | null;
  sourceText: string;
  tradition: ScriptCategory;
  matchedProductId?: string;
  matchedVariantId?: string;
}

const ON_DISK_VERIFIED_FONT_IDS = new Set<string>([
  "utm-thuphap-thien-an",
  "great-vibes",
  "allura",
  "caveat-brush",
  "arizonia",
  "alex-brush",
  "yuji-boku",
  "yuji-mai",
  "liu-jian-mao-cao",
  "long-cang",
  "ma-shan-zheng",
  "zhi-mang-xing",
  "nanum-brush-script",
  "east-sea-dokdo",
]);

export const DEFAULT_STUDIO_FONT_OPTIONS: ReadonlyArray<StudioFontOption> =
  INITIAL_FONT_CATALOG.filter(
    (f) => isFontLicensedForPrint(f) && ON_DISK_VERIFIED_FONT_IDS.has(f.id)
  ).map((f) => ({
    id: f.id,
    name: f.name,
    familyName: f.familyName,
    category: f.category,
    categoryLabel: f.categoryLabel,
    supportedScripts: f.supportedScripts,
    previewText: f.previewText,
    description: f.description,
  }));

export const PRIMARY_FONT_FAMILY_BY_TRADITION: Readonly<
  Record<ScriptCategory, string>
> = {
  VIETNAMESE_THU_PHAP: DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  JAPANESE_SHODO: "Yuji Boku",
  CHINESE_CALLIGRAPHY: "Ma Shan Zheng",
  KOREAN_BRUSH: "Nanum Brush Script",
};

export const FONT_PREVIEW_CLASS_BY_ID: Readonly<Record<string, string>> = {
  "utm-thuphap-thien-an": "font-brush-utm-thien-an",
  "great-vibes": "font-brush-great-vibes",
  "allura": "font-brush-allura",
  "kaushan-script": "font-brush-kaushan-script",
  "caveat-brush": "font-brush-caveat-brush",
  "arizonia": "font-brush-arizonia",
  "alex-brush": "font-brush-alex-brush",
  "yuji-boku": "font-brush-yuji-boku",
  "yuji-syuku": "font-jp-yuji-syuku",
  "yuji-mai": "font-brush-yuji-mai",
  "liu-jian-mao-cao": "font-brush-liu-jian-mao-cao",
  "long-cang": "font-brush-long-cang",
  "ma-shan-zheng": "font-brush-ma-shan-zheng",
  "zhi-mang-xing": "font-brush-zhi-mang-xing",
  "nanum-brush-script": "font-brush-nanum-brush-script",
  "east-sea-dokdo": "font-brush-east-sea-dokdo",
};

export function getFontPreviewUtilityClass(font: {
  id: string;
  familyName: string;
}): string {
  const byId = FONT_PREVIEW_CLASS_BY_ID[font.id];
  if (byId) return byId;

  const lower = font.familyName.toLowerCase();
  if (lower.includes("thien an") || lower.includes("thiên ân")) {
    return "font-brush-utm-thien-an";
  }
  if (lower.includes("yuji boku")) return "font-brush-yuji-boku";
  if (lower.includes("yuji mai")) return "font-brush-yuji-mai";
  if (lower.includes("ma shan")) return "font-brush-ma-shan-zheng";
  if (lower.includes("long cang")) return "font-brush-long-cang";
  if (lower.includes("zhi mang")) return "font-brush-zhi-mang-xing";
  if (lower.includes("liu jian")) return "font-brush-liu-jian-mao-cao";
  if (lower.includes("nanum")) return "font-brush-nanum-brush-script";
  if (lower.includes("dokdo")) return "font-brush-east-sea-dokdo";
  return "font-headline-sm";
}

export function resolveScriptLang(
  tradition: ScriptCategory
): "vi" | "ja" | "zh" | "ko" {
  switch (tradition) {
    case "JAPANESE_SHODO":
      return "ja";
    case "CHINESE_CALLIGRAPHY":
      return "zh";
    case "KOREAN_BRUSH":
      return "ko";
    default:
      return "vi";
  }
}

export function getCanonicalStudioFontValue(font: StudioFontOption): string {
  if (font.id === "utm-thuphap-thien-an") {
    return DEFAULT_CALLIGRAPHY_FONT_FAMILY;
  }
  return font.familyName;
}

export function isSameStudioFont(
  selectedFontFamily: string,
  option: StudioFontOption
): boolean {
  const cleanSelected = selectedFontFamily.trim().toLowerCase();
  if (!cleanSelected) return false;
  if (option.id === "utm-thuphap-thien-an") {
    return (
      cleanSelected === DEFAULT_CALLIGRAPHY_FONT_FAMILY.toLowerCase() ||
      cleanSelected === option.familyName.toLowerCase() ||
      cleanSelected === option.id
    );
  }
  return (
    cleanSelected === option.familyName.toLowerCase() ||
    cleanSelected === option.name.toLowerCase() ||
    cleanSelected === option.id.toLowerCase()
  );
}

export function getFontsForTradition(
  tradition: ScriptCategory,
  availableFonts: readonly StudioFontOption[],
  includeGlobalLatin = false
): StudioFontOption[] {
  const pool =
    availableFonts.length > 0 ? availableFonts : DEFAULT_STUDIO_FONT_OPTIONS;
  const primary = pool.filter((f) => f.category === tradition);
  if (!includeGlobalLatin) {
    return primary.length > 0 ? [...primary] : [...pool];
  }
  const secondary = pool.filter(
    (f) => f.category !== tradition && f.supportedScripts.includes("LATIN")
  );
  return [...primary, ...secondary];
}

export function resolveTraditionFontPairing(
  nextTradition: ScriptCategory,
  currentFontFamily: string,
  availableFonts: readonly StudioFontOption[] = DEFAULT_STUDIO_FONT_OPTIONS
): string {
  const pool =
    availableFonts.length > 0 ? availableFonts : DEFAULT_STUDIO_FONT_OPTIONS;
  const matchingCategoryFonts = pool.filter(
    (f) => f.category === nextTradition
  );

  if (
    matchingCategoryFonts.some((f) => isSameStudioFont(currentFontFamily, f))
  ) {
    return currentFontFamily;
  }

  const preferredFamily = PRIMARY_FONT_FAMILY_BY_TRADITION[nextTradition];
  const preferredMatch = matchingCategoryFonts.find((f) =>
    isSameStudioFont(preferredFamily, f)
  );
  if (preferredMatch) {
    return getCanonicalStudioFontValue(preferredMatch);
  }

  if (matchingCategoryFonts[0]) {
    return getCanonicalStudioFontValue(matchingCategoryFonts[0]);
  }

  return preferredFamily;
}

export interface BrushExpressionPreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  strokePreset: StrokePresetOption;
  variationType: VariationTypeOption;
}

export const BRUSH_EXPRESSION_PRESETS: ReadonlyArray<BrushExpressionPreset> = [
  {
    id: "gyosho-flowing",
    title: "Gyosho",
    subtitle: "Flowing Semi-Cursive",
    description: "Fluid brush cadence, connected movement, and lyrical grace.",
    badge: "Most Popular",
    strokePreset: "FLOWING_INK",
    variationType: "04_EXPRESSIVE",
  },
  {
    id: "kaisho-block",
    title: "Kaisho",
    subtitle: "Structured Block",
    description: "Balanced proportion, crisp stroke stops, and classical clarity.",
    strokePreset: "CLASSICAL",
    variationType: "01_CONTROLLED",
  },
  {
    id: "sosho-bold",
    title: "Sosho",
    subtitle: "Heavy Sumi Mass",
    description: "Deep ink pressure, dramatic weight, and commanding presence.",
    strokePreset: "BOLD_BRUSH",
    variationType: "02_BOLD",
  },
  {
    id: "kasure-dry",
    title: "Kasure",
    subtitle: "Dry Horsehair",
    description: "Raw bristle energy with broken flying-white texture.",
    strokePreset: "DRY_BRUSH",
    variationType: "03_DRY_BRUSH",
  },
  {
    id: "zen-minimal",
    title: "Zen Minimal",
    subtitle: "Pure Unadorned",
    description: "Restrained fine strokes without decorative swash flourishes.",
    strokePreset: "CLASSICAL",
    variationType: "05_MINIMAL",
  },
];
