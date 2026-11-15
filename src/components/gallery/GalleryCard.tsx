"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import type { GalleryItem } from "@prisma/client";

interface GalleryCardProps {
  item: GalleryItem;
}

export function GalleryCard({ item }: GalleryCardProps) {
  const router = useRouter();
  const [isBuying, setIsBuying] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(item.availableSizes[0] || "");
  const [showVariantSelector, setShowVariantSelector] = useState(false);

  // 1. MAKE IT YOURS
  const handleMakeItYours = () => {
    // Analytics: gallery_make_it_yours_click
    const params = new URLSearchParams();
    params.set("galleryId", item.id);
    router.push(`/create?${params.toString()}`);
  };

  // 2. BUY AS SHOWN
  const handleBuyAsShown = async () => {
    if (item.requiresSize && !showVariantSelector) {
      setShowVariantSelector(true);
      return;
    }

    // Analytics: gallery_buy_as_shown_click
    setIsBuying(true);
    try {
      const res = await fetch("/api/checkout/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          galleryItemId: item.id,
          variantId: showVariantSelector ? selectedVariant : "default",
        }),
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate checkout");
        setIsBuying(false);
      }
    } catch (error) {
      console.error(error);
      setIsBuying(false);
    }
  };

  return (
    <div className="flex flex-col bg-white border border-surface-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Product Image */}
      <Link href={`/gallery/${item.slug}`} className="aspect-[4/5] bg-[#FBF9F5] relative overflow-hidden flex items-center justify-center group">
        {item.productImageUrl ? (
          (() => {
            const isApparel = item.productName.toLowerCase().match(/shirt|tee|hoodie|tank|shorts|leggings|jersey/);
            const fallbackPrintArea = {
              top: isApparel ? "22%" : "15%",
              left: isApparel ? "30%" : "15%",
              width: isApparel ? "40%" : "70%",
              height: isApparel ? "55%" : "70%"
            };
            return (
          <>
            {(item.mockupTransform as any)?.customImageUrl ? (
              <img 
                src={(item.mockupTransform as any).customImageUrl} 
                alt={item.title} 
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <img 
                  src={item.productImageUrl} 
                  alt={item.title} 
                  className="absolute inset-0 w-full h-full object-cover mix-blend-multiply"
                  style={item.mockupTransform ? {
                    transform: `translate(${((item.mockupTransform as any).background?.translateX) || (item.mockupTransform as any).translateX || 0}px, ${((item.mockupTransform as any).background?.translateY) || (item.mockupTransform as any).translateY || 0}px) scale(${((item.mockupTransform as any).background?.scale) || (item.mockupTransform as any).scale || 1})`,
                  } : undefined}
                />
                {item.artworkPreviewUrl && item.artworkPreviewUrl.startsWith("data:image/svg+xml;base64,") ? (
                  <div 
                    className="absolute z-10 flex items-center justify-center"
                    style={(item.mockupTransform as any)?.printArea ? {
                      top: `${(item.mockupTransform as any).printArea.topPct}%`,
                      left: `${(item.mockupTransform as any).printArea.leftPct}%`,
                      width: `${(item.mockupTransform as any).printArea.widthPct}%`,
                      height: `${(item.mockupTransform as any).printArea.heightPct}%`,
                    } : fallbackPrintArea}
                  >
                    <div 
                      className={`w-full h-full flex items-center justify-center pointer-events-none select-none [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto drop-shadow-sm`}
                      style={(item.mockupTransform as any)?.artwork ? {
                        transform: `translate(${(item.mockupTransform as any).artwork.translateX || 0}px, ${(item.mockupTransform as any).artwork.translateY || 0}px) scale(${(item.mockupTransform as any).artwork.scale || 1}) rotate(${(item.mockupTransform as any).artwork.rotation || 0}deg)`,
                      } : undefined}
                      dangerouslySetInnerHTML={{
                        __html: typeof atob !== "undefined" 
                          ? decodeURIComponent(escape(atob(item.artworkPreviewUrl.split(",")[1]))) 
                          : ""
                      }}
                    />
                  </div>
                ) : item.artworkPreviewUrl && (
                  <img 
                    src={item.artworkPreviewUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-sm scale-75"
                  />
                )}
              </>
            )}
          </>
          );
          })()
        ) : (
          <div className="text-surface-variant font-medium">No Image</div>
        )}
      </Link>

      {/* Metadata & Actions */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        <Link href={`/gallery/${item.slug}`} className="hover:opacity-80 transition-opacity block">
          <h3 className="font-display-md text-lg font-bold text-on-background line-clamp-1 group-hover:text-primary transition-colors">{item.title}</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {item.productType} &middot; ${(item.listedPriceCents / 100).toFixed(2)}
          </p>
        </Link>

        <div className="mt-auto flex flex-col gap-3">
          {showVariantSelector && item.requiresSize && (
            <div className="flex flex-col gap-2 p-3 bg-[#FBF9F5] border border-surface-variant rounded-xl mb-2">
              <label className="text-xs font-bold text-on-background uppercase tracking-widest">Select Size</label>
              <div className="flex gap-2 flex-wrap">
                {item.availableSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedVariant(size)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${
                      selectedVariant === size 
                        ? "bg-[#111111] text-white border-black" 
                        : "bg-white text-on-background border-surface-variant hover:border-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleBuyAsShown}
            disabled={isBuying || !item.purchasable}
            className="w-full bg-[#111111] text-white py-3.5 rounded-xl font-label-caps uppercase text-sm font-bold tracking-wider hover:bg-black/90 active:scale-[0.98] transition-all flex items-center justify-center shadow-md disabled:opacity-50"
            title="Get this exact design."
          >
            {isBuying ? <Loader2 className="w-5 h-5 animate-spin" /> : (
               showVariantSelector ? `Buy Now — $${(item.listedPriceCents / 100).toFixed(2)}` : "Buy As Shown"
            )}
          </button>

          <button
            onClick={handleMakeItYours}
            className="w-full bg-white text-[#111111] py-3.5 rounded-xl font-label-caps uppercase text-sm font-bold tracking-wider border-2 border-[#E0DBD1] hover:border-black/60 hover:bg-[#FAF8F5] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            title="Start with these words and create your own Thi Bút."
          >
            Make It Yours <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
