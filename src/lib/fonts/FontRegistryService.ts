import "server-only";
import fs from "node:fs";
import path from "node:path";
import opentype, { type OpenTypeFont } from "@shuding/opentype.js";
import type { Font as PrismaFont } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  CATEGORY_LABELS,
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  DEFAULT_CALLIGRAPHY_FONT_ID,
  DEFAULT_SEAL_FONT_FAMILY,
  DEFAULT_SEAL_FONT_ID,
  INITIAL_FONT_CATALOG,
  isFontLicensedForPrint,
  isFontWebEmbeddable,
  isUnverifiedLegacyArchiveFile,
  type FontCatalogItem,
  type FontEntry,
  type FontLicenseSubject,
  type ScriptCategory,
} from "./fontCatalog";

export {
  CATEGORY_LABELS,
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  DEFAULT_CALLIGRAPHY_FONT_ID,
  DEFAULT_SEAL_FONT_FAMILY,
  DEFAULT_SEAL_FONT_ID,
  INITIAL_FONT_CATALOG,
  isFontLicensedForPrint,
  isFontWebEmbeddable,
  isUnverifiedLegacyArchiveFile,
};
export type { FontCatalogItem, FontEntry, FontLicenseSubject, ScriptCategory };

export class FontLicenseError extends Error {
  public readonly fontIdentifier: string;

  constructor(fontIdentifier: string, reason: string) {
    super(`Font licensing gate rejected "${fontIdentifier}": ${reason}`);
    this.name = "FontLicenseError";
    this.fontIdentifier = fontIdentifier;
  }
}

export class FontNotFoundError extends Error {
  public readonly fontIdentifier: string;

  constructor(fontIdentifier: string) {
    super(`Font "${fontIdentifier}" not found on server`);
    this.name = "FontNotFoundError";
    this.fontIdentifier = fontIdentifier;
  }
}

const ALLOWED_FONT_DOWNLOAD_HOSTS = new Set<string>([
  "raw.githubusercontent.com",
  "github.com",
  "fonts.gstatic.com",
]);

function normalizeLookupKey(raw: string): string {
  const firstFamily = raw.split(",")[0] ?? raw;
  return firstFamily
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .trim()
    .toLowerCase();
}

function isValidScriptCategory(val: string | null | undefined): val is ScriptCategory {
  return (
    val === "VIETNAMESE_THU_PHAP" ||
    val === "JAPANESE_SHODO" ||
    val === "CHINESE_CALLIGRAPHY" ||
    val === "KOREAN_BRUSH"
  );
}

function safeAssetFontPath(fileName: string): string | null {
  const cleanName = path.basename(fileName.trim());
  if (!cleanName || cleanName !== fileName.trim() || cleanName.startsWith(".")) {
    return null;
  }
  return path.join(process.cwd(), "assets", "fonts", cleanName);
}

function safeQuarantinedFontPath(fileName: string): string | null {
  const cleanName = path.basename(fileName.trim());
  if (!cleanName || cleanName !== fileName.trim() || cleanName.startsWith(".")) {
    return null;
  }
  return path.join(process.cwd(), ".quarantined-fonts", cleanName);
}

function parseOpenTypeBuffer(buf: Buffer): OpenTypeFont {
  const arrayBuffer = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
  const parseFn = typeof opentype.parse === "function" ? opentype.parse : opentype.parse;
  return parseFn(arrayBuffer);
}

export class FontRegistryService {
  private static memoryEnabledState = new Map<string, boolean>();
  private static bufferCache = new Map<string, Buffer>();
  private static openTypeCache = new Map<string, OpenTypeFont>();
  private static base64Cache = new Map<string, string>();
  private static dbBackoffUntilMs = 0;

  public static resetMemoryStateForTests(): void {
    this.memoryEnabledState.clear();
    this.dbBackoffUntilMs = 0;
  }

  public static assertFontLicensedForPrint(subject: FontLicenseSubject): void {
    const label = subject.name || subject.id || subject.fileName || "unknown-font";
    if (!subject.commercialApproved) {
      throw new FontLicenseError(
        label,
        "commercialApproved is false (unverified commercial license)"
      );
    }
    if (!subject.printExportAllowed) {
      throw new FontLicenseError(
        label,
        "printExportAllowed is false (web-only or non-exportable license)"
      );
    }
    if (!subject.licenseVerifiedAt) {
      throw new FontLicenseError(
        label,
        "licenseVerifiedAt timestamp is missing"
      );
    }
  }

  public static canActivateFont(subject: FontLicenseSubject): boolean {
    return isFontLicensedForPrint(subject);
  }

  public static isFontOnDisk(fileName: string): boolean {
    if (!fileName) return false;
    if (this.bufferCache.has(fileName)) return true;
    const fontPath = safeAssetFontPath(fileName);
    if (!fontPath) return false;
    try {
      return fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000;
    } catch {
      return false;
    }
  }

  private static readDiskFontBuffer(fileName: string, aliases?: string[]): Buffer | null {
    const candidates = [fileName, ...(aliases ?? []).filter((a) => /\.(ttf|otf|woff2)$/i.test(a))];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const cached = this.bufferCache.get(candidate);
      if (cached) return cached;

      const fontPath = safeAssetFontPath(candidate);
      if (!fontPath) continue;
      try {
        if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000) {
          const buf = fs.readFileSync(fontPath);
          this.bufferCache.set(candidate, buf);
          if (fileName && candidate !== fileName) {
            this.bufferCache.set(fileName, buf);
          }
          return buf;
        }
      } catch {
        // Ignore read error and try next candidate
      }
    }
    return null;
  }

  private static readQuarantinedFontBufferForInspection(
    fileName: string,
    aliases?: string[]
  ): Buffer | null {
    const candidates = [fileName, ...(aliases ?? []).filter((a) => /\.(ttf|otf)$/i.test(a))];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const fontPath = safeQuarantinedFontPath(candidate);
      if (!fontPath) continue;
      try {
        if (fs.existsSync(fontPath) && fs.statSync(fontPath).size > 1000) {
          return fs.readFileSync(fontPath);
        }
      } catch {
        // Ignore read error during offline inspection
      }
    }
    return null;
  }

  public static getBase64(fileName: string): string {
    if (!fileName) return "";
    const cached = this.base64Cache.get(fileName);
    if (cached) return cached;
    const buf = this.readDiskFontBuffer(fileName);
    if (!buf) return "";
    const b64 = buf.toString("base64");
    this.base64Cache.set(fileName, b64);
    return b64;
  }

  private static async fetchDbFontsSafe(): Promise<PrismaFont[] | null> {
    if (!process.env.DATABASE_URL) {
      return null;
    }
    if (Date.now() < this.dbBackoffUntilMs) {
      return null;
    }
    try {
      return await prisma.font.findMany({
        orderBy: { name: "asc" },
      });
    } catch {
      this.dbBackoffUntilMs = Date.now() + 5_000;
      return null;
    }
  }

  private static findCatalogItem(fontFamilyOrId: string): FontCatalogItem | undefined {
    const key = normalizeLookupKey(fontFamilyOrId);
    if (!key) return undefined;

    return INITIAL_FONT_CATALOG.find((item) => {
      if (item.id.toLowerCase() === key) return true;
      if (item.name.toLowerCase() === key) return true;
      if (item.familyName.toLowerCase() === key) return true;
      if (item.fileName && item.fileName.toLowerCase() === key) return true;
      if (item.aliases?.some((alias) => alias.toLowerCase() === key)) return true;
      return false;
    });
  }

  private static mapDbFontToEntry(
    dbFont: PrismaFont,
    includeBase64: boolean
  ): FontEntry {
    const category: ScriptCategory = isValidScriptCategory(dbFont.tradition)
      ? dbFont.tradition
      : "VIETNAMESE_THU_PHAP";
    const onDisk =
      this.isFontOnDisk(dbFont.fileName) || Boolean(dbFont.storageKey);

    // Enforce strict unverified defaults on legacy archive files unless explicitly verified
    const isUnverifiedArchive =
      isUnverifiedLegacyArchiveFile(dbFont.fileName) && !dbFont.licenseVerifiedAt;
    const commercialApproved = isUnverifiedArchive
      ? false
      : dbFont.commercialApproved;
    const printExportAllowed = isUnverifiedArchive
      ? false
      : dbFont.printExportAllowed;
    const webEmbedAllowed = isUnverifiedArchive
      ? false
      : Boolean(dbFont.webEmbedAllowed);
    const verifiedIso = dbFont.licenseVerifiedAt
      ? dbFont.licenseVerifiedAt.toISOString()
      : null;

    const licensed = isFontLicensedForPrint({
      id: dbFont.id,
      name: dbFont.name,
      fileName: dbFont.fileName,
      commercialApproved,
      printExportAllowed,
      webEmbedAllowed,
      licenseVerifiedAt: verifiedIso,
    });

    const memoryOverride = this.memoryEnabledState.get(dbFont.id);
    const desiredEnabled = memoryOverride ?? dbFont.enabled;

    return {
      id: dbFont.id,
      name: dbFont.name,
      familyName: dbFont.familyName || dbFont.name,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      fileName: dbFont.fileName,
      format:
        dbFont.format === "otf" || dbFont.format === "woff2"
          ? dbFont.format
          : "ttf",
      supportedScripts: dbFont.supportedScripts,
      previewText: "Thi Bút",
      sourceUrl: dbFont.licenseUrl || "Local Import",
      sourceLabel: dbFont.licenseType || "Unverified Local Import",
      downloadUrl: "",
      license: dbFont.licenseType || "Unverified Local Archive",
      licenseUrl: dbFont.licenseUrl || undefined,
      commercialApproved,
      printExportAllowed,
      webEmbedAllowed,
      licenseVerifiedAt: verifiedIso,
      licenseVerifiedBy: dbFont.licenseVerifiedBy,
      description: licensed
        ? "Verified custom font registered in database."
        : "Imported font awaiting commercial & print-export license verification.",
      defaultEnabled: false,
      isDownloaded: onDisk,
      isActiveOnFrontend: Boolean(desiredEnabled && onDisk && licensed),
      base64Data:
        includeBase64 && onDisk ? this.getBase64(dbFont.fileName) : undefined,
    };
  }

  public static async getAllFonts(options?: {
    includeBase64?: boolean;
  }): Promise<FontEntry[]> {
    const includeBase64 = options?.includeBase64 ?? true;
    const dbFonts = await this.fetchDbFontsSafe();

    const dbBySlug = new Map<string, PrismaFont>();
    const dbByFileName = new Map<string, PrismaFont>();
    const matchedDbIds = new Set<string>();

    if (dbFonts) {
      for (const row of dbFonts) {
        if (row.slug) dbBySlug.set(row.slug.toLowerCase(), row);
        if (row.fileName) dbByFileName.set(row.fileName.toLowerCase(), row);
      }
    }

    const catalogEntries: FontEntry[] = INITIAL_FONT_CATALOG.map((font) => {
      const dbMatch =
        dbBySlug.get(font.id.toLowerCase()) ||
        (font.fileName
          ? dbByFileName.get(font.fileName.toLowerCase())
          : undefined);

      if (dbMatch) {
        matchedDbIds.add(dbMatch.id);
      }

      const onDisk = font.isWebFont
        ? true
        : this.readDiskFontBuffer(font.fileName, font.aliases) !== null ||
          Boolean(dbMatch?.storageKey);

      const commercialApproved = dbMatch
        ? dbMatch.commercialApproved
        : font.commercialApproved;
      const printExportAllowed = dbMatch
        ? dbMatch.printExportAllowed
        : font.printExportAllowed;
      const webEmbedAllowed =
        commercialApproved && printExportAllowed
          ? dbMatch
            ? Boolean(dbMatch.webEmbedAllowed || font.webEmbedAllowed)
            : font.webEmbedAllowed
          : false;
      const licenseVerifiedAt = dbMatch?.licenseVerifiedAt
        ? dbMatch.licenseVerifiedAt.toISOString()
        : font.licenseVerifiedAt ?? null;

      const licensed = isFontLicensedForPrint({
        id: font.id,
        name: font.name,
        fileName: font.fileName,
        commercialApproved,
        printExportAllowed,
        webEmbedAllowed,
        licenseVerifiedAt,
      });

      const memoryOverride = this.memoryEnabledState.get(font.id);
      const desiredActive =
        memoryOverride ?? (dbMatch ? dbMatch.enabled : font.defaultEnabled);

      return {
        ...font,
        commercialApproved,
        printExportAllowed,
        webEmbedAllowed,
        licenseVerifiedAt,
        isDownloaded: onDisk,
        isActiveOnFrontend: Boolean(desiredActive && onDisk && licensed),
        base64Data:
          includeBase64 && onDisk && !font.isWebFont
            ? this.getBase64(font.fileName)
            : undefined,
      };
    });

    const extraDbEntries: FontEntry[] = dbFonts
      ? dbFonts
          .filter((row) => !matchedDbIds.has(row.id))
          .map((row) => this.mapDbFontToEntry(row, includeBase64))
      : [];

    return [...catalogEntries, ...extraDbEntries];
  }

  public static async getActiveFrontendFonts(): Promise<FontEntry[]> {
    const all = await this.getAllFonts({ includeBase64: false });
    return all.filter(
      (f) => f.isActiveOnFrontend && f.isDownloaded && isFontLicensedForPrint(f)
    );
  }

  public static async toggleActive(
    fontIdOrSlug: string,
    isActive: boolean
  ): Promise<{ id: string; enabled: boolean }> {
    const trimmed = fontIdOrSlug.trim();
    if (!trimmed) {
      throw new FontNotFoundError(fontIdOrSlug);
    }

    const catalogItem = this.findCatalogItem(trimmed);
    const dbFonts = await this.fetchDbFontsSafe();
    const dbFont = dbFonts?.find(
      (f) =>
        f.id === trimmed ||
        (f.slug && f.slug.toLowerCase() === trimmed.toLowerCase()) ||
        (catalogItem &&
          (f.slug === catalogItem.id || f.fileName === catalogItem.fileName))
    );

    if (!catalogItem && !dbFont) {
      if (isUnverifiedLegacyArchiveFile(trimmed)) {
        throw new FontLicenseError(
          trimmed,
          "Legacy archive font is unverified for commercial/print use"
        );
      }
      throw new FontNotFoundError(trimmed);
    }

    const effectiveSubject: FontLicenseSubject = dbFont
      ? {
          id: dbFont.id,
          name: dbFont.name,
          fileName: dbFont.fileName,
          commercialApproved:
            isUnverifiedLegacyArchiveFile(dbFont.fileName) &&
            !dbFont.licenseVerifiedAt
              ? false
              : dbFont.commercialApproved,
          printExportAllowed:
            isUnverifiedLegacyArchiveFile(dbFont.fileName) &&
            !dbFont.licenseVerifiedAt
              ? false
              : dbFont.printExportAllowed,
          licenseVerifiedAt:
            dbFont.licenseVerifiedAt ?? catalogItem?.licenseVerifiedAt ?? null,
        }
      : {
          id: catalogItem!.id,
          name: catalogItem!.name,
          fileName: catalogItem!.fileName,
          commercialApproved: catalogItem!.commercialApproved,
          printExportAllowed: catalogItem!.printExportAllowed,
          licenseVerifiedAt: catalogItem!.licenseVerifiedAt ?? null,
        };

    // TB-CALLI-008 & T-407: Enforce licensing gate BEFORE enabling any font!
    if (isActive) {
      this.assertFontLicensedForPrint(effectiveSubject);
    }

    const canonicalKey = catalogItem ? catalogItem.id : dbFont!.id;
    this.memoryEnabledState.set(canonicalKey, isActive);
    if (dbFont) {
      this.memoryEnabledState.set(dbFont.id, isActive);
    }

    // Persist in Prisma Font table when DB is reachable (serverless-safe, zero disk writes)
    if (process.env.DATABASE_URL && Date.now() >= this.dbBackoffUntilMs) {
      try {
        if (dbFont) {
          await prisma.font.update({
            where: { id: dbFont.id },
            data: { enabled: isActive },
          });
        } else if (catalogItem && catalogItem.fileName) {
          await prisma.font.upsert({
            where: { fileName: catalogItem.fileName },
            update: {
              enabled: isActive,
              slug: catalogItem.id,
              webEmbedAllowed: catalogItem.webEmbedAllowed,
            },
            create: {
              slug: catalogItem.id,
              name: catalogItem.name,
              familyName: catalogItem.familyName,
              fileName: catalogItem.fileName,
              format: catalogItem.format,
              tradition: catalogItem.category,
              supportedScripts: catalogItem.supportedScripts,
              licenseType: catalogItem.license,
              licenseUrl: catalogItem.licenseUrl ?? null,
              commercialApproved: catalogItem.commercialApproved,
              printExportAllowed: catalogItem.printExportAllowed,
              webEmbedAllowed: catalogItem.webEmbedAllowed,
              licenseVerifiedAt: catalogItem.licenseVerifiedAt
                ? new Date(catalogItem.licenseVerifiedAt)
                : null,
              licenseVerifiedBy: catalogItem.licenseVerifiedBy ?? null,
              enabled: isActive,
            },
          });
        }
      } catch {
        this.dbBackoffUntilMs = Date.now() + 5_000;
      }
    }

    return { id: canonicalKey, enabled: isActive };
  }

  /**
   * Deactivates a font in the database/memory without mutating server font assets (T-406).
   */
  public static async deactivateFont(
    fontIdOrSlug: string
  ): Promise<{ id: string; name: string }> {
    const trimmed = fontIdOrSlug.trim();
    const catalogItem = this.findCatalogItem(trimmed);
    const dbFonts = await this.fetchDbFontsSafe();
    const dbFont = dbFonts?.find(
      (f) => f.id === trimmed || f.slug === trimmed
    );

    if (!catalogItem && !dbFont) {
      throw new FontNotFoundError(trimmed);
    }

    const id = catalogItem ? catalogItem.id : dbFont!.id;
    const name = catalogItem ? catalogItem.name : dbFont!.name;
    this.memoryEnabledState.set(id, false);
    if (dbFont) {
      this.memoryEnabledState.set(dbFont.id, false);
    }

    if (process.env.DATABASE_URL && Date.now() >= this.dbBackoffUntilMs) {
      try {
        if (dbFont) {
          await prisma.font.update({
            where: { id: dbFont.id },
            data: { enabled: false },
          });
        } else if (catalogItem && catalogItem.fileName) {
          await prisma.font.upsert({
            where: { fileName: catalogItem.fileName },
            update: { enabled: false },
            create: {
              slug: catalogItem.id,
              name: catalogItem.name,
              familyName: catalogItem.familyName,
              fileName: catalogItem.fileName,
              format: catalogItem.format,
              tradition: catalogItem.category,
              supportedScripts: catalogItem.supportedScripts,
              licenseType: catalogItem.license,
              licenseUrl: catalogItem.licenseUrl ?? null,
              commercialApproved: catalogItem.commercialApproved,
              printExportAllowed: catalogItem.printExportAllowed,
              webEmbedAllowed: catalogItem.webEmbedAllowed,
              licenseVerifiedAt: catalogItem.licenseVerifiedAt
                ? new Date(catalogItem.licenseVerifiedAt)
                : null,
              licenseVerifiedBy: catalogItem.licenseVerifiedBy ?? null,
              enabled: false,
            },
          });
        }
      } catch {
        this.dbBackoffUntilMs = Date.now() + 5_000;
      }
    }

    return { id, name };
  }

  /**
   * Resolves a font binary for web embedding (`/api/fonts/[id]`, R-107).
   * Serves bytes ONLY when `commercialApproved && printExportAllowed && webEmbedAllowed && enabled`.
   */
  public static async resolveWebEmbedFont(fontIdOrSlug: string): Promise<{
    entry: FontEntry;
    buffer: Buffer;
    mimeType: string;
  }> {
    const trimmed = fontIdOrSlug.trim();
    if (!trimmed) {
      throw new FontNotFoundError(fontIdOrSlug);
    }

    const allFonts = await this.getAllFonts({ includeBase64: false });
    const normalized = trimmed.toLowerCase();

    const matched = allFonts.find(
      (f) =>
        f.id.toLowerCase() === normalized ||
        (f.fileName && f.fileName.toLowerCase() === normalized) ||
        f.familyName.toLowerCase() === normalized ||
        f.aliases?.some((a) => a.toLowerCase() === normalized)
    );

    if (!matched) {
      if (isUnverifiedLegacyArchiveFile(trimmed)) {
        throw new FontLicenseError(
          trimmed,
          "Unverified legacy archive font is prohibited for web embedding"
        );
      }
      throw new FontNotFoundError(trimmed);
    }

    if (
      !matched.commercialApproved ||
      !matched.printExportAllowed ||
      !matched.webEmbedAllowed ||
      !matched.licenseVerifiedAt ||
      matched.isWebFont ||
      !matched.fileName
    ) {
      throw new FontLicenseError(
        matched.name,
        "Font is not licensed for self-hosted web embedding"
      );
    }

    if (!matched.isActiveOnFrontend) {
      if (!matched.isDownloaded) {
        throw new FontNotFoundError(matched.name);
      }
      throw new FontLicenseError(matched.name, "Font is disabled");
    }

    const buffer = this.readDiskFontBuffer(matched.fileName, matched.aliases);
    if (!buffer) {
      throw new FontNotFoundError(matched.name);
    }

    const mimeType =
      matched.format === "woff2"
        ? "font/woff2"
        : matched.format === "otf"
          ? "font/otf"
          : "font/ttf";

    return { entry: matched, buffer, mimeType };
  }

  /**
   * Resolves a print-licensed font's raw TTF/OTF Buffer from local server assets or cached storage.
   * Enforces TB-CALLI-008 licensing gate before returning any bytes for rendering.
   */
  public static async resolveFontBuffer(
    fontFamilyOrId: string,
    options?: { allowUnlicensedInspection?: boolean }
  ): Promise<Buffer> {
    const catalogItem = this.findCatalogItem(fontFamilyOrId);

    if (catalogItem) {
      if (!options?.allowUnlicensedInspection) {
        this.assertFontLicensedForPrint(catalogItem);
      }
      if (catalogItem.isWebFont || !catalogItem.fileName) {
        throw new FontLicenseError(
          catalogItem.name,
          "Web-only font has no server-exportable font file"
        );
      }
      const diskBuf = this.readDiskFontBuffer(
        catalogItem.fileName,
        catalogItem.aliases
      );
      if (diskBuf) {
        return diskBuf;
      }
      if (options?.allowUnlicensedInspection) {
        const quarantinedBuf = this.readQuarantinedFontBufferForInspection(
          catalogItem.fileName,
          catalogItem.aliases
        );
        if (quarantinedBuf) {
          return quarantinedBuf;
        }
      }
      throw new FontNotFoundError(catalogItem.name);
    }

    // Check DB Font table if not in static catalog
    const normalized = normalizeLookupKey(fontFamilyOrId);
    const dbFonts = await this.fetchDbFontsSafe();
    const dbMatch = dbFonts?.find(
      (f) =>
        f.id.toLowerCase() === normalized ||
        (f.slug && f.slug.toLowerCase() === normalized) ||
        f.name.toLowerCase() === normalized ||
        (f.familyName && f.familyName.toLowerCase() === normalized) ||
        f.fileName.toLowerCase() === normalized
    );

    if (dbMatch) {
      const entry = this.mapDbFontToEntry(dbMatch, false);
      if (!options?.allowUnlicensedInspection) {
        this.assertFontLicensedForPrint(entry);
      }
      const diskBuf = this.readDiskFontBuffer(dbMatch.fileName);
      if (diskBuf) {
        return diskBuf;
      }
      if (options?.allowUnlicensedInspection) {
        const quarantinedBuf = this.readQuarantinedFontBufferForInspection(
          dbMatch.fileName
        );
        if (quarantinedBuf) {
          return quarantinedBuf;
        }
      }
      throw new FontNotFoundError(dbMatch.name);
    }

    if (isUnverifiedLegacyArchiveFile(fontFamilyOrId)) {
      if (!options?.allowUnlicensedInspection) {
        throw new FontLicenseError(
          fontFamilyOrId,
          "Unverified legacy archive font is prohibited in print rendering"
        );
      }
      const rawBuf =
        this.readDiskFontBuffer(fontFamilyOrId) ??
        this.readQuarantinedFontBufferForInspection(fontFamilyOrId);
      if (rawBuf) return rawBuf;
    }

    throw new FontNotFoundError(fontFamilyOrId);
  }

  public static async parseOpenTypeFont(
    fontFamilyOrId: string,
    options?: { allowUnlicensedInspection?: boolean }
  ): Promise<OpenTypeFont> {
    const cacheKey = `${normalizeLookupKey(fontFamilyOrId)}:${Boolean(
      options?.allowUnlicensedInspection
    )}`;
    const cached = this.openTypeCache.get(cacheKey);
    if (cached) return cached;

    const buf = await this.resolveFontBuffer(fontFamilyOrId, options);
    const parsed = parseOpenTypeBuffer(buf);
    this.openTypeCache.set(cacheKey, parsed);
    return parsed;
  }

  /**
   * Verifies every non-control character in `text` maps to a real glyph (glyphIndex > 0)
   * using `@shuding/opentype.js` (TB-CALLI-003 / TB-CALLI-006 / T-407).
   */
  public static async hasGlyphCoverage(
    fontFamilyOrId: string,
    text: string,
    options?: { allowUnlicensedInspection?: boolean }
  ): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const font = await this.parseOpenTypeFont(fontFamilyOrId, options);
    for (const ch of Array.from(trimmed)) {
      if (/\s/.test(ch)) continue;
      if (font.charToGlyphIndex(ch) <= 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Preloads all active, print-licensed fonts on disk into the in-memory Buffer & OpenType caches.
   */
  public static async preloadActiveFonts(): Promise<{
    loaded: string[];
    skipped: string[];
  }> {
    const activeFonts = await this.getActiveFrontendFonts();
    const loaded: string[] = [];
    const skipped: string[] = [];

    for (const font of activeFonts) {
      if (font.isWebFont || !font.fileName) {
        skipped.push(font.id);
        continue;
      }
      try {
        await this.parseOpenTypeFont(font.id);
        loaded.push(font.id);
      } catch {
        skipped.push(font.id);
      }
    }

    return { loaded, skipped };
  }

  /**
   * Serverless-safe font ingestion (T-406, R-107):
   * - Never invokes `execSync` / `unzip` or writes to `src/` or `public/`.
   * - Verifies bundled `assets/fonts/` presence or fetches direct allowlisted TTF into memory / private Blob + Prisma `Font`.
   */
  public static async downloadFont(
    fontId: string
  ): Promise<{ success: boolean; message: string }> {
    const font = INITIAL_FONT_CATALOG.find((f) => f.id === fontId);
    if (!font) {
      return {
        success: false,
        message: `Font "${fontId}" not found in catalog`,
      };
    }

    if (!isFontLicensedForPrint(font)) {
      return {
        success: false,
        message: `Font "${font.name}" cannot be activated for commercial print (${font.license})`,
      };
    }

    // If already bundled in assets/fonts, preload into memory and mark active in DB
    const existingBuf = this.readDiskFontBuffer(font.fileName, font.aliases);
    if (existingBuf) {
      await this.toggleActive(font.id, true);
      return {
        success: true,
        message: `Verified bundled font "${font.name}" and enabled in registry`,
      };
    }

    if (!font.downloadUrl) {
      return {
        success: false,
        message: `Font "${font.name}" has no direct server download URL`,
      };
    }

    try {
      const parsedUrl = new URL(font.downloadUrl);
      if (
        parsedUrl.protocol !== "https:" ||
        !ALLOWED_FONT_DOWNLOAD_HOSTS.has(parsedUrl.hostname)
      ) {
        return {
          success: false,
          message: `Download host "${parsedUrl.hostname}" is not in the font allowlist`,
        };
      }

      const res = await fetch(parsedUrl.toString());
      if (!res.ok) {
        return {
          success: false,
          message: `Failed to fetch font (HTTP ${res.status})`,
        };
      }

      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length <= 1000) {
        return {
          success: false,
          message: "Downloaded font file was empty or invalid",
        };
      }

      // Verify valid OpenType/TrueType table before accepting
      parseOpenTypeBuffer(buf);
      this.bufferCache.set(font.fileName, buf);

      let storageKey: string | null = null;
      const blobToken =
        process.env.BLOB_READ_WRITE_TOKEN ||
        process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        const { put } = await import("@vercel/blob");
        const uploaded = await put(`fonts/${font.fileName}`, buf, {
          access: "private",
          addRandomSuffix: false,
          contentType: "font/ttf",
          token: blobToken,
        });
        storageKey = uploaded.url;
      }

      if (process.env.DATABASE_URL && Date.now() >= this.dbBackoffUntilMs) {
        try {
          await prisma.font.upsert({
            where: { fileName: font.fileName },
            update: {
              enabled: true,
              webEmbedAllowed: font.webEmbedAllowed,
              storageKey: storageKey ?? undefined,
            },
            create: {
              slug: font.id,
              name: font.name,
              familyName: font.familyName,
              fileName: font.fileName,
              format: font.format,
              tradition: font.category,
              supportedScripts: font.supportedScripts,
              licenseType: font.license,
              licenseUrl: font.licenseUrl ?? null,
              commercialApproved: font.commercialApproved,
              printExportAllowed: font.printExportAllowed,
              webEmbedAllowed: font.webEmbedAllowed,
              licenseVerifiedAt: font.licenseVerifiedAt
                ? new Date(font.licenseVerifiedAt)
                : null,
              licenseVerifiedBy: font.licenseVerifiedBy ?? null,
              storageKey,
              enabled: true,
            },
          });
        } catch {
          this.dbBackoffUntilMs = Date.now() + 5_000;
        }
      }

      this.memoryEnabledState.set(font.id, true);
      return {
        success: true,
        message: `Successfully ingested "${font.name}"`,
      };
    } catch {
      return {
        success: false,
        message: `Failed to ingest font "${font.name}"`,
      };
    }
  }

  public static async downloadMultipleFonts(fontIds: string[]): Promise<{
    results: { id: string; success: boolean; message: string }[];
    successCount: number;
    failureCount: number;
  }> {
    const results: { id: string; success: boolean; message: string }[] = [];
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
