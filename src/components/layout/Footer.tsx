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
    <footer className="bg-tertiary-container text-on-tertiary border-t border-outline/30 mt-auto">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 pb-12 border-b border-outline/25">
          <div className="space-y-3 max-w-sm">
            <Link
              href="/"
              className="font-headline-sm text-headline-sm text-on-tertiary hover:opacity-90 transition-opacity motion-reduce:transition-none"
            >
              Thi Bút
            </Link>
            <p className="font-body-md text-body-md text-on-tertiary-container">
              Preserving the art of the brush. Elevating modern expression.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-6 gap-y-3 font-label-caps text-label-caps uppercase text-on-tertiary-container"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-on-tertiary transition-colors motion-reduce:transition-none relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-px after:bg-secondary hover:after:w-full after:transition-all motion-reduce:after:transition-none"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 font-label-caps text-label-caps text-on-tertiary-container">
          <p>© 2026 Thi Bút Marketplace. All rights reserved.</p>
          <p className="uppercase tracking-widest opacity-80">
            Meaning Before Strokes · 詩筆
          </p>
        </div>
      </div>
    </footer>
  );
}
