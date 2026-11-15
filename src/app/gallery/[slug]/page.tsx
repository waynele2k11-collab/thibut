import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import { GalleryDetailActions } from "@/components/gallery/GalleryDetailActions";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await prisma.galleryItem.findUnique({ where: { slug } });
  if (!item) return { title: "Not Found" };
  
  return {
    title: `${item.title} — Thi Bút Gallery`,
    description: `Explore "${item.title}" — mapped to ${item.productName} via Thi Bút.`,
  };
}

export default async function GalleryDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = await prisma.galleryItem.findUnique({ where: { slug } });

  if (!item) {
    notFound();
  }

  const primaryImage = item.productImageUrl;
  const artworkImage = item.artworkPreviewUrl;

  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.currency,
    minimumFractionDigits: 2,
  }).format(item.listedPriceCents / 100);

  return (
    <main className="min-h-screen bg-background">
      
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 md:py-24">
        <Link 
          href="/gallery" 
          className="inline-flex items-center text-on-surface-variant hover:text-on-surface transition-colors mb-12 font-label-caps text-label-caps uppercase"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Gallery
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">
          {/* LEFT: Product Mockup Carousel */}
          <div className="flex-1">
            <div className="relative w-full aspect-[4/5] bg-surface rounded-2xl overflow-hidden shadow-sm sticky top-24">
              {primaryImage && (
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
                          <Image
                            src={primaryImage}
                            alt={item.title}
                            fill
                            className="object-cover mix-blend-multiply absolute inset-0"
                            style={item.mockupTransform ? {
                              transform: `translate(${((item.mockupTransform as any).background?.translateX) || (item.mockupTransform as any).translateX || 0}px, ${((item.mockupTransform as any).background?.translateY) || (item.mockupTransform as any).translateY || 0}px) scale(${((item.mockupTransform as any).background?.scale) || (item.mockupTransform as any).scale || 1})`,
                            } : undefined}
                            priority
                          />
                          {artworkImage && artworkImage.startsWith("data:image/svg+xml;base64,") ? (
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
                                    ? decodeURIComponent(escape(atob(artworkImage.split(",")[1]))) 
                                    : ""
                                }}
                              />
                            </div>
                          ) : artworkImage && (
                            <img 
                              src={artworkImage}
                              alt=""
                              className="absolute inset-0 w-full h-full object-contain drop-shadow-sm scale-75"
                            />
                          )}
                        </>
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </div>

          {/* RIGHT: Ecommerce Data + Design Meaning */}
          <div className="flex-1 flex flex-col">
            <div className="max-w-md">
              
              {/* TOP: ECOMMERCE DATA */}
              <div className="mb-16">
                <h1 className="font-display-lg text-display-md md:text-display-lg text-on-background mb-2">
                  {item.title}
                </h1>
                
                <p className="font-display-md text-title-lg text-on-surface-variant mb-6">
                  {item.subtitle}
                </p>

                <p className="font-display-sm text-headline-sm text-on-background mb-10">
                  {formattedPrice}
                </p>

                <div className="space-y-6 mb-10">
                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Product</h3>
                    <p className="font-body text-body-lg text-on-background">{item.productName}</p>
                  </div>
                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Color</h3>
                    <p className="font-body text-body-lg text-on-background">Available at checkout</p>
                  </div>
                  {item.requiresSize && (
                    <div>
                      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Size</h3>
                      <p className="font-body text-body-md text-on-surface-variant">Available at checkout</p>
                    </div>
                  )}
                </div>

                {/* Client component for Actions/Modal */}
                <GalleryDetailActions product={item} />
              </div>

              {/* BOTTOM: THE WORDS */}
              <div className="pt-12 border-t border-surface-variant">
                <h2 className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em] mb-10">
                  The Words
                </h2>

                <div className="space-y-8">
                  <div>
                    <p className="font-display-md text-display-md mb-2">{item.title}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Meaning
                    </h3>
                    <p className="font-body text-body-lg text-on-background">{item.description}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Tradition</h3>
                    <p className="font-body text-body-lg text-on-background">{item.tradition?.replace(/_/g, " ")}</p>
                  </div>

                  <div>
                    <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Language</h3>
                    <p className="font-body text-body-lg text-on-background">{item.sourceLanguage}</p>
                  </div>
                </div>
              </div>

              {/* BOTTOM: DESIGN SPECIFICATIONS */}
              {(() => {
                const mt = item.mockupTransform as any;
                if (!mt || !mt.designParams) return null;
                const design = mt.designParams;
                const artScale = mt.artwork?.scale || 1;
                const artTx = mt.artwork?.translateX || 0;
                const artTy = mt.artwork?.translateY || 0;
                
                // Color formatting
                const inkMap: Record<string, string> = {
                  "#111111": "Charcoal Black",
                  "#F6F1E7": "Ivory White",
                  "#263238": "Navy Ink",
                  "#B3261E": "Cinnabar Red"
                };
                const displayInk = inkMap[design.inkColor] || design.inkColor;
                
                // Stroke formatting
                const strokeMap: Record<string, string> = {
                  "CLASSICAL": "Classical Elegance",
                  "BOLD_BRUSH": "Bold Brush",
                  "FLOWING_INK": "Flowing Ink",
                  "DRY_BRUSH": "Dry Brush",
                  "FREE_SPIRIT": "Free Spirit"
                };
                const displayStroke = strokeMap[design.strokePreset] || design.strokePreset;

                return (
                  <div className="pt-12 mt-12 border-t border-surface-variant">
                    <h2 className="font-label-caps text-label-caps text-secondary uppercase tracking-[0.2em] mb-10">
                      Design Specifications
                    </h2>

                    <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                      <div>
                        <h3 className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Pigment</h3>
                        <p className="font-mono text-sm text-on-background">{displayInk}</p>
                      </div>

                      <div>
                        <h3 className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Brush Style</h3>
                        <p className="font-mono text-sm text-on-background">{displayStroke}</p>
                      </div>

                      {design.fontName && (
                        <div>
                          <h3 className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Typography</h3>
                          <p className="font-mono text-sm text-on-background">{design.fontName}</p>
                        </div>
                      )}

                      <div>
                        <h3 className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Alignment</h3>
                        <p className="font-mono text-[11px] text-on-background">
                          {design.layout}
                          {design.hasSeal ? " + Seal" : ""}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <h3 className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">Print Calibration (Zoom / Crop)</h3>
                        <p className="font-mono text-[11px] text-on-background">
                          Scale: {Math.round(artScale * 100)}% &nbsp;|&nbsp; 
                          Offset X: {Math.round(artTx)}px &nbsp;|&nbsp; 
                          Offset Y: {Math.round(artTy)}px
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
