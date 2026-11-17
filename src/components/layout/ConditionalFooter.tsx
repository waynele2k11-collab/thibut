"use client";

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
    pathname.startsWith("/admin/studio");

  if (isDedicatedStudioRoute) {
    return null;
  }

  return <>{children}</>;
}
