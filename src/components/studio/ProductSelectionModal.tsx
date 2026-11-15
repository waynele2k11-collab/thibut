"use client";

import { X } from "lucide-react";

export interface ProductMock {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description: string;
  variants?: {
    id: string;
    size: string | null;
    color: string | null;
    colorHex: string | null;
  }[];
}

export const MOCK_PRODUCTS: ProductMock[] = [
  {
    id: "premium-tee",
    name: "Premium Heavyweight Tee",
    price: 45.00,
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "100% combed ring-spun cotton. Ultra soft, vintage wash.",
  },
  {
    id: "vintage-hoodie",
    name: "Vintage Wash Hoodie",
    price: 85.00,
    imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "Heavyweight French Terry. Boxy, oversized fit.",
  },
  {
    id: "canvas-art",
    name: "Gallery Canvas Wrap",
    price: 120.00,
    imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    description: "Museum-quality textured canvas on solid wood frame.",
  }
];

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductId?: string;
  onSelect: (productId: string) => void;
  products?: ProductMock[];
}

export function ProductSelectionModal({ isOpen, onClose, selectedProductId, onSelect, products = MOCK_PRODUCTS }: ProductSelectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
      <div className="bg-[#FAF7F2] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-bold text-stone-900 font-serif">Select Merchandise</h2>
            <p className="text-sm text-stone-500 mt-1">Choose the canvas for your calligraphy.</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors rounded-full hover:bg-stone-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  onSelect(product.id);
                  onClose();
                }}
                className={`text-left border-2 rounded-xl overflow-hidden transition-all flex flex-col bg-white ${
                  selectedProductId === product.id ? "border-stone-900 ring-2 ring-stone-900/20" : "border-stone-200 hover:border-stone-400 hover:shadow-md"
                }`}
              >
                <div className="w-full h-48 bg-stone-100 overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-stone-900">{product.name}</h3>
                    <span className="font-medium text-stone-900">${product.price.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">{product.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
