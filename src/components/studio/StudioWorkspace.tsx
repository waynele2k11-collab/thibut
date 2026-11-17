"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  ShoppingCart,
} from "lucide-react";
import { z } from "zod";
import { addToCartAction } from "@/app/actions/cart";
import {
  ensureStudioSessionAction,
  saveCompositionToSession,
} from "@/app/actions/composition";
import {
  generateInstantSvgString,
  safeBase64Encode,
  type StrokePresetOption,
  type VariationTypeOption,
} from "@/lib/calligraphy/ClientCalligraphyRenderer";
import {
  DEFAULT_CALLIGRAPHY_FONT_FAMILY,
  DEFAULT_SEAL_FONT_FAMILY,
  type ScriptCategory,
} from "@/lib/fonts/fontCatalog";
import {
  CompositionSchema,
  HexColorSchema,
  type CompositionLayer,
  type DesignComposition,
  type PlacementValue,
} from "@/lib/print/types";
import { MainStageCanvas, type MainStageCanvasRef } from "./MainStageCanvas";
import { MobileStudioSheet } from "./MobileStudioSheet";
import {
  MOCK_PRODUCTS,
  ProductSelectionModal,
  type ProductMock,
} from "./ProductSelectionModal";
import {
  StudioInspector,
  type InkPigment,
  type WordTreatment,
} from "./StudioInspector";

const AnalyzeResponseSchema = z.object({
  interpretations: z
    .array(
      z.object({
        type: z.string(),
        language: z.string().optional(),
        text: z.string(),
        romanization: z.string().nullable().optional(),
        meaning: z.string().nullable().optional(),
        warning: z.string().nullable().optional(),
        recommended: z.boolean().optional(),
      })
    )
    .default([]),
});

interface CulturalInsight {
  renderedText: string;
  romanization: string | null;
  meaning: string | null;
  warning: string | null;
  typeLabel: string;
}

interface StatusBanner {
  tone: "success" | "error";
  message: string;
}

interface StudioToolbarProps {
  variant: "desktop" | "mobile";
  isAdmin: boolean;
  isLocked: boolean;
  viewMode: "RAW_ART" | "MOCKUP";
  onChangeViewMode: (mode: "RAW_ART" | "MOCKUP") => void;
  layoutMode: "HORIZONTAL" | "VERTICAL";
  onChangeLayoutMode: (mode: "HORIZONTAL" | "VERTICAL") => void;
  isSaving: boolean;
  onSave: () => void;
  isAddingToCart: boolean;
  onAddToCart: () => void;
}

function StudioToolbar({
  variant,
  isAdmin,
  isLocked,
  viewMode,
  onChangeViewMode,
  layoutMode,
  onChangeLayoutMode,
  isSaving,
  onSave,
  isAddingToCart,
  onAddToCart,
}: StudioToolbarProps) {
  const isDesktop = variant === "desktop";

  return (
    <div
      className={
        isDesktop
          ? "hidden lg:flex absolute top-5 left-1/2 -translate-x-1/2 z-10 items-center gap-3 bg-surface-container-lowest/95 backdrop-blur-md px-4 py-2 border border-surface-variant"
          : "lg:hidden absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between bg-surface-container-lowest/95 backdrop-blur-md px-3 py-2 border-t border-surface-variant gap-2"
      }
    >
      <Link
        href={isAdmin ? "/admin/gallery" : "/"}
        aria-label="Exit Studio"
        className="p-2 text-on-surface-variant hover:text-on-background transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      {/* View Mode Toggle */}
      <div
        className={`flex bg-surface-container-low border border-surface-variant p-0.5 ${
          isDesktop ? "" : "flex-1 max-w-[168px]"
        }`}
      >
        <button
          type="button"
          onClick={() => onChangeViewMode("RAW_ART")}
          className={`${
            isDesktop ? "px-3.5 py-1.5 text-xs" : "flex-1 py-1.5 text-[11px]"
          } font-label-caps uppercase transition-colors cursor-pointer ${
            viewMode === "RAW_ART"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          {isDesktop ? "Raw Art" : "Art"}
        </button>
        <button
          type="button"
          onClick={() => onChangeViewMode("MOCKUP")}
          className={`${
            isDesktop ? "px-3.5 py-1.5 text-xs" : "flex-1 py-1.5 text-[11px]"
          } font-label-caps uppercase transition-colors cursor-pointer ${
            viewMode === "MOCKUP"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          {isDesktop ? "Mockup" : "Mock"}
        </button>
      </div>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      {/* Layout Orientation Toggle */}
      <div className="flex bg-surface-container-low border border-surface-variant p-0.5">
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onChangeLayoutMode("VERTICAL")}
          title="Vertical Column"
          aria-label="Vertical layout"
          className={`px-2.5 py-1.5 text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            layoutMode === "VERTICAL"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          ⬇
        </button>
        <button
          type="button"
          disabled={isLocked}
          onClick={() => onChangeLayoutMode("HORIZONTAL")}
          title="Horizontal Scroll"
          aria-label="Horizontal layout"
          className={`px-2.5 py-1.5 text-xs transition-colors cursor-pointer disabled:opacity-50 ${
            layoutMode === "HORIZONTAL"
              ? "bg-surface-container-lowest text-on-background border border-surface-variant"
              : "text-on-surface-variant hover:text-on-background"
          }`}
        >
          ➡
        </button>
      </div>

      {isDesktop && <div className="w-px h-6 bg-surface-variant" />}

      {/* Save Composition Action (T-302) */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || isLocked}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant bg-surface-container-lowest text-on-background hover:bg-surface-container-low transition-colors text-xs font-label-caps uppercase disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
      >
        {isSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        <span>{isSaving ? "Saving" : "Save"}</span>
      </button>

      {/* Primary Cart CTA */}
      {!isAdmin && (
        <button
          type="button"
          onClick={onAddToCart}
          disabled={isAddingToCart || isLocked}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary text-on-secondary hover:opacity-90 transition-opacity text-xs font-label-caps uppercase disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isAddingToCart ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShoppingCart className="w-3.5 h-3.5" />
          )}
          <span>
            {isAddingToCart
              ? "Adding"
              : isDesktop
                ? "Add to Cart"
                : "Cart"}
          </span>
        </button>
      )}
    </div>
  );
}

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

export function StudioWorkspace({
  isAdmin = false,
  products = MOCK_PRODUCTS,
  sessionId: initialSessionId,
  initialText,
  initialTradition = "VIETNAMESE_THU_PHAP",
  initialTreatment = "KEEP_ORIGINAL",
  initialComposition = null,
  initialLocked = false,
}: StudioWorkspaceProps) {
  const canvasRef = useRef<MainStageCanvasRef>(null);
  const router = useRouter();

  const initialCalLayer = initialComposition?.layers.find(
    (l) => l.type === "calligraphy"
  );
  const initialSealLayer = initialComposition?.layers.find(
    (l) => l.type === "seal"
  );

  const resolvedStartingText =
    initialCalLayer?.text || initialText?.trim() || "Có Chí Thì Nên";

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    initialSessionId
  );
  const [isLocked, setIsLocked] = useState<boolean>(initialLocked);

  // Canvas & Layout state
  const [viewMode, setViewMode] = useState<"RAW_ART" | "MOCKUP">("RAW_ART");
  const [layoutMode, setLayoutMode] = useState<"HORIZONTAL" | "VERTICAL">(
    initialCalLayer?.layout === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL"
  );

  // Calligraphy & Inspector state
  const [inputText, setInputText] = useState<string>(resolvedStartingText);
  const [tradition, setTradition] =
    useState<ScriptCategory>(initialTradition);
  const [treatment, setTreatment] =
    useState<WordTreatment>(initialTreatment);
  const [strokePreset, setStrokePreset] =
    useState<StrokePresetOption>("BOLD_BRUSH");
  const [variationType] = useState<VariationTypeOption>("01_CONTROLLED");
  const [fontFamily, setFontFamily] = useState<string>(
    initialCalLayer?.fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY
  );
  const [inkColor, setInkColor] = useState<InkPigment>(
    initialCalLayer?.colorHex || initialComposition?.color || "#121212"
  );
  const [hasSeal, setHasSeal] = useState<boolean>(Boolean(initialSealLayer));
  const [sealText, setSealText] = useState<string>(
    initialSealLayer?.sealText || "印"
  );
  const [sealFontFamily, setSealFontFamily] = useState<string>(
    initialSealLayer?.fontFamily || DEFAULT_SEAL_FONT_FAMILY
  );
  const [placement, setPlacement] = useState<PlacementValue>(
    initialComposition?.placement || "front"
  );

  // Cultural Meaning & Romanization async cache (INV-011, T-408)
  const [analyzedResult, setAnalyzedResult] = useState<{
    key: string;
    insight: CulturalInsight;
  } | null>(null);
  const [analyzingKey, setAnalyzingKey] = useState<string | null>(null);

  // Merchandise & Persistence state
  const initialMatchedProduct = initialComposition?.productVariantId
    ? products.find((p) =>
        p.variants?.some((v) => v.id === initialComposition.productVariantId)
      )
    : undefined;

  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >(initialMatchedProduct?.id ?? products[0]?.id);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0];

  const [selectedVariantId, setSelectedVariantId] = useState<
    string | undefined
  >(
    initialComposition?.productVariantId ?? selectedProduct?.variants?.[0]?.id
  );
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);

  const effectiveVariantId = useMemo(() => {
    const variants = selectedProduct?.variants;
    if (!variants || variants.length === 0) {
      return undefined;
    }
    if (
      selectedVariantId &&
      variants.some((variant) => variant.id === selectedVariantId)
    ) {
      return selectedVariantId;
    }
    return variants[0].id;
  }, [selectedProduct, selectedVariantId]);

  const cleanInput = inputText.trim();
  const currentInsightKey = `${cleanInput}|${tradition}|${treatment}`;
  const matchedInsight =
    analyzedResult && analyzedResult.key === currentInsightKey
      ? analyzedResult.insight
      : null;

  const renderedText = !cleanInput
    ? "Thi Bút"
    : treatment === "KEEP_ORIGINAL"
      ? cleanInput
      : (matchedInsight?.renderedText ?? cleanInput);

  const culturalInsight: CulturalInsight = !cleanInput
    ? {
        renderedText: "Thi Bút",
        romanization: null,
        meaning: "Enter a word or phrase to see its cultural interpretation.",
        warning: null,
        typeLabel: "Studio Default",
      }
    : (matchedInsight ?? {
        renderedText: cleanInput,
        romanization: null,
        meaning:
          cleanInput === "Có Chí Thì Nên"
            ? "Perseverance turns aspiration into mastery."
            : null,
        warning: null,
        typeLabel:
          treatment === "KEEP_ORIGINAL" ? "Original Phrase" : "Interpreting",
      });

  const isAnalyzing = Boolean(cleanInput) && analyzingKey === currentInsightKey;

  // Ensure caller-bound PersonalizationSession on mount
  useEffect(() => {
    let cancelled = false;
    ensureStudioSessionAction({
      ...(initialSessionId ? { sessionId: initialSessionId } : {}),
      inputText: resolvedStartingText,
      culturalStyle: initialTradition,
    })
      .then((res) => {
        if (cancelled || !res.ok) return;
        setActiveSessionId(res.sessionId);
        setIsLocked(res.locked);
      })
      .catch(() => {
        // Offline or non-critical bootstrap failure; Save/Cart actions also ensure identity
      });

    return () => {
      cancelled = true;
    };
  }, [initialSessionId, initialTradition, resolvedStartingText]);

  // Wire treatment + inputText + tradition to /api/personalization/analyze (T-408, INV-011)
  useEffect(() => {
    if (!cleanInput) {
      return;
    }

    const apiTreatment =
      treatment === "MATCH_SOUND"
        ? "PHONETIC"
        : treatment === "TRANSLATE_MEANING"
          ? "TRANSLATE"
          : "KEEP_ORIGINAL";

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAnalyzingKey(currentInsightKey);
      try {
        const res = await fetch("/api/personalization/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText: cleanInput,
            culturalStyle: tradition,
            textTreatment: apiTreatment,
            mode: cleanInput.includes(" ") ? "QUOTE" : "NAME",
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          return;
        }

        const rawJson: unknown = await res.json();
        const parsed = AnalyzeResponseSchema.safeParse(rawJson);
        if (!parsed.success || parsed.data.interpretations.length === 0) {
          return;
        }

        const list = parsed.data.interpretations;
        const preferred =
          list.find((item) => item.recommended) ?? list[0];

        const nextRendered = preferred.text.trim() || cleanInput;
        setAnalyzedResult({
          key: currentInsightKey,
          insight: {
            renderedText: nextRendered,
            romanization: preferred.romanization ?? null,
            meaning: preferred.meaning ?? null,
            warning: preferred.warning ?? null,
            typeLabel: preferred.type.replace(/_/g, " "),
          },
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          setAnalyzingKey((prev) =>
            prev === currentInsightKey ? null : prev
          );
        }
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cleanInput, currentInsightKey, tradition, treatment]);

  // Strictly memoized calligraphy SVG (T-404, TB-CALLI-005):
  // Keyed ONLY on [renderedText, fontFamily, layoutMode, strokePreset, variationType].
  // Changing product, variant, inkColor, viewMode, placement, or seal NEVER regenerates SVG!
  const artworkSvgString = useMemo(
    () =>
      generateInstantSvgString({
        text: renderedText,
        fontFamily,
        layout: layoutMode,
        strokePreset,
        variationType,
        inkColor: "#121212",
        hasSeal: false,
      }),
    [renderedText, fontFamily, layoutMode, strokePreset, variationType]
  );

  const artworkSvgDataUri = useMemo(
    () => `data:image/svg+xml;base64,${safeBase64Encode(artworkSvgString)}`,
    [artworkSvgString]
  );

  const mockupImage =
    selectedProduct?.imageUrl ||
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";

  // Build validated CompositionSchema from live normalized stage coordinates (T-302, INV-013)
  const buildCurrentComposition = useCallback((): DesignComposition => {
    const stageTransforms = canvasRef.current?.getNormalizedTransform();
    const artworkTransform = stageTransforms?.artwork ?? {
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
    };

    const safeHex = HexColorSchema.safeParse(inkColor).success
      ? inkColor
      : "#121212";

    const calligraphyText =
      (renderedText.trim() || inputText.trim() || "Thi Bút").slice(0, 200);

    const layers: CompositionLayer[] = [
      {
        id: "layer-calligraphy-main",
        type: "calligraphy",
        text: calligraphyText,
        fontFamily: fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        layout: layoutMode,
        colorHex: safeHex,
        zIndex: 10,
        opacity: 1,
        transform: artworkTransform,
      },
    ];

    if (hasSeal) {
      layers.push({
        id: "layer-seal-chop",
        type: "seal",
        sealText: (sealText.trim() || "印").slice(0, 12),
        fontFamily: sealFontFamily || DEFAULT_SEAL_FONT_FAMILY,
        colorHex: "#B71032",
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
      ...(effectiveVariantId ? { productVariantId: effectiveVariantId } : {}),
      placement,
      color: safeHex,
      transform: artworkTransform,
      layers,
    });
  }, [
    effectiveVariantId,
    fontFamily,
    hasSeal,
    inkColor,
    inputText,
    layoutMode,
    placement,
    renderedText,
    sealFontFamily,
    sealText,
  ]);

  const handleSaveComposition = async () => {
    if (isSaving || isLocked) return;
    setIsSaving(true);
    setStatusBanner(null);

    try {
      let targetSessionId = activeSessionId;
      if (!targetSessionId) {
        const ensured = await ensureStudioSessionAction({
          inputText: renderedText || inputText || "Thi Bút",
          culturalStyle: tradition,
        });
        if (!ensured.ok || !ensured.sessionId) {
          setStatusBanner({
            tone: "error",
            message: ensured.error || "Unable to initialize Studio session.",
          });
          setIsSaving(false);
          return;
        }
        targetSessionId = ensured.sessionId;
        setActiveSessionId(ensured.sessionId);
        if (ensured.locked) {
          setIsLocked(true);
          setStatusBanner({
            tone: "error",
            message: "This session is locked after checkout.",
          });
          setIsSaving(false);
          return;
        }
      }

      const composition = buildCurrentComposition();
      await saveCompositionToSession(targetSessionId, composition);

      setStatusBanner({
        tone: "success",
        message: "Composition saved to your Studio session.",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to save composition. Please try again.";
      setStatusBanner({ tone: "error", message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCart = async () => {
    if (isAddingToCart || isLocked) return;
    setStatusBanner(null);

    if (!effectiveVariantId) {
      setStatusBanner({
        tone: "error",
        message:
          "Please select an active product variant (color & size) in the Merchandise section.",
      });
      return;
    }

    setIsAddingToCart(true);
    try {
      const composition = buildCurrentComposition();
      const res = await addToCartAction({
        variantId: effectiveVariantId,
        composition,
        text: (renderedText.trim() || inputText.trim() || "Thi Bút").slice(
          0,
          200
        ),
        fontFamily: fontFamily || DEFAULT_CALLIGRAPHY_FONT_FAMILY,
        tradition,
        placement,
        ...(activeSessionId ? { sessionId: activeSessionId } : {}),
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
        router.push("/cart");
        return;
      }

      setStatusBanner({
        tone: "error",
        message: res.error || "Unable to add item to cart.",
      });
    } catch {
      setStatusBanner({
        tone: "error",
        message: "Unexpected error while adding item to cart.",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const inspectorProps = {
    isAdmin,
    locked: isLocked,
    inputText,
    setInputText,
    tradition,
    setTradition,
    treatment,
    setTreatment,
    strokePreset,
    setStrokePreset,
    inkColor,
    setInkColor,
    hasSeal,
    setHasSeal,
    sealText,
    setSealText,
    sealFontFamily,
    setSealFontFamily,
    fontFamily,
    setFontFamily,
    placement,
    setPlacement,
    selectedProduct,
    selectedVariantId: effectiveVariantId,
    onSelectVariant: setSelectedVariantId,
    onSelectProduct: () => setIsProductModalOpen(true),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] h-[100dvh] w-full bg-background font-body-md text-on-background overflow-hidden">
      {/* ── CANVAS & MEANING COLUMN ─────────────────────────────────────── */}
      <div className="relative flex flex-col bg-background w-full overflow-hidden h-[54vh] lg:h-full">
        {/* Shared Toolbar (Desktop & Mobile — T-092) */}
        <StudioToolbar
          variant="desktop"
          isAdmin={isAdmin}
          isLocked={isLocked}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
          isSaving={isSaving}
          onSave={handleSaveComposition}
          isAddingToCart={isAddingToCart}
          onAddToCart={handleAddToCart}
        />

        <StudioToolbar
          variant="mobile"
          isAdmin={isAdmin}
          isLocked={isLocked}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
          isSaving={isSaving}
          onSave={handleSaveComposition}
          isAddingToCart={isAddingToCart}
          onAddToCart={handleAddToCart}
        />

        {/* Inline Status / Lock Notification */}
        <div
          aria-live="polite"
          className="absolute top-4 lg:top-20 left-4 right-4 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 z-20 flex flex-col gap-2 max-w-md pointer-events-none"
        >
          {isLocked && (
            <div className="pointer-events-auto bg-surface-container-lowest border border-surface-variant px-4 py-2.5 flex items-center gap-2 text-xs text-on-background">
              <Lock className="w-4 h-4 text-secondary shrink-0" />
              <span>
                This composition is locked because an order has been created
                from this session.
              </span>
            </div>
          )}

          {statusBanner && (
            <div
              className={`pointer-events-auto px-4 py-2.5 border flex items-center justify-between gap-3 text-xs ${
                statusBanner.tone === "error"
                  ? "bg-error-container text-on-error-container border-error"
                  : "bg-surface-container-lowest text-on-background border-primary"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusBanner.tone === "error" ? (
                  <AlertCircle className="w-4 h-4 text-error shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
                <span>{statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="underline font-label-caps uppercase text-[10px] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Main Interactive Fabric Stage */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <MainStageCanvas
            ref={canvasRef}
            viewMode={viewMode}
            artworkSvgUrl={artworkSvgDataUri}
            fontFamily={fontFamily}
            inkColor={inkColor}
            productImageUrl={viewMode === "MOCKUP" ? mockupImage : undefined}
            hasSeal={hasSeal}
            sealStyle="IMPERIAL_RED"
            sealColor="#B71032"
            sealText={sealText}
            sealFontFamily={sealFontFamily}
            initialArtworkTransform={initialCalLayer?.transform}
            initialSealTransform={initialSealLayer?.transform}
            locked={isLocked}
          />
        </div>

        {/* Separate Cultural Meaning & Romanization Panel (T-408, INV-011 — NEVER baked inside SVG) */}
        <aside
          aria-label="Cultural Meaning and Romanization"
          className="hidden lg:flex items-center justify-between gap-6 px-8 py-4 bg-surface-container-lowest border-t border-surface-variant shrink-0"
        >
          <div className="flex items-start gap-3 min-w-0">
            <BookOpen className="w-4 h-4 text-secondary shrink-0 mt-1" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                  Cultural Meaning &amp; Romanization ({culturalInsight.typeLabel})
                </span>
                {isAnalyzing && (
                  <span className="inline-flex items-center gap-1 font-label-caps text-[10px] uppercase text-secondary">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing
                  </span>
                )}
              </div>
              <p className="font-body-md text-sm text-on-background mt-0.5 truncate">
                <span className="font-medium">
                  &ldquo;{culturalInsight.renderedText}&rdquo;
                </span>
                {culturalInsight.romanization ? (
                  <span className="text-on-surface-variant">
                    {" "}
                    · {culturalInsight.romanization}
                  </span>
                ) : null}
                {culturalInsight.meaning ? (
                  <span className="text-on-surface-variant italic">
                    {" "}
                    — {culturalInsight.meaning}
                  </span>
                ) : null}
              </p>
              {culturalInsight.warning && (
                <p className="text-xs text-error mt-0.5">
                  {culturalInsight.warning}
                </p>
              )}
            </div>
          </div>

          {activeSessionId && !isAdmin && !isLocked && (
            <Link
              href={`/checkout?sessionId=${encodeURIComponent(activeSessionId)}&digital=true`}
              className="shrink-0 font-label-caps text-[11px] uppercase text-secondary hover:underline"
            >
              Buy 300 DPI Digital Master
            </Link>
          )}
        </aside>
      </div>

      {/* ── DESKTOP INSPECTOR ────────────────────────────────────────────── */}
      <div className="hidden lg:flex h-full relative z-20 w-[390px] bg-surface-container-low">
        <StudioInspector {...inspectorProps} />
      </div>

      {/* ── MOBILE BOTTOM SHEET INSPECTOR ───────────────────────────────── */}
      <MobileStudioSheet>
        <div className="px-6 pt-2 pb-3 border-b border-surface-variant bg-surface-container-lowest">
          <p className="font-label-caps text-[10px] uppercase text-on-surface-variant">
            Cultural Meaning ({culturalInsight.typeLabel})
          </p>
          <p className="text-xs text-on-background mt-0.5">
            <strong>{culturalInsight.renderedText}</strong>
            {culturalInsight.romanization
              ? ` · ${culturalInsight.romanization}`
              : ""}
            {culturalInsight.meaning ? ` — ${culturalInsight.meaning}` : ""}
          </p>
        </div>
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
