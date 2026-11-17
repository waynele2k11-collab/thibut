import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import {
  DEVICE_TRUST_COOKIE,
  verifyDeviceTrustToken,
} from "@/lib/security/tokens";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const rawDeviceTrust = cookieStore.get(DEVICE_TRUST_COOKIE)?.value;
    const verifiedDevice = await verifyDeviceTrustToken(rawDeviceTrust, user.id);

    if (verifiedDevice) {
      return NextResponse.json({ status: "trusted" });
    }

    try {
      enforceRateLimit({
        bucket: "device-pin-generate",
        key: user.id,
        limit: 3,
        windowMs: 10 * 60_000,
      });
    } catch (rateErr: unknown) {
      if (rateErr instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Too many verification requests. Please wait before trying again." },
          {
            status: 429,
            headers: { "Retry-After": String(rateErr.retryAfterSeconds) },
          }
        );
      }
      throw rateErr;
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser && user.email) {
      dbUser = await prisma.user.findUnique({ where: { email: user.email } });
    }
    if (!dbUser && user.email) {
      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "Creator";
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: metadataName,
        },
      });
    }

    if (!dbUser) {
      return NextResponse.json(
        { error: "Account synchronization required" },
        { status: 500 }
      );
    }

    // Invalidate any prior unverified PINs for this user before issuing a new one
    await prisma.deviceVerification.deleteMany({
      where: {
        userId: dbUser.id,
        verified: false,
      },
    });

    await prisma.deviceVerification.create({
      data: {
        userId: dbUser.id,
        code,
        attempts: 0,
        expiresAt,
      },
    });

    const isProd = process.env.NODE_ENV === "production";

    if (process.env.RESEND_API_KEY && user.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error: resendError } = await resend.emails.send({
          from: "Thi Bút <noreply@thibut.com>",
          to: [user.email],
          subject: "Your Device Verification Code",
          html: `<p>Your 6-digit verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
        });

        if (resendError) {
          console.warn("[Auth] Resend delivery failed");
          if (isProd) {
            return NextResponse.json(
              { error: "Unable to deliver verification code" },
              { status: 502 }
            );
          }
        }
      } catch {
        console.warn("[Auth] Email provider exception");
        if (isProd) {
          return NextResponse.json(
            { error: "Unable to deliver verification code" },
            { status: 502 }
          );
        }
      }
    } else if (isProd) {
      console.error("[Auth] RESEND_API_KEY not configured in production");
      return NextResponse.json(
        { error: "Verification delivery service unavailable" },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "requires_pin" });
  } catch (error: unknown) {
    console.error(
      "[Auth] Device check error:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
