import {
  Inter,
  Playfair_Display,
  Noto_Sans_JP,
  Noto_Serif_JP,
  Dancing_Script,
  Caveat,
  Alex_Brush,
  Great_Vibes,
  Kaushan_Script,
  Caveat_Brush,
  Arizonia,
  Allura,
  Yuji_Boku,
  Yuji_Syuku,
  Yuji_Mai,
  East_Sea_Dokdo,
  Nanum_Brush_Script,
  Long_Cang,
  Ma_Shan_Zheng,
  Zhi_Mang_Xing,
} from "next/font/google";

// ── DESIGN.md Core UI & Editorial Fonts (Self-Hosted via next/font/google) ──
export const fontInter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const fontPlayfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
});

export const fontNotoSansJp = Noto_Sans_JP({
  weight: ["400", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  preload: false,
});

export const fontNotoSerifJp = Noto_Serif_JP({
  weight: ["400", "700"],
  variable: "--font-noto-serif-jp",
  display: "swap",
  preload: false,
});

// 🇻🇳 Vietnamese / Latin Thư Pháp Suite (Scoped to /create and /studio previews)
export const fontVnGreatVibes = Great_Vibes({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-vn-greatvibes",
  display: "swap",
  preload: false,
});

export const fontVnKaushan = Kaushan_Script({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-vn-kaushan",
  display: "swap",
  preload: false,
});

export const fontVnCaveatBrush = Caveat_Brush({
  subsets: ["latin-ext"],
  weight: ["400"],
  variable: "--font-vn-caveatbrush",
  display: "swap",
  preload: false,
});

export const fontVnArizonia = Arizonia({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-vn-arizonia",
  display: "swap",
  preload: false,
});

export const fontVnAllura = Allura({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-vn-allura",
  display: "swap",
  preload: false,
});

export const fontVnAlexBrush = Alex_Brush({
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  variable: "--font-vn-alex",
  display: "swap",
  preload: false,
});

export const fontVnDancingScript = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
  variable: "--font-vn-dancing",
  display: "swap",
  preload: false,
});

export const fontVnCaveat = Caveat({
  subsets: ["latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vn-caveat",
  display: "swap",
  preload: false,
});

// 🇯🇵 Japanese (Shodō / Dry Brush & Classical Calligraphy)
export const fontJpYujiBoku = Yuji_Boku({
  weight: "400",
  variable: "--font-jp-yuji-boku",
  display: "swap",
  preload: false,
});

export const fontJpYujiSyuku = Yuji_Syuku({
  weight: "400",
  variable: "--font-jp-yuji-syuku",
  display: "swap",
  preload: false,
});

export const fontJpYujiMai = Yuji_Mai({
  weight: "400",
  variable: "--font-jp-yuji-mai",
  display: "swap",
  preload: false,
});

// 🇰🇷 Korean (Seoye / Hangul Brush Script)
export const fontKrNanumBrush = Nanum_Brush_Script({
  weight: "400",
  variable: "--font-kr-nanum",
  display: "swap",
  preload: false,
});

export const fontKrEastSeaDokdo = East_Sea_Dokdo({
  weight: "400",
  variable: "--font-kr-dokdo",
  display: "swap",
  preload: false,
});

// 🇨🇳 Chinese (Shūfǎ / Cursive & Standard Brush Calligraphy)
export const fontCnLongCang = Long_Cang({
  weight: "400",
  variable: "--font-cn-longcang",
  display: "swap",
  preload: false,
});

export const fontCnMaShanZheng = Ma_Shan_Zheng({
  weight: "400",
  variable: "--font-cn-mashan",
  display: "swap",
  preload: false,
});

export const fontCnZhiMangXing = Zhi_Mang_Xing({
  weight: "400",
  variable: "--font-cn-zhimang",
  display: "swap",
  preload: false,
});

/**
 * Joined CSS variable classes for calligraphic preview fonts.
 * Scoped strictly to `/create` and `/studio` layouts (R-101, DESIGN.md §1).
 */
export const studioBrushFontVariables = [
  fontVnGreatVibes.variable,
  fontVnKaushan.variable,
  fontVnCaveatBrush.variable,
  fontVnArizonia.variable,
  fontVnAllura.variable,
  fontVnAlexBrush.variable,
  fontVnDancingScript.variable,
  fontVnCaveat.variable,
  fontJpYujiBoku.variable,
  fontJpYujiSyuku.variable,
  fontJpYujiMai.variable,
  fontKrNanumBrush.variable,
  fontKrEastSeaDokdo.variable,
  fontCnLongCang.variable,
  fontCnMaShanZheng.variable,
  fontCnZhiMangXing.variable,
].join(" ");

