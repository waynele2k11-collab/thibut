import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const deviceTrust = cookieStore.get("device_trust")?.value;

    if (deviceTrust === "verified") {
      return NextResponse.json({ status: "trusted" });
    }

    // Generate a new 6 digit PIN
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Make sure user exists in Prisma
    let dbUser = await prisma.user.findUnique({ where: { email: user.email || "" } });
    if (!dbUser && user.email) {
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || "Creator",
        }
      });
    }

    if (!dbUser) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (prisma.deviceVerification) {
      await prisma.deviceVerification.create({
        data: {
          userId: dbUser.id,
          code,
          expiresAt,
        }
      });
    } else {
      await prisma.$executeRaw`
        INSERT INTO "DeviceVerification" ("id", "userId", "code", "expiresAt", "verified", "createdAt")
        VALUES (gen_random_uuid()::text, ${dbUser.id}, ${code}, ${expiresAt}, false, NOW())
      `;
    }

    // Send Email via Resend with graceful fallback
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
          console.warn("Resend API notice:", resendError);
          console.log(`\n========================================\n[AUTH PIN] Code for ${user.email}: ${code}\n========================================\n`);
        }
      } catch (emailErr) {
        console.warn("Email send exception:", emailErr);
        console.log(`\n========================================\n[AUTH PIN] Code for ${user.email}: ${code}\n========================================\n`);
      }
    } else {
      console.log(`\n========================================\n[AUTH PIN] Code for ${user.email}: ${code}\n========================================\n`);
    }

    return NextResponse.json({ status: "requires_pin" });
  } catch (error: any) {
    console.error("Device check error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
