import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { safeRedirectPath } from "@/lib/security/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const safeCallbackUrl = safeRedirectPath(
    searchParams.get("callbackUrl") ?? searchParams.get("next"),
    "/studio"
  );

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/auth/login?error=SessionError", origin));
  }

  try {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email || null,
        phoneNumber: user.phone || null,
      },
      create: {
        id: user.id,
        email: user.email || null,
        phoneNumber: user.phone || null,
      },
    });

    return NextResponse.redirect(new URL(safeCallbackUrl, origin));
  } catch (err: unknown) {
    console.error(
      "[AuthConfirm] Failed to sync user to Prisma:",
      err instanceof Error ? err.name : "UnknownError"
    );
    return NextResponse.redirect(new URL("/auth/login?error=SyncError", origin));
  }
}
