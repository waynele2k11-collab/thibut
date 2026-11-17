declare module "server-only" {}

declare module "@shuding/opentype.js" {
  export interface OpenTypePath {
    toPathData(decimalPlaces?: number): string;
    toSVG(decimalPlaces?: number): string;
    getBoundingBox(): { x1: number; y1: number; x2: number; y2: number };
  }

  export interface OpenTypeFont {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    numGlyphs: number;
    charToGlyphIndex(s: string): number;
    getAdvanceWidth(text: string, fontSize?: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): OpenTypePath;
  }

  export function parse(buffer: ArrayBuffer): OpenTypeFont;

  const opentype: {
    parse(buffer: ArrayBuffer): OpenTypeFont;
  };
  export default opentype;
}

declare module "pngjs" {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(options?: { width?: number; height?: number; filterType?: number });
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG, options?: Record<string, unknown>): Buffer;
    };
  }
}
