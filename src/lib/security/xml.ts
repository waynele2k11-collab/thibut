/**
 * Escapes untrusted text before embedding inside XML/SVG markup (T-411).
 * Isomorphic (safe on both client and server).
 */
export function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Deterministic FNV-1a 32-bit hex digest for stable SVG filter/gradient IDs (T-404, INV-013).
 * Produces identical output on SSR Node.js and browser clients without Math.random().
 */
export function deterministicUid(seed: string, prefix = "tb"): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${prefix}-${hex}`;
}
