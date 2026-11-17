"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { ensureStudioSessionAction } from "@/app/actions/composition";
import {
  generateInstantSvgString,
  safeBase64Encode,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import type { DesignComposition } from "@/lib/print/types";
import {
  DEFAULT_STUDIO_FONT_OPTIONS,
  isSameStudioFont,
  resolveTraditionFontPairing,
  type GalleryRemixContext,
  type StudioFontOption,
} from "@/lib/studio/fontPairing";
import { detectGarmentInkContrastIssue } from "@/lib/studio/garmentSwatches";
import { DEFAULT_INK_HEX, SEAL_VERMILION_HEX } from "@/lib/studio/inkPalette";
import { computeStudioLiveQuote } from "@/lib/studio/studioQuote";
import {
  createStudioStore,
  StudioStoreContext,
  useStudioStore,
  type StudioLayoutMode,
  type StudioStep,
  type WordTreatment,
} from "@/lib/studio/studioStore";
import { useStudioActions } from "@/lib/studio/useStudioActions";
import {
  useStudioAnalysis,
  type CulturalCandidate,
} from "@/lib/studio/useStudioAnalysis";
import { CulturalMeaningBar } from "./CulturalMeaningPanel";
import type {
  MainStageCanvasProps,
  MainStageCanvasRef,
} from "./MainStageCanvas";
import {
  ProductSelectionModal,
  type ProductMock,
} from "./ProductSelectionModal";
import { StudioInspector } from "./StudioInspector";
import { StudioToolbar } from "./StudioToolbar";

const LazyMainStageCanvas = dynamic<MainStageCanvasProps>(
  () => import("./MainStageCanvas").then((mod) => mod.MainStageCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="w-64 sm:w-96 max-w-full aspect-square bg-surface-container border border-surface-variant rounded-lg animate-pulse motion-reduce:animate-none" />
      </div>
    ),
  }
);

export interface StudioWorkspaceProps {
  isAdmin?: boolean;
  products?: ProductMock[];
  availableFonts?: StudioFontOption[];
  galleryRemix?: GalleryRemixContext | null;
  initialCandidates?: CulturalCandidate[];
  shouldSyncSessionUrl?: boolean;
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
  availableFonts,
  galleryRemix,
  initialCandidates,
  shouldSyncSessionUrl,
  initialSessionId,
  initialTradition,
  resolvedStartingText,
  initialCalTransform,
  initialSealTransform,
}: {
  isAdmin: boolean;
  products: ProductMock[];
  availableFonts: readonly StudioFontOption[];
  galleryRemix: GalleryRemixContext | null;
  initialCandidates?: CulturalCandidate[];
  shouldSyncSessionUrl: boolean;
  initialSessionId?: string;
  initialTradition: ScriptCategory;
  resolvedStartingText: string;
  initialCalTransform?: DesignComposition["transform"];
  initialSealTransform?: DesignComposition["transform"];
}) {
  const router = useRouter();
  const [state, setState] = useStudioStore();
  const canvasRef = useRef<MainStageCanvasRef>(null);

  const {
    renderedText,
    culturalInsight,
    candidates,
    selectedCandidate,
    isAnalyzing,
  } = useStudioAnalysis(state.inputText, state.tradition, state.treatment, {
    activeSessionId: state.activeSessionId,
    creationMode: state.creationMode,
    selectedInterpretationId: state.selectedInterpretationId,
    initialCandidates,
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === state.selectedProductId) || products[0],
    [products, state.selectedProductId]
  );

  const effectiveVariant = useMemo(() => {
    const variants = selectedProduct?.variants;
    if (!variants || variants.length === 0) return undefined;
    if (state.selectedVariantId) {
      const matched = variants.find((v) => v.id === state.selectedVariantId);
      if (matched) return matched;
    }
    return variants[0];
  }, [selectedProduct, state.selectedVariantId]);

  const effectiveVariantId = effectiveVariant?.id;

  const activeFontOption = useMemo(
    () => availableFonts.find((f) => isSameStudioFont(state.fontFamily, f)),
    [availableFonts, state.fontFamily]
  );

  const contrastAdvice = useMemo(
    () =>
      state.fulfillmentFormat === "PHYSICAL" && selectedProduct
        ? detectGarmentInkContrastIssue(effectiveVariant?.color, state.inkColor)
        : null,
    [
      effectiveVariant?.color,
      selectedProduct,
      state.fulfillmentFormat,
      state.inkColor,
    ]
  );

  const liveQuote = useMemo(
    () =>
      computeStudioLiveQuote({
        fulfillmentFormat: state.fulfillmentFormat,
        selectedProduct,
        selectedVariant: effectiveVariant,
        placement: state.placement,
      }),
    [
      effectiveVariant,
      selectedProduct,
      state.fulfillmentFormat,
      state.placement,
    ]
  );

  const { handleSaveComposition, handleAddToCart } = useStudioActions({
    state,
    setState,
    canvasRef,
    renderedText,
    effectiveVariantId,
    selectedProductName: selectedProduct?.name,
  });

  useEffect(() => {
    let cancelled = false;
    ensureStudioSessionAction({
      ...(initialSessionId ? { sessionId: initialSessionId } : {}),
      inputText: resolvedStartingText.slice(0, 200),
      culturalStyle: initialTradition,
    })
      .then((res) => {
        if (cancelled || !res.ok || !res.sessionId) return;
        setState({ activeSessionId: res.sessionId, isLocked: res.locked });
        if (shouldSyncSessionUrl && typeof window !== "undefined") {
          const search = window.location.search || "";
          router.replace(`/create/${res.sessionId}${search}`, {
            scroll: false,
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    initialSessionId,
    initialTradition,
    resolvedStartingText,
    router,
    setState,
    shouldSyncSessionUrl,
  ]);

  const handleTraditionChange = useCallback(
    (nextTradition: ScriptCategory) => {
      const nextFontFamily = resolveTraditionFontPairing(
        nextTradition,
        state.fontFamily,
        availableFonts
      );
      setState({
        tradition: nextTradition,
        fontFamily: nextFontFamily,
        selectedInterpretationId: null,
      });
    },
    [availableFonts, setState, state.fontFamily]
  );

  const handleStepChange = useCallback(
    (nextStep: StudioStep) => {
      setState((prev) => ({
        activeStep: nextStep,
        ...(nextStep === "PRODUCT" &&
        prev.fulfillmentFormat === "PHYSICAL" &&
        products.length > 0
          ? { viewMode: "MOCKUP" as const }
          : {}),
      }));
    },
    [products.length, setState]
  );

  // Strictly memoized calligraphy SVG (TB-CALLI-005)
  const artworkSvgString = useMemo(
    () =>
      generateInstantSvgString({
        text: renderedText,
        tradition: state.tradition,
        fontFamily: state.fontFamily,
        layout: state.layoutMode,
        strokePreset: state.strokePreset,
        variationType: state.variationType,
        inkColor: DEFAULT_INK_HEX,
        hasSeal: false,
      }),
    [
      renderedText,
      state.tradition,
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

  const mockupImage =
    effectiveVariant?.mockupImageUrl ||
    selectedProduct?.imageUrl ||
    "/mockups/blank_hoodie.jpg";

  const backgroundAssetUrl = state.backgroundAssetId
    ? `/api/uploads/background?assetId=${encodeURIComponent(state.backgroundAssetId)}`
    : undefined;

  return (
    <div
      className={
        isAdmin
          ? "flex flex-col lg:grid lg:grid-cols-[1fr_430px] h-dvh w-full bg-background font-body-md text-on-background overflow-hidden"
          : "flex flex-col lg:grid lg:grid-cols-[1fr_430px] h-[calc(100dvh-73px)] min-h-[560px] w-full bg-background font-body-md text-on-background overflow-hidden"
      }
    >
      <div className="relative flex flex-col bg-background w-full overflow-hidden h-[38%] min-h-[225px] max-h-[340px] lg:max-h-none lg:h-full border-b lg:border-b-0 border-surface-variant shrink-0">
        <StudioToolbar
          isLocked={state.isLocked}
          viewMode={state.viewMode}
          onChangeViewMode={(viewMode) => setState({ viewMode })}
          layoutMode={state.layoutMode}
          onChangeLayoutMode={(layoutMode: StudioLayoutMode) =>
            setState({ layoutMode })
          }
          onZoomIn={() => canvasRef.current?.nudgeArtworkScale(1.14)}
          onZoomOut={() => canvasRef.current?.nudgeArtworkScale(0.88)}
          onRotate={() => canvasRef.current?.rotateArtwork(90)}
          onResetTransform={() => canvasRef.current?.resetTransforms()}
        />

        <div
          aria-live="polite"
          className="absolute top-14 left-3 right-3 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-20 flex flex-col gap-2 max-w-md pointer-events-none"
        >
          {state.isLocked && (
            <div className="pointer-events-auto bg-surface-container-lowest border border-surface-variant rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-on-background">
              <Lock
                className="w-4 h-4 text-secondary shrink-0"
                aria-hidden="true"
              />
              <span>
                This composition is locked because an order has been created from this session.
              </span>
            </div>
          )}

          {state.statusBanner && (
            <div
              className={`pointer-events-auto px-4 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                state.statusBanner.tone === "error"
                  ? "bg-error-container text-on-error-container border-error"
                  : "bg-surface-container-lowest text-on-background border-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                {state.statusBanner.tone === "error" ? (
                  <AlertCircle
                    className="w-4 h-4 text-error shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="w-4 h-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span>{state.statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setState({ statusBanner: null })}
                className="underline font-label-caps uppercase text-[10px] cursor-pointer shrink-0"
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
            backgroundAssetUrl={backgroundAssetUrl}
            backgroundFillMode={state.backgroundFillMode}
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
          activeStep={state.activeStep}
          onJumpToMeaning={() => handleStepChange("MEANING")}
        />
      </div>

      <div className="flex-1 min-h-0 lg:h-full relative z-20 w-full">
        <StudioInspector
          isAdmin={isAdmin}
          locked={state.isLocked}
          activeStep={state.activeStep}
          onChangeStep={handleStepChange}
          galleryRemix={galleryRemix}
          creationMode={state.creationMode}
          onChangeCreationMode={(creationMode) => setState({ creationMode })}
          inputText={state.inputText}
          setInputText={(inputText) =>
            setState({ inputText, selectedInterpretationId: null })
          }
          renderedText={renderedText}
          tradition={state.tradition}
          setTradition={handleTraditionChange}
          treatment={state.treatment}
          setTreatment={(treatment) =>
            setState({ treatment, selectedInterpretationId: null })
          }
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          onSelectCandidate={(selectedInterpretationId) =>
            setState({ selectedInterpretationId })
          }
          isAnalyzing={isAnalyzing}
          availableFonts={availableFonts}
          activeFontOption={activeFontOption}
          fontFamily={state.fontFamily}
          setFontFamily={(fontFamily) => setState({ fontFamily })}
          strokePreset={state.strokePreset}
          variationType={state.variationType}
          onSelectExpression={(strokePreset, variationType) =>
            setState({ strokePreset, variationType })
          }
          layoutMode={state.layoutMode}
          onChangeLayoutMode={(layoutMode) => setState({ layoutMode })}
          inkColor={state.inkColor}
          setInkColor={(inkColor) => setState({ inkColor })}
          contrastAdvice={contrastAdvice}
          hasSeal={state.hasSeal}
          setHasSeal={(hasSeal) => setState({ hasSeal })}
          sealText={state.sealText}
          setSealText={(sealText) => setState({ sealText })}
          sealFontFamily={state.sealFontFamily}
          setSealFontFamily={(sealFontFamily) => setState({ sealFontFamily })}
          backgroundAssetId={state.backgroundAssetId}
          backgroundFillMode={state.backgroundFillMode}
          onChangeBackgroundAsset={(backgroundAssetId) =>
            setState({ backgroundAssetId })
          }
          onChangeBackgroundFillMode={(backgroundFillMode) =>
            setState({ backgroundFillMode })
          }
          fulfillmentFormat={state.fulfillmentFormat}
          onChangeFulfillmentFormat={(fulfillmentFormat) =>
            setState((prev) => ({
              fulfillmentFormat,
              viewMode:
                fulfillmentFormat === "DIGITAL"
                  ? "RAW_ART"
                  : products.length > 0
                    ? "MOCKUP"
                    : prev.viewMode,
            }))
          }
          products={products}
          selectedProduct={selectedProduct}
          selectedVariantId={effectiveVariantId}
          onSelectProductId={(selectedProductId) => {
            const nextProd = products.find((p) => p.id === selectedProductId);
            setState({
              selectedProductId,
              selectedVariantId: nextProd?.variants?.[0]?.id,
              viewMode: "MOCKUP",
            });
          }}
          onSelectVariant={(selectedVariantId) =>
            setState({ selectedVariantId, viewMode: "MOCKUP" })
          }
          onSelectProduct={() => setState({ isProductModalOpen: true })}
          placement={state.placement}
          setPlacement={(placement) => setState({ placement })}
          quote={liveQuote}
          isSaving={state.isSaving}
          onSave={handleSaveComposition}
          isAddingToCart={state.isAddingToCart}
          onPrimaryPurchaseAction={handleAddToCart}
          cartConfirmation={state.cartConfirmation}
          onDismissCartConfirmation={() => setState({ cartConfirmation: null })}
          onApplyInspiration={(preset) => {
            const pairedFont = resolveTraditionFontPairing(
              preset.tradition,
              state.fontFamily,
              availableFonts
            );
            setState({
              inputText: preset.text,
              tradition: preset.tradition,
              treatment: preset.treatment,
              creationMode: preset.mode,
              fontFamily: pairedFont,
              selectedInterpretationId: null,
            });
          }}
        />
      </div>

      <ProductSelectionModal
        isOpen={state.isProductModalOpen}
        onClose={() => setState({ isProductModalOpen: false })}
        selectedProductId={state.selectedProductId}
        onSelect={(selectedProductId) => {
          const nextProd = products.find((p) => p.id === selectedProductId);
          setState({
            selectedProductId,
            selectedVariantId: nextProd?.variants?.[0]?.id,
            viewMode: "MOCKUP",
          });
        }}
        products={products}
      />
    </div>
  );
}

export function StudioWorkspace({
  isAdmin = false,
  products = [],
  availableFonts,
  galleryRemix = null,
  initialCandidates,
  shouldSyncSessionUrl = false,
  sessionId: initialSessionId,
  initialText,
  initialTradition,
  initialTreatment = "KEEP_ORIGINAL",
  initialComposition = null,
  initialLocked = false,
}: StudioWorkspaceProps) {
  const effectiveFonts =
    availableFonts && availableFonts.length > 0
      ? availableFonts
      : DEFAULT_STUDIO_FONT_OPTIONS;

  const initialCalLayer = initialComposition?.layers.find(
    (l) => l.type === "calligraphy"
  );
  const initialSealLayer = initialComposition?.layers.find(
    (l) => l.type === "seal"
  );
  const initialBgAssetLayer = initialComposition?.layers.find(
    (l) => l.type === "asset"
  );

  const resolvedTradition: ScriptCategory =
    initialTradition ?? galleryRemix?.tradition ?? "VIETNAMESE_THU_PHAP";

  const resolvedStartingText =
    initialCalLayer?.text ||
    initialText?.trim() ||
    galleryRemix?.sourceText ||
    "Có Chí Thì Nên";

  const resolvedInitialFont =
    initialCalLayer?.fontFamily ||
    resolveTraditionFontPairing(resolvedTradition, "", effectiveFonts);

  const initialMatchedProduct = initialComposition?.productVariantId
    ? products.find((p) =>
        p.variants?.some((v) => v.id === initialComposition.productVariantId)
      )
    : galleryRemix?.matchedProductId
      ? products.find((p) => p.id === galleryRemix.matchedProductId)
      : undefined;
  const firstProduct = initialMatchedProduct ?? products[0];

  const resolvedInitialVariantId =
    initialComposition?.productVariantId ??
    galleryRemix?.matchedVariantId ??
    firstProduct?.variants?.[0]?.id;

  const resolvedInitialLayout: StudioLayoutMode =
    initialCalLayer?.layout === "HORIZONTAL"
      ? "HORIZONTAL"
      : initialCalLayer?.layout === "EMBLEM"
        ? "EMBLEM"
        : "VERTICAL";

  const [store] = useState(() =>
    createStudioStore({
      activeSessionId: initialSessionId,
      isLocked: initialLocked,
      activeStep: "MEANING",
      creationMode: galleryRemix ? "CREATOR_ART" : "QUOTE",
      fulfillmentFormat: products.length === 0 && !isAdmin ? "DIGITAL" : "PHYSICAL",
      selectedInterpretationId: null,
      viewMode: galleryRemix ? "MOCKUP" : "RAW_ART",
      layoutMode: resolvedInitialLayout,
      inputText: resolvedStartingText,
      tradition: resolvedTradition,
      treatment: initialTreatment,
      strokePreset: "FLOWING_INK",
      variationType: "04_EXPRESSIVE",
      fontFamily: resolvedInitialFont,
      inkColor:
        initialCalLayer?.colorHex || initialComposition?.color || DEFAULT_INK_HEX,
      hasSeal: initialComposition ? Boolean(initialSealLayer) : true,
      sealText: initialSealLayer?.sealText || "印",
      sealFontFamily: initialSealLayer?.fontFamily || DEFAULT_SEAL_FONT_FAMILY,
      backgroundAssetId: initialBgAssetLayer?.assetId ?? null,
      backgroundFillMode: initialBgAssetLayer?.fillMode ?? "contain",
      placement: initialComposition?.placement || "front",
      selectedProductId: firstProduct?.id,
      selectedVariantId: resolvedInitialVariantId,
      isProductModalOpen: false,
      isSaving: false,
      isAddingToCart: false,
      statusBanner: null,
      cartConfirmation: null,
    })
  );

  return (
    <StudioStoreContext.Provider value={store}>
      <StudioWorkspaceContainer
        isAdmin={isAdmin}
        products={products}
        availableFonts={effectiveFonts}
        galleryRemix={galleryRemix}
        initialCandidates={initialCandidates}
        shouldSyncSessionUrl={shouldSyncSessionUrl}
        initialSessionId={initialSessionId}
        initialTradition={resolvedTradition}
        resolvedStartingText={resolvedStartingText}
        initialCalTransform={initialCalLayer?.transform}
        initialSealTransform={initialSealLayer?.transform}
      />
    </StudioStoreContext.Provider>
  );
}
