// Keepsake editor: download file names and the job code. Pure. ASCII only.
// Print files and the preview are named by job code and layer only: nothing the admin typed
// (which may hold a customer's name) goes into them.
import { serializeProject, type LayerId, type Scene } from "./scene";

export function projectSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "keepsake";
}

/**
 * Four hex characters from the whole scene (FNV-1a). `extra` carries what the scene does not
 * hold, such as the pixel sizes of the attached images. Not a security hash: it only lets two
 * films be told apart when they came from different states of the project.
 */
export function sceneHash(scene: Scene, extra = ""): string {
  const text = `${serializeProject(scene)}\u0000${extra}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return ((hash ^ (hash >>> 16)) & 0xffff).toString(16).padStart(4, "0");
}

/**
 * The job code printed on every film and used in every file name: UTC date, UTC time and the
 * scene hash, as "20261124-1805-a3f9". `dateIso` is an ISO timestamp such as
 * `new Date().toISOString()`.
 */
export function jobCode(dateIso: string, hash: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dateIso);
  const stamp = match ? `${match[1]}${match[2]}${match[3]}-${match[4]}${match[5]}` : "00000000-0000";
  const safeHash = /^[0-9a-f]{4}$/.test(hash) ? hash : "0000";
  return `${stamp}-${safeHash}`;
}

function safeJobCode(code: string): string {
  return /^[0-9a-f-]{1,24}$/.test(code) ? code : "00000000-0000-0000";
}

/** `index` and `total` count the films of the set, as on the border label. */
export function exportFileName(
  code: string,
  layer: LayerId | "preview",
  index: number,
  total: number,
  mirror: boolean
): string {
  const job = safeJobCode(code);
  if (layer === "preview") return `keepsake-${job}-concept-preview.png`;
  return `keepsake-${job}-film-${index}of${total}-${layer}${mirror ? "-mirrored" : ""}.png`;
}

/** The project file is the admin's own working file, so it keeps the project name. */
export function projectFileName(scene: Scene): string {
  return `${projectSlug(scene.name)}.keepsake.json`;
}
