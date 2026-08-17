"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyDevicePin(pin: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, error: "Unauthorized" };
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email || "" } });
  
  if (!dbUser) {
    return { success: false, error: "User not found in DB" };
  }

  // Find the most recent active code
  let verification: { id: string; code: string } | null = null;

  if (prisma.deviceVerification) {
    verification = await prisma.deviceVerification.findFirst({
      where: { 
        userId: dbUser.id, 
        verified: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });
  } else {
    const records: any[] = await prisma.$queryRaw`
      SELECT "id", "code" FROM "DeviceVerification"
      WHERE "userId" = ${dbUser.id} AND "verified" = false AND "expiresAt" > NOW()
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    verification = records[0] || null;
  }

  if (!verification || verification.code !== pin) {
    return { success: false, error: "Invalid or expired PIN" };
  }

  // Mark verified
  if (prisma.deviceVerification) {
    await prisma.deviceVerification.update({
      where: { id: verification.id },
      data: { verified: true }
    });
  } else {
    await prisma.$executeRaw`
      UPDATE "DeviceVerification" SET "verified" = true WHERE "id" = ${verification.id}
    `;
  }

  // Set 14-day trust cookie
  const cookieStore = await cookies();
  cookieStore.set("device_trust", "verified", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14, // 14 days
    path: "/",
  });

  return { success: true };
}
