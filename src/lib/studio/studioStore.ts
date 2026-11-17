"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type {
  StrokePresetOption,
  VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import type { PlacementValue } from "@/lib/print/types";

export type WordTreatment =
  | "KEEP_ORIGINAL"
  | "MATCH_SOUND"
  | "TRANSLATE_MEANING";

export type InkPigment = string;

export type StudioStep = "MEANING" | "BRUSH" | "PRODUCT";

export type CreationMode = "QUOTE" | "NAME" | "STORY" | "CREATOR_ART";

export type FulfillmentFormat = "PHYSICAL" | "DIGITAL";

export type StudioLayoutMode = "HORIZONTAL" | "VERTICAL" | "EMBLEM";

export interface StudioStatusBanner {
  tone: "success" | "error";
  message: string;
}

export interface CartConfirmationBanner {
  cartId?: string;
  count: number;
  productLabel: string;
}

export interface StudioState {
  activeSessionId: string | undefined;
  isLocked: boolean;
  activeStep: StudioStep;
  creationMode: CreationMode;
  fulfillmentFormat: FulfillmentFormat;
  selectedInterpretationId: string | null;
  viewMode: "RAW_ART" | "MOCKUP";
  layoutMode: StudioLayoutMode;
  inputText: string;
  tradition: ScriptCategory;
  treatment: WordTreatment;
  strokePreset: StrokePresetOption;
  variationType: VariationTypeOption;
  fontFamily: string;
  inkColor: InkPigment;
  hasSeal: boolean;
  sealText: string;
  sealFontFamily: string;
  backgroundAssetId: string | null;
  backgroundFillMode: "cover" | "contain";
  placement: PlacementValue;
  selectedProductId: string | undefined;
  selectedVariantId: string | undefined;
  isProductModalOpen: boolean;
  isSaving: boolean;
  isAddingToCart: boolean;
  statusBanner: StudioStatusBanner | null;
  cartConfirmation: CartConfirmationBanner | null;
}

export type StudioStateInput = Omit<
  StudioState,
  | "activeStep"
  | "creationMode"
  | "fulfillmentFormat"
  | "selectedInterpretationId"
  | "backgroundAssetId"
  | "backgroundFillMode"
  | "cartConfirmation"
> & {
  activeStep?: StudioStep;
  creationMode?: CreationMode;
  fulfillmentFormat?: FulfillmentFormat;
  selectedInterpretationId?: string | null;
  backgroundAssetId?: string | null;
  backgroundFillMode?: "cover" | "contain";
  cartConfirmation?: CartConfirmationBanner | null;
};

export interface StudioStore {
  getState: () => StudioState;
  setState: (
    updater: Partial<StudioState> | ((prev: StudioState) => Partial<StudioState>)
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStudioStore(initialInput: StudioStateInput): StudioStore {
  let state: StudioState = {
    ...initialInput,
    activeStep: initialInput.activeStep ?? "MEANING",
    creationMode: initialInput.creationMode ?? "QUOTE",
    fulfillmentFormat: initialInput.fulfillmentFormat ?? "PHYSICAL",
    selectedInterpretationId: initialInput.selectedInterpretationId ?? null,
    backgroundAssetId: initialInput.backgroundAssetId ?? null,
    backgroundFillMode: initialInput.backgroundFillMode ?? "contain",
    cartConfirmation: initialInput.cartConfirmation ?? null,
  };
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (updater) => {
      const partial = typeof updater === "function" ? updater(state) : updater;
      state = { ...state, ...partial };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const StudioStoreContext = createContext<StudioStore | null>(null);

export function useStudioStore(): [StudioState, StudioStore["setState"]] {
  const store = useContext(StudioStoreContext);
  if (!store) {
    throw new Error("useStudioStore must be used within a StudioStoreContext.Provider");
  }
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );
  return [state, store.setState];
}
