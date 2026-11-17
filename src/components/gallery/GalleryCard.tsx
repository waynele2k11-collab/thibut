"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import type { GalleryItem } from "@prisma/client";
import { formatMinor } from "@/lib/money";

export type GalleryCardItem = Omit<
  GalleryItem,
  "listedPriceMinor" | "createdAt" | "updatedAt"
> & {
  listedPriceMinor: bigint | string;
};

interface PrintAreaPct {
  topPct?: number;
  leftPct?: number;
  widthPct?: number;
  heightPct?: number;
}

interface LayerTransform {
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotation?: number;
}

interface ParsedMockupTransform {
  customImageUrl?: string;
  translateX?: number;
  translateY?: number;
  scale?: number;
  background?: LayerTransform;
  artwork?: LayerTransform;
  printArea?: PrintAreaPct;
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return null;
}

function asNumber(val: unknown): number | undefined {
  return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function parseLayerTransform(val: unknown): LayerTransform | undefined {
  const rec = asRecord(val);
  if (!rec) return undefined;
  return {
    translateX: asNumber(rec.translateX),
    translateY: asNumber(rec.translateY),
    scale: asNumber(rec.scale),
    rotation: asNumber(rec.rotation),
  };
}

function parseMockupTransform(raw: unknown): ParsedMockupTransform | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const printAreaRec = asRecord(rec.printArea);

  return {
    customImageUrl:
      typeof rec.customImageUrl === "string" && rec.customImageUrl.length > 0
        ? rec.customImageUrl
        : undefined,
    translateX: asNumber(rec.translateX),
    translateY: asNumber(rec.translateY),
    scale: asNumber(rec.scale),
    background: parseLayerTransform(rec.background),
    artwork: parseLayerTransform(rec.artwork),
    printArea: printAreaRec
      ? {
          topPct: asNumber(printAreaRec.topPct),
          leftPct: asNumber(printAreaRec.leftPct),
          widthPct: asNumber(printAreaRec.widthPct),
          heightPct: asNumber(printAreaRec.heightPct),
        }
      : undefined,
  };
}

export interface GalleryCardProps {
  item: GalleryCardItem;
}

export function GalleryCard({ item }: GalleryCardProps) {
  const router = useRouter();
  const [isBuying, setIsBuying] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(
    item.availableSizes[0] || ""
  );
  const [showVariantSelector, setShowVariantSelector] = useState(false);

  const formattedPrice = formatMinor(item.listedPriceMinor, item.currency);
  const mt = parseMockupTransform(item.mockupTransform);
  const isVietnamese = Boolean(
    item.sourceLanguage?.toLowerCase().includes("vi") ||
      item.tradition?.includes("VIETNAMESE")
  );

  const handleMakeItYours = () => {
    const params = new URLSearchParams();
    params.set("galleryId", item.id);
    router.push(`/create?${params.toString()}`);
  };

  const handleBuyAsShown = async () => {
    if (item.requiresSize && !showVariantSelector) {
      setShowVariantSelector(true);
      return;
    }

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

      const data: { url?: string; error?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to initiate checkout");
        setIsBuying(false);
      }
    } catch (error: unknown) {
      console.error("[GalleryCard] Checkout error:", error);
      setIsBuying(false);
    }
  };

  const isApparel = Boolean(
    item.productName
      .toLowerCase()
      .match(/shirt|tee|hoodie|tank|shorts|leggings|jersey/)
  );

  const fallbackPrintArea = {
    top: isApparel ? "22%" : "15%",
    left: isApparel ? "30%" : "15%",
    width: isApparel ? "40%" : "70%",
    height: isApparel ? "55%" : "70%",
  };

  const bgTransformStyle = mt
    ? {
        transform: `translate(${mt.background?.translateX ?? mt.translateX ?? 0}px, ${
          mt.background?.translateY ?? mt.translateY ?? 0
        }px) scale(${mt.background?.scale ?? mt.scale ?? 1})`,
      }
    : undefined;

  const printAreaStyle = mt?.printArea
    ? {
        top: `${mt.printArea.topPct ?? 20}%`,
        left: `${mt.printArea.leftPct ?? 25}%`,
        width: `${mt.printArea.widthPct ?? 50}%`,
        height: `${mt.printArea.heightPct ?? 55}%`,
      }
    : fallbackPrintArea;

  const artTransformStyle = mt?.artwork
    ? {
        transform: `translate(${mt.artwork.translateX ?? 0}px, ${
          mt.artwork.translateY ?? 0
        }px) scale(${mt.artwork.scale ?? 1}) rotate(${mt.artwork.rotation ?? 0}deg)`,
      }
    : undefined;

  return (
    <article className="flex flex-col bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden transition-colors motion-reduce:transition-none hover:border-outline">
      <Link
        href={`/gallery/${item.slug}`}
        className="aspect-[4/5] bg-background relative overflow-hidden flex items-center justify-center group"
      >
        {item.productImageUrl ? (
          mt?.customImageUrl ? (
            <Image
              src={mt.customImageUrl}
              alt={item.title}
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <>
              <Image
                src={item.productImageUrl}
                alt={item.title}
                fill
                unoptimized
                className="object-cover mix-blend-multiply"
                style={bgTransformStyle}
              />
              {item.artworkPreviewUrl &&
              item.artworkPreviewUrl.startsWith("data:image/svg+xml;base64,") ? (
                <div
                  className="absolute z-10 flex items-center justify-center"
                  style={printAreaStyle}
                >
                  <Image
                    src={item.artworkPreviewUrl}
                    alt=""
                    width={320}
                    height={320}
                    unoptimized
                    className="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none select-none"
                    style={artTransformStyle}
                  />
                </div>
              ) : item.artworkPreviewUrl ? (
                <Image
                  src={item.artworkPreviewUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-contain scale-75 pointer-events-none select-none"
                />
              ) : null}
            </>
          )
        ) : (
          <div className="text-on-surface-variant font-body-md text-body-md">
            No Image
          </div>
        )}
      </Link>

      <div className="p-5 flex flex-col gap-4 flex-1">
        <Link
          href={`/gallery/${item.slug}`}
          className="hover:opacity-80 transition-opacity motion-reduce:transition-none block"
        >
          <h3
            lang={isVietnamese ? "vi" : undefined}
            className="font-headline-sm text-headline-sm text-on-background line-clamp-1"
          >
            {item.title}
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {item.productType} &middot; {formattedPrice}
          </p>
        </Link>

        <div className="mt-auto flex flex-col gap-3">
          {showVariantSelector && item.requiresSize && (
            <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-surface-variant rounded-lg mb-2">
              <span className="font-label-caps text-label-caps text-on-background uppercase">
                Select Size
              </span>
              <div className="flex gap-2 flex-wrap">
                {item.availableSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedVariant(size)}
                    className={`px-3 py-1.5 font-label-caps text-label-caps rounded border transition-colors motion-reduce:transition-none ${
                      selectedVariant === size
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface-container-lowest text-on-background border-surface-variant hover:border-primary"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleBuyAsShown}
            disabled={isBuying || !item.purchasable}
            className="w-full bg-primary text-on-primary py-3.5 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none flex items-center justify-center disabled:opacity-50"
          >
            {isBuying ? (
              <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : showVariantSelector ? (
              `Buy Now — ${formattedPrice}`
            ) : (
              "Buy As Shown"
            )}
          </button>

          <button
            type="button"
            onClick={handleMakeItYours}
            className="w-full bg-surface-container-lowest text-primary py-3.5 rounded font-label-caps text-label-caps uppercase border border-outline-variant hover:border-primary hover:bg-surface-container-high transition-colors motion-reduce:transition-none flex items-center justify-center gap-2"
          >
            Make It Yours <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
