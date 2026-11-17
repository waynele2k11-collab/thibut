"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type {
  StrokePresetOption,
  VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import type { ScriptCategory } from "@/lib/fonts/fontCatalog";
import type { PlacementValue } from "@/lib/print/types";
import type { InkPigment, WordTreatment } from "@/components/studio/StudioInspector";

export interface StudioStatusBanner {
  tone: "success" | "error";
  message: string;
}

export interface StudioState {
  activeSessionId: string | undefined;
  isLocked: boolean;
  viewMode: "RAW_ART" | "MOCKUP";
  layoutMode: "HORIZONTAL" | "VERTICAL";
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
  placement: PlacementValue;
  selectedProductId: string | undefined;
  selectedVariantId: string | undefined;
  isProductModalOpen: boolean;
  isSaving: boolean;
  isAddingToCart: boolean;
  statusBanner: StudioStatusBanner | null;
}

export interface StudioStore {
  getState: () => StudioState;
  setState: (
    updater: Partial<StudioState> | ((prev: StudioState) => Partial<StudioState>)
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStudioStore(initialState: StudioState): StudioStore {
  let state = initialState;
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
