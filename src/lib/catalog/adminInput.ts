/**
 * Pure parsers for catalog administration forms. Kept free of database and framework
 * imports so they can be unit tested directly.
 */

const MULTIPLIER_PATTERN = /^([1-3])(?:\.(\d{1,4}))?$/;

/** "1.6" -> 16000, "2" -> 20000. Integer arithmetic only; null when invalid or outside 1.0-3.0. */
export function parseMultiplierToBps(raw: string): number | null {
  const match = MULTIPLIER_PATTERN.exec(raw.trim());
  if (!match) return null;
  const whole = Number.parseInt(match[1], 10);
  const fraction = Number.parseInt((match[2] ?? "").padEnd(4, "0") || "0", 10);
  const bps = whole * 10000 + fraction;
  return bps >= 10000 && bps <= 30000 ? bps : null;
}

/** 16000 -> "1.6", 20000 -> "2". */
export function bpsToMultiplierInput(bps: number): string {
  const whole = Math.trunc(bps / 10000);
  const fraction = String(bps % 10000).padStart(4, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_PATTERN.test(slug);
}

/**
 * Catalog images are site-relative paths (files under /public). One per line.
 * Absolute URLs, protocol-relative URLs, traversal and whitespace are rejected.
 */
export function parseCatalogImagePaths(raw: string): string[] | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0 || lines.length > 8) return null;
  for (const line of lines) {
    if (!/^\/[A-Za-z0-9._\-/]+\.(?:webp|png|jpe?g|avif)$/i.test(line)) return null;
    if (line.startsWith("//") || line.includes("..")) return null;
  }
  return [...new Set(lines)];
}

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "QUOTE_ONLY", "INACTIVE"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ADMIN_FULFILLMENT_STATUSES = [
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
] as const;
export type AdminFulfillmentStatus = (typeof ADMIN_FULFILLMENT_STATUSES)[number];
