import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface StickyCTAProps {
  licensePrice: number;
  personalizationPrice: number;
  blankPrice: number;
}

export function StickyCTA({ licensePrice, personalizationPrice, blankPrice }: StickyCTAProps) {
  const total = licensePrice + personalizationPrice + blankPrice;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-outline-variant shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 p-4 md:px-margin-desktop md:py-6">
      <div className="max-w-container-max mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Price Breakdown */}
        <div className="flex items-center space-x-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <div className="flex flex-col">
            <span className="text-xs font-label-caps text-on-surface-variant uppercase">Artwork License</span>
            <span className="font-body-md font-semibold">${licensePrice.toFixed(2)}</span>
          </div>
          <div className="text-outline-variant">+</div>
          <div className="flex flex-col">
            <span className="text-xs font-label-caps text-on-surface-variant uppercase">Personalization</span>
            <span className="font-body-md font-semibold">${personalizationPrice.toFixed(2)}</span>
          </div>
          <div className="text-outline-variant">+</div>
          <div className="flex flex-col">
            <span className="text-xs font-label-caps text-on-surface-variant uppercase">Product Blank</span>
            <span className="font-body-md font-semibold">${blankPrice.toFixed(2)}</span>
          </div>
          <div className="text-outline-variant font-bold text-lg">=</div>
          <div className="flex flex-col">
            <span className="text-xs font-label-caps text-secondary uppercase">Total</span>
            <span className="font-headline-sm text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full md:w-auto inline-flex items-center justify-center bg-primary text-on-primary px-8 py-4 font-label-caps uppercase text-sm hover:bg-secondary hover:text-on-secondary transition-all duration-300 shadow-sm border border-transparent">
          <ShoppingBag className="w-4 h-4 mr-2" />
          Add to Cart & Checkout
        </button>
      </div>
    </div>
  );
}
