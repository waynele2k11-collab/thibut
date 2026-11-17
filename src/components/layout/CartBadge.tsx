"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCartCountAction } from "@/app/actions/cart";

interface CartRefreshDetail {
  count?: number;
}

export function CartBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    getCartCountAction()
      .then((serverCount) => {
        if (active) {
          setCount(serverCount);
        }
      })
      .catch(() => {
        if (active) {
          setCount(0);
        }
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<CartRefreshDetail | undefined>;
      if (typeof custom.detail?.count === "number") {
        setCount(custom.detail.count);
        return;
      }
      getCartCountAction()
        .then((serverCount) => setCount(serverCount))
        .catch(() => {});
    };

    window.addEventListener("thibut-cart-refresh", handler);
    return () => window.removeEventListener("thibut-cart-refresh", handler);
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={`Cart (${count} items)`}
      className={`relative ${className ?? ""}`}
    >
      <ShoppingCart className="w-5 h-5 text-primary hover:text-secondary transition-colors" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-secondary text-on-secondary font-label-caps text-[10px] rounded-full flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
