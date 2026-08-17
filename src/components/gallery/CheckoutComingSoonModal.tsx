"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import type { GalleryProductFixture } from "@/data/gallery";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: GalleryProductFixture;
}

export function CheckoutComingSoonModal({ isOpen, onClose, product }: Props) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const makeItYoursLink = `/create?product=${product.productId}&color=${encodeURIComponent(product.color)}&placement=${product.placement}&source=gallery&template=${product.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-surface border border-surface-variant rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8">
          <h2 className="font-display-md text-title-lg text-on-surface mb-2">
            Direct purchasing is coming next.
          </h2>
          <p className="font-body text-body-md text-on-surface-variant mb-8">
            This design is ready for purchase, but direct checkout is not enabled in this preview yet.
          </p>

          <div className="space-y-4">
            <Link 
              href={makeItYoursLink}
              className="w-full flex items-center justify-center bg-secondary text-on-secondary py-3 rounded-full font-label-caps text-label-caps hover:bg-secondary/90 transition-colors"
            >
              Continue customizing this product
            </Link>
            <button 
              onClick={onClose}
              className="w-full flex items-center justify-center bg-transparent border border-surface-variant text-on-surface py-3 rounded-full font-label-caps text-label-caps hover:bg-surface-variant/50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
