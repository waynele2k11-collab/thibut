"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { getCartCount } from "@/lib/cart/cartStore";

export function CartBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial count
    setCount(getCartCount());

    // Listen for cart updates
    const handler = (e: Event) => {
      const items = (e as CustomEvent).detail as any[];
      setCount(items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0));
    };
    window.addEventListener("thibut-cart-update", handler);
    return () => window.removeEventListener("thibut-cart-update", handler);
  }, []);

  return (
    <Link href="/cart" aria-label={`Cart (${count} items)`} className={`relative ${className ?? ""}`}>
      <ShoppingCart className="w-5 h-5 text-primary hover:text-secondary transition-colors" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#B3261E] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
