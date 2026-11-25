/**
 * Encrypts small secrets at rest (the admin's authenticator secret) with AES-256-GCM.
 * Keys are derived from ADMIN_SESSION_SECRET, each for one purpose. Pure: the secret is passed in.
 */
import crypto from "node:crypto";

export const ADMIN_SECRET_MIN_LENGTH = 32;

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

export type AdminKeyPurpose = "totp-secret" | "recovery-codes" | "address-hash";

/** One independent 256-bit key per purpose, so no key is used for two jobs. */
export function deriveAdminKey(masterSecret: string, purpose: AdminKeyPurpose): Buffer {
  // The trimmed value is the secret everywhere (here, the length checks and the token signer),
  // so a stray space or line break in one settings file cannot make the stored authenticator
  // secret unreadable.
  const secret = typeof masterSecret === "string" ? masterSecret.trim() : "";
  if (secret.length < ADMIN_SECRET_MIN_LENGTH) {
    throw new Error("ADMIN_SESSION_SECRET is missing or shorter than 32 characters");
  }
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("thibut-admin-sign-in", "utf8"),
      Buffer.from(purpose, "utf8"),
      32
    )
  );
}

export function sealSecret(plain: Uint8Array, key: Uint8Array): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

/** Null when the text is malformed, was sealed with another key, or was altered. */
export function openSecret(sealed: string | null | undefined, key: Uint8Array): Buffer | null {
  if (typeof sealed !== "string") return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const body = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH || body.length === 0) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    return null;
  }
}
