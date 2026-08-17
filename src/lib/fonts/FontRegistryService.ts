import fs from "fs";
import path from "path";

export type ScriptCategory = 
  | "VIETNAMESE_THU_PHAP" 
  | "JAPANESE_SHODO" 
  | "CHINESE_CALLIGRAPHY" 
  | "KOREAN_BRUSH";

export interface FontEntry {
  id: string;
  name: string;
  category: ScriptCategory;
  categoryLabel: string;
  fileName: string;
  previewText: string;
  sourceUrl: string;
  sourceLabel: string;
  downloadUrl: string;
  isZipArchive?: boolean;
  zipInternalPath?: string;
  license: string;
  commercialApproved: boolean;
  licenseVerifiedAt: string;
  description: string;
  isDownloaded: boolean;
  isActiveOnFrontend: boolean;
  base64Data?: string;
}

// Initial seed catalog of world-class calligraphy fonts
const INITIAL_FONT_CATALOG: Omit<FontEntry, "isDownloaded" | "isActiveOnFrontend">[] = [
  // 🇻🇳 Vietnamese Thư Pháp
  {
    id: "utm-thuphap-thien-an",
    name: "UTM Thư Pháp Thiên Ân",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "UtmThuphapThienAn.ttf",
    previewText: "Thi Bút",
    sourceUrl: "https://www.fontspace.com/utm-thuphap-thien-an-font-f32777",
    sourceLabel: "FontSpace / Michael Dinh Kien",
    downloadUrl: "https://www.fontspace.com/get/family/nzldj",
    isZipArchive: true,
    zipInternalPath: "UtmThuphapThienAn-VnBz.ttf",
    license: "Free for Personal & Commercial use",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "The gold-standard Vietnamese brush calligraphy typeface with sweeping dragon ascenders.",
  },
  {
    id: "great-vibes",
    name: "Long Vũ (Great Vibes)",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "GreatVibes-Regular.ttf",
    previewText: "Trọng Nghĩa",
    sourceUrl: "https://fonts.google.com/specimen/Great+Vibes",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Grand dragon sweeping loop capitals with flowing flourishes.",
  },
  {
    id: "kaushan-script",
    name: "Phi Bạch (Kaushan Script)",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "KaushanScript-Regular.ttf",
    previewText: "Chí Hướng",
    sourceUrl: "https://fonts.google.com/specimen/Kaushan+Script",
    sourceLabel: "Google Fonts / Impallari Type",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/kaushanscript/KaushanScript-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Raw, uninhibited horsehair brush strokes with visible dry bristle texture.",
  },
  {
    id: "caveat-brush",
    name: "Mực Nho (Caveat Brush)",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "CaveatBrush-Regular.ttf",
    previewText: "Tâm Đức",
    sourceUrl: "https://fonts.google.com/specimen/Caveat+Brush",
    sourceLabel: "Google Fonts / Impallari Type",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/caveatbrush/CaveatBrush-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Heavy sumi ink mass with strong pressure and authoritative brush impact.",
  },
  {
    id: "arizonia",
    name: "Phượng Vũ (Arizonia)",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "Arizonia-Regular.ttf",
    previewText: "Bình An",
    sourceUrl: "https://fonts.google.com/specimen/Arizonia",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/arizonia/Arizonia-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Delicate dancing phoenix curves inspired by Asian camel-hair brush elegance.",
  },
  {
    id: "alex-brush",
    name: "Khí Phách (Alex Brush)",
    category: "VIETNAMESE_THU_PHAP",
    categoryLabel: "Vietnamese Thư Pháp",
    fileName: "AlexBrush-Regular.ttf",
    previewText: "Phúc Lộc",
    sourceUrl: "https://fonts.google.com/specimen/Alex+Brush",
    sourceLabel: "Google Fonts / TypeSETIT",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/alexbrush/AlexBrush-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Classic poetic Vietnamese Thư Pháp script with clean rhythm.",
  },

  // 🇯🇵 Japanese Shodō
  {
    id: "yuji-boku",
    name: "Yuji Boku (勇司 朴)",
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiBoku-Regular.ttf",
    previewText: "諦めない",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Boku",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/yujiboku/YujiBoku-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Heavy ink-dipped dry brush Shodō with classical sumi weight and broken flying white.",
  },
  {
    id: "yuji-syuku",
    name: "Yuji Syuku (勇司 宿)",
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiSyuku-Regular.ttf",
    previewText: "武士道",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Syuku",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/yujisyuku/YujiSyuku-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Classical restrained Kanji brushwork with sharp brush tip transitions.",
  },
  {
    id: "yuji-mai",
    name: "Yuji Mai (勇司 舞)",
    category: "JAPANESE_SHODO",
    categoryLabel: "Japanese Shodō",
    fileName: "YujiMai-Regular.ttf",
    previewText: "風林火山",
    sourceUrl: "https://fonts.google.com/specimen/Yuji+Mai",
    sourceLabel: "Google Fonts / Kinuta Font Factory",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/yujimai/YujiMai-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Flowing Kana and Kanji brush movement with dancing brush cadence.",
  },

  // 🇨🇳 Chinese Shūfǎ
  {
    id: "liu-jian-mao-cao",
    name: "Liu Jian Mao Cao (刘建毛草)",
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "LiuJianMaoCao-Regular.ttf",
    previewText: "海納百川",
    sourceUrl: "https://fonts.google.com/specimen/Liu+Jian+Mao+Cao",
    sourceLabel: "Google Fonts / Liu Jian",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/liujianmaocao/LiuJianMaoCao-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Expressive cursive grass script (草書) with wild brush energy and dramatic ink pooling.",
  },
  {
    id: "long-cang",
    name: "Long Cang (龙苍)",
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "LongCang-Regular.ttf",
    previewText: "天道酬勤",
    sourceUrl: "https://fonts.google.com/specimen/Long+Cang",
    sourceLabel: "Google Fonts / Qiu Yin",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/longcang/LongCang-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Master semi-cursive grass script calligraphy with powerful stroke rhythm.",
  },
  {
    id: "ma-shan-zheng",
    name: "Ma Shan Zheng (马善政)",
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "MaShanZheng-Regular.ttf",
    previewText: "上善若水",
    sourceUrl: "https://fonts.google.com/specimen/Ma+Shan+Zheng",
    sourceLabel: "Google Fonts / Ma Shan Zheng",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Standard regular brush calligraphy (楷書) with authoritative balance.",
  },
  {
    id: "zhi-mang-xing",
    name: "Zhi Mang Xing (志芒星)",
    category: "CHINESE_CALLIGRAPHY",
    categoryLabel: "Chinese Shūfǎ",
    fileName: "ZhiMangXing-Regular.ttf",
    previewText: "大衛",
    sourceUrl: "https://fonts.google.com/specimen/Zhi+Mang+Xing",
    sourceLabel: "Google Fonts / Wei Zhimang",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/zhimangxing/ZhiMangXing-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Running script calligraphy (行書) with swift, connected strokes.",
  },

  // 🇰🇷 Korean Seoye
  {
    id: "nanum-brush-script",
    name: "Nanum Brush Script (나눔손글씨 붓)",
    category: "KOREAN_BRUSH",
    categoryLabel: "Korean Seoye",
    fileName: "NanumBrushScript-Regular.ttf",
    previewText: "영원한 사랑",
    sourceUrl: "https://fonts.google.com/specimen/Nanum+Brush+Script",
    sourceLabel: "Google Fonts / Naver Corp",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Authentic Korean calligraphy brush script with lively Hangul stroke dynamics.",
  },
  {
    id: "east-sea-dokdo",
    name: "East Sea Dokdo (독도체)",
    category: "KOREAN_BRUSH",
    categoryLabel: "Korean Seoye",
    fileName: "EastSeaDokdo-Regular.ttf",
    previewText: "희망과 꿈",
    sourceUrl: "https://fonts.google.com/specimen/East+Sea+Dokdo",
    sourceLabel: "Google Fonts / Yoon Design",
    downloadUrl: "https://raw.githubusercontent.com/google/fonts/main/ofl/eastseadokdo/EastSeaDokdo-Regular.ttf",
    license: "OFL (Open Font License)",
    commercialApproved: true,
    licenseVerifiedAt: "2026-08-17",
    description: "Heavy ancient stone-rubbing style Hangul brush script.",
  },
];

const CONFIG_FILE_PATH = path.join(process.cwd(), "src", "lib", "fonts", "font_registry_state.json");

export class FontRegistryService {
  private static memoryState: Record<string, boolean> | null = null;
  private static base64Cache: Record<string, string> = {};

  private static loadState(): Record<string, boolean> {
    try {
      if (fs.existsSync(CONFIG_FILE_PATH)) {
        const raw = fs.readFileSync(CONFIG_FILE_PATH, "utf-8");
        this.memoryState = JSON.parse(raw);
        return this.memoryState!;
      }
    } catch {
      // ignore
    }
    // Default active state with all fonts enabled
    this.memoryState = {
      "utm-thuphap-thien-an": true,
      "arizonia": true,
      "great-vibes": true,
      "kaushan-script": true,
      "caveat-brush": true,
      "alex-brush": true,
      "yuji-boku": true,
      "yuji-syuku": true,
      "yuji-mai": true,
      "long-cang": true,
      "liu-jian-mao-cao": true,
      "ma-shan-zheng": true,
      "zhi-mang-xing": true,
      "nanum-brush-script": true,
      "east-sea-dokdo": true,
    };
    return this.memoryState;
  }

  private static saveState(state: Record<string, boolean>) {
    this.memoryState = state;
    try {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
    } catch (e) {
      console.warn("Could not persist font_registry_state.json:", e);
    }
  }

  public static isFontOnDisk(fileName: string): boolean {
    const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
    return fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000;
  }

  public static getBase64(fileName: string): string {
    if (this.base64Cache[fileName]) return this.base64Cache[fileName];
    try {
      const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
      if (fs.existsSync(fontPath)) {
        const b64 = fs.readFileSync(fontPath).toString("base64");
        this.base64Cache[fileName] = b64;
        return b64;
      }
    } catch (e) {
      console.warn(`Error reading font ${fileName} for base64:`, e);
    }
    return "";
  }

  public static getAllFonts(): FontEntry[] {
    const activeState = this.loadState();
    return INITIAL_FONT_CATALOG.map((font) => {
      const onDisk = this.isFontOnDisk(font.fileName);
      const isActive = activeState[font.id] ?? onDisk;
      return {
        ...font,
        isDownloaded: onDisk,
        isActiveOnFrontend: isActive && onDisk,
        base64Data: onDisk ? this.getBase64(font.fileName) : undefined,
      };
    });
  }

  public static getActiveFrontendFonts(): FontEntry[] {
    return this.getAllFonts().filter((f) => f.isActiveOnFrontend && f.isDownloaded);
  }

  public static toggleActive(fontId: string, isActive: boolean): boolean {
    const state = this.loadState();
    state[fontId] = isActive;
    this.saveState(state);
    return true;
  }

  public static async downloadFont(fontId: string): Promise<{ success: boolean; message: string }> {
    const font = INITIAL_FONT_CATALOG.find((f) => f.id === fontId);
    if (!font) {
      return { success: false, message: `Font ${fontId} not found in catalog` };
    }

    try {
      const fontsDir = path.join(process.cwd(), "public", "fonts");
      if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
      }

      const targetPath = path.join(fontsDir, font.fileName);

      if (font.isZipArchive) {
        // Download zip and extract internal file
        const tempZipPath = path.join("/tmp", `${font.id}_temp.zip`);
        const res = await fetch(font.downloadUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching zip`);
        const arrayBuf = await res.arrayBuffer();
        fs.writeFileSync(tempZipPath, Buffer.from(arrayBuf));

        // Use unzip command
        const { execSync } = await import("child_process");
        if (font.zipInternalPath) {
          execSync(`unzip -p "${tempZipPath}" "${font.zipInternalPath}" > "${targetPath}"`);
        } else {
          execSync(`unzip -o "${tempZipPath}" -d "${fontsDir}"`);
        }
      } else {
        // Direct TTF download
        const res = await fetch(font.downloadUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching font file`);
        const arrayBuf = await res.arrayBuffer();
        fs.writeFileSync(targetPath, Buffer.from(arrayBuf));
      }

      // Verify file written and size > 1KB
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
        // Clear in-memory base64 cache
        delete this.base64Cache[font.fileName];
        // Mark active
        this.toggleActive(fontId, true);
        return { success: true, message: `Successfully downloaded ${font.name}` };
      } else {
        throw new Error("Downloaded file was empty or corrupted");
      }
    } catch (e: any) {
      console.error(`Failed to download font ${font.name}:`, e);
      return { success: false, message: e?.message || "Download failed" };
    }
  }

  public static async downloadMultipleFonts(fontIds: string[]): Promise<{
    results: { id: string; success: boolean; message: string }[];
    successCount: number;
    failureCount: number;
  }> {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const id of fontIds) {
      const res = await this.downloadFont(id);
      results.push({ id, ...res });
      if (res.success) successCount++;
      else failureCount++;
    }

    return { results, successCount, failureCount };
  }
}
