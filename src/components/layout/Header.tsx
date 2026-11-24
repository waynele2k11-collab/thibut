import Link from "next/link";
import { ScrollText, Search, User } from "lucide-react";
import { CartBadge } from "./CartBadge";
import { HeaderNavClient, type NavLinkItem } from "./HeaderNavClient";

const NAV_LINKS: readonly NavLinkItem[] = [
  { href: "/personal", label: "Personal" },
  { href: "/business", label: "Business" },
  { href: "/living", label: "Living" },
  { href: "/verse-library", label: "Verse Library" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/business-partners", label: "Business Partners" },
];

export function Header() {
  return (
    <header className="bg-background top-0 border-b border-surface-variant sticky z-50">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-3 md:py-4 max-w-container-max mx-auto">
        <Link
          href="/"
          className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded"
        >
          Thi Bút
        </Link>

        <HeaderNavClient
          links={NAV_LINKS}
          actions={
            <>
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  href="/personal"
                  aria-label="Browse designs"
                  className="p-1.5 rounded text-primary hover:text-secondary transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  <Search className="w-5 h-5" aria-hidden="true" />
                </Link>
                <Link
                  href="/orders"
                  aria-label="Orders and downloads"
                  title="Orders & Downloads"
                  className="p-1.5 rounded text-primary hover:text-secondary transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  <ScrollText className="w-5 h-5" aria-hidden="true" />
                </Link>
                <CartBadge className="p-1.5" />
                <Link
                  href="/auth/login"
                  aria-label="Account"
                  className="p-1.5 rounded text-primary hover:text-secondary transition-colors duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  <User className="w-5 h-5" aria-hidden="true" />
                </Link>
              </div>
              <CartBadge className="md:hidden p-2" />
            </>
          }
        />
      </div>
    </header>
  );
}
