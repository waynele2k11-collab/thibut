// Keepsake editor: turning the scene into downloaded files. Browser only.
// Everything is made in memory and handed to the browser's own download. No request is sent.
import { exportFileName, jobCode, projectFileName, sceneHash } from "@/lib/keepsake-editor/filenames";
import { sheetLabel } from "@/lib/keepsake-editor/marks";
import { withPngDpi } from "@/lib/keepsake-editor/png";
import {
  layersWithArtwork,
  serializeProject,
  type LayerId,
  type Scene,
} from "@/lib/keepsake-editor/scene";
import { mmToPxExact, type SheetSpec } from "@/lib/keepsake-editor/units";
import {
  conceptBandHeight,
  drawConceptBand,
  drawPreview,
  drawSheet,
  type Backdrop,
  type DrawAssets,
} from "./draw";

export const PREVIEW_PPI = 150;
export const PREVIEW_MAX_SIDE_PX = 2400;
/** A preview is never narrower than this, so the concept band stays readable on small pieces. */
export const PREVIEW_MIN_WIDTH_PX = 480;

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

export const TOO_LARGE_MESSAGE =
  "The browser could not create an image this large. Try a smaller piece size, or use a laptop.";

/** Layers that get a film: a layer holding only blank text gets none. */
export function nonEmptyLayers(scene: Scene): LayerId[] {
  return layersWithArtwork(scene);
}

/**
 * One set of films: the scene exactly as it was when the set was started, its films, and the job
 * code every file of the set carries. Films from one job always match each other.
 */
export type FilmJob = { scene: Scene; layers: LayerId[]; code: string; hash: string };

export function sceneFingerprint(scene: Scene, assets: DrawAssets): string {
  const sizes = Array.from(assets.images, ([id, image]) => `${id}:${image.w}x${image.h}`).sort().join(",");
  return sceneHash(scene, sizes);
}

export function startFilmJob(scene: Scene, assets: DrawAssets, dateIso: string): FilmJob {
  const hash = sceneFingerprint(scene, assets);
  return { scene, layers: layersWithArtwork(scene), code: jobCode(dateIso, hash), hash };
}

/**
 * Stops the export unless every font used by the scene is loaded. No fallback font is ever
 * drawn: a missing font ends the export with a message.
 */
export async function assertFontsReady(
  scene: Scene,
  assets: DrawAssets,
  isFontLoaded: (fontId: string) => boolean
): Promise<void> {
  await document.fonts.ready;
  for (const block of scene.blocks) {
    if (block.kind !== "text") continue;
    const family = assets.fontFamily(block.fontId).replace(/["\\]/g, "");
    const loaded = isFontLoaded(block.fontId) && document.fonts.check(`16px "${family}"`, block.text || "A");
    if (!loaded) {
      throw new ExportError("A font used in this piece is not loaded. Reload the page and try again.");
    }
  }
}

function tooLarge(w: number, h: number): ExportError {
  return new ExportError(`${TOO_LARGE_MESSAGE} (This file needs ${w} × ${h} pixels.)`);
}

/**
 * A canvas of exactly `width × height`, proven to hold pixels. A browser that cannot allocate a
 * canvas this large may hand back one that silently stays blank, so the far corner is painted and
 * read back before anything is drawn.
 */
function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width !== w || canvas.height !== h) throw tooLarge(w, h);
  let alpha = 0;
  try {
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillRect(w - 1, h - 1, 1, 1);
    alpha = ctx.getImageData(w - 1, h - 1, 1, 1).data[3];
    ctx.clearRect(0, 0, w, h);
  } catch {
    throw tooLarge(w, h);
  }
  if (alpha !== 255) throw tooLarge(w, h);
  return { canvas, ctx };
}

async function canvasToPng(canvas: HTMLCanvasElement, dpi: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new ExportError(TOO_LARGE_MESSAGE);
  const bytes = withPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "image/png" });
}

/** One film of a job as a transparent PNG at the sheet's resolution. */
export async function exportLayerPng(
  job: FilmJob,
  layer: LayerId,
  sheet: SheetSpec,
  assets: DrawAssets
): Promise<{ blob: Blob; fileName: string }> {
  const index = job.layers.indexOf(layer) + 1;
  const total = job.layers.length;
  if (index < 1) throw new ExportError("This layer has nothing to print.");
  const { canvas, ctx } = newCanvas(sheet.sheetWpx, sheet.sheetHpx);
  drawSheet(ctx, job.scene, layer, sheet, assets, sheetLabel(job.scene, layer, index, total, sheet, job.code));
  const blob = await canvasToPng(canvas, sheet.dpi);
  return { blob, fileName: exportFileName(job.code, layer, index, total, job.scene.mirror) };
}

/** The combined preview on the chosen backdrop, with the fixed concept band under it. */
export async function exportPreviewPng(
  job: FilmJob,
  sheet: SheetSpec,
  assets: DrawAssets,
  backdrop: Backdrop
): Promise<{ blob: Blob; fileName: string }> {
  const scene = job.scene;
  const pieceW = mmToPxExact(sheet.pieceWmm, sheet.dpi);
  const pieceH = mmToPxExact(sheet.pieceHmm, sheet.dpi);
  const longer = Math.max(pieceW, pieceH);
  // Small pieces are enlarged to the minimum width, but a long narrow piece is never blown up
  // past 4000 px on its longer side; there the band goes onto two lines.
  const scale = Math.max(
    Math.min(PREVIEW_PPI / sheet.dpi, PREVIEW_MAX_SIDE_PX / longer),
    Math.min(PREVIEW_MIN_WIDTH_PX / pieceW, 4000 / longer)
  );
  const width = Math.round(pieceW * scale);
  const height = Math.round(pieceH * scale);
  const band = conceptBandHeight(width);
  const { canvas, ctx } = newCanvas(width, height + band);
  drawPreview(ctx, scene, sheet, scale, assets, {
    backdrop,
    visible: { back: true, middle: true, front: true },
    guides: false,
  });
  drawConceptBand(ctx, height, width, band);
  const blob = await canvasToPng(canvas, Math.round(sheet.dpi * scale));
  return { blob, fileName: exportFileName(job.code, "preview", 0, job.layers.length, scene.mirror) };
}

export function projectBlob(scene: Scene): { blob: Blob; fileName: string } {
  return {
    blob: new Blob([serializeProject(scene)], { type: "application/json" }),
    fileName: projectFileName(scene),
  };
}

/** Hands a file to the browser's download. The object URL is local to this page. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
