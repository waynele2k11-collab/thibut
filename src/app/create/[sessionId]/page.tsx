"use client";

/**
 * /create/[sessionId] — Thi Bút Creative Studio & Personalization Lab
 * 
 * 1. Studio Configurator: Interactive 2-column live studio editor
 *    (Words, Tradition, Treatment, Stroke Presets, 01-06 Variations, Ink, Seal, Flourish).
 * 2. Merchandise Customizer: Realistic physical product mockups (Apparel, Posters, Canvas),
 *    sizing, garment color selection, and handover to Secure Stripe Checkout.
 */

import { useState, use, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Sliders, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { StudioConfigurator, StudioState } from "@/components/create/StudioConfigurator";
import { CompositionEditor } from "@/components/create/CompositionEditor";

export interface ProductConfig {
  id: string;
  name: string;
  price: number;
  category: "apparel" | "wall_art" | "merch" | "digital";
  sizes: string[];
  colors: { id: string; name: string; hex: string; mockup: string }[];
  defaultSize: string;
  defaultColor: string;
}

export const PRODUCT_CATALOG: Record<string, ProductConfig> = {
  "Premium Hoodie": {
    id: "Premium Hoodie",
    name: "Premium Heavyweight Hoodie",
    price: 99.00,
    category: "apparel",
    sizes: ["S", "M", "L", "XL", "2XL"],
    colors: [
      { id: "bone-white", name: "Bone White", hex: "#F6F1E7", mockup: "/mockups/blank_hoodie.jpg" },
      { id: "pitch-black", name: "Pitch Black", hex: "#111111", mockup: "/mockups/hoodie.jpg" },
      { id: "heather-grey", name: "Heather Grey", hex: "#A8A8A8", mockup: "/mockups/blank_hoodie.jpg" },
    ],
    defaultSize: "L",
    defaultColor: "Bone White",
  },
  "Classic T-Shirt": {
    id: "Classic T-Shirt",
    name: "Classic Organic Cotton T-Shirt",
    price: 45.00,
    category: "apparel",
    sizes: ["XS", "S", "M", "L", "XL", "2XL"],
    colors: [
      { id: "bone-white", name: "Bone White", hex: "#F6F1E7", mockup: "/mockups/model-male.jpg" },
      { id: "pitch-black", name: "Pitch Black", hex: "#111111", mockup: "/mockups/model-female.jpg" },
      { id: "slate-navy", name: "Slate Navy", hex: "#1E293B", mockup: "/mockups/model-male.jpg" },
    ],
    defaultSize: "L",
    defaultColor: "Bone White",
  },
  "Fine Art Poster": {
    id: "Fine Art Poster",
    name: "Archival Fine Art Poster",
    price: 25.00,
    category: "wall_art",
    sizes: ["12x16 in", "18x24 in", "24x36 in"],
    colors: [
      { id: "natural-matte", name: "Natural Matte", hex: "#FAF8F5", mockup: "/mockups/fine-art-poster.jpg" },
      { id: "gallery-black", name: "Gallery Black", hex: "#111111", mockup: "/mockups/framed_print.jpg" },
    ],
    defaultSize: "18x24 in",
    defaultColor: "Natural Matte",
  },
  "Canvas Print": {
    id: "Canvas Print",
    name: "Gallery Stretched Canvas",
    price: 49.00,
    category: "wall_art",
    sizes: ["12x16 in", "16x20 in", "18x24 in", "24x36 in"],
    colors: [
      { id: "museum-wrap", name: "Museum Wrap", hex: "#F6F1E7", mockup: "/mockups/framed_print.jpg" },
      { id: "black-frame", name: "Floating Frame", hex: "#111111", mockup: "/mockups/framed_print.jpg" },
    ],
    defaultSize: "18x24 in",
    defaultColor: "Museum Wrap",
  },
  "Tote Bag": {
    id: "Tote Bag",
    name: "Heavy Cotton Canvas Tote",
    price: 29.00,
    category: "merch",
    sizes: ["Standard (15x16 in)"],
    colors: [
      { id: "natural-canvas", name: "Natural Canvas", hex: "#EAE4DA", mockup: "/mockups/model-female.jpg" },
      { id: "black-canvas", name: "Black Canvas", hex: "#111111", mockup: "/mockups/model-female.jpg" },
    ],
    defaultSize: "Standard (15x16 in)",
    defaultColor: "Natural Canvas",
  },
  "Coffee Mug": {
    id: "Coffee Mug",
    name: "Artisan Ceramic Mug",
    price: 19.00,
    category: "merch",
    sizes: ["11 oz", "15 oz"],
    colors: [
      { id: "glossy-white", name: "Glossy White", hex: "#FFFFFF", mockup: "/mockups/fine-art-poster.jpg" },
      { id: "matte-black", name: "Matte Black", hex: "#181818", mockup: "/mockups/fine-art-poster.jpg" },
    ],
    defaultSize: "15 oz",
    defaultColor: "Glossy White",
  },
  "Digital Download (All 6)": {
    id: "Digital Download (All 6)",
    name: "Ultra-HD Vector Master Files",
    price: 9.99,
    category: "digital",
    sizes: ["4500x5400 px @ 300 DPI"],
    colors: [
      { id: "vector-svg", name: "Lossless Vector", hex: "#B3261E", mockup: "" },
    ],
    defaultSize: "4500x5400 px @ 300 DPI",
    defaultColor: "Lossless Vector",
  },
};

export default function CreatePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params); // Next.js 16: params is a Promise
  const searchParams = useSearchParams();
  const initialText = searchParams.get("text") || "Có Chí Thì Nên";

  const [currentStage, setCurrentStage] = useState<"studio" | "product" | "compose">("studio");
  
  // Canonical Studio State
  const [studioState, setStudioState] = useState<StudioState>({
    inputText: initialText,
    tradition: "VIETNAMESE_THU_PHAP",
    treatment: "KEEP_ORIGINAL",
    interpretation: {
      text: initialText,
      romanization: initialText,
      meaning: "Where there is a will, there is a way.",
      culturalNote: "Master Vietnamese Thư Pháp vector composition.",
      type: "ORIGINAL",
    },
    strokePreset: "BOLD_BRUSH",
    variationIndex: "01_CONTROLLED",
    fontId: "utm-thuphap-thien-an",
    layout: "HORIZONTAL",
    inkColor: "black",
    hasSeal: true,
    sealStyle: "IMPERIAL_RED",
    flourish: "DRAGON",
    advanced: {
      pressureMultiplier: 1.0,
      dryBrushIntensity: 0.15,
      letterSpacing: "0.02em",
      rotation: 0,
      scale: 1.0,
    },
  });
  const [activeCandidate, setActiveCandidate] = useState<any>({
    id: "studio-master-vector",
    imageUrl: "",
    variationType: "01_CONTROLLED",
    variationName: "01 Harmony",
  });

  // Merchandising State
  const [selectedProduct, setSelectedProduct] = useState("Premium Hoodie");
  const [selectedSize, setSelectedSize] = useState("L");
  const [selectedColor, setSelectedColor] = useState("Bone White");
  const [compositionData, setCompositionData] = useState<any>(null);

  const handleSelectProduct = (prodId: string) => {
    setSelectedProduct(prodId);
    const cfg = PRODUCT_CATALOG[prodId] || PRODUCT_CATALOG["Premium Hoodie"];
    setSelectedSize(cfg.defaultSize);
    setSelectedColor(cfg.defaultColor);
  };

  const handleProceedToMerchandise = (state: StudioState, candidate: any) => {
    setStudioState(state);
    setActiveCandidate(candidate);
    setCurrentStage("product");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md antialiased">
      {/* Studio Header */}
      <header className="border-b border-surface-variant bg-surface-container-lowest/80 backdrop-blur sticky top-0 z-30 px-margin-mobile md:px-margin-desktop py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="font-serif font-black text-lg sm:text-xl tracking-tight text-on-background">
              Thi Bút
            </Link>
            <span className="text-on-surface-variant font-mono text-xs hidden sm:inline">
              / Creative Studio
            </span>
          </div>

          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-label-caps uppercase">
            <button 
              onClick={() => setCurrentStage("studio")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors font-bold ${
                currentStage === "studio" 
                  ? "bg-black text-white" 
                  : "text-on-surface-variant hover:text-black"
              }`}
            >
              <span className="hidden sm:inline">1. Studio Artwork</span>
              <span className="sm:hidden">1. Artwork</span>
            </button>
            <span className="text-outline-variant text-[10px]">→</span>
            <button 
              onClick={() => setCurrentStage("product")}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors font-bold ${
                currentStage === "product" 
                  ? "bg-black text-white" 
                  : "text-on-surface-variant hover:text-black"
              }`}
            >
              <span className="hidden sm:inline">2. Merchandise & Size</span>
              <span className="sm:hidden">2. Products</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-grow w-full px-margin-mobile md:px-margin-desktop py-8">
        
        {/* ── STAGE 1: ALL-IN-ONE STUDIO CONFIGURATOR ─────────────────────────── */}
        {currentStage === "studio" && (
          <StudioConfigurator
            initialSessionId={sessionId}
            initialText={initialText}
            initialTradition="VIETNAMESE_THU_PHAP"
            onProceedToMerchandise={handleProceedToMerchandise}
          />
        )}

        {/* ── STAGE 2: PRODUCT MERCHANDISING & SPECIFICATIONS ────────────────── */}
        {currentStage === "product" && (() => {
          const currentConfig = PRODUCT_CATALOG[selectedProduct] || PRODUCT_CATALOG["Premium Hoodie"];
          const activeMockup = currentConfig.colors.find(c => c.name === selectedColor)?.mockup || currentConfig.colors[0]?.mockup || "/mockups/blank_hoodie.jpg";
          const hasUserCustomPhoto = (compositionData?.productMode === "photo" || compositionData?.productMode === "generate") && compositionData?.bgImage;
          const previewBackground = hasUserCustomPhoto ? compositionData.bgImage : (selectedProduct !== "Digital Download (All 6)" ? activeMockup : null);
          const isApparel = currentConfig.category === "apparel";
          const artworkUrlToRender = activeCandidate?.imageUrl || "";

          return (
            <div className="max-w-6xl mx-auto flex flex-col gap-8">
              {/* Back Button */}
              <div>
                <button
                  onClick={() => setCurrentStage("studio")}
                  className="inline-flex items-center gap-1.5 text-xs font-label-caps uppercase text-on-surface-variant hover:text-black font-bold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Studio Artwork
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                
                {/* Left: Product Mockup Stage */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div className="border border-surface-variant bg-surface-container-lowest p-6 relative overflow-hidden rounded-2xl shadow-sm">
                    <div className="relative w-full aspect-[4/5] max-h-[460px] flex items-center justify-center bg-[#F6F1E7]/40 overflow-hidden rounded-xl">
                      {previewBackground && (
                        <img
                          src={previewBackground}
                          alt={`${selectedProduct} in ${selectedColor}`}
                          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                        />
                      )}
                      
                      {/* Position Calligraphy Artwork Overlay on Product */}
                      <div 
                        className={`relative z-10 flex items-center justify-center ${
                          isApparel ? "w-[48%] mt-[-10%]" : "w-[65%]"
                        }`}
                      >
                        {artworkUrlToRender ? (
                          <img 
                            src={artworkUrlToRender} 
                            alt={studioState?.interpretation?.text || initialText} 
                            className={`w-full h-auto object-contain pointer-events-none select-none ${
                              !hasUserCustomPhoto && selectedColor === "Bone White" ? "mix-blend-multiply" : ""
                            }`}
                            style={{
                              transform: `scale(${studioState?.advanced?.scale || 1}) rotate(${studioState?.advanced?.rotation || 0}deg)`,
                              filter: studioState?.inkColor === "ivory" && !hasUserCustomPhoto ? "drop-shadow(0px 2px 4px rgba(0,0,0,0.4))" : undefined,
                            }}
                            onContextMenu={(e) => e.preventDefault()} 
                            draggable={false} 
                          />
                        ) : (
                          <div className="font-serif font-bold text-2xl text-black">
                            {studioState?.interpretation?.text || initialText}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cultural Summary Badge */}
                    <div className="mt-4 border-t border-surface-variant pt-4 flex items-center justify-between">
                      <div>
                        <p className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">Calligraphy Artwork</p>
                        <p className="font-headline-sm text-base font-bold text-on-background mt-0.5">
                          &ldquo;{studioState?.interpretation?.text || initialText}&rdquo;
                        </p>
                      </div>
                      <span className="text-xs text-on-surface-variant italic max-w-[240px] text-right truncate">
                        {studioState?.interpretation?.meaning || ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Merchandising Configuration */}
                <div className="lg:col-span-5 flex flex-col gap-6 bg-white p-6 border border-surface-variant rounded-2xl shadow-sm">
                  <div>
                    <h1 className="font-headline-md text-xl font-bold text-on-background">
                      Select Product & Size
                    </h1>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Manufactured on-demand at 300 DPI archival quality.
                    </p>
                  </div>

                  {/* Product Type Grid */}
                  <div>
                    <span className="font-label-caps text-xs uppercase text-on-surface-variant block mb-2 font-bold tracking-wider">
                      Product Type
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(PRODUCT_CATALOG).map((prod) => (
                        <button 
                          key={prod.id} 
                          onClick={() => handleSelectProduct(prod.id)}
                          className={`border p-3 rounded-xl text-left transition-all ${
                            selectedProduct === prod.id 
                              ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                              : 'border-outline-variant hover:border-primary/50 bg-[#FAF8F5]'
                          }`}
                        >
                          <span className="text-xs font-bold text-on-background block truncate">{prod.id}</span>
                          <span className="text-[11px] font-mono text-on-surface-variant font-semibold">
                            ${prod.price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Garment Color Swatches */}
                  {currentConfig.colors.length > 1 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-label-caps text-xs uppercase text-on-surface-variant font-bold tracking-wider">
                          Garment Color
                        </span>
                        <span className="text-xs font-mono text-on-background font-semibold">{selectedColor}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {currentConfig.colors.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setSelectedColor(c.name)}
                            title={c.name}
                            className={`w-9 h-9 rounded-full border shadow-sm transition-all flex items-center justify-center ${
                              selectedColor === c.name ? "ring-2 ring-primary scale-105" : "hover:scale-105 opacity-80"
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {selectedColor === c.name && (
                              <span className={`w-2 h-2 rounded-full ${c.hex === "#111111" || c.hex === "#1E293B" ? "bg-white" : "bg-black"}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size Selector */}
                  {currentConfig.sizes.length > 0 && selectedProduct !== "Digital Download (All 6)" && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-label-caps text-xs uppercase text-on-surface-variant font-bold tracking-wider">
                          Select Size
                        </span>
                        <span className="text-xs font-mono text-on-background font-semibold">{selectedSize}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentConfig.sizes.map((s) => (
                          <button
                            key={s}
                            onClick={() => setSelectedSize(s)}
                            className={`px-3.5 py-2 border rounded-xl text-xs font-label-caps uppercase transition-all ${
                              selectedSize === s
                                ? "bg-black text-white border-black font-bold shadow-sm"
                                : "border-outline-variant bg-white text-on-background hover:border-primary"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price Breakdown Banner */}
                  <div className="p-4 bg-[#F4EFE6] border border-[#E5E0D8] rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-label-caps uppercase text-[#66635D] block font-bold">Total Target Price</span>
                      <span className="text-xl font-bold text-[#111111] font-display-md">
                        ${currentConfig.price.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-xs text-[#137333] font-bold bg-[#E6F4EA] px-2.5 py-1 rounded-lg">
                      Free Standard Shipping
                    </span>
                  </div>

                  {/* Checkout CTA */}
                  <Link
                    href={`/checkout?candidate=${encodeURIComponent(activeCandidate.id)}`
                      + `&product=${encodeURIComponent(selectedProduct)}`
                      + `&size=${encodeURIComponent(selectedSize)}`
                      + `&color=${encodeURIComponent(selectedColor)}`
                      + `&mockup=${encodeURIComponent(activeMockup)}`
                      + `&sessionId=${encodeURIComponent(sessionId)}`
                      + `&text=${encodeURIComponent(studioState.inputText)}`
                      + `&interpretedText=${encodeURIComponent(studioState.interpretation.text)}`
                      + `&interpretation=${encodeURIComponent(studioState.interpretation.type || "Original")}`
                      + `&meaning=${encodeURIComponent(studioState.interpretation.meaning || "")}`
                      + `&romanization=${encodeURIComponent(studioState.interpretation.romanization || "")}`
                    }
                    className="w-full bg-primary text-on-primary py-4 font-label-caps uppercase text-center hover:bg-surface-tint transition-all block rounded-xl font-bold shadow-md text-sm"
                  >
                    Proceed to Checkout (${currentConfig.price.toFixed(2)}) →
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
}
