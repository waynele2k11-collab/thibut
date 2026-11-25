import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { ADMIN_TAB } from "@/components/admin/AdminNotice";

const TABS = [
  { href: adminPath("/catalog"), label: "Products & Prices" },
  { href: adminPath("/catalog/designs"), label: "Designs" },
  { href: adminPath("/catalog/categories"), label: "Categories" },
] as const;

export function CatalogTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Catalog sections" className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={`${ADMIN_TAB} ${
            tab.href === current ? "bg-primary text-on-primary border-primary hover:bg-primary" : ""
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
