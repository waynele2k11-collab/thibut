# Keepsake Editor: Plan

Dated 2026-11-24. Status: PROPOSAL. Branch `feat/keepsake-editor`. No code is written yet.

Goal, in the founder's words: "I need an admin editor for Vietnamese font to create custom piece."

The editor is a production tool for one person, the admin. It turns a customer's photo, a verse typed by the admin and some artwork into print files: one transparent PNG for each clear film, plus one preview image for the customer's proof. The public Studio stays paused.

## 0. Before writing code

`AGENTS.md` says this Next.js (16.3.0, React 19.2.8) differs from what an agent remembers. The developer reads these first, from `node_modules/next/dist/docs/`:

| Guide | Why |
| --- | --- |
| `01-app/02-guides/ai-agents.md` | House rules for agents in this version |
| `01-app/02-guides/content-security-policy.md` | The site sends a strict CSP from `src/utils/supabase/middleware.ts` |
| `01-app/02-guides/lazy-loading.md` | The editor is a client-only component loaded with `next/dynamic` |
| `01-app/02-guides/single-page-applications.md` and `interactive-apps.md` | Client state in an App Router page |
| `01-app/03-api-reference` entries for `page`, `route`, `proxy` and `next.config` `outputFileTracingIncludes` | The page, the font route and file tracing for `assets/fonts` |

## 1. Assessment of what exists

**`/adm/admin/studio` today.** `src/app/adm/admin/(panel)/studio/page.tsx` renders `StudioWorkspace` with `isAdmin`. It is reachable: the pause redirects in `next.config.ts` cover `/create`, `/gallery` and the four tradition pages, not `/adm/admin/studio`. `src/app/adm/admin/(panel)/layout.tsx` calls `requireAdmin()` for every admin page.

| Part | File | Use for this goal |
| --- | --- | --- |
| Font catalogue with licence flags | `src/lib/fonts/fontCatalog.ts` (`INITIAL_FONT_CATALOG`, `isFontLicensedForPrint`) | **Reuse.** Two files on disk, Pinyon Script and Sedgwick Ave Display, have no catalogue entry yet |
| Font files, parsing and glyph check | `src/lib/fonts/FontRegistryService.ts` (`parseOpenTypeFont`, `hasGlyphCoverage`) | **Reuse** the parser. `hasGlyphCoverage` answers yes or no; the editor needs the list of missing characters |
| Font delivery to the browser | `src/app/api/fonts/[id]/route.ts` (`resolveWebEmbedFont`) | **Do not depend on it.** It needs a database row marking the font active, and `next.config.ts` excludes `assets/fonts` from most `/api` routes |
| Admin guard | `src/utils/admin/auth.ts` (`requireAdmin`, `assertAdminApi`) | **Reuse** |
| CSP | `src/utils/supabase/middleware.ts` | Already allows `img-src blob: data:` and `font-src 'self'`. No change needed |
| Canvas | `src/components/studio/MainStageCanvas.tsx` (fabric 7, 793 lines) | **Not reused.** Square stage, one calligraphy group, one seal, one background, garment mock-up |
| State | `src/lib/studio/studioStore.ts` | **Not reused.** One text, one font, one ink colour, steps "Meaning, Brush, Product", cart and session fields |
| Workspace | `StudioWorkspace.tsx`, `StudioInspector.tsx`, `StudioQuoteFooter.tsx`, `Step*Panel.tsx` | **Not reused.** Tied to print-on-demand products, garment colours, a live price quote, AI meaning analysis and add-to-cart |
| Print file | `src/lib/print-generator.tsx`, `src/lib/print/types.ts` | **Not reused.** Fixed at 4500 × 5400 px; text capped at 200 characters; images only by stored asset id; one composition, not layers; needs a personalization session |

**Recommendation: build a new, small `/adm/admin/keepsake-editor`.** It reuses the font catalogue, the font parser and the admin guard, and nothing else. A "keepsake mode" inside `StudioWorkspace` would mean bending a single-text, fixed-size, product-and-cart tool into a multi-block, multi-layer, any-size tool, with every change risking the paused Studio's tests (`studio-ux-redesign.test.ts`, `wysiwyg-regression.test.ts`, `print-master-fonts.test.ts`). The new editor is about ten files and touches three existing ones.

## 2. Scope

**Version 1 lets the admin:**

1. Pick a piece size from a short list, or type a width and height in millimetres. Set the safe margin (default 3 mm on each side).
2. Add text blocks. Two buttons give sensible starts: "Hero word" (thư pháp font, large) and "Verse" (script font, several lines). Each block has its own text, font, size, colour, alignment, line spacing, position, rotation and layer. Up to 8 blocks.
3. Add up to 3 images from the computer. One can be marked as the customer photo. Each has position, scale, rotation, a crop rectangle and a layer.
4. Assign every element to Back, Middle or Front. Show or hide each layer in the preview.
5. See the combined preview on a light, dark or checked backdrop.
6. Download each non-empty layer as a PNG, and the preview as a PNG.
7. Download and reopen a project file (JSON) holding everything except the images.

**Left out of version 1 on purpose:** saving to the database, linking to an order, the proof and approval workflow, templates, a backgrounds or ornaments library, background removal, curved or vertical text, undo history beyond one step, double-sided pieces as one project (make two projects), and any AI.

**Version 2 adds:** projects saved against an order item; private photo storage; proof versions and customer approval (BRD section 10, APR-001 to APR-008); templates per occasion; piece sizes read from the catalogue variant; front and back sides in one project.

## 3. Rendering

**Everything is drawn in the browser with the plain Canvas 2D API. No fabric, no server rendering.**

| Question | Decision |
| --- | --- |
| Preview and export match | One function, `drawLayer`, draws a layer onto any canvas at any scale. The preview calls it at screen scale; export calls it at print scale. Same code, same fonts |
| Fonts | Loaded once with the `FontFace` API from an admin-only route that streams the file from `assets/fonts`. Export waits for `document.fonts.ready` and checks each used family with `document.fonts.check` before drawing; if a font is not loaded, export stops with a message. No fallback font is ever drawn |
| Text | Typed by the admin. Normalised to NFC. Line breaks are kept exactly; there is no automatic wrapping in version 1. Drawn with `fillText`, one call per line |
| Size | `px = round(mm / 25.4 × 300)`. If the longer side would pass 6000 px, the resolution drops to the highest whole number that fits, never below 150, and the screen says so |
| Film size | Piece size minus the safe margin on each side |
| Export sheet | Film area plus a 5 mm border on every side. The border holds crop marks at the four corners and a label. Every layer of a project has the same pixel size, so films cut on the marks stack by their edges |
| Label in the border | Project name, layer name and number ("FRONT 3/3"), film size in mm, resolution, "MIRRORED" when set, date |
| Marks inside the film | Off by default. A switch adds a 0.3 mm dot 2 mm inside each film corner, for casting where edges cannot be used |
| Transparency | The canvas starts clear and nothing fills it. PNG export keeps the alpha channel |
| Mirror | One switch for the whole export. It flips the film area left to right; the border label is not flipped. Default off |
| Print resolution tag | `canvas.toBlob` writes no resolution. A pure function adds the PNG `pHYs` chunk so print software opens the file at the right physical size |
| Clear film warning | For each text block, when the colour's relative luminance is above 0.6 the screen warns: "Light colours print faint or invisible on clear film without white ink." Images get a one-line reminder, not a calculation |
| Photo sharpness | When a placed image has fewer than 150 source pixels per inch at its printed size, the screen warns |
| Glyph check | The page loads, for each font, the list of characters it has out of a fixed test set (below). Every text block is checked as the admin types. Any character not in the font's list is named: "This font has no glyph for: ữ, ằ". A block with missing characters blocks export |
| Which fonts are offered | Only fonts that pass three tests on the server: the file is in `assets/fonts`; the catalogue marks it approved for commercial print; it has every character of the Vietnamese test set. The list is computed, not typed in |
| Preview download | 150 px per inch, longer side capped at 2400 px, drawn on the chosen backdrop, with a band along the bottom: "Concept preview. Not a photograph of the finished piece." (APR-009). The band cannot be switched off |

**Test set for the glyph check.** Basic Latin letters, digits and common punctuation, plus all 134 Vietnamese letters with diacritics in both cases (a, ă, â, e, ê, i, o, ô, ơ, u, ư, y with the five tone marks, and đ). A character outside the set is treated as missing.

## 4. Photos and privacy

The photo never leaves the browser in version 1. It is read from the file input with `createImageBitmap(file, { imageOrientation: "from-image" })`, kept in memory, drawn to the canvas and dropped when the page closes. There is no upload request, no storage, no log. The project file does not contain images; it records each image's file name and placement so the admin can re-attach the same file.

| Limit | Value |
| --- | --- |
| Types | JPEG, PNG, WebP. TIFF and HEIC are refused with a message, because browsers cannot decode them reliably |
| File size | 25 MB |
| Longer side | 12000 px |
| Leaving the page | A browser warning when there is unsaved work |

## 5. Data model

Version 1: no schema change and no migration. Sizes come from a constants file.

Version 2, for a later plan: `widthMm`, `heightMm` and `thicknessMm` on `CatalogVariant`; `KeepsakeProject` (order item, scene JSON, version); private image storage; `DesignProof` and `DesignApproval` as named in BRD section 13.

## 6. Files

**New, pure, under `src/lib/keepsake-editor/`** (no React, no DOM, no server imports):

```ts
// units.ts
export const PRINT_DPI = 300; export const MIN_DPI = 150; export const MAX_SIDE_PX = 6000; export const BORDER_MM = 5;
export function mmToPx(mm: number, dpi: number): number;
export type SheetSpec = { pieceWmm: number; pieceHmm: number; marginMm: number; filmWmm: number; filmHmm: number;
  dpi: number; reduced: boolean; filmWpx: number; filmHpx: number; borderPx: number; sheetWpx: number; sheetHpx: number };
export function resolveSheet(pieceWmm: number, pieceHmm: number, marginMm: number): SheetSpec; // throws RangeError outside 20..600 mm or when the film would be under 10 mm

// sizes.ts
export const KEEPSAKE_SIZES: readonly { id: string; label: string; wMm: number; hMm: number }[]; // placeholders until the founder confirms real sizes

// scene.ts
export type LayerId = "back" | "middle" | "front";
export type TextBlock = { id: string; kind: "text"; layer: LayerId; text: string; fontId: string; sizeMm: number; colorHex: string;
  align: "left" | "center" | "right"; lineHeight: number; xMm: number; yMm: number; rotationDeg: number };
export type ImageBlock = { id: string; kind: "image"; layer: LayerId; fileName: string; isCustomerPhoto: boolean;
  xMm: number; yMm: number; widthMm: number; rotationDeg: number; crop: { x: number; y: number; w: number; h: number } }; // crop in 0..1 of the source
export type Scene = { version: 1; name: string; pieceWmm: number; pieceHmm: number; marginMm: number; mirror: boolean; innerMarks: boolean; blocks: (TextBlock | ImageBlock)[] };
export const SceneSchema: z.ZodType<Scene>;          // used for the project file; limits: 8 text blocks, 3 images, 2000 characters per block
export function parseProjectFile(json: string): Scene; // throws a fixed-text error

// reducer.ts
export type Action = /* addText, addImage, update, remove, reorder, setSize, setMargin, setMirror, load, undo */;
export function reduce(state: Scene, action: Action): Scene;

// layout.ts
export type Measure = (text: string, fontId: string, sizePx: number) => { width: number; ascent: number; descent: number };
export type LaidOutLine = { text: string; x: number; baselineY: number };
export function layoutText(block: TextBlock, sheet: SheetSpec, measure: Measure): { lines: LaidOutLine[]; box: { x: number; y: number; w: number; h: number } };
export function hitTest(scene: Scene, sheet: SheetSpec, measure: Measure, imageSizes: Record<string, { w: number; h: number }>, xMm: number, yMm: number): string | null;

// marks.ts
export type Segment = { x1: number; y1: number; x2: number; y2: number };
export function cropMarks(sheet: SheetSpec): Segment[];                 // eight segments, in the border only
export function innerDots(sheet: SheetSpec): { x: number; y: number; r: number }[];
export function sheetLabel(scene: Scene, layer: LayerId, index: number, total: number, sheet: SheetSpec, dateIso: string): string;

// coverage.ts
export const VIETNAMESE_TEST_SET: string;
export function coveredChars(hasGlyph: (ch: string) => boolean): string;  // server calls this with an opentype font
export function missingChars(text: string, covered: string): string[];   // unique, in order of first appearance; whitespace ignored
export function coversVietnamese(covered: string): boolean;

// color.ts
export function relativeLuminance(hex: string): number;
export function faintOnClearFilm(hex: string): boolean;

// png.ts
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array;     // inserts or replaces pHYs; throws on a non-PNG

// filenames.ts
export function exportFileName(scene: Scene, layer: LayerId | "preview", index: number): string; // ASCII only, no customer text beyond the project name
```

**New, server.**

| File | Does |
| --- | --- |
| `src/lib/keepsake-editor/eligible-fonts.server.ts` | `getEligibleFonts(): Promise<{ id; name; family; covered }[]>`. Reads `INITIAL_FONT_CATALOG`, keeps entries whose file is on disk and that pass `isFontLicensedForPrint`, parses each with `FontRegistryService.parseOpenTypeFont`, keeps those where `coversVietnamese` is true |
| `src/app/adm/admin/(panel)/keepsake-editor/page.tsx` | Server page. Calls `getEligibleFonts()` and renders the client editor through `next/dynamic` with `ssr: false` |
| `src/app/adm/admin/(panel)/keepsake-editor/fonts/[id]/route.ts` | `GET`. Calls `assertAdminApi()` first. Serves the file only for an id returned by `getEligibleFonts()`. `Cache-Control: private, max-age=3600`. `runtime = "nodejs"` |

**New, client, under `src/components/keepsake-editor/`.**

| File | Does |
| --- | --- |
| `KeepsakeEditor.tsx` | Holds the scene with `useReducer`, the loaded images in a ref, the three panels |
| `PreviewCanvas.tsx` | Draws the combined preview; pointer drag moves the selected block |
| `BlockPanel.tsx`, `SizePanel.tsx`, `ExportPanel.tsx` | Controls. Every input has a visible label |
| `draw.ts` | `drawLayer(ctx, scene, layer, sheet, scale, assets)`, `drawSheet` (layer plus border), `drawPreview` |
| `export.ts` | Offscreen canvas, `toBlob`, `withPngDpi`, download |
| `use-fonts.ts` | Loads the eligible fonts with `FontFace` |

**Changed.**

| File | Change |
| --- | --- |
| `src/lib/fonts/fontCatalog.ts` | Add entries for Pinyon Script and Sedgwick Ave Display (SIL Open Font License; licence text is in each file's name table) |
| `src/components/admin/AdminSidebar.tsx` | Add "Keepsake Editor" |
| `next.config.ts` | Add `"/adm/admin/keepsake-editor/fonts/[id]": ["./assets/fonts/**/*"]` and the page path to `outputFileTracingIncludes` |

**Tests.** One file, `tests/keepsake-editor.test.ts`, which `npm test` picks up through `tests/**/*.test.ts`. It covers: `mmToPx` and `resolveSheet` (normal, reduced resolution, out of range); `cropMarks` stay in the border and are the same for every layer; `layoutText` keeps line breaks and alignment with a fake measure; `missingChars` names characters; every catalogue font file on disk is run through `coveredChars`, and the test pins which ones pass (expected: UTM Thư Pháp Thiên Ân, Great Vibes, Allura, Alex Brush, Arizonia, Pinyon Script, Sedgwick Ave Display); `faintOnClearFilm`; `withPngDpi` round-trip on a tiny PNG; `parseProjectFile` rejects hostile input; `reduce` limits; a source test that the font route calls `assertAdminApi` before anything else and that no file under `src/components/keepsake-editor` or `src/lib/keepsake-editor` contains `fetch(` except the font loader.

## 7. Risks

| Risk | Control |
| --- | --- |
| This Next.js version differs from training data | Read the guides in section 0. Copy patterns from pages written this month (`src/app/adm/admin/(panel)/catalog`) |
| fabric 7 API | Not used |
| A font fails to load and the browser draws a fallback | Export checks `document.fonts.check` for every used family and stops if any is missing |
| Canvas text shaping differs slightly between browsers | Preview and export run in the same browser, so they match each other. The printed size is fixed by millimetres, not by the browser |
| Large canvases on a phone | The editor is for a laptop. Under 900 px wide it shows the preview and a note; export still works up to the browser's limit, and a failed `toBlob` gives a clear message |
| Photo privacy | No upload path exists in version 1; a source test asserts no `fetch` in the editor |
| Font licences | 15 files carry the SIL Open Font License in the file. UTM Thư Pháp Thiên Ân carries the designer's line "Free for everyone" and no licence text; the catalogue already records it as approved. Nanum Brush Script has no licence text in the file and has no Vietnamese letters, so it is never offered |
| Sizes are placeholders | The size list is marked "not validated"; custom millimetres are always available |
| Clear film has no white | Warning on light text colours; reminder on images. The print shop's result still has to be tested on a real film |
| Font route in a production build | File tracing for the new route cannot be checked here. Check the first preview deployment |

## 8. Tasks

| ID | Task | Done when |
| --- | --- | --- |
| KE-01 | Pure modules: units, sizes, scene, reducer, marks, color, png, filenames | Tests pass |
| KE-02 | Coverage: `coverage.ts`, `eligible-fonts.server.ts`, two catalogue entries | The pinned list of seven fonts passes |
| KE-03 | Font route with admin guard; `next.config.ts` tracing | Source test passes |
| KE-04 | `layout.ts` and `draw.ts` | Layout tests pass |
| KE-05 | Editor page, panels, preview, drag, warnings | Type check clean |
| KE-06 | Export of layers and preview; project file save and open | `withPngDpi` and project-file tests pass |
| KE-07 | Sidebar link; a short "how to use" note at the top of the page | |
| KE-R | Independent review | No open Blocker or High |

**Cannot be verified without a browser:** that fonts load and draw; drag behaviour; that exported PNGs are transparent, the right pixel size and open at the right physical size in print software; the look of Vietnamese diacritics in each font at print size; memory use at 6000 px; the production build of the font route.

## 9. Decisions for the founder

1. The real piece sizes in millimetres. Until then the list is placeholders.
2. The safe margin between the piece edge and the film (default 3 mm).
3. Whether crop marks in a 5 mm border suit the print shop, or it wants the film area only (a switch can drop the border).
