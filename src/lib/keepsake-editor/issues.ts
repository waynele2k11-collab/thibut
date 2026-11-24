// Keepsake editor: what stops an export and what only deserves a warning. Pure.
import { CLEAR_FILM_WARNING, faintOnClearFilm } from "./color";
import { missingChars, missingGlyphMessage } from "./coverage";
import { blockBounds, imagePixelsPerInch, type Box, type Measure } from "./layout";
import { LAYER_LABELS, type Block, type Scene } from "./scene";
import { mmToPxExact, PRINT_DPI, type SheetSpec } from "./units";

export type Issue = {
  blockId: string;
  /**
   * "block" stops the export. "warn" must be accepted once before a download. "note" is shown
   * and needs no answer.
   */
  level: "block" | "warn" | "note";
  message: string;
};

export const MIN_PHOTO_PPI = 150;
export const IMAGE_FILM_REMINDER =
  "Images print without white ink on clear film: pale areas turn see-through. Check the result on a real film.";

/** What the geometry checks need: the sheet and the measurer the draw function uses. */
export type IssueGeometry = { sheet: SheetSpec; measure: Measure };

/** Slack for rounding: positions are typed in tenths of a millimetre. */
const EDGE_TOLERANCE_PX = 1;

function trimNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * Checks one block's drawn bounds against the film. Anything that would be cut off stops the
 * export, so the film edge never trims artwork without the admin being told. An image may reach
 * the film edge exactly (a background that fills the film); it is not warned about on that side.
 */
export function geometryIssue(
  kind: Block["kind"],
  bounds: Box,
  sheet: SheetSpec,
  safeZoneMm: number
): { level: "block" | "warn"; message: string } | null {
  const filmW = mmToPxExact(sheet.filmWmm, sheet.dpi);
  const filmH = mmToPxExact(sheet.filmHmm, sheet.dpi);
  const t = EDGE_TOLERANCE_PX;
  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.w;
  const bottom = bounds.y + bounds.h;

  if (right <= 0 || bottom <= 0 || left >= filmW || top >= filmH) {
    return {
      level: "block",
      message: "This block is outside the film, so none of it would print. Move it back inside the film, or remove it.",
    };
  }
  if (bounds.w > filmW + 2 * t || bounds.h > filmH + 2 * t) {
    return {
      level: "block",
      message:
        kind === "text"
          ? "This text is larger than the film. Make the letters smaller, or press Enter to break long lines."
          : "This image is larger than the film. Make it narrower, trim it, or use \"Fill the film\".",
    };
  }
  if (left < -t || top < -t || right > filmW + t || bottom > filmH + t) {
    return {
      level: "block",
      message: "This block runs off the film and would be cut off. Move it inside the film edge, or make it smaller.",
    };
  }
  const safe = mmToPxExact(Math.max(0, safeZoneMm), sheet.dpi);
  if (safe > 0) {
    const gaps = [left, top, filmW - right, filmH - bottom];
    const near = gaps.some((gap) => {
      if (kind === "image" && gap <= t) return false; // reaches the edge on purpose
      return gap < safe - 1e-6;
    });
    if (near) {
      return {
        level: "warn",
        message: `This block comes within ${trimNumber(safeZoneMm)} mm of the film edge and may be trimmed when the film is cut.`,
      };
    }
  }
  return null;
}

export function sceneIssues(
  scene: Scene,
  fonts: readonly { id: string; covered: string }[],
  fontStatus: Readonly<Record<string, string | undefined>>,
  imageSizes: Readonly<Record<string, { w: number; h: number }>>,
  geometry?: IssueGeometry | null
): Issue[] {
  const issues: Issue[] = [];
  for (const block of scene.blocks) {
    let measurable = true;
    if (block.kind === "text") {
      const font = fonts.find((f) => f.id === block.fontId);
      if (!font) {
        issues.push({
          blockId: block.id,
          level: "block",
          message: "This font is not available for Vietnamese text. Choose another font.",
        });
        continue;
      }
      const missing = missingChars(block.text, font.covered);
      if (missing.length > 0) {
        issues.push({ blockId: block.id, level: "block", message: missingGlyphMessage(missing) });
      }
      const status = Object.hasOwn(fontStatus, block.fontId) ? fontStatus[block.fontId] : undefined;
      if (status === "error") {
        measurable = false;
        issues.push({
          blockId: block.id,
          level: "block",
          message: "This font failed to load. Reload the page, or choose another font.",
        });
      } else if (status !== "ready") {
        measurable = false;
        issues.push({ blockId: block.id, level: "block", message: "This font is still loading." });
      }
      if (block.text.trim() === "") {
        issues.push({ blockId: block.id, level: "warn", message: "This text block is empty. It prints nothing." });
      }
      if (faintOnClearFilm(block.colorHex)) {
        issues.push({ blockId: block.id, level: "warn", message: CLEAR_FILM_WARNING });
      }
    } else {
      const size = Object.hasOwn(imageSizes, block.id) ? imageSizes[block.id] : undefined;
      if (!size) {
        issues.push({
          blockId: block.id,
          level: "block",
          message: `The image "${block.fileName}" is not attached. Attach the file again, or remove the image.`,
        });
        continue;
      }
      const ppi = imagePixelsPerInch(block, size);
      if (ppi < MIN_PHOTO_PPI) {
        issues.push({
          blockId: block.id,
          level: "warn",
          message: `This image has about ${Math.round(ppi)} pixels per inch at this size and may print soft. Use a larger file or make it smaller.`,
        });
      } else if (ppi < PRINT_DPI) {
        issues.push({
          blockId: block.id,
          level: "note",
          message: `This image has about ${Math.round(ppi)} pixels per inch at this size. Films print at ${PRINT_DPI}, so it is enlarged a little.`,
        });
      }
    }
    // A font that is not loaded would be measured in a stand-in font, so its bounds mean nothing.
    if (geometry && measurable) {
      const bounds = blockBounds(block, geometry.sheet, geometry.measure, imageSizes);
      const found = bounds ? geometryIssue(block.kind, bounds, geometry.sheet, scene.safeZoneMm) : null;
      if (found) issues.push({ blockId: block.id, ...found });
    }
  }
  return issues;
}

export function blocksExport(issues: readonly Issue[]): boolean {
  return issues.some((issue) => issue.level === "block");
}

/** Warnings that must be accepted before a download. Notes are not among them. */
export function warningsOf(issues: readonly Issue[]): Issue[] {
  return issues.filter((issue) => issue.level === "warn");
}

/** Changes whenever the set of warnings changes, so an earlier "download anyway" no longer applies. */
export function warningKey(issues: readonly Issue[]): string {
  return warningsOf(issues)
    .map((issue) => `${issue.blockId}\u0001${issue.message}`)
    .join("\u0002");
}

/** A short name for a block in lists: its layer and what it is. */
export function blockLabel(block: Block): string {
  const layer = LAYER_LABELS[block.layer];
  if (block.kind === "image") {
    return `${layer} · ${block.isCustomerPhoto ? "Customer photo" : "Image"}: ${block.fileName}`;
  }
  const firstLine = block.text.split("\n")[0] ?? "";
  return `${layer} · Text: ${Array.from(firstLine).slice(0, 28).join("") || "(empty)"}`;
}

/** Every issue with the name of the block it belongs to, blocking ones first. */
export function describeIssues(scene: Scene, issues: readonly Issue[]): { issue: Issue; label: string }[] {
  const order = { block: 0, warn: 1, note: 2 } as const;
  return issues
    .map((issue) => {
      const block = scene.blocks.find((b) => b.id === issue.blockId);
      return { issue, label: block ? blockLabel(block) : "Block" };
    })
    .sort((a, b) => order[a.issue.level] - order[b.issue.level]);
}
