/**
 * Admin password hashing (scrypt, node:crypto). Pure: no database, no request, no environment.
 *
 * Stored form: `scrypt:N:r:p:<salt base64url>:<hash base64url>`. Colons, not `$`, so the value
 * survives env loaders that expand `$NAME`.
 */
import crypto from "node:crypto";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** OWASP-recommended interactive cost: N = 2^17, r = 8, p = 1 (about 128 MB per check). */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 131072, r: 8, p: 1 };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** Node refuses scrypt above its maxmem; we raise maxmem to exactly what the parameters need. */
const MAX_SCRYPT_MEMORY_BYTES = 256 * 1024 * 1024;

function scryptMemoryBytes(params: ScryptParams): number {
  return 128 * params.N * params.r;
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0;
}

function areParamsAcceptable(params: ScryptParams): boolean {
  return (
    isPowerOfTwo(params.N) &&
    params.N >= 16384 &&
    Number.isInteger(params.r) &&
    params.r >= 8 &&
    params.r <= 32 &&
    Number.isInteger(params.p) &&
    params.p >= 1 &&
    params.p <= 4 &&
    scryptMemoryBytes(params) <= MAX_SCRYPT_MEMORY_BYTES
  );
}

function scrypt(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: params.N, r: params.r, p: params.p, maxmem: scryptMemoryBytes(params) + 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

export function isAcceptablePassword(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<string> {
  if (!isAcceptablePassword(password)) {
    throw new Error(
      `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`
    );
  }
  if (!areParamsAcceptable(params)) {
    throw new Error("Unsupported scrypt parameters");
  }
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join(":");
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
}

export function parsePasswordHash(encoded: string | null | undefined): ParsedHash | null {
  if (typeof encoded !== "string") return null;
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  if (![rawN, rawR, rawP].every((v) => /^[0-9]{1,7}$/.test(v))) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(rawSalt) || !/^[A-Za-z0-9_-]+$/.test(rawKey)) return null;
  const params: ScryptParams = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!areParamsAcceptable(params)) return null;
  const salt = Buffer.from(rawSalt, "base64url");
  const key = Buffer.from(rawKey, "base64url");
  if (salt.length !== SALT_LENGTH || key.length !== KEY_LENGTH) return null;
  return { params, salt, key };
}

/**
 * A random salt nobody stores a hash for. Running scrypt against it costs the same as a real
 * check, so "no such admin" and "wrong password" take the same time.
 */
const DUMMY_SALT = crypto.randomBytes(SALT_LENGTH);

/**
 * Constant-time password check. A missing or malformed stored hash still runs one full scrypt
 * and returns false.
 */
export async function verifyPassword(
  password: string,
  encoded: string | null | undefined
): Promise<boolean> {
  const candidate =
    typeof password === "string" && password.length <= PASSWORD_MAX_LENGTH ? password : "";
  const parsed = parsePasswordHash(encoded);
  if (!parsed) {
    await scrypt(candidate, DUMMY_SALT, DEFAULT_SCRYPT_PARAMS);
    return false;
  }
  const derived = await scrypt(candidate, parsed.salt, parsed.params);
  const matches = crypto.timingSafeEqual(derived, parsed.key);
  return matches && candidate.length > 0 && candidate === password;
}
