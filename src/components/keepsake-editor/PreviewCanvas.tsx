"use client";

// Keepsake editor: the combined on-screen preview. Dragging moves the selected block.
import { useEffect, useRef } from "react";
import { hitTest } from "@/lib/keepsake-editor/layout";
import type { LayerId, Scene } from "@/lib/keepsake-editor/scene";
import { mmToPxExact, pxToMm, type SheetSpec } from "@/lib/keepsake-editor/units";
import {
  conceptBandHeight,
  drawConceptBand,
  drawPreview,
  drawSelection,
  imageSizes,
  makeMeasure,
  type Backdrop,
  type DrawAssets,
} from "./draw";

const MAX_DISPLAY_PX = 620;

type Drag = { id: string; pointerId: number; startXmm: number; startYmm: number; blockXmm: number; blockYmm: number };

export function PreviewCanvas({
  scene,
  sheet,
  assets,
  selectedId,
  backdrop,
  visible,
  redrawKey,
  onSelect,
  onMove,
  onMoveEnd,
}: {
  scene: Scene;
  sheet: SheetSpec;
  assets: DrawAssets;
  selectedId: string | null;
  backdrop: Backdrop;
  visible: Record<LayerId, boolean>;
  /** Changes when fonts finish loading, so the canvas is drawn again with the real font. */
  redrawKey: string;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
  /** The pointer was released: the drag is finished and is one undo step. */
  onMoveEnd: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /** The share of the canvas height taken by the piece; the rest is the concept band. */
  const pieceShareRef = useRef(1);

  const pieceW = mmToPxExact(sheet.pieceWmm, sheet.dpi);
  const pieceH = mmToPxExact(sheet.pieceHmm, sheet.dpi);
  const displayScale = Math.min(MAX_DISPLAY_PX / pieceW, MAX_DISPLAY_PX / pieceH);
  const cssW = Math.round(pieceW * displayScale);
  const cssH = Math.round(pieceH * displayScale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The on-screen width; the height follows from the canvas's own proportions.
    canvas.style.width = `${cssW}px`;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pieceWpx = Math.max(1, Math.round(cssW * ratio));
    const pieceHpx = Math.max(1, Math.round(cssH * ratio));
    // The concept band is part of the picture on screen too, so a screenshot or "Save image as"
    // always carries it (BRD APR-009).
    const bandPx = conceptBandHeight(pieceWpx);
    canvas.width = pieceWpx;
    canvas.height = pieceHpx + bandPx;
    pieceShareRef.current = pieceHpx / (pieceHpx + bandPx);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = displayScale * ratio;
    drawPreview(ctx, scene, sheet, scale, assets, { backdrop, visible, guides: true });
    const selected = scene.blocks.find((block) => block.id === selectedId);
    if (selected && visible[selected.layer]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, pieceWpx, pieceHpx);
      ctx.clip();
      drawSelection(ctx, selected, sheet, scale, assets);
      ctx.restore();
    }
    drawConceptBand(ctx, pieceHpx, pieceWpx, bandPx);
  }, [scene, sheet, assets, selectedId, backdrop, visible, redrawKey, cssW, cssH, displayScale]);

  const toFilmMm = (event: React.PointerEvent<HTMLCanvasElement>): { xMm: number; yMm: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const xCss = ((event.clientX - rect.left) / Math.max(1, rect.width)) * cssW;
    // The canvas is taller than the piece by the concept band.
    const yCss = ((event.clientY - rect.top) / Math.max(1, rect.height) / pieceShareRef.current) * cssH;
    return {
      xMm: pxToMm(xCss / displayScale, sheet.dpi) - sheet.marginMm,
      yMm: pxToMm(yCss / displayScale, sheet.dpi) - sheet.marginMm,
    };
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Concept preview of the piece, not a photograph. Drag a block to move it, or use the position boxes."
      className="block h-auto max-w-full touch-none rounded border border-outline-variant"
      onPointerDown={(event) => {
        const ctx = event.currentTarget.getContext("2d");
        if (!ctx) return;
        const point = toFilmMm(event);
        const visibleScene: Scene = { ...scene, blocks: scene.blocks.filter((b) => visible[b.layer]) };
        const id = hitTest(visibleScene, sheet, makeMeasure(ctx, assets), imageSizes(assets), point.xMm, point.yMm);
        onSelect(id);
        const block = id ? scene.blocks.find((b) => b.id === id) : undefined;
        if (!block) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          id: block.id,
          pointerId: event.pointerId,
          startXmm: point.xMm,
          startYmm: point.yMm,
          blockXmm: block.xMm,
          blockYmm: block.yMm,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const point = toFilmMm(event);
        const round = (v: number) => Math.round(v * 10) / 10;
        onMove(drag.id, round(drag.blockXmm + point.xMm - drag.startXmm), round(drag.blockYmm + point.yMm - drag.startYmm));
      }}
      onPointerUp={() => {
        if (dragRef.current) onMoveEnd();
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        if (dragRef.current) onMoveEnd();
        dragRef.current = null;
      }}
    />
  );
}
