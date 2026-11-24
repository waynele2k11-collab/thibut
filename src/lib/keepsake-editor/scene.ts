// Keepsake editor: the scene (everything the admin placed) and the project file. Pure.
import { z } from "zod";
import { MAX_PIECE_MM, MIN_PIECE_MM } from "./units";

export type LayerId = "back" | "middle" | "front";
export const LAYER_IDS: readonly LayerId[] = ["back", "middle", "front"];
export const LAYER_LABELS: Record<LayerId, string> = {
  back: "Back",
  middle: "Middle",
  front: "Front",
};

export type TextBlock = {
  id: string;
  kind: "text";
  layer: LayerId;
  text: string;
  fontId: string;
  sizeMm: number;
  colorHex: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  /** Anchor in millimetres from the film's top-left corner: left edge, centre or right edge by `align`. */
  xMm: number;
  /** Top of the text block in millimetres from the film's top edge. */
  yMm: number;
  rotationDeg: number;
};

export type ImageBlock = {
  id: string;
  kind: "image";
  layer: LayerId;
  /** File name only, so the admin can re-attach the same file. The image itself is never stored. */
  fileName: string;
  isCustomerPhoto: boolean;
  /** Top-left corner in millimetres from the film's top-left corner. */
  xMm: number;
  yMm: number;
  widthMm: number;
  rotationDeg: number;
  /** Crop rectangle as fractions (0..1) of the source image. */
  crop: { x: number; y: number; w: number; h: number };
};

export type Block = TextBlock | ImageBlock;

export type Scene = {
  version: 1;
  name: string;
  pieceWmm: number;
  pieceHmm: number;
  marginMm: number;
  /**
   * Width of the zone just inside the film edge where artwork may be trimmed when the film is
   * cut. A guide on screen and a warning; it is never drawn in an exported file.
   */
  safeZoneMm: number;
  mirror: boolean;
  innerMarks: boolean;
  /** Export each layer with a 5 mm border holding crop marks and a label. */
  cropBorder: boolean;
  blocks: Block[];
};

export const MAX_TEXT_BLOCKS = 8;
export const MAX_IMAGE_BLOCKS = 3;
export const MAX_TEXT_CHARS = 2000;
export const MAX_NAME_CHARS = 80;
export const MAX_PROJECT_FILE_CHARS = 200_000;
export const MIN_TEXT_SIZE_MM = 1;
export const MAX_TEXT_SIZE_MM = 300;
export const MIN_IMAGE_WIDTH_MM = 2;
export const MAX_IMAGE_WIDTH_MM = 1200;
export const POSITION_LIMIT_MM = 2000;
export const DEFAULT_SAFE_ZONE_MM = 3;
export const MAX_SAFE_ZONE_MM = 50;

export const PROJECT_FILE_ERROR = "This is not a valid keepsake project file.";

const idSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);
const layerSchema = z.enum(["back", "middle", "front"]);
const positionSchema = z.number().finite().min(-POSITION_LIMIT_MM).max(POSITION_LIMIT_MM);
const rotationSchema = z.number().finite().min(-360).max(360);
const fractionSchema = z.number().finite().min(0).max(1);

const textBlockSchema = z.strictObject({
  id: idSchema,
  kind: z.literal("text"),
  layer: layerSchema,
  text: z.string().max(MAX_TEXT_CHARS),
  fontId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  sizeMm: z.number().finite().min(MIN_TEXT_SIZE_MM).max(MAX_TEXT_SIZE_MM),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().finite().min(0.6).max(3),
  xMm: positionSchema,
  yMm: positionSchema,
  rotationDeg: rotationSchema,
});

const imageBlockSchema = z.strictObject({
  id: idSchema,
  kind: z.literal("image"),
  layer: layerSchema,
  fileName: z
    .string()
    .min(1)
    .max(200)
    .refine((v) => !/[\\/\u0000-\u001f]/.test(v)),
  isCustomerPhoto: z.boolean(),
  xMm: positionSchema,
  yMm: positionSchema,
  widthMm: z.number().finite().min(MIN_IMAGE_WIDTH_MM).max(MAX_IMAGE_WIDTH_MM),
  rotationDeg: rotationSchema,
  crop: z
    .strictObject({ x: fractionSchema, y: fractionSchema, w: fractionSchema, h: fractionSchema })
    .refine((c) => c.w >= 0.01 && c.h >= 0.01 && c.x + c.w <= 1.000001 && c.y + c.h <= 1.000001),
});

export const SceneSchema = z
  .strictObject({
    version: z.literal(1),
    name: z.string().max(MAX_NAME_CHARS),
    pieceWmm: z.number().finite().min(MIN_PIECE_MM).max(MAX_PIECE_MM),
    pieceHmm: z.number().finite().min(MIN_PIECE_MM).max(MAX_PIECE_MM),
    marginMm: z.number().finite().min(0).max(MAX_PIECE_MM),
    // Optional so project files saved before the safe zone existed still open.
    safeZoneMm: z.number().finite().min(0).max(MAX_SAFE_ZONE_MM).optional(),
    mirror: z.boolean(),
    innerMarks: z.boolean(),
    cropBorder: z.boolean(),
    blocks: z
      .array(z.discriminatedUnion("kind", [textBlockSchema, imageBlockSchema]))
      .max(MAX_TEXT_BLOCKS + MAX_IMAGE_BLOCKS),
  })
  .superRefine((scene, ctx) => {
    const ids = new Set<string>();
    let texts = 0;
    let images = 0;
    let customerPhotos = 0;
    for (const block of scene.blocks) {
      if (ids.has(block.id)) ctx.addIssue({ code: "custom", message: "duplicate id" });
      ids.add(block.id);
      if (block.kind === "text") texts += 1;
      else {
        images += 1;
        if (block.isCustomerPhoto) customerPhotos += 1;
      }
    }
    if (customerPhotos > 1) ctx.addIssue({ code: "custom", message: "more than one customer photo" });
    if (texts > MAX_TEXT_BLOCKS) ctx.addIssue({ code: "custom", message: "too many text blocks" });
    if (images > MAX_IMAGE_BLOCKS) ctx.addIssue({ code: "custom", message: "too many images" });
    if (scene.pieceWmm - 2 * scene.marginMm < 10 || scene.pieceHmm - 2 * scene.marginMm < 10) {
      ctx.addIssue({ code: "custom", message: "margin too large" });
    }
  });

// Characters that draw nothing and that no font is asked for: control characters, soft hyphen,
// zero-width characters, direction (bidi) controls and the byte-order mark. Pasted text from chat
// apps and web pages often carries them.
const HIDDEN_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
// Tab, no-break space, thin and other typographic spaces: drawn as an ordinary space.
const ODD_SPACES = /[\t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const LINE_SEPARATORS = /\r\n?|[\u2028\u2029]/g;

/** How many hidden characters `normalizeText` would remove from `raw`. */
export function hiddenCharCount(raw: string): number {
  if (typeof raw !== "string") return 0;
  return (raw.match(HIDDEN_CHARS) ?? []).length;
}

/**
 * Text as it is stored and drawn: line breaks kept exactly (CRLF becomes LF), hidden characters
 * removed, unusual spaces turned into ordinary spaces, then NFC.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(LINE_SEPARATORS, "\n")
    .replace(HIDDEN_CHARS, "")
    .replace(ODD_SPACES, " ")
    .normalize("NFC");
}

/** Cuts to `max` UTF-16 units without leaving half of a surrogate pair at the end. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** A project or file name as it is stored: one line, no hidden characters, NFC. */
export function normalizeName(raw: string): string {
  return truncateText(normalizeText(raw).replace(/\n/g, " "), MAX_NAME_CHARS);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** True when any object in the parsed JSON has a key that could reach a prototype. */
function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (typeof value !== "object" || value === null) return false;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKey((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Reads a project file. Throws an Error with a fixed message for anything that is not a valid
 * project: the message never repeats the file's content.
 */
export function parseProjectFile(json: string): Scene {
  if (typeof json !== "string" || json.length === 0 || json.length > MAX_PROJECT_FILE_CHARS) {
    throw new Error(PROJECT_FILE_ERROR);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
    // Also inside the try: a very deep file can exhaust the stack here.
    if (hasForbiddenKey(raw)) throw new Error(PROJECT_FILE_ERROR);
  } catch {
    throw new Error(PROJECT_FILE_ERROR);
  }
  const parsed = SceneSchema.safeParse(raw);
  if (!parsed.success) throw new Error(PROJECT_FILE_ERROR);
  const scene = parsed.data;
  return {
    ...scene,
    safeZoneMm: scene.safeZoneMm ?? DEFAULT_SAFE_ZONE_MM,
    name: normalizeName(scene.name),
    blocks: scene.blocks.map((block) =>
      block.kind === "text"
        ? { ...block, text: truncateText(normalizeText(block.text), MAX_TEXT_CHARS) }
        : block
    ),
  };
}

/** The project file: everything except the images. */
export function serializeProject(scene: Scene): string {
  return JSON.stringify(scene, null, 2);
}

export function emptyScene(pieceWmm: number, pieceHmm: number, marginMm: number): Scene {
  return {
    version: 1,
    name: "Untitled piece",
    pieceWmm,
    pieceHmm,
    marginMm,
    safeZoneMm: DEFAULT_SAFE_ZONE_MM,
    mirror: false,
    innerMarks: false,
    cropBorder: true,
    blocks: [],
  };
}

/** True when the block puts ink on its film: an image, or text that is not blank. */
export function blockPrints(block: Block): boolean {
  return block.kind === "image" || block.text.trim() !== "";
}

/** Layers that get a film: those with at least one block that prints, back to front. */
export function layersWithArtwork(scene: Scene): LayerId[] {
  return LAYER_IDS.filter((layer) => scene.blocks.some((block) => block.layer === layer && blockPrints(block)));
}
