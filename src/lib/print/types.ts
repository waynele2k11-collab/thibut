/**
 * Universal Design Composition JSON API
 * 
 * This object model acts as the single source of truth for both the frontend
 * live-preview editor and the backend 300 DPI high-res print master generator.
 * It strictly separates the "Artwork Layers" (Calligraphy, Overlays) from the
 * "Media Layers" (Photographer photos, Digital Art Prints, Blank Mockups).
 */

export interface DesignComposition {
  canvas: {
    width: number;
    height: number;
    dpi: number;
    backgroundColor?: string;
  };
  layers: CompositionLayer[];
}

export type CompositionLayer = MediaLayer | VectorTextLayer;

export interface LayerBase {
  id: string;
  type: "media" | "vector";
  zIndex: number;
  opacity: number;
  blendMode: "normal" | "multiply" | "screen" | "overlay";
}

/**
 * Used for Photographer Photos, Digital Art Prints, or Product Base Layers
 */
export interface MediaLayer extends LayerBase {
  type: "media";
  assetUrl: string; // URL or Base64 DataURI of the background art
  fillMode: "cover" | "contain";
}

/**
 * Used for Thi Bút Calligraphy and Texts
 */
export interface VectorTextLayer extends LayerBase {
  type: "vector";
  svgBase64: string; // The deterministic SVG string from the Calligraphy Renderer
  transform: {
    x: number; // Pixels from center
    y: number; // Pixels from center
    scale: number;
    rotation: number;
  };
  colorHex: string;
}
