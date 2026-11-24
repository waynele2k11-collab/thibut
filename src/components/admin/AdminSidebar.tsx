"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Palette,
  Store,
  Type,
  Users,
  UserSquare2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Fonts", href: "/admin/fonts", icon: Type },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Sellers", href: "/admin/sellers", icon: UserSquare2 },
    { name: "Art", href: "/admin/art", icon: Palette },
    { name: "Presets", href: "/admin/background-presets", icon: ImageIcon },
    { name: "Calligraphy", href: "/admin/ai/calligraphy", icon: Palette },
    { name: "Knowledge", href: "/admin/knowledge", icon: BookOpen },
    { name: "Admin Studio", href: "/admin/studio", icon: Palette },
    { name: "Catalog", href: "/admin/catalog", icon: Store },
    { name: "Gallery", href: "/admin/gallery", icon: Store },
    { name: "Products", href: "/admin/products", icon: Store },
    { name: "Orders", href: "/admin/orders", icon: CreditCard },
    { name: "Finance", href: "/admin/finance", icon: CreditCard },
  ];

  return (
    <aside className="w-64 bg-surface-container-low border-r border-surface-variant flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6 border-b border-surface-variant">
        <Link
          href="/admin"
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
            (item.href === "/admin/catalog" && pathname.startsWith("/admin/catalog/"));

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

      <div className="p-4 border-t border-surface-variant">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors motion-reduce:transition-none rounded"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="font-label-caps text-label-caps uppercase">
            Log Out
          </span>
        </button>
      </div>
    </aside>
  );
}
