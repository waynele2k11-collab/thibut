import Link from "next/link";

export function Footer() {
  const links = [
    { label: "Cultural Guide", href: "/cultural-guide" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Licensing", href: "/licensing" },
    { label: "Artists", href: "/artists" },
    { label: "Legal", href: "/legal" },
    { label: "Terms", href: "/terms" },
    { label: "Support", href: "/support" },
  ];

  return (
    <footer className="bg-[#0B0B0B] text-[#F6F1E7] border-t border-[#222222] mt-auto">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pb-12 border-b border-[#222222]">
          {/* Brand Identity */}
          <div className="space-y-3 max-w-sm">
            <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-[#F6F1E7] hover:opacity-90 transition-opacity">
              Thi Bút
            </Link>
            <p className="text-[#A8A399] text-sm leading-relaxed">
              Preserving the art of the brush. Elevating modern expression.
            </p>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-xs uppercase tracking-widest text-[#A8A399]">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-[#F6F1E7] transition-colors relative after:content-[''] after:absolute after:bottom-[-2px] after:left-0 after:w-0 after:h-[1px] after:bg-[#B3261E] hover:after:w-full after:transition-all"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom Metadata & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-[#666666] tracking-wider">
          <p>© 2026 Thi Bút Marketplace. All rights reserved.</p>
          <p className="uppercase tracking-widest text-[10px] text-[#A8A399]/60">
            Meaning Before Strokes · 詩筆
          </p>
        </div>
      </div>
    </footer>
  );
}
