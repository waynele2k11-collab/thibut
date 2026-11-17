"use server";

import * as nextHeaders from "next/headers";
import { z } from "zod";
import { requireAdmin } from "@/utils/admin/auth";
import {
  ADMIN_STEPUP_COOKIE,
  signAdminStepUpToken,
  timingSafeEqualString,
} from "@/lib/security/tokens";
import {
  enforceDistributedRateLimit,
  getClientIpFromHeaders,
  RateLimitError,
} from "@/lib/security/rate-limit";

const MasterPasswordSchema = z.string().min(1).max(512);
const STEPUP_TTL_SECONDS = 60 * 60 * 8; // 8 hours

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

export async function verifyMasterPassword(
  password: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin({ allowBeforeStepUp: true });

  try {
    const reqHeaders = await safeReadRequestHeaders();
    const clientIp = getClientIpFromHeaders(reqHeaders, admin.id);

    await enforceDistributedRateLimit({
      bucket: "admin-stepup-ip",
      key: clientIp,
      limit: 10,
      windowMs: 15 * 60_000,
    });

    await enforceDistributedRateLimit({
      bucket: "admin-stepup",
      key: admin.id,
      limit: 5,
      windowMs: 15 * 60_000,
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many verification attempts. Please try again later.",
      };
    }
    return { success: false, error: "Invalid credentials" };
  }

  const parsed = MasterPasswordSchema.safeParse(password);
  if (!parsed.success) {
    return { success: false, error: "Invalid credentials" };
  }

  const masterPassword = process.env.ADMIN_MASTER_PASSWORD;
  if (!masterPassword) {
    timingSafeEqualString(parsed.data, "unconfigured-admin-stepup-sentinel-value");
    return { success: false, error: "Invalid credentials" };
  }

  if (!timingSafeEqualString(parsed.data, masterPassword)) {
    return { success: false, error: "Invalid credentials" };
  }

  try {
    const token = await signAdminStepUpToken(admin.id, STEPUP_TTL_SECONDS);
    const cookieStore = await nextHeaders.cookies();

    // Remove legacy forgeable plaintext cookie if present
    cookieStore.delete("admin_master_pwd_verified");

    cookieStore.set(ADMIN_STEPUP_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STEPUP_TTL_SECONDS,
      path: "/",
    });

    return { success: true };
  } catch (error: unknown) {
    console.error(
      "[AdminVerify] Step-up token issuance failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { success: false, error: "Invalid credentials" };
  }
}
