"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ShoppingCart, User } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  const getLinkClass = (path: string) => {
    // Exact match for home, or starts with path for others (e.g., /create)
    const isActive = path === "/" ? pathname === path : pathname.startsWith(path);
    
    return `font-label-caps text-label-caps uppercase transition-colors duration-300 ${
      isActive 
        ? "text-primary font-bold border-b-2 border-secondary" 
        : "text-on-surface-variant font-medium hover:text-secondary border-b-2 border-transparent"
    }`;
  };
  return (
    <nav className="bg-background docked full-width top-0 border-b border-surface-variant relative z-50">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
        {/* Brand Logo */}
        <Link href="/" className="font-display-lg text-headline-md md:text-display-lg text-primary flex-shrink-0">
          Thi Bút
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex space-x-8 items-center flex-grow justify-center">
          <Link href="/" className={getLinkClass("/")}>
            Explore
          </Link>
          <Link href="/create" className={getLinkClass("/create")}>
            Create
          </Link>
          <Link href="/gallery" className={getLinkClass("/gallery")}>
            Gallery
          </Link>
          <Link href="/about" className={getLinkClass("/about")}>
            About
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-6 flex-shrink-0">
          <div className="flex space-x-4">
            <Link href="/gallery" aria-label="Search" className="hover:text-secondary transition-colors duration-300 scale-95 hover:scale-100">
              <Search className="w-5 h-5 text-primary hover:text-secondary" />
            </Link>
            <Link href="/cart" aria-label="Cart" className="hover:text-secondary transition-colors duration-300 scale-95 hover:scale-100">
              <ShoppingCart className="w-5 h-5 text-primary hover:text-secondary" />
            </Link>
            <Link href="/auth/login" aria-label="person" className="hover:text-secondary transition-colors duration-300 scale-95 hover:scale-100">
              <User className="w-5 h-5 text-primary hover:text-secondary" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
