import { 
  Dancing_Script, 
  Caveat, 
  Yuji_Syuku, 
  Yuji_Mai, 
  East_Sea_Dokdo, 
  Nanum_Brush_Script, 
  Ma_Shan_Zheng, 
  Zhi_Mang_Xing 
} from "next/font/google";

// 🇻🇳 Vietnamese (Thư Pháp Alternatives)
export const fontVnDancingScript = Dancing_Script({
  subsets: ["vietnamese"],
  weight: ["400", "700"],
  variable: "--font-vn-dancing",
  display: "swap",
});

export const fontVnCaveat = Caveat({
  subsets: ["latin-ext"],
  weight: ["400", "700"],
  variable: "--font-vn-caveat",
  display: "swap",
});

// 🇯🇵 Japanese (Shodo / Brush Calligraphy)
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

// 🇰🇷 Korean (Seoye / Brush Script)
export const fontKrEastSeaDokdo = East_Sea_Dokdo({
  weight: "400",
  variable: "--font-kr-dokdo",
  display: "swap",
  preload: false,
});

export const fontKrNanumBrush = Nanum_Brush_Script({
  weight: "400",
  variable: "--font-kr-nanum",
  display: "swap",
  preload: false,
});

// 🇨🇳 Chinese (Shufa / Brush Calligraphy)
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
