// Keepsake editor: state changes. Pure.
import {
  MAX_IMAGE_BLOCKS,
  MAX_IMAGE_WIDTH_MM,
  MAX_SAFE_ZONE_MM,
  MAX_TEXT_BLOCKS,
  MAX_TEXT_CHARS,
  MAX_TEXT_SIZE_MM,
  MIN_IMAGE_WIDTH_MM,
  MIN_TEXT_SIZE_MM,
  POSITION_LIMIT_MM,
  normalizeName,
  normalizeText,
  truncateText,
  type Block,
  type ImageBlock,
  type LayerId,
  type Scene,
  type TextBlock,
} from "./scene";
import { MAX_PIECE_MM, MIN_FILM_MM, MIN_PIECE_MM } from "./units";

export type TextPatch = Partial<Omit<TextBlock, "id" | "kind">>;
export type ImagePatch = Partial<Omit<ImageBlock, "id" | "kind">>;

export type Action =
  | { type: "addText"; id: string; preset: "hero" | "verse"; fontId: string }
  | {
      type: "addImage";
      id: string;
      fileName: string;
      /** Source height divided by source width. */
      aspect: number;
      isCustomerPhoto: boolean;
    }
  | { type: "update"; id: string; patch: TextPatch | ImagePatch; coalesceKey?: string }
  | { type: "remove"; id: string }
  | { type: "reorder"; id: string; direction: "up" | "down" }
  | { type: "setSize"; pieceWmm: number; pieceHmm: number }
  | { type: "setMargin"; marginMm: number }
  | { type: "setSafeZone"; safeZoneMm: number }
  /** Centre-crops an image to the film's proportions and places it edge to edge. */
  | { type: "fillFilm"; id: string; sourceAspect: number }
  /** Ends a run of coalesced updates (pointer released, field left), so the next one is its own undo step. */
  | { type: "endRun" }
  | { type: "setMirror"; mirror: boolean }
  | { type: "setInnerMarks"; innerMarks: boolean }
  | { type: "setCropBorder"; cropBorder: boolean }
  | { type: "setName"; name: string }
  | { type: "load"; scene: Scene }
  | { type: "undo" };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const LAYERS: readonly LayerId[] = ["back", "middle", "front"];
const ALIGNS = ["left", "center", "right"] as const;

function applyTextPatch(block: TextBlock, patch: TextPatch): TextBlock {
  const next: TextBlock = { ...block };
  if (typeof patch.text === "string") next.text = truncateText(normalizeText(patch.text), MAX_TEXT_CHARS);
  if (typeof patch.fontId === "string" && /^[a-z0-9-]{1,64}$/.test(patch.fontId)) next.fontId = patch.fontId;
  if (patch.sizeMm !== undefined) next.sizeMm = clamp(finiteOr(patch.sizeMm, block.sizeMm), MIN_TEXT_SIZE_MM, MAX_TEXT_SIZE_MM);
  if (typeof patch.colorHex === "string" && /^#[0-9a-fA-F]{6}$/.test(patch.colorHex)) next.colorHex = patch.colorHex;
  if (patch.align !== undefined && ALIGNS.includes(patch.align)) next.align = patch.align;
  if (patch.lineHeight !== undefined) next.lineHeight = clamp(finiteOr(patch.lineHeight, block.lineHeight), 0.6, 3);
  if (patch.xMm !== undefined) next.xMm = clamp(finiteOr(patch.xMm, block.xMm), -POSITION_LIMIT_MM, POSITION_LIMIT_MM);
  if (patch.yMm !== undefined) next.yMm = clamp(finiteOr(patch.yMm, block.yMm), -POSITION_LIMIT_MM, POSITION_LIMIT_MM);
  if (patch.rotationDeg !== undefined) next.rotationDeg = clamp(finiteOr(patch.rotationDeg, block.rotationDeg), -360, 360);
  if (patch.layer !== undefined && LAYERS.includes(patch.layer)) next.layer = patch.layer;
  return next;
}

function applyImagePatch(block: ImageBlock, patch: ImagePatch): ImageBlock {
  const next: ImageBlock = { ...block };
  if (typeof patch.fileName === "string" && patch.fileName.length > 0) next.fileName = cleanFileName(patch.fileName);
  if (typeof patch.isCustomerPhoto === "boolean") next.isCustomerPhoto = patch.isCustomerPhoto;
  if (patch.widthMm !== undefined) next.widthMm = clamp(finiteOr(patch.widthMm, block.widthMm), MIN_IMAGE_WIDTH_MM, MAX_IMAGE_WIDTH_MM);
  if (patch.xMm !== undefined) next.xMm = clamp(finiteOr(patch.xMm, block.xMm), -POSITION_LIMIT_MM, POSITION_LIMIT_MM);
  if (patch.yMm !== undefined) next.yMm = clamp(finiteOr(patch.yMm, block.yMm), -POSITION_LIMIT_MM, POSITION_LIMIT_MM);
  if (patch.rotationDeg !== undefined) next.rotationDeg = clamp(finiteOr(patch.rotationDeg, block.rotationDeg), -360, 360);
  if (patch.layer !== undefined && LAYERS.includes(patch.layer)) next.layer = patch.layer;
  if (typeof patch.crop === "object" && patch.crop !== null) {
    const x = clamp(finiteOr(patch.crop.x, 0), 0, 0.99);
    const y = clamp(finiteOr(patch.crop.y, 0), 0, 0.99);
    const w = clamp(finiteOr(patch.crop.w, 1), 0.01, 1 - x);
    const h = clamp(finiteOr(patch.crop.h, 1), 0.01, 1 - y);
    next.crop = { x, y, w, h };
  }
  return next;
}

function cleanFileName(raw: string): string {
  return truncateText(raw.replace(/[\\/\u0000-\u001f]/g, "_"), 200) || "image";
}

function countKind(scene: Scene, kind: Block["kind"]): number {
  return scene.blocks.filter((b) => b.kind === kind).length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** One change to the scene. An action that is not allowed returns the same object. */
export function reduce(state: Scene, action: Action): Scene {
  // The types forbid these, but a caller that breaks them must not crash the editor.
  if (typeof action !== "object" || action === null) return state;
  switch (action.type) {
    case "addText": {
      if (typeof action.id !== "string" || typeof action.fontId !== "string") return state;
      if (!/^[a-z0-9-]{1,40}$/.test(action.id) || !/^[a-z0-9-]{1,64}$/.test(action.fontId)) return state;
      if (countKind(state, "text") >= MAX_TEXT_BLOCKS) return state;
      if (state.blocks.some((b) => b.id === action.id)) return state;
      const filmW = state.pieceWmm - 2 * state.marginMm;
      const filmH = state.pieceHmm - 2 * state.marginMm;
      const hero = action.preset === "hero";
      const block: TextBlock = {
        id: action.id,
        kind: "text",
        layer: "front",
        text: hero ? "Mẹ" : "Nghĩa mẹ như nước\ntrong nguồn chảy ra",
        fontId: action.fontId,
        sizeMm: round1(clamp(filmH * (hero ? 0.2 : 0.06), 3, 80)),
        colorHex: "#3a2a12",
        align: "center",
        lineHeight: hero ? 1.1 : 1.35,
        xMm: round1(filmW / 2),
        yMm: round1(filmH * (hero ? 0.12 : 0.45)),
        rotationDeg: 0,
      };
      return { ...state, blocks: [...state.blocks, block] };
    }
    case "addImage": {
      if (typeof action.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(action.id)) return state;
      if (countKind(state, "image") >= MAX_IMAGE_BLOCKS) return state;
      if (state.blocks.some((b) => b.id === action.id)) return state;
      const filmW = state.pieceWmm - 2 * state.marginMm;
      const filmH = state.pieceHmm - 2 * state.marginMm;
      const aspect = clamp(finiteOr(action.aspect, 1), 0.05, 20);
      const isCustomerPhoto = action.isCustomerPhoto === true;
      const widthMm = round1(clamp(Math.min(filmW * 0.6, (filmH * 0.6) / aspect), MIN_IMAGE_WIDTH_MM, MAX_IMAGE_WIDTH_MM));
      const block: ImageBlock = {
        id: action.id,
        kind: "image",
        layer: isCustomerPhoto ? "middle" : "back",
        fileName: typeof action.fileName === "string" ? cleanFileName(action.fileName) : "image",
        isCustomerPhoto,
        xMm: round1((filmW - widthMm) / 2),
        yMm: round1((filmH - widthMm * aspect) / 2),
        widthMm,
        rotationDeg: 0,
        crop: { x: 0, y: 0, w: 1, h: 1 },
      };
      const blocks = isCustomerPhoto
        ? state.blocks.map((b) => (b.kind === "image" ? { ...b, isCustomerPhoto: false } : b))
        : state.blocks;
      return { ...state, blocks: [...blocks, block] };
    }
    case "update": {
      if (typeof action.patch !== "object" || action.patch === null) return state;
      const index = state.blocks.findIndex((b) => b.id === action.id);
      if (index < 0) return state;
      const current = state.blocks[index];
      const updated: Block =
        current.kind === "text"
          ? applyTextPatch(current, action.patch as TextPatch)
          : applyImagePatch(current, action.patch as ImagePatch);
      let blocks = state.blocks.map((b, i) => (i === index ? updated : b));
      if (updated.kind === "image" && updated.isCustomerPhoto) {
        // Only one image is the customer photo.
        blocks = blocks.map((b) =>
          b.kind === "image" && b.id !== updated.id ? { ...b, isCustomerPhoto: false } : b
        );
      }
      return { ...state, blocks };
    }
    case "remove": {
      if (!state.blocks.some((b) => b.id === action.id)) return state;
      return { ...state, blocks: state.blocks.filter((b) => b.id !== action.id) };
    }
    case "reorder": {
      const index = state.blocks.findIndex((b) => b.id === action.id);
      const target = action.direction === "up" ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...state, blocks };
    }
    case "setSize": {
      const w = action.pieceWmm;
      const h = action.pieceHmm;
      if (!Number.isFinite(w) || !Number.isFinite(h)) return state;
      if (w < MIN_PIECE_MM || w > MAX_PIECE_MM || h < MIN_PIECE_MM || h > MAX_PIECE_MM) return state;
      if (w - 2 * state.marginMm < MIN_FILM_MM || h - 2 * state.marginMm < MIN_FILM_MM) return state;
      return { ...state, pieceWmm: w, pieceHmm: h };
    }
    case "setMargin": {
      const m = action.marginMm;
      if (!Number.isFinite(m) || m < 0) return state;
      if (state.pieceWmm - 2 * m < MIN_FILM_MM || state.pieceHmm - 2 * m < MIN_FILM_MM) return state;
      return { ...state, marginMm: m };
    }
    case "setSafeZone": {
      const z = action.safeZoneMm;
      if (typeof z !== "number" || !Number.isFinite(z) || z < 0 || z > MAX_SAFE_ZONE_MM) return state;
      return { ...state, safeZoneMm: z };
    }
    case "fillFilm": {
      const index = state.blocks.findIndex((b) => b.id === action.id);
      const current = index < 0 ? undefined : state.blocks[index];
      if (!current || current.kind !== "image") return state;
      const source = action.sourceAspect;
      if (typeof source !== "number" || !Number.isFinite(source) || source <= 0) return state;
      const filmW = state.pieceWmm - 2 * state.marginMm;
      const filmH = state.pieceHmm - 2 * state.marginMm;
      const film = filmH / filmW;
      // Keep the whole width and trim top and bottom when the source is taller than the film;
      // otherwise keep the whole height and trim the sides.
      const crop =
        source > film
          ? { x: 0, y: (1 - film / source) / 2, w: 1, h: film / source }
          : { x: (1 - source / film) / 2, y: 0, w: source / film, h: 1 };
      if (crop.w < 0.01 || crop.h < 0.01) return state;
      const filled: ImageBlock = { ...current, xMm: 0, yMm: 0, widthMm: filmW, rotationDeg: 0, crop };
      return { ...state, blocks: state.blocks.map((b, i) => (i === index ? filled : b)) };
    }
    case "setMirror":
      return { ...state, mirror: action.mirror === true };
    case "setInnerMarks":
      return { ...state, innerMarks: action.innerMarks === true };
    case "setCropBorder":
      return { ...state, cropBorder: action.cropBorder === true };
    case "setName":
      if (typeof action.name !== "string") return state;
      return { ...state, name: normalizeName(action.name) };
    case "load":
      return typeof action.scene === "object" && action.scene !== null ? action.scene : state;
    case "undo":
    case "endRun":
      return state;
    default:
      return state;
  }
}

/** The scene plus one step of undo. */
export type EditorState = { scene: Scene; previous: Scene | null; lastKey: string | null; dirty: boolean };

export function initialEditorState(scene: Scene): EditorState {
  return { scene, previous: null, lastKey: null, dirty: false };
}

/**
 * Wraps `reduce` with one step of undo. A run of updates that share a `coalesceKey` (a drag, or
 * typing in one field) counts as one step; `endRun` closes the run, so two separate drags of the
 * same block are two steps.
 */
export function reduceEditor(state: EditorState, action: Action): EditorState {
  if (typeof action !== "object" || action === null) return state;
  if (action.type === "undo") {
    if (!state.previous) return state;
    return { scene: state.previous, previous: null, lastKey: null, dirty: true };
  }
  if (action.type === "endRun") {
    return state.lastKey === null ? state : { ...state, lastKey: null };
  }
  const scene = reduce(state.scene, action);
  if (scene === state.scene) return state;
  if (action.type === "load") return { scene, previous: null, lastKey: null, dirty: false };
  const key = action.type === "update" ? (action.coalesceKey ?? null) : null;
  const sameRun = key !== null && key === state.lastKey && state.previous !== null;
  return {
    scene,
    previous: sameRun ? state.previous : state.scene,
    lastKey: key,
    dirty: true,
  };
}
