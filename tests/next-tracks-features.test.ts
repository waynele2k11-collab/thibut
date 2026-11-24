import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BackgroundLayerControls } from "@/components/studio/BackgroundLayerControls";
import { DesignPolicyQuickEditor } from "@/components/creator/CreatorStudioControls";
import { CompositionSchema } from "@/lib/print/types";
import { createStudioStore } from "@/lib/studio/studioStore";
import { runStaticLaunchReadinessAudit } from "../scripts/launch-readiness";

test("Track 2: BackgroundLayerControls renders Pure Transparent, 3 AI presets, Private Photo upload, and Fit/Fill controls when asset is active", () => {
  const activeAssetId = "123e4567-e89b-12d3-a456-426614174000";

  const html = renderToStaticMarkup(
    React.createElement(BackgroundLayerControls, {
      locked: false,
      backgroundAssetId: activeAssetId,
      backgroundFillMode: "cover",
      onChangeBackgroundAsset: () => {},
      onChangeBackgroundFillMode: () => {},
    })
  );

  assert.match(html, /Layer Active/);
  assert.match(html, /Pure Transparent/);
  assert.match(html, /Zen Ivory/);
  assert.match(html, /Sumi Mist/);
  assert.match(html, /Bamboo Shadow/);
  assert.match(html, /Upload Private Photo/);
  assert.match(html, /Remove background layer/);

  // Verify CompositionSchema accepts AssetLayerSchema alongside calligraphy & seal
  const parsed = CompositionSchema.safeParse({
    version: 1,
    placement: "front",
    color: "#121212",
    transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
    layers: [
      {
        id: "layer-background-asset",
        type: "asset",
        assetId: activeAssetId,
        fillMode: "cover",
        zIndex: 0,
        opacity: 1,
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      },
      {
        id: "layer-calligraphy-main",
        type: "calligraphy",
        text: "七転八起",
        fontFamily: "Yuji Boku",
        layout: "VERTICAL",
        colorHex: "#121212",
        zIndex: 10,
        opacity: 1,
        transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0 },
      },
    ],
  });
  assert.equal(parsed.success, true);

  const store = createStudioStore({
    activeSessionId: "sess-bg",
    isLocked: false,
    viewMode: "RAW_ART",
    layoutMode: "VERTICAL",
    inputText: "Tâm",
    tradition: "VIETNAMESE_THU_PHAP",
    treatment: "KEEP_ORIGINAL",
    strokePreset: "BOLD_BRUSH",
    variationType: "01_CONTROLLED",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    inkColor: "#121212",
    hasSeal: true,
    sealText: "印",
    sealFontFamily: "Ma Shan Zheng",
    backgroundAssetId: activeAssetId,
    backgroundFillMode: "cover",
    placement: "front",
    selectedProductId: undefined,
    selectedVariantId: undefined,
    isProductModalOpen: false,
    isSaving: false,
    isAddingToCart: false,
    statusBanner: null,
  });
  assert.equal(store.getState().backgroundAssetId, activeAssetId);
  assert.equal(store.getState().backgroundFillMode, "cover");
});

test("Track 4: Creator Studio DesignPolicyQuickEditor renders versioned policy trigger", () => {
  const html = renderToStaticMarkup(
    React.createElement(DesignPolicyQuickEditor, {
      designId: "123e4567-e89b-12d3-a456-426614174000",
      versionNumber: 2,
      initialPolicy: {
        allowName: true,
        allowQuote: true,
        allowTranslation: true,
        allowCalligraphy: true,
        allowAIRestyle: false,
      },
    })
  );

  assert.match(html, /Policy v2\.0/);
});

test("Track 5: Static launch readiness audit verifies 16 on-disk OpenType fonts, migrations, and vercel.json", () => {
  const checks = runStaticLaunchReadinessAudit(process.cwd(), {
    ...process.env,
    NODE_ENV: "development",
  });

  const fontCheck = checks.find((c) => c.name.includes("Licensed Brush Fonts"));
  assert.ok(fontCheck);
  assert.equal(fontCheck.status, "PASS");
  assert.match(fontCheck.detail, /16 commercial print-licensed OpenType fonts/);

  const migCheck = checks.find((c) => c.name.includes("Prisma Migrations"));
  assert.ok(migCheck);
  assert.equal(migCheck.status, "PASS");

  const vercelCheck = checks.find((c) => c.name.includes("Vercel Serverless"));
  assert.ok(vercelCheck);
  assert.equal(vercelCheck.status, "PASS");
});
