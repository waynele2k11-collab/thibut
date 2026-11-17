"use client";

import { useEffect } from "react";
import Image from "next/image";
import { PackageX, X } from "lucide-react";
import { formatMinor } from "@/lib/money";

export interface ProductVariantMock {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  retailPriceMinor?: string;
  mockupImageUrl?: string | null;
}

export interface ProductMock {
  id: string;
  name: string;
  category?: string;
  priceMinor: string;
  formattedPrice: string;
  imageUrl: string;
  description: string;
  variants?: ProductVariantMock[];
}

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
  products = [],
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-background/45 backdrop-blur-xs p-4"
    >
      <div className="bg-background border border-surface-variant rounded-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
            className="p-2 rounded text-on-surface-variant hover:text-on-background hover:bg-surface-container-low transition-colors motion-reduce:transition-none cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-surface-container-low border border-surface-variant rounded-lg">
              <PackageX
                className="w-8 h-8 text-on-surface-variant mb-3"
                aria-hidden="true"
              />
              <h3 className="font-headline-sm text-headline-sm text-on-background mb-2">
                Catalog temporarily unavailable
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                Physical blanks are currently refreshing. You can still save your calligraphy composition or purchase a 300 DPI Digital Master.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((product) => {
                const isSelected = selectedProductId === product.id;
                const displayPrice =
                  product.formattedPrice || formatMinor(product.priceMinor, "USD");
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      onSelect(product.id);
                      onClose();
                    }}
                    className={`text-left border rounded-lg overflow-hidden transition-colors motion-reduce:transition-none flex flex-col bg-surface-container-lowest cursor-pointer ${
                      isSelected
                        ? "border-primary ring-1 ring-primary"
                        : "border-surface-variant hover:border-outline"
                    }`}
                  >
                    <div className="w-full h-48 bg-surface-container-low overflow-hidden relative">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4 flex flex-col flex-1 gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-headline-sm text-base text-on-background">
                          {product.name}
                        </h3>
                        <span className="font-body-md text-sm font-medium text-on-background shrink-0">
                          {displayPrice}
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
          )}
        </div>
      </div>
    </div>
  );
}
