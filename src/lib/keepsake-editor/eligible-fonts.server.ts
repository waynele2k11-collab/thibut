import "server-only";
import fs from "node:fs";
import path from "node:path";
import opentype from "@shuding/opentype.js";
import { INITIAL_FONT_CATALOG, isFontLicensedForPrint } from "@/lib/fonts/fontCatalog";
import { coveredChars, coversVietnamese } from "./coverage";

export type EligibleFont = {
  id: string;
  name: string;
  family: string;
  /** Characters of the editor's test set that this font can draw. */
  covered: string;
  /** The catalogue's note on the licence basis, when it has one. */
  note?: string;
};

type EligibleFontRecord = EligibleFont & { fileName: string };

let cache: Promise<EligibleFontRecord[]> | null = null;

function fontPath(fileName: string): string {
  return path.join(process.cwd(), "assets", "fonts", path.basename(fileName));
}

// The font is parsed here with the same parser FontRegistryService uses, without importing that
// service: it pulls in the database client, which this list does not need.
async function computeEligibleFonts(): Promise<EligibleFontRecord[]> {
  const eligible: EligibleFontRecord[] = [];
  for (const item of INITIAL_FONT_CATALOG) {
    if (item.isWebFont || !item.fileName) continue;
    if (!/^[A-Za-z0-9._-]+\.(ttf|otf)$/.test(item.fileName)) continue;
    if (!isFontLicensedForPrint(item)) continue;
    try {
      const buffer = await fs.promises.readFile(fontPath(item.fileName));
      if (buffer.byteLength < 1000) continue;
      const font = opentype.parse(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      );
      const covered = coveredChars((ch) => font.charToGlyphIndex(ch) > 0);
      if (!coversVietnamese(covered)) continue;
      eligible.push({
        id: item.id,
        name: item.name,
        family: item.familyName,
        covered,
        ...(item.licenseNote ? { note: item.licenseNote } : {}),
        fileName: item.fileName,
      });
    } catch {
      // A font that is missing or cannot be parsed is not offered.
    }
  }
  return eligible;
}

async function getRecords(): Promise<EligibleFontRecord[]> {
  cache ??= computeEligibleFonts();
  return cache;
}

/**
 * Fonts the keepsake editor may offer: in the catalogue, approved for commercial print, on disk,
 * and covering every character of the Vietnamese test set. The list is computed, never typed in.
 */
export async function getEligibleFonts(): Promise<EligibleFont[]> {
  const records = await getRecords();
  return records.map(({ id, name, family, covered, note }) => ({ id, name, family, covered, ...(note ? { note } : {}) }));
}

/**
 * The bytes of an eligible font, or null. The file name comes from the catalogue entry that
 * matched `id` exactly; nothing from the request is ever used as a path.
 */
export async function readEligibleFontFile(
  id: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const records = await getRecords();
  const record = records.find((font) => font.id === id);
  if (!record) return null;
  try {
    const buffer = await fs.promises.readFile(fontPath(record.fileName));
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return { bytes, contentType: record.fileName.endsWith(".otf") ? "font/otf" : "font/ttf" };
  } catch {
    return null;
  }
}

export function resetEligibleFontsForTests(): void {
  cache = null;
}
