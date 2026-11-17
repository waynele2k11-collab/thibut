"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export interface ProductVariantMock {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
}

export interface ProductMock {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  variants?: ProductVariantMock[];
}

export const MOCK_PRODUCTS: ProductMock[] = [
  {
    id: "premium-tee",
    name: "Premium Heavyweight Tee",
    price: 45.0,
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "100% combed ring-spun cotton. Ultra soft, archival wash.",
  },
  {
    id: "vintage-hoodie",
    name: "Artisan Heavyweight Hoodie",
    price: 85.0,
    imageUrl:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "Heavyweight French Terry fleece with structured drape.",
  },
  {
    id: "canvas-art",
    name: "Gallery Canvas Wrap",
    price: 120.0,
    imageUrl:
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "Museum-grade textured canvas stretched over solid wood.",
  },
];

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductId?: string;
  onSelect: (productId: string) => void;
  products?: ProductMock[];
}

export function ProductSelectionModal({
  isOpen,
  onClose,
  selectedProductId,
  onSelect,
  products = MOCK_PRODUCTS,
}: ProductSelectionModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-product-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-background/45 backdrop-blur-sm p-4"
    >
      <div className="bg-background border border-surface-variant w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-variant">
          <div>
            <h2
              id="studio-product-modal-title"
              className="font-headline-sm text-headline-sm text-on-background"
            >
              Select Merchandise
            </h2>
            <p className="font-body-md text-sm text-on-surface-variant mt-1">
              Choose the physical medium for your brush calligraphy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product selection"
            className="p-2 text-on-surface-variant hover:text-on-background hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((product) => {
              const isSelected = selectedProductId === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onSelect(product.id);
                    onClose();
                  }}
                  className={`text-left border overflow-hidden transition-colors flex flex-col bg-surface-container-lowest cursor-pointer ${
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-surface-variant hover:border-outline"
                  }`}
                >
                  <div className="w-full h-48 bg-surface-container-low overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1 gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-headline-sm text-base text-on-background">
                        {product.name}
                      </h3>
                      <span className="font-body-md text-sm font-medium text-on-background shrink-0">
                        ${product.price.toFixed(2)}
                      </span>
                    </div>
                    <p className="font-body-md text-xs text-on-surface-variant leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
