"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { ensureStudioSessionAction } from "@/app/actions/composition";
import {
  generateInstantSvgString,
  safeBase64Encode,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import type { DesignComposition } from "@/lib/print/types";
import { DEFAULT_INK_HEX, SEAL_VERMILION_HEX } from "@/lib/studio/inkPalette";
import {
  createStudioStore,
  StudioStoreContext,
  useStudioStore,
} from "@/lib/studio/studioStore";
import { useStudioActions } from "@/lib/studio/useStudioActions";
import { useStudioAnalysis } from "@/lib/studio/useStudioAnalysis";
import {
  CulturalMeaningBar,
  MobileCulturalMeaningSummary,
} from "./CulturalMeaningPanel";
import type { MainStageCanvasProps, MainStageCanvasRef } from "./MainStageCanvas";
import { MobileStudioSheet } from "./MobileStudioSheet";
import { ProductSelectionModal, type ProductMock } from "./ProductSelectionModal";
import { StudioInspector, type WordTreatment } from "./StudioInspector";
import { StudioToolbar } from "./StudioToolbar";

const LazyMainStageCanvas = dynamic<MainStageCanvasProps>(
  () => import("./MainStageCanvas").then((mod) => mod.MainStageCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
        <div className="w-[800px] max-w-full aspect-square bg-surface-container border border-surface-variant rounded animate-pulse motion-reduce:animate-none" />
      </div>
    ),
  }
);

export interface StudioWorkspaceProps {
  isAdmin?: boolean;
  products?: ProductMock[];
  sessionId?: string;
  initialText?: string;
  initialTradition?: ScriptCategory;
  initialTreatment?: WordTreatment;
  initialComposition?: DesignComposition | null;
  initialLocked?: boolean;
}

function StudioWorkspaceContainer({
  isAdmin,
  products,
  initialSessionId,
  initialTradition,
  resolvedStartingText,
  initialCalTransform,
  initialSealTransform,
}: {
  isAdmin: boolean;
  products: ProductMock[];
  initialSessionId?: string;
  initialTradition: ScriptCategory;
  resolvedStartingText: string;
  initialCalTransform?: DesignComposition["transform"];
  initialSealTransform?: DesignComposition["transform"];
}) {
  const [state, setState] = useStudioStore();
  const canvasRef = useRef<MainStageCanvasRef>(null);

  const { renderedText, culturalInsight, isAnalyzing } = useStudioAnalysis(
    state.inputText,
    state.tradition,
    state.treatment
  );

  const selectedProduct =
    products.find((p) => p.id === state.selectedProductId) || products[0];

  const effectiveVariantId = useMemo(() => {
    const variants = selectedProduct?.variants;
    if (!variants || variants.length === 0) return undefined;
    if (
      state.selectedVariantId &&
      variants.some((variant) => variant.id === state.selectedVariantId)
    ) {
      return state.selectedVariantId;
    }
    return variants[0]?.id;
  }, [selectedProduct, state.selectedVariantId]);

  const { handleSaveComposition, handleAddToCart } = useStudioActions({
    state,
    setState,
    canvasRef,
    renderedText,
    effectiveVariantId,
  });

  useEffect(() => {
    let cancelled = false;
    ensureStudioSessionAction({
      ...(initialSessionId ? { sessionId: initialSessionId } : {}),
      inputText: resolvedStartingText,
      culturalStyle: initialTradition,
    })
      .then((res) => {
        if (cancelled || !res.ok) return;
        setState({ activeSessionId: res.sessionId, isLocked: res.locked });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, initialTradition, resolvedStartingText, setState]);

  // Strictly memoized calligraphy SVG (TB-CALLI-005)
  const artworkSvgString = useMemo(
    () =>
      generateInstantSvgString({
        text: renderedText,
        fontFamily: state.fontFamily,
        layout: state.layoutMode,
        strokePreset: state.strokePreset,
        variationType: state.variationType,
        inkColor: DEFAULT_INK_HEX,
        hasSeal: false,
      }),
    [
      renderedText,
      state.fontFamily,
      state.layoutMode,
      state.strokePreset,
      state.variationType,
    ]
  );

  const artworkSvgDataUri = useMemo(
    () => `data:image/svg+xml;base64,${safeBase64Encode(artworkSvgString)}`,
    [artworkSvgString]
  );

  const mockupImage = selectedProduct?.imageUrl || "/mockups/blank_hoodie.jpg";

  const inspectorProps = {
    isAdmin,
    locked: state.isLocked,
    inputText: state.inputText,
    setInputText: (inputText: string) => setState({ inputText }),
    tradition: state.tradition,
    setTradition: (tradition: ScriptCategory) => setState({ tradition }),
    treatment: state.treatment,
    setTreatment: (treatment: WordTreatment) => setState({ treatment }),
    strokePreset: state.strokePreset,
    setStrokePreset: (strokePreset: typeof state.strokePreset) =>
      setState({ strokePreset }),
    inkColor: state.inkColor,
    setInkColor: (inkColor: string) => setState({ inkColor }),
    hasSeal: state.hasSeal,
    setHasSeal: (hasSeal: boolean) => setState({ hasSeal }),
    sealText: state.sealText,
    setSealText: (sealText: string) => setState({ sealText }),
    sealFontFamily: state.sealFontFamily,
    setSealFontFamily: (sealFontFamily: string) => setState({ sealFontFamily }),
    fontFamily: state.fontFamily,
    setFontFamily: (fontFamily: string) => setState({ fontFamily }),
    placement: state.placement,
    setPlacement: (placement: typeof state.placement) => setState({ placement }),
    selectedProduct,
    selectedVariantId: effectiveVariantId,
    onSelectVariant: (selectedVariantId: string) =>
      setState({ selectedVariantId }),
    onSelectProduct: () => setState({ isProductModalOpen: true }),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] h-dvh w-full bg-background font-body-md text-on-background overflow-hidden">
      <div className="relative flex flex-col bg-background w-full overflow-hidden h-[54vh] lg:h-full">
        <StudioToolbar
          variant="desktop"
          isAdmin={isAdmin}
          isLocked={state.isLocked}
          viewMode={state.viewMode}
          onChangeViewMode={(viewMode) => setState({ viewMode })}
          layoutMode={state.layoutMode}
          onChangeLayoutMode={(layoutMode) => setState({ layoutMode })}
          isSaving={state.isSaving}
          onSave={handleSaveComposition}
          isAddingToCart={state.isAddingToCart}
          onAddToCart={handleAddToCart}
        />

        <StudioToolbar
          variant="mobile"
          isAdmin={isAdmin}
          isLocked={state.isLocked}
          viewMode={state.viewMode}
          onChangeViewMode={(viewMode) => setState({ viewMode })}
          layoutMode={state.layoutMode}
          onChangeLayoutMode={(layoutMode) => setState({ layoutMode })}
          isSaving={state.isSaving}
          onSave={handleSaveComposition}
          isAddingToCart={state.isAddingToCart}
          onAddToCart={handleAddToCart}
        />

        <div
          aria-live="polite"
          className="absolute top-4 lg:top-20 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-20 flex flex-col gap-2 max-w-md pointer-events-none"
        >
          {state.isLocked && (
            <div className="pointer-events-auto bg-surface-container-lowest border border-surface-variant rounded px-4 py-2.5 flex items-center gap-2 text-xs text-on-background">
              <Lock className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
              <span>
                This composition is locked because an order has been created from this session.
              </span>
            </div>
          )}

          {state.statusBanner && (
            <div
              className={`pointer-events-auto px-4 py-2.5 rounded border flex items-center justify-between gap-3 text-xs ${
                state.statusBanner.tone === "error"
                  ? "bg-error-container text-on-error-container border-error"
                  : "bg-surface-container-lowest text-on-background border-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                {state.statusBanner.tone === "error" ? (
                  <AlertCircle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                )}
                <span>{state.statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setState({ statusBanner: null })}
                className="underline font-label-caps uppercase text-[10px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <LazyMainStageCanvas
            stageRef={canvasRef}
            viewMode={state.viewMode}
            artworkSvgUrl={artworkSvgDataUri}
            fontFamily={state.fontFamily}
            inkColor={state.inkColor}
            productImageUrl={
              state.viewMode === "MOCKUP" ? mockupImage : undefined
            }
            hasSeal={state.hasSeal}
            sealStyle="IMPERIAL_RED"
            sealColor={SEAL_VERMILION_HEX}
            sealText={state.sealText}
            sealFontFamily={state.sealFontFamily}
            initialArtworkTransform={initialCalTransform}
            initialSealTransform={initialSealTransform}
            locked={state.isLocked}
          />
        </div>

        <CulturalMeaningBar
          insight={culturalInsight}
          tradition={state.tradition}
          isAnalyzing={isAnalyzing}
          activeSessionId={state.activeSessionId}
          isAdmin={isAdmin}
          isLocked={state.isLocked}
        />
      </div>

      <div className="hidden lg:flex h-full relative z-20 w-[390px] bg-surface-container-low">
        <StudioInspector {...inspectorProps} />
      </div>

      <MobileStudioSheet>
        <MobileCulturalMeaningSummary
          insight={culturalInsight}
          tradition={state.tradition}
        />
        <StudioInspector {...inspectorProps} />
      </MobileStudioSheet>

      <ProductSelectionModal
        isOpen={state.isProductModalOpen}
        onClose={() => setState({ isProductModalOpen: false })}
        selectedProductId={state.selectedProductId}
        onSelect={(selectedProductId) => setState({ selectedProductId })}
        products={products}
      />
    </div>
  );
}

export function StudioWorkspace({
  isAdmin = false,
  products = [],
  sessionId: initialSessionId,
  initialText,
  initialTradition = "VIETNAMESE_THU_PHAP",
  initialTreatment = "KEEP_ORIGINAL",
  initialComposition = null,
  initialLocked = false,
}: StudioWorkspaceProps) {
  const initialCalLayer = initialComposition?.layers.find(
    (l) => l.type === "calligraphy"
  );
  const initialSealLayer = initialComposition?.layers.find(
    (l) => l.type === "seal"
  );
  const resolvedStartingText =
    initialCalLayer?.text || initialText?.trim() || "Có Chí Thì Nên";

  const initialMatchedProduct = initialComposition?.productVariantId
    ? products.find((p) =>
        p.variants?.some((v) => v.id === initialComposition.productVariantId)
      )
    : undefined;
  const firstProduct = initialMatchedProduct ?? products[0];

  const [store] = useState(() =>
    createStudioStore({
      activeSessionId: initialSessionId,
      isLocked: initialLocked,
      viewMode: "RAW_ART",
      layoutMode:
        initialCalLayer?.layout === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
      inputText: resolvedStartingText,
      tradition: initialTradition,
      treatment: initialTreatment,
      strokePreset: "BOLD_BRUSH",
      variationType: "01_CONTROLLED",
      fontFamily:
        initialCalLayer?.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
      inkColor:
        initialCalLayer?.colorHex || initialComposition?.color || DEFAULT_INK_HEX,
      hasSeal: Boolean(initialSealLayer),
      sealText: initialSealLayer?.sealText || "印",
      sealFontFamily: initialSealLayer?.fontFamily || DEFAULT_SEAL_FONT_FAMILY,
      placement: initialComposition?.placement || "front",
      selectedProductId: firstProduct?.id,
      selectedVariantId:
        initialComposition?.productVariantId ?? firstProduct?.variants?.[0]?.id,
      isProductModalOpen: false,
      isSaving: false,
      isAddingToCart: false,
      statusBanner: null,
    })
  );

  return (
    <StudioStoreContext.Provider value={store}>
      <StudioWorkspaceContainer
        isAdmin={isAdmin}
        products={products}
        initialSessionId={initialSessionId}
        initialTradition={initialTradition}
        resolvedStartingText={resolvedStartingText}
        initialCalTransform={initialCalLayer?.transform}
        initialSealTransform={initialSealLayer?.transform}
      />
    </StudioStoreContext.Provider>
  );
}
