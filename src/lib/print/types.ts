import { z } from "zod";

/**
 * Authoritative Print Master Constants (INV-013). 4500 x 5400 px at 300 DPI is a 15 x 18 inch
 * print area; the size is kept so every stored print master and calligraphy render stays valid.
 * Canvas dimensions are strictly server-controlled and NEVER supplied by clients.
 */
export const PRINT_MASTER_WIDTH = 4500 as const;
export const PRINT_MASTER_HEIGHT = 5400 as const;
export const PRINT_MASTER_DPI = 300 as const;
// 300 DPI = 300 / 0.0254 = 11811.0236 pixels per meter (PNG pHYs chunk)
export const PRINT_MASTER_PIXELS_PER_METER = 11811 as const;

export const ALLOWED_PLACEMENT_VALUES = [
  "front",
  "back",
  "both",
  "left_chest",
  "FRONT_CENTER",
  "BACK_CENTER",
  "LEFT_CHEST",
  "FRONT_AND_BACK",
] as const;

export const PlacementSchema = z.enum(ALLOWED_PLACEMENT_VALUES);
export type PlacementValue = z.infer<typeof PlacementSchema>;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a 6-digit hex color");

/**
 * Normalized print-area transform:
 * - x, y in [0, 1] where (0.5, 0.5) is the center of the safe print area.
 * - scale in [0.05, 4] relative to safe print area width.
 * - rotation in degrees [-360, 360].
 */
export const NormalizedTransformSchema = z.object({
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.05).max(4).default(1),
  rotation: z.number().min(-360).max(360).default(0),
});
export type NormalizedTransform = z.infer<typeof NormalizedTransformSchema>;

export const CalligraphyLayerSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("calligraphy"),
  assetId: z.string().min(1).max(128).optional(),
  text: z.string().min(1).max(200),
  fontFamily: z.string().min(1).max(120),
  layout: z.enum(["HORIZONTAL", "VERTICAL", "EMBLEM", "FULL_BACK"]).default("VERTICAL"),
  colorHex: HexColorSchema.default("#121212"),
  zIndex: z.number().int().min(0).max(50).default(10),
  opacity: z.number().min(0).max(1).default(1),
  transform: NormalizedTransformSchema,
});

export const SealLayerSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("seal"),
  assetId: z.string().min(1).max(128).optional(),
  sealText: z.string().min(1).max(12).default("印"),
  fontFamily: z.string().min(1).max(120).default("Ma Shan Zheng"),
  colorHex: HexColorSchema.default("#B71032"),
  zIndex: z.number().int().min(0).max(50).default(20),
  opacity: z.number().min(0).max(1).default(0.92),
  transform: NormalizedTransformSchema,
});

/**
 * Background / creator artwork layer references an internal Asset ID only —
 * NEVER an arbitrary client-controlled URL (prevents SSRF, INV-013).
 */
export const AssetLayerSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.literal("asset"),
  assetId: z.string().uuid(),
  fillMode: z.enum(["cover", "contain"]).default("contain"),
  zIndex: z.number().int().min(0).max(50).default(0),
  opacity: z.number().min(0).max(1).default(1),
  transform: NormalizedTransformSchema,
});

export const CompositionLayerSchema = z.discriminatedUnion("type", [
  CalligraphyLayerSchema,
  SealLayerSchema,
  AssetLayerSchema,
]);
export type CompositionLayer = z.infer<typeof CompositionLayerSchema>;

/**
 * Canonical server-validated Composition JSON (T-300, INV-013).
 * Canvas size (4500x5400 @ 300 DPI transparent) is fixed by the server renderer.
 */
export const CompositionSchema = z.object({
  version: z.literal(1).default(1),
  calligraphyAssetId: z.string().min(1).max(128).optional(),
  productVariantId: z.string().min(1).max(128).optional(),
  placement: PlacementSchema.default("front"),
  color: HexColorSchema.default("#121212"),
  transform: NormalizedTransformSchema.default({
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
  }),
  layers: z.array(CompositionLayerSchema).min(1).max(12),
});

export type DesignComposition = z.infer<typeof CompositionSchema>;

/**
 * Converts a legacy pre-Wave-1 composition JSON shape (if encountered on historical orders)
 * into a validated `DesignComposition` conforming to `CompositionSchema`.
 */
export function adaptLegacyComposition(raw: unknown): DesignComposition {
  const direct = CompositionSchema.safeParse(raw);
  if (direct.success) {
    return direct.data;
  }

  if (typeof raw === "object" && raw !== null && "layers" in raw) {
    const candidate = raw as Record<string, unknown>;
    if (Array.isArray(candidate.layers)) {
      const normalizedLayers = candidate.layers.map((item) => {
        if (typeof item !== "object" || item === null) return item;
        const l = item as Record<string, unknown>;
        if (
          l.type === "seal" &&
          (l.fontFamily === "VNI Ong do" || l.fontFamily === "vni-ong-do")
        ) {
          return { ...l, fontFamily: "Ma Shan Zheng" };
        }
        return item;
      });
      return CompositionSchema.parse({
        ...candidate,
        layers: normalizedLayers,
      });
    }
  }

  return CompositionSchema.parse(raw);
}
