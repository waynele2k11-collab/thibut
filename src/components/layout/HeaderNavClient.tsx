"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, X } from "lucide-react";

export interface NavLinkItem {
  href: string;
  label: string;
}

const DEFAULT_NAV_LINKS: readonly NavLinkItem[] = [
  { href: "/", label: "Explore" },
  { href: "/create", label: "Create" },
  { href: "/gallery", label: "Gallery" },
  { href: "/how-it-works", label: "How It Works" },
];

export interface HeaderNavClientProps {
  links?: readonly NavLinkItem[];
  actions?: React.ReactNode;
}

export function HeaderNavClient({
  links = DEFAULT_NAV_LINKS,
  actions,
}: HeaderNavClientProps) {
  const pathname = usePathname();
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isRouteActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const openDrawer = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    setMobileOpen(true);
  };

  const closeDrawer = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      setMobileOpen(false);
    }
  };

  const handleToggle = () => {
    if (mobileOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  const handleDialogClose = () => {
    setMobileOpen(false);
    toggleButtonRef.current?.focus();
  };

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    if (typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype) {
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const isInsideDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isInsideDialog) {
      dialog.close();
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  }, [pathname]);

  const dialogClosedByAttr: Record<string, string> = { closedby: "any" };

  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden md:flex space-x-8 items-center grow justify-center"
      >
        {links.map(({ href, label }) => {
          const active = isRouteActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`font-label-caps text-label-caps uppercase py-1 transition-colors duration-300 motion-reduce:transition-none border-b-2 ${
                active
                  ? "text-primary font-bold border-secondary"
                  : "text-on-surface-variant hover:text-secondary border-transparent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <button
          ref={toggleButtonRef}
          type="button"
          className="md:hidden p-2 rounded text-primary hover:text-secondary hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls={dialogId}
          onClick={handleToggle}
        >
          {mobileOpen ? (
            <X className="w-6 h-6" aria-hidden="true" />
          ) : (
            <Menu className="w-6 h-6" aria-hidden="true" />
          )}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label="Site navigation"
        onClose={handleDialogClose}
        onClick={handleDialogClick}
        className="md:hidden m-0 ml-auto h-dvh max-h-none w-72 max-w-[85vw] border-l border-surface-variant bg-background p-0 text-on-surface backdrop:bg-primary/40 backdrop:backdrop-blur-xs open:flex open:flex-col"
        {...dialogClosedByAttr}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
          <span className="font-display-lg-mobile text-headline-sm text-primary">
            Thi Bút
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close navigation menu"
            className="p-2 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col flex-1 px-6 py-8">
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-4">
            Navigation
          </p>
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {links.map(({ href, label }) => {
              const active = isRouteActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={closeDrawer}
                  className={`py-3 px-4 rounded-lg font-body-md text-body-md transition-colors motion-reduce:transition-none ${
                    active
                      ? "bg-surface-container-high text-secondary font-semibold"
                      : "text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-surface-variant">
            <Link
              href="/auth/login"
              onClick={closeDrawer}
              className="flex items-center gap-3 py-3 px-4 rounded-lg font-label-caps text-label-caps uppercase text-on-surface hover:bg-surface-container-high transition-colors motion-reduce:transition-none"
            >
              <User className="w-4 h-4" aria-hidden="true" />
              My Account
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
