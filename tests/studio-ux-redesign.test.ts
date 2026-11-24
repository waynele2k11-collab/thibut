import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductMock } from "@/components/studio/ProductSelectionModal";
import { StepBrushPanel } from "@/components/studio/StepBrushPanel";
import { StepMeaningPanel } from "@/components/studio/StepMeaningPanel";
import { StepProductPanel } from "@/components/studio/StepProductPanel";
import { StudioQuoteFooter } from "@/components/studio/StudioQuoteFooter";
import {
  DEFAULT_STUDIO_FONT_OPTIONS,
  getFontsForTradition,
  resolveTraditionFontPairing,
} from "@/lib/studio/fontPairing";
import {
  detectGarmentInkContrastIssue,
  extractProductColorOptions,
  extractSizesForSelectedColor,
  findVariantForColorSwitch,
} from "@/lib/studio/garmentSwatches";
import {
  DEFAULT_INK_HEX,
  PURE_WHITE_HEX,
} from "@/lib/studio/inkPalette";
import {
  mapGalleryTraditionToScriptCategory,
  matchGalleryProductToCatalog,
} from "@/lib/studio/loadStudioEntryContext";
import { computeStudioLiveQuote } from "@/lib/studio/studioQuote";
import { formatInterpretationBadgeLabel } from "@/lib/studio/useStudioAnalysis";
import { AnalyzeRequestSchema } from "@/lib/services/personalization/analyzeService";

const SAMPLE_PRODUCTS: ProductMock[] = [
  {
    id: "prod-hoodie",
    name: "Premium Washi Hoodie",
    category: "hoodie",
    priceMinor: "3499",
    formattedPrice: "$34.99",
    imageUrl: "/mockups/hoodie.jpg",
    description: "Heavyweight brushed fleece hoodie.",
    variants: [
      {
        id: "var-white-m",
        size: "M",
        color: "Paper White",
        colorHex: "#FFFFFF",
        retailPriceMinor: "3499",
      },
      {
        id: "var-white-l",
        size: "L",
        color: "Paper White",
        colorHex: "#FFFFFF",
        retailPriceMinor: "3499",
      },
      {
        id: "var-black-m",
        size: "M",
        color: "Sumi Black",
        colorHex: "#121212",
        retailPriceMinor: "3699",
      },
      {
        id: "var-black-l",
        size: "L",
        color: "Sumi Black",
        colorHex: "#121212",
        retailPriceMinor: "3699",
      },
    ],
  },
  {
    id: "prod-canvas",
    name: "Framed Archival Canvas",
    category: "canvas",
    priceMinor: "4999",
    formattedPrice: "$49.99",
    imageUrl: "/mockups/framed_print.jpg",
    description: "Museum-grade cotton canvas.",
    variants: [
      {
        id: "var-canvas-std",
        size: "18x24",
        color: "Natural",
        colorHex: "#F6F1E7",
        retailPriceMinor: "4999",
      },
    ],
  },
];

test("UX-01: AnalyzeRequestSchema accepts optional sessionId UUID and rejects nil UUID", () => {
  const validWithSession = AnalyzeRequestSchema.safeParse({
    sessionId: "123e4567-e89b-12d3-a456-426614174000",
    inputText: "Never Give Up",
    culturalStyle: "JAPANESE_SHODO",
    textTreatment: "TRANSLATE",
    mode: "QUOTE",
  });
  assert.equal(validWithSession.success, true);

  const validWithoutSession = AnalyzeRequestSchema.safeParse({
    inputText: "Never Give Up",
    culturalStyle: "JAPANESE_SHODO",
    textTreatment: "TRANSLATE",
    mode: "QUOTE",
  });
  assert.equal(validWithoutSession.success, true);

  const rejectedNilSession = AnalyzeRequestSchema.safeParse({
    sessionId: "00000000-0000-0000-0000-000000000000",
    inputText: "Never Give Up",
    culturalStyle: "JAPANESE_SHODO",
    textTreatment: "TRANSLATE",
    mode: "QUOTE",
  });
  assert.equal(rejectedNilSession.success, false);
});

test("UX-01: Gallery 'Make It Yours' tradition & catalog product matching hydrates accurately", () => {
  assert.equal(
    mapGalleryTraditionToScriptCategory("JAPANESE_SHODO", "ja"),
    "JAPANESE_SHODO"
  );
  assert.equal(
    mapGalleryTraditionToScriptCategory(null, "ko-KR"),
    "KOREAN_BRUSH"
  );
  assert.equal(
    mapGalleryTraditionToScriptCategory("Chinese Shufa", null),
    "CHINESE_CALLIGRAPHY"
  );
  assert.equal(
    mapGalleryTraditionToScriptCategory(null, "vi"),
    "VIETNAMESE_THU_PHAP"
  );

  const matchedBlackHoodie = matchGalleryProductToCatalog(
    {
      productName: "Classic Hoodie",
      productCategory: "HOODIE",
      defaultColor: "Sumi Black",
    },
    SAMPLE_PRODUCTS
  );
  assert.equal(matchedBlackHoodie.matchedProductId, "prod-hoodie");
  assert.equal(matchedBlackHoodie.matchedVariantId, "var-black-m");

  const matchedCanvas = matchGalleryProductToCatalog(
    {
      productName: "Gallery Print",
      productCategory: "WALL_ART",
      defaultColor: null,
    },
    SAMPLE_PRODUCTS
  );
  assert.equal(matchedCanvas.matchedProductId, "prod-canvas");
  assert.equal(matchedCanvas.matchedVariantId, "var-canvas-std");
});

test("UX-05: Tradition font pairing unlocks all 14 verified on-disk fonts including Korean Hangul", () => {
  assert.equal(DEFAULT_STUDIO_FONT_OPTIONS.length, 14);

  const koreanFonts = getFontsForTradition(
    "KOREAN_BRUSH",
    DEFAULT_STUDIO_FONT_OPTIONS
  );
  assert.equal(koreanFonts.length, 2);
  assert.deepEqual(
    koreanFonts.map((f) => f.familyName),
    ["Nanum Brush Script", "East Sea Dokdo"]
  );

  // Switching from Vietnamese font to Korean Seoye auto-pairs Nanum Brush Script
  assert.equal(
    resolveTraditionFontPairing(
      "KOREAN_BRUSH",
      "UTM Thư Pháp Thiên Ân",
      DEFAULT_STUDIO_FONT_OPTIONS
    ),
    "Nanum Brush Script"
  );

  // If user already picked East Sea Dokdo, staying in Korean Seoye preserves it
  assert.equal(
    resolveTraditionFontPairing(
      "KOREAN_BRUSH",
      "East Sea Dokdo",
      DEFAULT_STUDIO_FONT_OPTIONS
    ),
    "East Sea Dokdo"
  );

  // Switching to Japanese Shodo auto-pairs on-disk Yuji Boku
  assert.equal(
    resolveTraditionFontPairing(
      "JAPANESE_SHODO",
      "UTM Thư Pháp Thiên Ân",
      DEFAULT_STUDIO_FONT_OPTIONS
    ),
    "Yuji Boku"
  );

  // Switching to Chinese Shufa auto-pairs Ma Shan Zheng
  assert.equal(
    resolveTraditionFontPairing(
      "CHINESE_CALLIGRAPHY",
      "Yuji Boku",
      DEFAULT_STUDIO_FONT_OPTIONS
    ),
    "Ma Shan Zheng"
  );
});

test("UX-05 & UX-06: Garment swatches deduplicate colors, preserve size on color switch, and guard ink contrast", () => {
  const hoodie = SAMPLE_PRODUCTS[0]!;
  const colors = extractProductColorOptions(hoodie);
  assert.equal(colors.length, 2);
  assert.equal(colors[0]?.label, "Paper White");
  assert.equal(colors[1]?.label, "Sumi Black");

  const blackSizes = extractSizesForSelectedColor(hoodie, "sumi black");
  assert.equal(blackSizes.length, 2);
  assert.deepEqual(
    blackSizes.map((v) => v.size),
    ["M", "L"]
  );

  // Switching from Paper White Size L to Sumi Black preserves Size L
  const switchedId = findVariantForColorSwitch(hoodie, "sumi black", "L");
  assert.equal(switchedId, "var-black-l");

  // Dark garment + Sumi Black ink triggers contrast warning suggesting Pure White & Imperial Gold
  const darkConflict = detectGarmentInkContrastIssue("Sumi Black", DEFAULT_INK_HEX);
  assert.ok(darkConflict);
  assert.equal(darkConflict.suggestedInkHex, PURE_WHITE_HEX);
  assert.equal(darkConflict.secondaryInkName, "Imperial Gold");

  // Paper White garment + Pure White ink triggers contrast warning suggesting Sumi Black
  const lightConflict = detectGarmentInkContrastIssue("Paper White", PURE_WHITE_HEX);
  assert.ok(lightConflict);
  assert.equal(lightConflict.suggestedInkHex, DEFAULT_INK_HEX);

  // Paper White garment + Sumi Black ink has zero conflict
  assert.equal(detectGarmentInkContrastIssue("Paper White", DEFAULT_INK_HEX), null);
});

test("UX-06: computeStudioLiveQuote matches authoritative BigInt pricing for Physical and Digital Master", () => {
  const digitalQuote = computeStudioLiveQuote({
    fulfillmentFormat: "DIGITAL",
    selectedProduct: SAMPLE_PRODUCTS[0],
    selectedVariant: SAMPLE_PRODUCTS[0]?.variants?.[0],
    placement: "front",
  });
  assert.equal(digitalQuote.isDigital, true);
  assert.equal(digitalQuote.totalMinor, 1499n);
  assert.equal(digitalQuote.totalFormatted, "$14.99");

  // Physical: $34.99 blank + $4.99 license + $3.00 personalization + $9.00 both placement = $51.98 (5198n)
  const physicalBothQuote = computeStudioLiveQuote({
    fulfillmentFormat: "PHYSICAL",
    selectedProduct: SAMPLE_PRODUCTS[0],
    selectedVariant: SAMPLE_PRODUCTS[0]?.variants?.[0],
    placement: "both",
  });
  assert.equal(physicalBothQuote.isDigital, false);
  assert.equal(physicalBothQuote.totalMinor, 5198n);
  assert.equal(physicalBothQuote.totalFormatted, "$51.98");
  assert.equal(physicalBothQuote.artworkFormatted, "$4.99");
  assert.equal(physicalBothQuote.personalizationFormatted, "$3.00");
  assert.equal(physicalBothQuote.productFormatted, "$43.99");
});

test("UX-04, UX-05 & UX-06: Step panels and StudioQuoteFooter render all 3 Cultural Intelligence cards, Hangul fonts, swatches, and live quote", () => {
  const candidates = [
    {
      id: "cand-1",
      type: "LITERAL",
      typeLabel: formatInterpretationBadgeLabel("LITERAL"),
      language: "Japanese",
      text: "諦めない",
      romanization: "Akiramenai",
      meaning: "Direct refusal to surrender.",
      warning: null,
      recommended: false,
    },
    {
      id: "cand-2",
      type: "IDIOMATIC",
      typeLabel: formatInterpretationBadgeLabel("IDIOMATIC"),
      language: "Japanese",
      text: "七転八起",
      romanization: "Shichitenhakki",
      meaning: "Fall seven times, stand up eight.",
      warning: null,
      recommended: true,
    },
    {
      id: "cand-3",
      type: "POETIC",
      typeLabel: formatInterpretationBadgeLabel("POETIC"),
      language: "Japanese",
      text: "不屈",
      romanization: "Fukutsu",
      meaning: "Indomitable spirit.",
      warning: null,
      recommended: false,
    },
  ];

  const meaningHtml = renderToStaticMarkup(
    React.createElement(StepMeaningPanel, {
      locked: false,
      galleryRemix: {
        galleryItemId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Zen Perseverance",
        subtitle: null,
        sourceText: "Never Give Up",
        tradition: "JAPANESE_SHODO",
      },
      creationMode: "QUOTE",
      onChangeCreationMode: () => {},
      inputText: "Never Give Up",
      onChangeInputText: () => {},
      tradition: "JAPANESE_SHODO",
      onChangeTradition: () => {},
      treatment: "TRANSLATE_MEANING",
      onChangeTreatment: () => {},
      candidates,
      selectedCandidate: candidates[1]!,
      onSelectCandidate: () => {},
      isAnalyzing: false,
      onApplyInspiration: () => {},
    })
  );

  // All 3 Cultural Intelligence candidates + Gallery Remix badge render
  assert.match(meaningHtml, /Gallery Remix/);
  assert.match(meaningHtml, /Akiramenai/);
  assert.match(meaningHtml, /Shichitenhakki/);
  assert.match(meaningHtml, /Fukutsu/);
  assert.match(meaningHtml, /Recommended/);
  assert.match(meaningHtml, /lang="ja"/);

  const brushHtml = renderToStaticMarkup(
    React.createElement(StepBrushPanel, {
      locked: false,
      renderedText: "영원한 사랑",
      tradition: "KOREAN_BRUSH",
      treatment: "TRANSLATE_MEANING",
      availableFonts: DEFAULT_STUDIO_FONT_OPTIONS,
      fontFamily: "Nanum Brush Script",
      onSelectFontFamily: () => {},
      strokePreset: "FLOWING_INK",
      variationType: "04_EXPRESSIVE",
      onSelectExpression: () => {},
      layoutMode: "VERTICAL",
      onChangeLayoutMode: () => {},
      inkColor: DEFAULT_INK_HEX,
      onSelectInkColor: () => {},
      contrastAdvice: detectGarmentInkContrastIssue("Sumi Black", DEFAULT_INK_HEX),
      hasSeal: true,
      onToggleSeal: () => {},
      sealText: "印",
      onChangeSealText: () => {},
      sealFontFamily: "Ma Shan Zheng",
      onChangeSealFontFamily: () => {},
    })
  );

  assert.match(brushHtml, /Nanum Brush Script/);
  assert.match(brushHtml, /East Sea Dokdo/);
  assert.match(brushHtml, /Most Popular/);
  assert.match(brushHtml, /Switch to Pure White/);
  assert.match(brushHtml, /lang="ko"/);

  const quote = computeStudioLiveQuote({
    fulfillmentFormat: "PHYSICAL",
    selectedProduct: SAMPLE_PRODUCTS[0],
    selectedVariant: SAMPLE_PRODUCTS[0]?.variants?.[1],
    placement: "front",
  });

  const productHtml = renderToStaticMarkup(
    React.createElement(StepProductPanel, {
      locked: false,
      isAdmin: false,
      fulfillmentFormat: "PHYSICAL",
      onChangeFulfillmentFormat: () => {},
      products: SAMPLE_PRODUCTS,
      selectedProduct: SAMPLE_PRODUCTS[0],
      selectedVariantId: "var-white-l",
      onSelectProductId: () => {},
      onSelectVariantId: () => {},
      onOpenProductModal: () => {},
      placement: "front",
      onChangePlacement: () => {},
    })
  );

  assert.match(productHtml, /Digital Master · \$14\.99/);
  assert.match(productHtml, /Material color Paper White/);
  assert.match(productHtml, /Material color Sumi Black/);
  assert.match(productHtml, /Selected: L/);

  const footerHtml = renderToStaticMarkup(
    React.createElement(StudioQuoteFooter, {
      isAdmin: false,
      isLocked: false,
      activeStep: "PRODUCT",
      onChangeStep: () => {},
      fulfillmentFormat: "PHYSICAL",
      quote,
      isSaving: false,
      onSave: () => {},
      isAddingToCart: false,
      onPrimaryPurchaseAction: () => {},
      cartConfirmation: {
        cartId: "cart-abc",
        count: 1,
        productLabel: "Premium Washi Hoodie",
      },
      onDismissCartConfirmation: () => {},
    })
  );

  assert.match(footerHtml, /Add to Cart — \$42\.98/);
  assert.match(footerHtml, /Checkout Now/);
  assert.match(footerHtml, /Keep Designing/);
  assert.match(footerHtml, /fixed lg:static bottom-0/);

  // Mobile UX guardrails: 16px (`text-base`) inputs to prevent iOS auto-zoom
  assert.match(meaningHtml, /<input[^>]*text-base[^>]*id="studio-canvas-words"/);
  assert.match(brushHtml, /<input[^>]*text-base[^>]*id="studio-seal-text"/);
  assert.match(brushHtml, /<select[^>]*id="studio-seal-font"[^>]*text-base/);

  // Mobile workspace uses natural full-page scrolling + sticky live preview ribbon + single-row toolbar
  const workspaceSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/studio/StudioWorkspace.tsx"),
    "utf8"
  );
  assert.match(workspaceSource, /lg:overflow-hidden/);
  assert.match(workspaceSource, /aria-label="Live calligraphy preview"/);
  assert.match(workspaceSource, /mobileCanvasExpanded/);

  const toolbarSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/studio/StudioToolbar.tsx"),
    "utf8"
  );
  assert.match(toolbarSource, /overflow-x-auto/);
});
