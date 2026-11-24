// Keepsake editor: write the print resolution into a PNG. Pure.
// A browser canvas writes no resolution, so print software would guess the physical size.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
}

export const NOT_A_PNG = "The image is not a valid PNG.";

/**
 * Returns a copy of the PNG whose pHYs chunk states `dpi` pixels per inch on both axes. An
 * existing pHYs chunk is replaced. Throws on anything that is not a well-formed PNG.
 */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!Number.isFinite(dpi) || dpi <= 0) throw new RangeError("The resolution must be positive.");
  if (png.length < 8 + 25 || SIGNATURE.some((b, i) => png[i] !== b)) throw new Error(NOT_A_PNG);

  const pixelsPerMetre = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(4 + 4 + 9 + 4);
  writeUint32(phys, 0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  writeUint32(phys, 8, pixelsPerMetre);
  writeUint32(phys, 12, pixelsPerMetre);
  phys[16] = 1; // unit: metre
  writeUint32(phys, 17, crc32(phys.subarray(4, 17)));

  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  while (offset + 12 <= png.length) {
    const length = readUint32(png, offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error(NOT_A_PNG);
    const type = chunkType(png, offset);
    if (!sawHeader) {
      if (type !== "IHDR") throw new Error(NOT_A_PNG);
      sawHeader = true;
      parts.push(png.subarray(offset, end), phys);
    } else if (type !== "pHYs") {
      parts.push(png.subarray(offset, end));
    }
    offset = end;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawHeader || !sawEnd) throw new Error(NOT_A_PNG);

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    out.set(part, position);
    position += part.length;
  }
  return out;
}

/** The pHYs resolution of a PNG in pixels per inch, or null when it has none. For tests and checks. */
export function readPngDpi(png: Uint8Array): number | null {
  if (png.length < 8 || SIGNATURE.some((b, i) => png[i] !== b)) return null;
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = readUint32(png, offset);
    if (chunkType(png, offset) === "pHYs" && length === 9 && png[offset + 16] === 1) {
      return Math.round(readUint32(png, offset + 8) * 0.0254);
    }
    offset += 12 + length;
  }
  return null;
}
