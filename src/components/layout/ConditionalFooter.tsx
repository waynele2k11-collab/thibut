"use client";

import { adminPath } from "@/lib/admin-path";
import { usePathname } from "next/navigation";

export function ConditionalFooter({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDedicatedStudioRoute =
    pathname === "/create" ||
    pathname.startsWith("/create/") ||
    pathname.startsWith(adminPath("/studio"));

  if (isDedicatedStudioRoute) {
    return null;
  }

  return <>{children}</>;
}
