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
  GUIDE_SAFE_HEX,
  PURE_WHITE_HEX,
  SEAL_VERMILION_HEX,
  STAGE_PAPER_HEX,
} from "@/lib/studio/inkPalette";

const STAGE_SIZE = 800;
const MIN_DISPLAY_SIZE = 210;
const SAFE_PADDING = 48;
const SAFE_SPAN = STAGE_SIZE - SAFE_PADDING * 2; // 704px

type StageLayerRole = "background" | "artwork" | "seal" | "guide";

const objectRoleMap = new WeakMap<fabric.FabricObject, StageLayerRole>();
const baseFitScaleMap = new WeakMap<fabric.FabricObject, number>();

export interface StageNormalizedTransforms {
  artwork: NormalizedTransform;
  seal: NormalizedTransform | null;
}

export interface MainStageCanvasRef {
  getNormalizedTransform: () => StageNormalizedTransforms;
  nudgeArtworkScale: (multiplier: number) => void;
  rotateArtwork: (deltaDegrees: number) => void;
  resetTransforms: () => void;
}

export interface MainStageCanvasProps {
  stageRef?: React.Ref<MainStageCanvasRef>;
  viewMode: "RAW_ART" | "MOCKUP";
  artworkSvgUrl: string;
  fontFamily: string;
  inkColor: string;
  productImageUrl?: string;
  backgroundAssetUrl?: string;
  backgroundFillMode?: "cover" | "contain";
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

function isOutsideSafePrintArea(obj: fabric.FabricObject): boolean {
  const centerLeft = obj.left ?? STAGE_SIZE / 2;
  const centerTop = obj.top ?? STAGE_SIZE / 2;
  const halfW = ((obj.width ?? 0) * Math.abs(obj.scaleX ?? 1)) / 2;
  const halfH = ((obj.height ?? 0) * Math.abs(obj.scaleY ?? 1)) / 2;

  return (
    centerLeft - halfW < SAFE_PADDING - 4 ||
    centerTop - halfH < SAFE_PADDING - 4 ||
    centerLeft + halfW > STAGE_SIZE - SAFE_PADDING + 4 ||
    centerTop + halfH > STAGE_SIZE - SAFE_PADDING + 4
  );
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
    backgroundAssetUrl,
    backgroundFillMode = "contain",
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const inkColorRef = useRef(inkColor);
  const lockedRef = useRef(locked);
  const viewModeRef = useRef(viewMode);
  const initialArtAppliedRef = useRef(false);
  const initialSealAppliedRef = useRef(false);

  useEffect(() => {
    inkColorRef.current = inkColor;
  }, [inkColor]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (!canvas) return;
    const guide = findObjectByRole(canvas, "guide");
    if (guide) {
      guide.set({ opacity: viewMode === "RAW_ART" ? 0.22 : 0 });
      canvas.requestRenderAll();
    }
  }, [canvas, viewMode]);

  useEffect(() => {
    lockedRef.current = locked;
    if (!canvas) return;
    canvas.selection = !locked;
    for (const obj of canvas.getObjects()) {
      const role = objectRoleMap.get(obj);
      if (role === "guide" || role === "background") continue;
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

    const safeGuide = new fabric.Rect({
      left: SAFE_PADDING,
      top: SAFE_PADDING,
      width: SAFE_SPAN,
      height: SAFE_SPAN,
      originX: "left",
      originY: "top",
      fill: "transparent",
      stroke: GUIDE_SAFE_HEX,
      strokeWidth: 1.5,
      strokeDashArray: [10, 6],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      opacity: viewModeRef.current === "RAW_ART" ? 0.22 : 0,
    });
    objectRoleMap.set(safeGuide, "guide");
    fCanvas.add(safeGuide);

    const highlightGuide = (e: { target?: fabric.FabricObject }) => {
      const target = e.target;
      if (!target || objectRoleMap.get(target) === "guide") return;
      const outside = isOutsideSafePrintArea(target);
      safeGuide.set({
        opacity: outside ? 0.85 : 0.55,
        stroke: outside ? SEAL_VERMILION_HEX : GUIDE_SAFE_HEX,
        strokeWidth: outside ? 2.5 : 1.5,
      });
      fCanvas.bringObjectToFront(safeGuide);
    };

    const settleGuide = () => {
      safeGuide.set({
        opacity: viewModeRef.current === "RAW_ART" ? 0.22 : 0,
        stroke: GUIDE_SAFE_HEX,
        strokeWidth: 1.5,
      });
      fCanvas.requestRenderAll();
    };

    fCanvas.on("object:moving", highlightGuide);
    fCanvas.on("object:scaling", highlightGuide);
    fCanvas.on("object:rotating", highlightGuide);
    fCanvas.on("mouse:up", settleGuide);

    setCanvas(fCanvas);

    return () => {
      fCanvas.off("object:moving", highlightGuide);
      fCanvas.off("object:scaling", highlightGuide);
      fCanvas.off("object:rotating", highlightGuide);
      fCanvas.off("mouse:up", settleGuide);
      fCanvas.dispose();
    };
  }, []);

  // Container-responsive scaling via Fabric setDimensions + setZoom (zero CSS inline styles, crisp vectors)
  useEffect(() => {
    if (!canvas || !viewportRef.current) return;
    const container = viewportRef.current;

    const applyResponsiveDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) {
        return;
      }
      const pad = rect.width < 640 ? 12 : 36;
      const availW = Math.max(MIN_DISPLAY_SIZE, rect.width - pad);
      const availH = Math.max(MIN_DISPLAY_SIZE, rect.height - pad);
      const displaySize = Math.round(
        clamp(Math.min(availW, availH), MIN_DISPLAY_SIZE, STAGE_SIZE)
      );
      const zoom = displaySize / STAGE_SIZE;

      canvas.setDimensions({ width: displaySize, height: displaySize });
      canvas.setZoom(zoom);
      canvas.requestRenderAll();
    };

    applyResponsiveDimensions();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        applyResponsiveDimensions();
      });
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", applyResponsiveDimensions);
    return () => window.removeEventListener("resize", applyResponsiveDimensions);
  }, [canvas]);

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

      nudgeArtworkScale: (multiplier: number) => {
        if (!canvas || lockedRef.current) return;
        const target =
          canvas.getActiveObject() &&
          objectRoleMap.get(canvas.getActiveObject()!) !== "guide"
            ? canvas.getActiveObject()!
            : findObjectByRole(canvas, "artwork");
        if (!target) return;

        const baseFit = baseFitScaleMap.get(target) ?? 1;
        const currentRelative = (target.scaleX ?? baseFit) / (baseFit || 1);
        const nextRelative = clamp(currentRelative * multiplier, 0.15, 3.5);
        const nextScale = baseFit * nextRelative;

        target.set({ scaleX: nextScale, scaleY: nextScale });
        target.setCoords();
        canvas.requestRenderAll();
      },

      rotateArtwork: (deltaDegrees: number) => {
        if (!canvas || lockedRef.current) return;
        const target =
          canvas.getActiveObject() &&
          objectRoleMap.get(canvas.getActiveObject()!) !== "guide"
            ? canvas.getActiveObject()!
            : findObjectByRole(canvas, "artwork");
        if (!target) return;

        const nextAngle = normalizeAngle((target.angle ?? 0) + deltaDegrees);
        target.set({ angle: nextAngle });
        target.setCoords();
        canvas.requestRenderAll();
      },

      resetTransforms: () => {
        if (!canvas || lockedRef.current) return;
        const artObj = findObjectByRole(canvas, "artwork");
        if (artObj) {
          const baseFit = baseFitScaleMap.get(artObj) ?? 1;
          artObj.set({
            left: STAGE_SIZE / 2,
            top: STAGE_SIZE / 2,
            scaleX: baseFit,
            scaleY: baseFit,
            angle: 0,
          });
          artObj.setCoords();
        }
        const sealObj = findObjectByRole(canvas, "seal");
        if (sealObj) {
          const baseSealFit = baseFitScaleMap.get(sealObj) ?? 1;
          sealObj.set({
            left: STAGE_SIZE / 2 + 150,
            top: STAGE_SIZE / 2 + 110,
            scaleX: baseSealFit,
            scaleY: baseSealFit,
            angle: 0,
          });
          sealObj.setCoords();
        }
        canvas.requestRenderAll();
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
          const scaleX = STAGE_SIZE / (img.width || 1);
          const scaleY = STAGE_SIZE / (img.height || 1);
          const scale = Math.max(scaleX, scaleY);

          img.set({
            scaleX: scale,
            scaleY: scale,
            originX: "center",
            originY: "center",
            left: STAGE_SIZE / 2,
            top: STAGE_SIZE / 2,
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

  // 1b. Private uploaded / AI-generated background asset layer (zIndex 0, INV-013, INV-014, TB-CALLI-005)
  useEffect(() => {
    if (!canvas) return;
    let isCancelled = false;

    const existingBg = findObjectByRole(canvas, "background");
    if (existingBg) {
      canvas.remove(existingBg);
    }

    if (!backgroundAssetUrl) {
      canvas.requestRenderAll();
      return;
    }

    fabric.FabricImage.fromURL(backgroundAssetUrl)
      .then((bgImg) => {
        if (isCancelled) return;
        const stale = findObjectByRole(canvas, "background");
        if (stale) {
          canvas.remove(stale);
        }

        const scaleX = SAFE_SPAN / (bgImg.width || SAFE_SPAN);
        const scaleY = SAFE_SPAN / (bgImg.height || SAFE_SPAN);
        const fitScale =
          backgroundFillMode === "cover"
            ? Math.max(scaleX, scaleY)
            : Math.min(scaleX, scaleY);

        bgImg.set({
          left: STAGE_SIZE / 2,
          top: STAGE_SIZE / 2,
          originX: "center",
          originY: "center",
          scaleX: fitScale,
          scaleY: fitScale,
          selectable: false,
          evented: false,
        });

        objectRoleMap.set(bgImg, "background");
        canvas.add(bgImg);
        canvas.sendObjectToBack(bgImg);
        const guide = findObjectByRole(canvas, "guide");
        if (guide) {
          canvas.bringObjectToFront(guide);
        }
        canvas.requestRenderAll();
      })
      .catch(() => {
        if (!isCancelled) {
          canvas.requestRenderAll();
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [canvas, backgroundAssetUrl, backgroundFillMode]);

  // 2. Calligraphy vector load — runs ONLY when artworkSvgUrl or fontFamily changes (TB-CALLI-005)
  useEffect(() => {
    if (!canvas || !artworkSvgUrl) return;

    let isCancelled = false;

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

          const scaleToFitWidth =
            SAFE_SPAN / (artworkGroup.width || STAGE_SIZE);
          const scaleToFitHeight =
            SAFE_SPAN / (artworkGroup.height || STAGE_SIZE);
          const baseFitScale = Math.min(scaleToFitWidth, scaleToFitHeight, 1);

          const targetX = preservedNormalized
            ? SAFE_PADDING + preservedNormalized.x * SAFE_SPAN
            : STAGE_SIZE / 2;
          const targetY = preservedNormalized
            ? SAFE_PADDING + preservedNormalized.y * SAFE_SPAN
            : STAGE_SIZE / 2;
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
          const guide = findObjectByRole(canvas, "guide");
          if (guide) {
            canvas.bringObjectToFront(guide);
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
            : STAGE_SIZE / 2 + 150;
          const targetY = preservedSealTransform
            ? SAFE_PADDING + preservedSealTransform.y * SAFE_SPAN
            : STAGE_SIZE / 2 + 110;
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
          const guide = findObjectByRole(canvas, "guide");
          if (guide) {
            canvas.bringObjectToFront(guide);
          }
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
    <div
      ref={viewportRef}
      className="w-full h-full flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden"
    >
      <div className="relative bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden shrink-0">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
});
