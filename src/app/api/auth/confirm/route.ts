import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/studio";

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/auth/login?error=SessionError", request.url));
  }

  try {
    // Upsert the user into Prisma using the Supabase auth.users ID
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

    // Optionally create a CreatorProfile here if they don't have one
    // We'll skip this for now or handle it in the Studio onboarding page

    return NextResponse.redirect(new URL(callbackUrl, request.url));
  } catch (err) {
    console.error("Failed to sync user to Prisma:", err);
    return NextResponse.redirect(new URL("/auth/login?error=SyncError", request.url));
  }
}
