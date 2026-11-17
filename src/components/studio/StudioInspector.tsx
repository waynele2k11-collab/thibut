"use client";

import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  StrokePresetOption,
  VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import type { PlacementValue } from "@/lib/print/types";
import type {
  GalleryRemixContext,
  StudioFontOption,
} from "@/lib/studio/fontPairing";
import type { GarmentInkContrastAdvice } from "@/lib/studio/garmentSwatches";
import type { StudioLiveQuote } from "@/lib/studio/studioQuote";
import type {
  CartConfirmationBanner,
  CreationMode,
  FulfillmentFormat,
  InkPigment,
  StudioLayoutMode,
  StudioStep,
  WordTreatment,
} from "@/lib/studio/studioStore";
import type { CulturalCandidate } from "@/lib/studio/useStudioAnalysis";
import type { ProductMock } from "./ProductSelectionModal";
import { StepBrushPanel } from "./StepBrushPanel";
import { StepMeaningPanel } from "./StepMeaningPanel";
import { StepProductPanel } from "./StepProductPanel";
import { StudioQuoteFooter } from "./StudioQuoteFooter";

export type { InkPigment, WordTreatment };

export interface StudioInspectorProps {
  isAdmin: boolean;
  locked?: boolean;
  activeStep: StudioStep;
  onChangeStep: (step: StudioStep) => void;
  galleryRemix: GalleryRemixContext | null;
  creationMode: CreationMode;
  onChangeCreationMode: (mode: CreationMode) => void;
  inputText: string;
  setInputText: (v: string) => void;
  renderedText: string;
  tradition: ScriptCategory;
  setTradition: (v: ScriptCategory) => void;
  treatment: WordTreatment;
  setTreatment: (v: WordTreatment) => void;
  candidates: CulturalCandidate[];
  selectedCandidate: CulturalCandidate | null;
  onSelectCandidate: (id: string) => void;
  isAnalyzing: boolean;
  availableFonts: readonly StudioFontOption[];
  activeFontOption?: StudioFontOption;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  strokePreset: StrokePresetOption;
  variationType: VariationTypeOption;
  onSelectExpression: (
    strokePreset: StrokePresetOption,
    variationType: VariationTypeOption
  ) => void;
  layoutMode: StudioLayoutMode;
  onChangeLayoutMode: (mode: StudioLayoutMode) => void;
  inkColor: InkPigment;
  setInkColor: (v: InkPigment) => void;
  contrastAdvice: GarmentInkContrastAdvice | null;
  hasSeal: boolean;
  setHasSeal: (v: boolean) => void;
  sealText: string;
  setSealText: (v: string) => void;
  sealFontFamily: string;
  setSealFontFamily: (v: string) => void;
  backgroundAssetId: string | null;
  backgroundFillMode: "cover" | "contain";
  onChangeBackgroundAsset: (assetId: string | null) => void;
  onChangeBackgroundFillMode: (fillMode: "cover" | "contain") => void;
  fulfillmentFormat: FulfillmentFormat;
  onChangeFulfillmentFormat: (format: FulfillmentFormat) => void;
  products: readonly ProductMock[];
  selectedProduct?: ProductMock;
  selectedVariantId?: string;
  onSelectProductId: (id: string) => void;
  onSelectVariant: (v: string) => void;
  onSelectProduct: () => void;
  placement: PlacementValue;
  setPlacement: (p: PlacementValue) => void;
  quote: StudioLiveQuote;
  isSaving: boolean;
  onSave: () => void;
  isAddingToCart: boolean;
  onPrimaryPurchaseAction: () => void;
  cartConfirmation: CartConfirmationBanner | null;
  onDismissCartConfirmation: () => void;
  onApplyInspiration: (preset: {
    text: string;
    tradition: ScriptCategory;
    treatment: WordTreatment;
    mode: CreationMode;
  }) => void;
}

export function StudioInspector({
  isAdmin,
  locked = false,
  activeStep,
  onChangeStep,
  galleryRemix,
  creationMode,
  onChangeCreationMode,
  inputText,
  setInputText,
  renderedText,
  tradition,
  setTradition,
  treatment,
  setTreatment,
  candidates,
  selectedCandidate,
  onSelectCandidate,
  isAnalyzing,
  availableFonts,
  activeFontOption,
  fontFamily,
  setFontFamily,
  strokePreset,
  variationType,
  onSelectExpression,
  layoutMode,
  onChangeLayoutMode,
  inkColor,
  setInkColor,
  contrastAdvice,
  hasSeal,
  setHasSeal,
  sealText,
  setSealText,
  sealFontFamily,
  setSealFontFamily,
  backgroundAssetId,
  backgroundFillMode,
  onChangeBackgroundAsset,
  onChangeBackgroundFillMode,
  fulfillmentFormat,
  onChangeFulfillmentFormat,
  products,
  selectedProduct,
  selectedVariantId,
  onSelectProductId,
  onSelectVariant,
  onSelectProduct,
  placement,
  setPlacement,
  quote,
  isSaving,
  onSave,
  isAddingToCart,
  onPrimaryPurchaseAction,
  cartConfirmation,
  onDismissCartConfirmation,
  onApplyInspiration,
}: StudioInspectorProps) {
  return (
    <div className="w-full h-full min-h-0 bg-surface-container-low lg:border-l border-surface-variant flex flex-col">
      <Tabs
        value={activeStep}
        onValueChange={(next) => {
          if (next === "MEANING" || next === "BRUSH" || next === "PRODUCT") {
            onChangeStep(next);
          }
        }}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div className="px-4 sm:px-6 pt-3 pb-3 bg-surface-container-lowest border-b border-surface-variant shrink-0 space-y-2.5">
          <div className="hidden lg:flex items-center justify-between gap-2">
            <div>
              <h1 className="font-headline-sm text-lg text-on-background leading-tight">
                Personalization Studio
              </h1>
              <p className="font-body-md text-xs text-on-surface-variant">
                {locked
                  ? "Session locked after checkout."
                  : "Meaning before strokes — craft your custom piece."}
              </p>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || locked}
              className="min-h-9 px-3 py-1.5 rounded border border-outline-variant bg-surface-container-lowest text-on-background hover:bg-surface-container-low inline-flex items-center gap-1.5 font-label-caps text-[11px] uppercase transition-colors motion-reduce:transition-none cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{isSaving ? "Saving" : "Save"}</span>
            </button>
          </div>

          <TabsList
            aria-label="Personalization steps"
            className="w-full grid grid-cols-3"
          >
            <TabsTrigger value="MEANING" className="min-h-10 px-2 text-[11px]">
              1. Meaning
            </TabsTrigger>
            <TabsTrigger value="BRUSH" className="min-h-10 px-2 text-[11px]">
              2. Brush
            </TabsTrigger>
            <TabsTrigger value="PRODUCT" className="min-h-10 px-2 text-[11px]">
              3. Product
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5">
          <TabsContent value="MEANING" className="mt-0">
            <StepMeaningPanel
              locked={locked}
              galleryRemix={galleryRemix}
              creationMode={creationMode}
              onChangeCreationMode={onChangeCreationMode}
              inputText={inputText}
              onChangeInputText={setInputText}
              tradition={tradition}
              onChangeTradition={setTradition}
              treatment={treatment}
              onChangeTreatment={setTreatment}
              candidates={candidates}
              selectedCandidate={selectedCandidate}
              onSelectCandidate={onSelectCandidate}
              isAnalyzing={isAnalyzing}
              activeFontOption={activeFontOption}
              onApplyInspiration={onApplyInspiration}
            />
          </TabsContent>

          <TabsContent value="BRUSH" className="mt-0">
            <StepBrushPanel
              locked={locked}
              renderedText={renderedText}
              tradition={tradition}
              treatment={treatment}
              availableFonts={availableFonts}
              fontFamily={fontFamily}
              onSelectFontFamily={setFontFamily}
              strokePreset={strokePreset}
              variationType={variationType}
              onSelectExpression={onSelectExpression}
              layoutMode={layoutMode}
              onChangeLayoutMode={onChangeLayoutMode}
              inkColor={inkColor}
              onSelectInkColor={setInkColor}
              contrastAdvice={contrastAdvice}
              hasSeal={hasSeal}
              onToggleSeal={setHasSeal}
              sealText={sealText}
              onChangeSealText={setSealText}
              sealFontFamily={sealFontFamily}
              onChangeSealFontFamily={setSealFontFamily}
              backgroundAssetId={backgroundAssetId}
              backgroundFillMode={backgroundFillMode}
              onChangeBackgroundAsset={onChangeBackgroundAsset}
              onChangeBackgroundFillMode={onChangeBackgroundFillMode}
            />
          </TabsContent>

          <TabsContent value="PRODUCT" className="mt-0">
            <StepProductPanel
              locked={locked}
              isAdmin={isAdmin}
              fulfillmentFormat={fulfillmentFormat}
              onChangeFulfillmentFormat={onChangeFulfillmentFormat}
              products={products}
              selectedProduct={selectedProduct}
              selectedVariantId={selectedVariantId}
              onSelectProductId={onSelectProductId}
              onSelectVariantId={onSelectVariant}
              onOpenProductModal={onSelectProduct}
              placement={placement}
              onChangePlacement={setPlacement}
            />
          </TabsContent>
        </div>
      </Tabs>

      <StudioQuoteFooter
        isAdmin={isAdmin}
        isLocked={locked}
        activeStep={activeStep}
        onChangeStep={onChangeStep}
        fulfillmentFormat={fulfillmentFormat}
        quote={quote}
        isSaving={isSaving}
        onSave={onSave}
        isAddingToCart={isAddingToCart}
        onPrimaryPurchaseAction={onPrimaryPurchaseAction}
        cartConfirmation={cartConfirmation}
        onDismissCartConfirmation={onDismissCartConfirmation}
      />
    </div>
  );
}
