"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { CartBadge } from "./CartBadge";

const NAV_LINKS = [
  { href: "/", label: "Explore" },
  { href: "/create", label: "Create" },
  { href: "/gallery", label: "Gallery" },
  { href: "/how-it-works", label: "How It Works" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getLinkClass = (path: string) => {
    const isActive = path === "/" ? pathname === path : pathname.startsWith(path);
    return `font-label-caps text-label-caps uppercase transition-colors duration-300 ${
      isActive
        ? "text-primary font-bold border-b-2 border-secondary"
        : "text-on-surface-variant font-medium hover:text-secondary border-b-2 border-transparent"
    }`;
  };

  return (
    <>
      <nav className="bg-background docked full-width top-0 border-b border-surface-variant relative z-50">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          {/* Brand Logo */}
          <Link href="/" className="font-display-lg text-headline-md md:text-display-lg text-primary flex-shrink-0">
            Thi Bút
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex space-x-8 items-center flex-grow justify-center">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={getLinkClass(href)}>
                {label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Desktop icons */}
            <div className="hidden md:flex space-x-4">
              <Link href="/gallery" aria-label="Search" className="hover:text-secondary transition-colors duration-300 scale-95 hover:scale-100">
                <Search className="w-5 h-5 text-primary hover:text-secondary" />
              </Link>
              <CartBadge />
              <Link href="/auth/login" aria-label="Account" className="hover:text-secondary transition-colors duration-300 scale-95 hover:scale-100">
                <User className="w-5 h-5 text-primary hover:text-secondary" />
              </Link>
            </div>

            {/* Mobile: Cart icon + Hamburger */}
            <CartBadge className="md:hidden p-1" />
            <button
              className="md:hidden p-1 text-primary"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Drawer Panel */}
          <div
            className="absolute top-0 right-0 h-full w-72 bg-[#FBF9F4] shadow-2xl flex flex-col pt-20 pb-8 px-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 mb-6">
              Navigation
            </p>
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`py-3 px-4 rounded-xl text-base font-medium transition-all ${
                      isActive
                        ? "bg-[#F4EFE6] text-[#B3261E] font-bold"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 py-3 px-4 rounded-xl text-sm text-stone-600 hover:bg-stone-100"
              >
                <User className="w-4 h-4" /> My Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
