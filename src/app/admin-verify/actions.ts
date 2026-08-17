"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyMasterPassword(password: string) {
  const masterPassword = process.env.ADMIN_MASTER_PASSWORD;

  if (!masterPassword) {
    return { success: false, error: "ADMIN_MASTER_PASSWORD is not configured in .env" };
  }

  if (password === masterPassword) {
    const cookieStore = await cookies();
    cookieStore.set("admin_master_pwd_verified", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });
    return { success: true };
  }

  return { success: false, error: "Incorrect password" };
}
