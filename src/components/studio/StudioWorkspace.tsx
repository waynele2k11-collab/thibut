"use client";

import React, { useState, useRef, useEffect } from "react";
import { MainStageCanvas, MainStageCanvasRef } from "./MainStageCanvas";
import { StudioInspector, WordTreatment, InkPigment } from "./StudioInspector";
import { MobileStudioSheet } from "./MobileStudioSheet";
import { ProductSelectionModal, MOCK_PRODUCTS } from "./ProductSelectionModal";
import { Download, ArrowLeft, Save, ShoppingCart } from "lucide-react";
import { generateInstantSvgString } from "@/lib/calligraphy/ClientCalligraphyRenderer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCartAction } from "@/app/actions/cart";

export interface StudioWorkspaceProps {
  isAdmin?: boolean;
  products?: ProductMock[];
}

export function StudioWorkspace({ isAdmin, products = MOCK_PRODUCTS }: StudioWorkspaceProps) {
  const canvasRef = useRef<MainStageCanvasRef>(null);
  const router = useRouter();

  // State for Canvas
  const [viewMode, setViewMode] = useState<"RAW_ART" | "MOCKUP">("RAW_ART");
  const [layoutMode, setLayoutMode] = useState<"HORIZONTAL" | "VERTICAL">("VERTICAL");

  // State for Inspector
  const [inputText, setInputText] = useState("Có Chí Thì Nên");
  const [treatment, setTreatment] = useState<WordTreatment>("KEEP_ORIGINAL");
  const [inkColor, setInkColor] = useState<InkPigment>("#121212");
  const [hasSeal, setHasSeal] = useState(false);
  const [sealText, setSealText] = useState("印");
  const [sealFontFamily, setSealFontFamily] = useState("VNI Ong do");
  const [fontFamily, setFontFamily] = useState("UTM ThuPhap Thien An");

  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(products[0]?.id);
  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(selectedProduct?.variants?.[0]?.id);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  useEffect(() => {
    if (selectedProduct?.variants?.[0]) {
      setSelectedVariantId(selectedProduct.variants[0].id);
    }
  }, [selectedProductId, selectedProduct]);

  // Generate SVG for canvas (without the seal, since MainStageCanvas renders it separately)
  const artworkSvgUrl = generateInstantSvgString({
    text: inputText,
    fontFamily: fontFamily,
    layout: layoutMode,
    inkColor: inkColor,
    hasSeal: false,
    sealText: sealText,
    sealFontFamily: sealFontFamily,
  });

  const base64Svg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(artworkSvgUrl)))}`;
  const mockupImage = selectedProduct?.imageUrl || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";

  const handleAddToCart = async () => {
    const dataUrl = canvasRef.current?.getCanvasDataUrl();
    if (!selectedVariantId) {
      alert("Please select a valid size and color in the merchandise section.");
      return;
    }
    setIsAddingToCart(true);
    const res = await addToCartAction({
      variantId: selectedVariantId,
      designDataUrl: dataUrl || "",
      config: {
        text: inputText,
        fontFamily,
        inkColor,
        hasSeal,
        layoutMode,
        tradition: "VIETNAMESE_THU_PHAP",
      },
    });
    setIsAddingToCart(false);
    if (res.success) {
      router.push("/cart");
    } else {
      alert(`Failed to add to cart: ${res.error}`);
    }
  };

  const inspectorProps = {
    isAdmin: isAdmin ?? false,
    inputText, setInputText,
    treatment, setTreatment,
    inkColor, setInkColor,
    hasSeal, setHasSeal,
    sealText, setSealText,
    sealFontFamily, setSealFontFamily,
    fontFamily, setFontFamily,
    selectedProduct,
    selectedVariantId,
    onSelectVariant: setSelectedVariantId,
    onSelectProduct: () => setIsProductModalOpen(true),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-[100dvh] w-full bg-[#FAF7F2] font-sans text-stone-900 overflow-hidden">

      {/* ── CANVAS COLUMN ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col bg-[#FAF7F2] w-full overflow-hidden
                      h-[52vh] lg:h-full">

        {/* ── DESKTOP TOOLBAR (top-center floating pill) ── */}
        <div className="hidden lg:flex absolute top-6 left-1/2 -translate-x-1/2 z-10 items-center gap-3
                        bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-stone-200/50">

          <Link href={isAdmin ? "/admin/gallery" : "/"} className="p-2 text-stone-500 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-px h-6 bg-stone-200" />

          {/* View Switcher */}
          <div className="flex bg-[#F6F1E8] rounded-xl p-1">
            <button onClick={() => setViewMode("RAW_ART")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === "RAW_ART" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}>
              📄 Raw Art
            </button>
            <button onClick={() => setViewMode("MOCKUP")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === "MOCKUP" ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"}`}>
              👕 Mockup
            </button>
          </div>
          <div className="w-px h-6 bg-stone-200" />

          {/* Orientation */}
          <div className="flex bg-[#F6F1E8] rounded-xl p-1">
            <button onClick={() => setLayoutMode("VERTICAL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${layoutMode === "VERTICAL" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`} title="Vertical">⬇</button>
            <button onClick={() => setLayoutMode("HORIZONTAL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${layoutMode === "HORIZONTAL" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`} title="Horizontal">➡</button>
          </div>
          <div className="w-px h-6 bg-stone-200" />

          {/* Export + Action */}
          {isAdmin ? (
            <button onClick={() => { const u = canvasRef.current?.getCanvasDataUrl(); if (u) alert("Gallery save!"); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#B3261E] text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">
              <Save className="w-4 h-4" /><span>Gallery</span>
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={isAddingToCart}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#B3261E] text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors shadow-md disabled:opacity-60">
              <ShoppingCart className="w-4 h-4" />
              <span>{isAddingToCart ? "Adding…" : "Add to Cart"}</span>
            </button>
          )}
        </div>

        {/* ── MOBILE COMPACT TOOLBAR (above bottom sheet) ── */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between
                        bg-white/90 backdrop-blur-md px-4 py-2 border-t border-stone-200/50 gap-2">

          <Link href={isAdmin ? "/admin/gallery" : "/"} className="p-2 text-stone-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* View toggle pills */}
          <div className="flex bg-[#F6F1E8] rounded-xl p-0.5 flex-1 max-w-[200px]">
            <button onClick={() => setViewMode("RAW_ART")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "RAW_ART" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}>
              📄 Art
            </button>
            <button onClick={() => setViewMode("MOCKUP")}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "MOCKUP" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"}`}>
              👕 Mock
            </button>
          </div>

          {/* Layout toggle */}
          <div className="flex bg-[#F6F1E8] rounded-xl p-0.5">
            <button onClick={() => setLayoutMode("VERTICAL")}
              className={`px-2 py-1.5 rounded-lg text-xs transition-all ${layoutMode === "VERTICAL" ? "bg-white shadow-sm" : "text-stone-400"}`}>⬇</button>
            <button onClick={() => setLayoutMode("HORIZONTAL")}
              className={`px-2 py-1.5 rounded-lg text-xs transition-all ${layoutMode === "HORIZONTAL" ? "bg-white shadow-sm" : "text-stone-400"}`}>➡</button>
          </div>

          {/* CTA */}
          {isAdmin ? (
            <button onClick={() => { const u = canvasRef.current?.getCanvasDataUrl(); if (u) alert("Gallery save!"); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#B3261E] text-white rounded-xl text-xs font-semibold">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={isAddingToCart}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#B3261E] text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-60">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{isAddingToCart ? "…" : "Cart"}</span>
            </button>
          )}
        </div>

        {/* Canvas Engine */}
        <MainStageCanvas
          ref={canvasRef}
          viewMode={viewMode}
          layoutMode={layoutMode}
          artworkSvgUrl={base64Svg}
          fontFamily={fontFamily}
          productImageUrl={viewMode === "MOCKUP" ? mockupImage : undefined}
          hasSeal={hasSeal}
          sealStyle="IMPERIAL_RED"
          sealColor="#B3261E"
          sealText={sealText}
          sealFontFamily={sealFontFamily}
        />
      </div>

      {/* ── DESKTOP INSPECTOR (right sidebar) ── */}
      <div className="hidden lg:flex h-full shadow-2xl relative z-20 w-[380px] bg-[#F6F1E8]">
        <StudioInspector {...inspectorProps} />
      </div>

      {/* ── MOBILE BOTTOM SHEET INSPECTOR ── */}
      <MobileStudioSheet>
        <StudioInspector {...inspectorProps} />
      </MobileStudioSheet>

      <ProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        selectedProductId={selectedProductId}
        onSelect={(id) => setSelectedProductId(id)}
        products={products}
      />
    </div>
  );
}
