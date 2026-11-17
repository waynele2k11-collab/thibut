"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as fabric from "fabric";
import { DEFAULT_SEAL_FONT_FAMILY } from "@/lib/fonts/fontCatalog";
import {
  NormalizedTransformSchema,
  type NormalizedTransform,
} from "@/lib/print/types";
import { escapeXml } from "@/lib/security/xml";
import {
  PURE_WHITE_HEX,
  SEAL_VERMILION_HEX,
  STAGE_PAPER_HEX,
} from "@/lib/studio/inkPalette";

const STAGE_SIZE = 800;
const SAFE_PADDING = 48;
const SAFE_SPAN = STAGE_SIZE - SAFE_PADDING * 2; // 704px

type StageLayerRole = "artwork" | "seal";

const objectRoleMap = new WeakMap<fabric.FabricObject, StageLayerRole>();
const baseFitScaleMap = new WeakMap<fabric.FabricObject, number>();

export interface StageNormalizedTransforms {
  artwork: NormalizedTransform;
  seal: NormalizedTransform | null;
}

export interface MainStageCanvasRef {
  getNormalizedTransform: () => StageNormalizedTransforms;
}

export interface MainStageCanvasProps {
  stageRef?: React.Ref<MainStageCanvasRef>;
  viewMode: "RAW_ART" | "MOCKUP";
  artworkSvgUrl: string;
  fontFamily: string;
  inkColor: string;
  productImageUrl?: string;
  hasSeal: boolean;
  sealStyle: string;
  sealColor: string;
  sealText?: string;
  sealFontFamily?: string;
  initialArtworkTransform?: NormalizedTransform;
  initialSealTransform?: NormalizedTransform;
  locked?: boolean;
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return (min + max) / 2;
  return Math.min(max, Math.max(min, val));
}

function normalizeAngle(rawAngle: number): number {
  if (!Number.isFinite(rawAngle)) return 0;
  const wrapped = (((rawAngle % 360) + 540) % 360) - 180;
  return clamp(Math.round(wrapped * 100) / 100, -360, 360);
}

function extractNormalizedTransform(
  obj: fabric.FabricObject,
  fallbackScale = 1
): NormalizedTransform {
  const left = obj.left ?? STAGE_SIZE / 2;
  const top = obj.top ?? STAGE_SIZE / 2;
  const baseScale = baseFitScaleMap.get(obj) ?? 1;
  const rawScale = (obj.scaleX ?? baseScale) / (baseScale > 0 ? baseScale : 1);

  return NormalizedTransformSchema.parse({
    x: Number(clamp((left - SAFE_PADDING) / SAFE_SPAN, 0, 1).toFixed(4)),
    y: Number(clamp((top - SAFE_PADDING) / SAFE_SPAN, 0, 1).toFixed(4)),
    scale: Number(
      clamp(
        Number.isFinite(rawScale) ? rawScale : fallbackScale,
        0.05,
        4
      ).toFixed(4)
    ),
    rotation: normalizeAngle(obj.angle ?? 0),
  });
}

function findObjectByRole(
  canvas: fabric.Canvas,
  role: StageLayerRole
): fabric.FabricObject | undefined {
  return canvas.getObjects().find((obj) => objectRoleMap.get(obj) === role);
}

function applyInkColorToFabricObject(
  target: fabric.FabricObject,
  colorHex: string
): void {
  if (target instanceof fabric.Group) {
    for (const child of target.getObjects()) {
      applyInkColorToFabricObject(child, colorHex);
    }
    target.dirty = true;
    return;
  }

  const updates: Partial<fabric.FabricObjectProps> = {};
  if (
    typeof target.fill === "string" &&
    target.fill.length > 0 &&
    target.fill !== "none" &&
    target.fill !== "transparent"
  ) {
    updates.fill = colorHex;
  }
  if (
    typeof target.stroke === "string" &&
    target.stroke.length > 0 &&
    target.stroke !== "none" &&
    target.stroke !== "transparent"
  ) {
    updates.stroke = colorHex;
  }
  target.set(updates);
  target.dirty = true;
}

export const MainStageCanvas = forwardRef<
  MainStageCanvasRef,
  MainStageCanvasProps
>(function MainStageCanvas(
  {
    stageRef,
    viewMode,
    artworkSvgUrl,
    fontFamily,
    inkColor,
    productImageUrl,
    hasSeal,
    sealStyle,
    sealColor,
    sealText,
    sealFontFamily = DEFAULT_SEAL_FONT_FAMILY,
    initialArtworkTransform,
    initialSealTransform,
    locked = false,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const inkColorRef = useRef(inkColor);
  const lockedRef = useRef(locked);
  const initialArtAppliedRef = useRef(false);
  const initialSealAppliedRef = useRef(false);

  useEffect(() => {
    inkColorRef.current = inkColor;
  }, [inkColor]);

  useEffect(() => {
    lockedRef.current = locked;
    if (!canvas) return;
    canvas.selection = !locked;
    for (const obj of canvas.getObjects()) {
      obj.set({
        selectable: !locked,
        evented: !locked,
      });
    }
    canvas.requestRenderAll();
  }, [canvas, locked]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      width: STAGE_SIZE,
      height: STAGE_SIZE,
      preserveObjectStacking: true,
      selection: !lockedRef.current,
    });

    setCanvas(fCanvas);

    return () => {
      fCanvas.dispose();
    };
  }, []);

  useImperativeHandle(
    stageRef ?? ref,
    () => ({
      getNormalizedTransform: (): StageNormalizedTransforms => {
        if (!canvas) {
          return {
            artwork: NormalizedTransformSchema.parse(
              initialArtworkTransform ?? {
                x: 0.5,
                y: 0.5,
                scale: 1,
                rotation: 0,
              }
            ),
            seal: hasSeal
              ? NormalizedTransformSchema.parse(
                  initialSealTransform ?? {
                    x: 0.72,
                    y: 0.68,
                    scale: 0.25,
                    rotation: 0,
                  }
                )
              : null,
          };
        }

        const artObj = findObjectByRole(canvas, "artwork");
        const sealObj = findObjectByRole(canvas, "seal");

        const artwork = artObj
          ? extractNormalizedTransform(artObj, 1)
          : NormalizedTransformSchema.parse(
              initialArtworkTransform ?? {
                x: 0.5,
                y: 0.5,
                scale: 1,
                rotation: 0,
              }
            );

        const seal = hasSeal
          ? sealObj
            ? extractNormalizedTransform(sealObj, 0.25)
            : NormalizedTransformSchema.parse(
                initialSealTransform ?? {
                  x: 0.72,
                  y: 0.68,
                  scale: 0.25,
                  rotation: 0,
                }
              )
          : null;

        return { artwork, seal };
      },
    }),
    [canvas, hasSeal, initialArtworkTransform, initialSealTransform]
  );

  // 1. Background layer ONLY (changing product/viewMode never reloads calligraphy — TB-CALLI-005)
  useEffect(() => {
    if (!canvas) return;
    let isCancelled = false;

    if (viewMode === "RAW_ART" || !productImageUrl) {
      canvas.backgroundColor = STAGE_PAPER_HEX;
      canvas.backgroundImage = undefined;
      canvas.requestRenderAll();
    } else {
      fabric.FabricImage.fromURL(productImageUrl, { crossOrigin: "anonymous" })
        .then((img) => {
          if (isCancelled) return;
          const width = canvas.width ?? STAGE_SIZE;
          const height = canvas.height ?? STAGE_SIZE;
          const scaleX = width / (img.width || 1);
          const scaleY = height / (img.height || 1);
          const scale = Math.max(scaleX, scaleY);

          img.set({
            scaleX: scale,
            scaleY: scale,
            originX: "center",
            originY: "center",
            left: width / 2,
            top: height / 2,
          });

          canvas.backgroundImage = img;
          canvas.requestRenderAll();
        })
        .catch(() => {
          if (isCancelled) return;
          canvas.backgroundColor = STAGE_PAPER_HEX;
          canvas.backgroundImage = undefined;
          canvas.requestRenderAll();
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [canvas, viewMode, productImageUrl]);

  // 2. Calligraphy vector load — runs ONLY when artworkSvgUrl or fontFamily changes (TB-CALLI-005)
  useEffect(() => {
    if (!canvas || !artworkSvgUrl) return;

    let isCancelled = false;
    const width = canvas.width ?? STAGE_SIZE;
    const height = canvas.height ?? STAGE_SIZE;

    let preservedNormalized: NormalizedTransform | null = null;
    const existingArtwork = findObjectByRole(canvas, "artwork");
    if (existingArtwork) {
      preservedNormalized = extractNormalizedTransform(existingArtwork, 1);
      canvas.remove(existingArtwork);
    } else if (!initialArtAppliedRef.current && initialArtworkTransform) {
      preservedNormalized = initialArtworkTransform;
      initialArtAppliedRef.current = true;
    }

    const loadArtwork = () => {
      fabric
        .loadSVGFromURL(artworkSvgUrl)
        .then(({ objects, options }) => {
          if (isCancelled) return;

          const validObjects = objects.filter(
            (obj): obj is fabric.FabricObject => obj !== null
          );
          if (validObjects.length === 0) return;

          const concurrentArtwork = findObjectByRole(canvas, "artwork");
          if (concurrentArtwork) {
            canvas.remove(concurrentArtwork);
          }

          const artworkGroup = fabric.util.groupSVGElements(
            validObjects,
            options
          );

          const scaleToFitWidth = SAFE_SPAN / (artworkGroup.width || width);
          const scaleToFitHeight = SAFE_SPAN / (artworkGroup.height || height);
          const baseFitScale = Math.min(scaleToFitWidth, scaleToFitHeight, 1);

          const targetX = preservedNormalized
            ? SAFE_PADDING + preservedNormalized.x * SAFE_SPAN
            : width / 2;
          const targetY = preservedNormalized
            ? SAFE_PADDING + preservedNormalized.y * SAFE_SPAN
            : height / 2;
          const appliedScale =
            baseFitScale * (preservedNormalized?.scale ?? 1);
          const appliedAngle = preservedNormalized?.rotation ?? 0;

          artworkGroup.set({
            left: targetX,
            top: targetY,
            originX: "center",
            originY: "center",
            scaleX: appliedScale,
            scaleY: appliedScale,
            angle: appliedAngle,
            selectable: !lockedRef.current,
            evented: !lockedRef.current,
            cornerColor: SEAL_VERMILION_HEX,
            cornerStyle: "circle",
            transparentCorners: false,
            borderColor: SEAL_VERMILION_HEX,
            globalCompositeOperation: "source-over",
          });

          objectRoleMap.set(artworkGroup, "artwork");
          baseFitScaleMap.set(artworkGroup, baseFitScale);

          applyInkColorToFabricObject(artworkGroup, inkColorRef.current);

          canvas.add(artworkGroup);
          if (!lockedRef.current) {
            canvas.setActiveObject(artworkGroup);
          }
          canvas.requestRenderAll();
        })
        .catch((err) => {
          console.warn("[MainStageCanvas] Failed to parse artwork SVG:", err);
        });
    };

    const fontSpec = fontFamily ? `16px "${fontFamily}"` : "16px serif";
    if (typeof document !== "undefined" && document.fonts?.load) {
      document.fonts
        .load(fontSpec)
        .then(() => {
          if (!isCancelled) loadArtwork();
        })
        .catch(() => {
          if (!isCancelled) loadArtwork();
        });
    } else {
      loadArtwork();
    }

    return () => {
      isCancelled = true;
    };
  }, [canvas, artworkSvgUrl, fontFamily, initialArtworkTransform]);

  // 3. Ink color property update ONLY — mutates existing Fabric vector paths in place (TB-CALLI-005)
  useEffect(() => {
    if (!canvas) return;
    const artworkObj = findObjectByRole(canvas, "artwork");
    if (!artworkObj) return;

    applyInkColorToFabricObject(artworkObj, inkColor);
    canvas.requestRenderAll();
  }, [canvas, inkColor]);

  // 4. Chop seal layer — independent of viewMode, product, and calligraphy SVG (TB-CALLI-005, T-411)
  useEffect(() => {
    if (!canvas) return;

    let isCancelled = false;
    const width = canvas.width ?? STAGE_SIZE;
    const height = canvas.height ?? STAGE_SIZE;

    let preservedSealTransform: NormalizedTransform | null = null;
    const existingSeal = findObjectByRole(canvas, "seal");
    if (existingSeal) {
      preservedSealTransform = extractNormalizedTransform(existingSeal, 1);
      canvas.remove(existingSeal);
    } else if (!initialSealAppliedRef.current && initialSealTransform) {
      preservedSealTransform = initialSealTransform;
      initialSealAppliedRef.current = true;
    }

    if (!hasSeal) {
      canvas.requestRenderAll();
      return;
    }

    const rawSealText = (sealText || "印").trim() || "印";
    const safeSealText = escapeXml(rawSealText);
    const safeSealColor = escapeXml(sealColor || SEAL_VERMILION_HEX);
    const cleanSealFont =
      (sealFontFamily || DEFAULT_SEAL_FONT_FAMILY).replace(
        /[^A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF _-]/g,
        ""
      ) || DEFAULT_SEAL_FONT_FAMILY;
    const safeSealFont = escapeXml(`'${cleanSealFont}', serif`);
    const glyphCount = Array.from(rawSealText).length;
    const fontSize = glyphCount > 2 ? 32 : 48;

    const renderSeal = () => {
      if (isCancelled) return;

      const sealSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" fill="${safeSealColor}" stroke="none"/><rect x="9" y="9" width="82" height="82" fill="none" stroke="${PURE_WHITE_HEX}" stroke-width="2"/><text x="50" y="54" font-family="${safeSealFont}" font-size="${fontSize}" font-weight="bold" fill="${PURE_WHITE_HEX}" text-anchor="middle" dominant-baseline="middle">${safeSealText}</text></svg>`;

      const blob = new Blob([sealSvg], { type: "image/svg+xml" });
      const blobUrl = URL.createObjectURL(blob);

      fabric
        .loadSVGFromURL(blobUrl)
        .then(({ objects, options }) => {
          URL.revokeObjectURL(blobUrl);
          if (isCancelled) return;

          const validObjects = objects.filter(
            (obj): obj is fabric.FabricObject => obj !== null
          );
          if (validObjects.length === 0) return;

          const concurrentSeal = findObjectByRole(canvas, "seal");
          if (concurrentSeal) {
            canvas.remove(concurrentSeal);
          }

          const sealGroup = fabric.util.groupSVGElements(validObjects, options);
          const baseSealFit = 1;
          const targetX = preservedSealTransform
            ? SAFE_PADDING + preservedSealTransform.x * SAFE_SPAN
            : width / 2 + 150;
          const targetY = preservedSealTransform
            ? SAFE_PADDING + preservedSealTransform.y * SAFE_SPAN
            : height / 2 + 110;
          const appliedScale =
            baseSealFit * (preservedSealTransform?.scale ?? 1);
          const appliedAngle = preservedSealTransform?.rotation ?? 0;

          sealGroup.set({
            left: targetX,
            top: targetY,
            scaleX: appliedScale,
            scaleY: appliedScale,
            angle: appliedAngle,
            originX: "center",
            originY: "center",
            selectable: !lockedRef.current,
            evented: !lockedRef.current,
            cornerColor: SEAL_VERMILION_HEX,
            cornerStyle: "circle",
            transparentCorners: false,
            borderColor: SEAL_VERMILION_HEX,
            globalCompositeOperation: "source-over",
          });

          objectRoleMap.set(sealGroup, "seal");
          baseFitScaleMap.set(sealGroup, baseSealFit);

          canvas.add(sealGroup);
          canvas.requestRenderAll();
        })
        .catch(() => {
          URL.revokeObjectURL(blobUrl);
        });
    };

    if (typeof document !== "undefined" && document.fonts?.load) {
      document.fonts
        .load(`${fontSize}px "${cleanSealFont}"`)
        .then(renderSeal)
        .catch(renderSeal);
    } else {
      renderSeal();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    canvas,
    hasSeal,
    sealStyle,
    sealColor,
    sealText,
    sealFontFamily,
    initialSealTransform,
  ]);

  return (
    <div className="w-full h-full flex items-center justify-center p-4 md:p-8 overflow-auto">
      <div className="relative bg-surface-container-lowest border border-surface-variant overflow-hidden shrink-0 w-[800px] h-[800px]">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
});
