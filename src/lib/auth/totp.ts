/**
 * Time-based one-time codes for the admin's authenticator app (RFC 6238 over RFC 4226).
 * HMAC-SHA1, 30-second step, 6 digits: the settings every authenticator app supports.
 * Pure: node:crypto only, the clock is passed in.
 */
import crypto from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Accept the previous and the next step, for a phone clock that is a little off. */
export const TOTP_DRIFT_STEPS = 1;
export const TOTP_SECRET_BYTES = 20;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Decodes unpadded or padded base32, ignoring spaces and case. Returns null on any other character. */
export function base32Decode(text: string): Buffer | null {
  const clean = text.replace(/[\s=-]/g, "").toUpperCase();
  if (clean.length === 0) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): Buffer {
  return crypto.randomBytes(TOTP_SECRET_BYTES);
}

export function timeStepAt(nowMs: number, stepSeconds = TOTP_STEP_SECONDS): number {
  return Math.floor(nowMs / 1000 / stepSeconds);
}

/** RFC 4226 HOTP value for one counter. */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function totpAt(secret: Uint8Array, nowMs: number, digits = TOTP_DIGITS): string {
  return hotp(secret, timeStepAt(nowMs), digits);
}

export function normalizeTotpInput(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s/g, "");
  return new RegExp(`^[0-9]{${TOTP_DIGITS}}$`).test(clean) ? clean : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Returns the time step the code is valid for, or null. Every candidate step is compared, so
 * the time taken does not say which one matched. The caller must then check the step is newer
 * than the last one it accepted (a code may be used once).
 */
export function findMatchingTimeStep(
  secret: Uint8Array,
  rawCode: string,
  nowMs: number
): number | null {
  const code = normalizeTotpInput(rawCode);
  if (!code) return null;
  const current = timeStepAt(nowMs);
  let matched: number | null = null;
  for (let delta = -TOTP_DRIFT_STEPS; delta <= TOTP_DRIFT_STEPS; delta++) {
    const step = current + delta;
    if (step < 0) continue;
    if (constantTimeEqual(hotp(secret, step), code) && matched === null) {
      matched = step;
    }
  }
  return matched;
}

/** The address an authenticator app accepts for manual or QR set-up. */
export function buildOtpAuthUri(params: {
  secret: Uint8Array;
  accountName: string;
  issuer: string;
}): string {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.accountName)}`;
  const query = new URLSearchParams({
    secret: base32Encode(params.secret),
    issuer: params.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** The setup key as people type it: groups of four. */
export function formatSetupKey(secret: Uint8Array): string {
  return base32Encode(secret).replace(/(.{4})/g, "$1 ").trim();
}
