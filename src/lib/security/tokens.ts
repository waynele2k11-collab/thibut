import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export class SecurityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityConfigError";
  }
}

export class TokenVerificationError extends Error {
  constructor(message = "Invalid or expired token") {
    super(message);
    this.name = "TokenVerificationError";
  }
}

const ISSUER = "thibut";

function requireSecret(envName: string): Uint8Array {
  const raw = process.env[envName];
  if (!raw || raw.trim().length < 16) {
    throw new SecurityConfigError(
      `Missing or weak required secret environment variable: ${envName}`
    );
  }
  return new TextEncoder().encode(raw);
}

let devAnonFallbackSecret: Uint8Array | null = null;
function getAnonSessionSecret(): Uint8Array {
  const raw = process.env.ANON_SESSION_SECRET;
  if (raw && raw.trim().length >= 16) {
    return new TextEncoder().encode(raw);
  }
  if (process.env.NODE_ENV === "production") {
    throw new SecurityConfigError(
      "Missing required secret environment variable: ANON_SESSION_SECRET"
    );
  }
  if (!devAnonFallbackSecret) {
    devAnonFallbackSecret = crypto.randomBytes(32);
  }
  return devAnonFallbackSecret;
}

export const ADMIN_STEPUP_COOKIE = "tb_admin_stepup";
export const DEVICE_TRUST_COOKIE = "tb_device_trust";
export const ANON_SESSION_COOKIE = "tb_anon_session";

export async function signAdminStepUpToken(
  userId: string,
  ttlSeconds = 60 * 60 * 8
): Promise<string> {
  const secret = requireSecret("ADMIN_SESSION_SECRET");
  return new SignJWT({ purpose: "admin_stepup" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyAdminStepUpToken(
  token: string | undefined | null,
  expectedUserId: string
): Promise<boolean> {
  if (!token) return false;
  const secret = requireSecret("ADMIN_SESSION_SECRET");
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    return payload.purpose === "admin_stepup" && payload.sub === expectedUserId;
  } catch {
    return false;
  }
}

export interface DeviceTrustClaims {
  userId: string;
  deviceId: string;
}

export async function signDeviceTrustToken(
  claims: DeviceTrustClaims,
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<string> {
  const secret = requireSecret("DEVICE_TRUST_SECRET");
  return new SignJWT({
    purpose: "device_trust",
    deviceId: claims.deviceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyDeviceTrustToken(
  token: string | undefined | null,
  expectedUserId: string
): Promise<DeviceTrustClaims | null> {
  if (!token) return null;
  let secret: Uint8Array;
  try {
    secret = requireSecret("DEVICE_TRUST_SECRET");
  } catch {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (
      payload.purpose !== "device_trust" ||
      payload.sub !== expectedUserId ||
      typeof payload.deviceId !== "string" ||
      !payload.deviceId
    ) {
      return null;
    }
    return { userId: payload.sub, deviceId: payload.deviceId };
  } catch {
    return null;
  }
}

export interface DownloadTokenClaims {
  orderItemId: string;
  orderId: string;
}

export async function signDownloadToken(
  claims: DownloadTokenClaims,
  ttlSeconds = 60 * 60 * 24 * 20
): Promise<string> {
  const secret = requireSecret("DOWNLOAD_TOKEN_SECRET");
  return new SignJWT({
    purpose: "digital_download",
    orderItemId: claims.orderItemId,
    orderId: claims.orderId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(claims.orderItemId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
}

export async function verifyDownloadToken(
  token: string | undefined | null
): Promise<DownloadTokenClaims> {
  if (!token) {
    throw new TokenVerificationError("Missing download token");
  }
  const secret = requireSecret("DOWNLOAD_TOKEN_SECRET");
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (
      payload.purpose !== "digital_download" ||
      typeof payload.orderItemId !== "string" ||
      typeof payload.orderId !== "string"
    ) {
      throw new TokenVerificationError("Invalid download token claims");
    }
    return {
      orderItemId: payload.orderItemId,
      orderId: payload.orderId,
    };
  } catch (err) {
    if (err instanceof TokenVerificationError || err instanceof SecurityConfigError) {
      throw err;
    }
    throw new TokenVerificationError("Invalid or expired download token");
  }
}

export async function signAnonSessionToken(
  anonId: string = crypto.randomUUID(),
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<{ anonId: string; token: string }> {
  const secret = getAnonSessionSecret();
  const token = await new SignJWT({ purpose: "anon_session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(anonId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secret);
  return { anonId, token };
}

export async function verifyAnonSessionToken(
  token: string | undefined | null
): Promise<string | null> {
  if (!token) return null;
  const secret = getAnonSessionSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      algorithms: ["HS256"],
    });
    if (payload.purpose !== "anon_session" || typeof payload.sub !== "string") {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

export function computeHmacSha256Hex(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function verifyHmacSha256(
  payload: string,
  signatureHex: string | null | undefined,
  secretEnvName: string
): boolean {
  if (!signatureHex) return false;
  const rawSecret = process.env[secretEnvName];
  if (!rawSecret || rawSecret.trim().length < 16) {
    throw new SecurityConfigError(
      `Missing or weak required secret environment variable: ${secretEnvName}`
    );
  }
  const cleanSig = signatureHex.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(cleanSig)) {
    return false;
  }
  const expected = Buffer.from(computeHmacSha256Hex(payload, rawSecret), "hex");
  const actual = Buffer.from(cleanSig, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
