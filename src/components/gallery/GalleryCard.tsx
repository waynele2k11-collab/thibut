"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { GalleryProductFixture } from "@/data/gallery";
import { CheckoutComingSoonModal } from "./CheckoutComingSoonModal";

interface GalleryCardProps {
  item: GalleryProductFixture;
}

export function GalleryCard({ item }: GalleryCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Format currency
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency,
    minimumFractionDigits: 0,
  }).format(item.retailPriceMinor / 100);

  const makeItYoursLink = `/create?product=${item.productId}&color=${encodeURIComponent(item.color)}&placement=${item.placement}&source=gallery&template=${item.id}`;

  const primaryImage = item.mockups.find(m => m.view === "FRONT")?.asset || item.mockups[0]?.asset;

  return (
    <>
      <div className="flex flex-col group">
        <div className="relative overflow-hidden bg-surface rounded-xl aspect-[3/4] mb-4">
          <Link href={`/gallery/${item.slug}`} className="block w-full h-full">
            {primaryImage && (
              <Image
                src={primaryImage}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            )}
            {/* Subtle overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 ease-out" />
          </Link>
        </div>

        <div className="flex flex-col space-y-1 px-2 mb-4">
          <Link href={`/gallery/${item.slug}`} className="hover:opacity-80 transition-opacity">
            <h3 className="font-display-md text-title-lg text-on-background">{item.title}</h3>
            <p className="font-body text-body-sm text-on-surface-variant">
              {item.productName} · {formattedPrice}
            </p>
          </Link>
        </div>

        {/* Both CTAs are always visible, not just on hover, per user instruction */}
        <div className="flex flex-col space-y-3 px-2 mt-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full py-2.5 bg-on-background text-background font-label-caps text-label-caps uppercase rounded-full hover:opacity-90 transition-opacity"
          >
            Buy As Shown
          </button>
          
          <Link 
            href={makeItYoursLink}
            className="w-full flex justify-center items-center py-2.5 text-on-surface-variant hover:text-on-surface font-label-caps text-label-caps uppercase transition-colors"
          >
            Make it yours <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </div>
      </div>

      <CheckoutComingSoonModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        product={item} 
      />
    </>
  );
}
