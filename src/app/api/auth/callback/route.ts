import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { safeRedirectPath } from "@/lib/security/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const safeNext = safeRedirectPath(
    searchParams.get("next") ?? searchParams.get("callbackUrl"),
    "/studio"
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/login?error=InvalidToken", origin));
}
