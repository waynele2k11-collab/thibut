/**
 * Single-use recovery codes for the admin, for when the authenticator app is lost.
 * Shown once at set-up; only a keyed hash is stored. Pure: node:crypto only.
 */
import crypto from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

/** No 0/O or 1/I/L, so a code survives being read off paper. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP_LENGTH = 5;
const GROUPS = 2;

export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateRecoveryCode());
  }
  return [...codes];
}

/** Upper-cases and removes spaces and dashes. Null when the text cannot be a recovery code. */
export function normalizeRecoveryCode(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length !== GROUP_LENGTH * GROUPS) return null;
  for (const char of clean) {
    if (!CODE_ALPHABET.includes(char)) return null;
  }
  return clean;
}

/**
 * Keyed hash stored in the database. The codes carry about 49 bits of randomness and the key
 * never leaves the server, so a copied table cannot be searched offline.
 */
export function hashRecoveryCode(normalizedCode: string, key: Uint8Array): string {
  return crypto.createHmac("sha256", key).update(`recovery:${normalizedCode}`).digest("hex");
}
