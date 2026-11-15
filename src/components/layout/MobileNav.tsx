"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Paintbrush, ImageIcon, ShoppingCart } from "lucide-react";

const TABS = [
  { href: "/", label: "Explore", icon: Home },
  { href: "/create", label: "Create", icon: Paintbrush },
  { href: "/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/cart", label: "Cart", icon: ShoppingCart },
];

export function MobileNav() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  if (isAdmin) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-stone-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const isHighlight = href === "/create";

          if (isHighlight) {
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
                aria-label={label}
              >
                <span className={`w-12 h-8 rounded-full flex items-center justify-center ${isActive ? "bg-[#B3261E]" : "bg-[#1b1c19]"}`}>
                  <Icon className="w-4 h-4 text-white" />
                </span>
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-[#B3261E]" : "text-[#1b1c19]"}`}>
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
              aria-label={label}
            >
              <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-[#B3261E]" : "text-stone-400"}`} />
              <span className={`text-[10px] font-medium tracking-wide transition-colors ${isActive ? "text-[#B3261E] font-semibold" : "text-stone-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
