"use client";

import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LogOut,
  Palette,
  Store,
  Type,
  Users,
  UserSquare2,
} from "lucide-react";
import { signOutAction, signOutEverywhereAction } from "@/app/adm/admin/(sign-in)/login/actions";

export function AdminSidebar() {
  const pathname = usePathname();
  const navItems = [
    { name: "Dashboard", href: adminPath(), icon: LayoutDashboard },
    { name: "Fonts", href: adminPath("/fonts"), icon: Type },
    { name: "Users", href: adminPath("/users"), icon: Users },
    { name: "Sellers", href: adminPath("/sellers"), icon: UserSquare2 },
    { name: "Art", href: adminPath("/art"), icon: Palette },
    { name: "Presets", href: adminPath("/background-presets"), icon: ImageIcon },
    { name: "Calligraphy", href: adminPath("/ai/calligraphy"), icon: Palette },
    { name: "Knowledge", href: adminPath("/knowledge"), icon: BookOpen },
    { name: "Admin Studio", href: adminPath("/studio"), icon: Palette },
    { name: "Keepsake Editor", href: adminPath("/keepsake-editor"), icon: Layers },
    { name: "Catalog", href: adminPath("/catalog"), icon: Store },
    { name: "Gallery", href: adminPath("/gallery"), icon: Store },
    { name: "Products", href: adminPath("/products"), icon: Store },
    { name: "Orders", href: adminPath("/orders"), icon: CreditCard },
    { name: "Finance", href: adminPath("/finance"), icon: CreditCard },
  ];

  return (
    <aside className="w-64 bg-surface-container-low border-r border-surface-variant flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6 border-b border-surface-variant">
        <Link
          href={adminPath()}
          className="font-headline-sm text-xl tracking-wide text-primary"
        >
          THI BÚT <span className="text-secondary">ADMIN</span>
        </Link>
      </div>

      <nav aria-label="Admin" className="flex-1 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href === adminPath("/catalog") && pathname.startsWith(adminPath("/catalog/")));

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-6 py-3 transition-colors motion-reduce:transition-none ${
                isActive
                  ? "bg-surface-container-high text-secondary border-r-2 border-secondary font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-primary"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="font-label-caps text-label-caps uppercase">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-surface-variant flex flex-col gap-1">
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors motion-reduce:transition-none rounded"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span className="font-label-caps text-label-caps uppercase">
              Log Out
            </span>
          </button>
        </form>
        <form action={signOutEverywhereAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors motion-reduce:transition-none rounded"
          >
            <span className="font-label-caps text-label-caps uppercase">
              Sign out everywhere
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}
