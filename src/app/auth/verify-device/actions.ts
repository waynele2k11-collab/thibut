"use server";

import crypto from "node:crypto";
import * as nextHeaders from "next/headers";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import {
  DEVICE_TRUST_COOKIE,
  signDeviceTrustToken,
  timingSafeEqualString,
} from "@/lib/security/tokens";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";

const DevicePinSchema = z.string().trim().regex(/^\d{6}$/, "Invalid or expired PIN");
const MAX_PIN_ATTEMPTS = 5;
const DEVICE_TRUST_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function safeReadRequestHeaders(): Promise<Headers> {
  const maybeHeaders = (
    nextHeaders as { headers?: () => Promise<Headers> | Headers }
  ).headers;
  if (typeof maybeHeaders === "function") {
    try {
      return await maybeHeaders();
    } catch {
      return new Headers();
    }
  }
  return new Headers();
}

export async function verifyDevicePin(
  pin: string
): Promise<{ success: boolean; error?: string }> {
  const parsedPin = DevicePinSchema.safeParse(pin);
  if (!parsedPin.success) {
    return { success: false, error: "Invalid or expired PIN" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const reqHeaders = await safeReadRequestHeaders();
    const clientIp = getClientIpFromHeaders(reqHeaders, user.id);

    await enforceDistributedRateLimit({
      bucket: "device-pin-verify-ip",
      key: clientIp,
      limit: 20,
      windowMs: 10 * 60_000,
    });

    await enforceDistributedRateLimit({
      bucket: "device-pin-verify",
      key: user.id,
      limit: 10,
      windowMs: 10 * 60_000,
    });
  } catch (rateErr: unknown) {
    if (rateErr instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many verification attempts. Please wait before trying again.",
      };
    }
    return { success: false, error: "Verification failed" };
  }

  let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser && user.email) {
    dbUser = await prisma.user.findUnique({ where: { email: user.email } });
  }

  if (!dbUser) {
    return { success: false, error: "Invalid or expired PIN" };
  }

  const verification = await prisma.deviceVerification.findFirst({
    where: {
      userId: dbUser.id,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    return { success: false, error: "Invalid or expired PIN" };
  }

  if (verification.attempts >= MAX_PIN_ATTEMPTS) {
    await prisma.deviceVerification.delete({ where: { id: verification.id } });
    return {
      success: false,
      error: "Too many failed attempts. Please request a new PIN.",
    };
  }

  if (!timingSafeEqualString(verification.code, parsedPin.data)) {
    const nextAttempts = verification.attempts + 1;
    if (nextAttempts >= MAX_PIN_ATTEMPTS) {
      await prisma.deviceVerification.delete({ where: { id: verification.id } });
      return {
        success: false,
        error: "Too many failed attempts. Please request a new PIN.",
      };
    }

    await prisma.deviceVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    return { success: false, error: "Invalid or expired PIN" };
  }

  try {
    const deviceId = crypto.randomUUID();
    const token = await signDeviceTrustToken(
      { userId: user.id, deviceId },
      DEVICE_TRUST_TTL_SECONDS
    );

    await prisma.deviceVerification.update({
      where: { id: verification.id },
      data: { verified: true, deviceId },
    });

    const cookieStore = await nextHeaders.cookies();
    cookieStore.delete("device_trust");
    cookieStore.set(DEVICE_TRUST_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: DEVICE_TRUST_TTL_SECONDS,
      path: "/",
    });

    return { success: true };
  } catch (err: unknown) {
    console.error(
      "[VerifyDevice] Failed to issue device trust token:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return { success: false, error: "Device verification unavailable" };
  }
}
