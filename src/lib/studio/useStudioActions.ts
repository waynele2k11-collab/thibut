"use client";

import { useCallback, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { addToCartAction } from "@/app/actions/cart";
import {
  ensureStudioSessionAction,
  saveCompositionToSession,
} from "@/app/actions/composition";
import {
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  DEFAULT_SEAL_FONT_FAMILY,
} from "@/lib/fonts/fontCatalog";
import {
  AssetLayerSchema,
  CompositionSchema,
  HexColorSchema,
  type CompositionLayer,
  type DesignComposition,
} from "@/lib/print/types";
import type { MainStageCanvasRef } from "@/components/studio/MainStageCanvas";
import { DEFAULT_INK_HEX, SEAL_VERMILION_HEX } from "./inkPalette";
import type { StudioState, StudioStore } from "./studioStore";

export function useStudioActions({
  state,
  setState,
  canvasRef,
  renderedText,
  effectiveVariantId,
  selectedProductName,
}: {
  state: StudioState;
  setState: StudioStore["setState"];
  canvasRef: RefObject<MainStageCanvasRef | null>;
  renderedText: string;
  effectiveVariantId: string | undefined;
  selectedProductName?: string;
}) {
  const router = useRouter();

  const buildCurrentComposition = useCallback((): DesignComposition => {
    const stageTransforms = canvasRef.current?.getNormalizedTransform();
    const artworkTransform = stageTransforms?.artwork ?? {
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
    };

    const safeHex = HexColorSchema.safeParse(state.inkColor).success
      ? state.inkColor
      : DEFAULT_INK_HEX;

    const calligraphyText = (
      renderedText.trim() ||
      state.inputText.trim() ||
      "Thi Bút"
    ).slice(0, 200);

    const layers: CompositionLayer[] = [];

    if (state.backgroundAssetId) {
      const parsedBgLayer = AssetLayerSchema.safeParse({
        id: "layer-background-asset",
        type: "asset",
        assetId: state.backgroundAssetId,
        fillMode: state.backgroundFillMode,
        zIndex: 0,
        opacity: 1,
        transform: {
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
        },
      });
      if (parsedBgLayer.success) {
        layers.push(parsedBgLayer.data);
      }
    }

    layers.push({
      id: "layer-calligraphy-main",
      type: "calligraphy",
      text: calligraphyText,
      fontFamily: state.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
      layout: state.layoutMode,
      colorHex: safeHex,
      zIndex: 10,
      opacity: 1,
      transform: artworkTransform,
    });

    if (state.hasSeal) {
      layers.push({
        id: "layer-seal-chop",
        type: "seal",
        sealText: (state.sealText.trim() || "印").slice(0, 12),
        fontFamily: state.sealFontFamily || DEFAULT_SEAL_FONT_FAMILY,
        colorHex: SEAL_VERMILION_HEX,
        zIndex: 20,
        opacity: 0.92,
        transform: stageTransforms?.seal ?? {
          x: 0.72,
          y: 0.68,
          scale: 0.25,
          rotation: 0,
        },
      });
    }

    return CompositionSchema.parse({
      version: 1,
      ...(effectiveVariantId && state.fulfillmentFormat === "PHYSICAL"
        ? { productVariantId: effectiveVariantId }
        : {}),
      placement: state.placement,
      color: safeHex,
      transform: artworkTransform,
      layers,
    });
  }, [
    canvasRef,
    effectiveVariantId,
    renderedText,
    state.backgroundAssetId,
    state.backgroundFillMode,
    state.fontFamily,
    state.fulfillmentFormat,
    state.hasSeal,
    state.inkColor,
    state.inputText,
    state.layoutMode,
    state.placement,
    state.sealFontFamily,
    state.sealText,
  ]);

  const ensurePersistedSessionId = useCallback(async (): Promise<
    string | null
  > => {
    if (state.activeSessionId) {
      return state.activeSessionId;
    }

    const ensured = await ensureStudioSessionAction({
      inputText: (renderedText || state.inputText || "Thi Bút").slice(0, 200),
      culturalStyle: state.tradition,
    });

    if (!ensured.ok || !ensured.sessionId) {
      setState({
        statusBanner: {
          tone: "error",
          message: ensured.error || "Unable to initialize Studio session.",
        },
      });
      return null;
    }

    if (ensured.locked) {
      setState({
        activeSessionId: ensured.sessionId,
        isLocked: true,
        statusBanner: {
          tone: "error",
          message: "This session is locked after checkout.",
        },
      });
      return null;
    }

    setState({ activeSessionId: ensured.sessionId });
    return ensured.sessionId;
  }, [
    renderedText,
    setState,
    state.activeSessionId,
    state.inputText,
    state.tradition,
  ]);

  const handleSaveComposition = useCallback(async () => {
    if (state.isSaving || state.isLocked) return;
    setState({ isSaving: true, statusBanner: null });

    try {
      const targetSessionId = await ensurePersistedSessionId();
      if (!targetSessionId) {
        return;
      }

      const composition = buildCurrentComposition();
      await saveCompositionToSession(targetSessionId, composition);
      setState({
        statusBanner: {
          tone: "success",
          message: "Draft saved to your Personalization Studio session.",
        },
      });
    } catch (err: unknown) {
      setState({
        statusBanner: {
          tone: "error",
          message:
            err instanceof Error
              ? err.message
              : "Unable to save composition. Please try again.",
        },
      });
    } finally {
      setState({ isSaving: false });
    }
  }, [
    buildCurrentComposition,
    ensurePersistedSessionId,
    setState,
    state.isLocked,
    state.isSaving,
  ]);

  const handleCheckoutDigitalMaster = useCallback(async () => {
    if (state.isAddingToCart || state.isLocked) return;
    setState({ isAddingToCart: true, statusBanner: null });

    try {
      const targetSessionId = await ensurePersistedSessionId();
      if (!targetSessionId) {
        return;
      }

      const composition = buildCurrentComposition();
      await saveCompositionToSession(targetSessionId, composition);
      router.push(
        `/checkout?sessionId=${encodeURIComponent(targetSessionId)}&digital=true`
      );
    } catch (err: unknown) {
      setState({
        statusBanner: {
          tone: "error",
          message:
            err instanceof Error
              ? err.message
              : "Unable to prepare 300 DPI Digital Master checkout.",
        },
      });
    } finally {
      setState({ isAddingToCart: false });
    }
  }, [
    buildCurrentComposition,
    ensurePersistedSessionId,
    router,
    setState,
    state.isAddingToCart,
    state.isLocked,
  ]);

  const handleAddToCart = useCallback(async () => {
    if (state.isAddingToCart || state.isLocked) return;
    setState({ statusBanner: null, cartConfirmation: null });

    if (state.fulfillmentFormat === "DIGITAL") {
      await handleCheckoutDigitalMaster();
      return;
    }

    if (!effectiveVariantId) {
      setState({
        statusBanner: {
          tone: "error",
          message:
            "Catalog temporarily unavailable — switch to 300 DPI Digital Master or select an active variant.",
        },
      });
      return;
    }

    setState({ isAddingToCart: true });
    try {
      const composition = buildCurrentComposition();
      const res = await addToCartAction({
        variantId: effectiveVariantId,
        composition,
        text: (renderedText.trim() || state.inputText.trim() || "Thi Bút").slice(
          0,
          200
        ),
        fontFamily: state.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        tradition: state.tradition,
        placement: state.placement,
        ...(state.activeSessionId ? { sessionId: state.activeSessionId } : {}),
        quantity: 1,
      });

      if (res.success) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("thibut-cart-refresh", {
              detail: { count: res.count },
            })
          );
        }
        setState({
          cartConfirmation: {
            cartId: res.cartId,
            count: res.count ?? 1,
            productLabel: selectedProductName || "Custom Calligraphy Piece",
          },
        });
        return;
      }

      setState({
        statusBanner: {
          tone: "error",
          message: res.error || "Unable to add item to cart.",
        },
      });
    } catch {
      setState({
        statusBanner: {
          tone: "error",
          message: "Unexpected error while adding item to cart.",
        },
      });
    } finally {
      setState({ isAddingToCart: false });
    }
  }, [
    buildCurrentComposition,
    effectiveVariantId,
    handleCheckoutDigitalMaster,
    renderedText,
    selectedProductName,
    setState,
    state.activeSessionId,
    state.fontFamily,
    state.fulfillmentFormat,
    state.inputText,
    state.isAddingToCart,
    state.isLocked,
    state.placement,
    state.tradition,
  ]);

  return {
    handleSaveComposition,
    handleAddToCart,
    handleCheckoutDigitalMaster,
  };
}
