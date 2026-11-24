# Keepsake Editor: Independent Review

Dated 2026-11-24. Branch `feat/keepsake-editor`, base `8e952b4`. Reviewed: the uncommitted working tree.

**Verdict: no Blocker. One High (KE-H1) should be fixed before the first real order.** The print arithmetic, marks, mirror, PNG resolution tag, font eligibility, font route and privacy all held up under test. Nothing here was run in a browser, so fonts drawing, transparency of the real PNG and physical print size are still unproven (section 7).

## 1. Scope

- New: `src/lib/keepsake-editor/*` (13 files), `src/components/keepsake-editor/*` (10 files), `src/app/admin/keepsake-editor/page.tsx`, `src/app/admin/keepsake-editor/fonts/[id]/route.ts`, `tests/keepsake-editor.test.ts`.
- Changed: `next.config.ts`, `src/components/admin/AdminSidebar.tsx`, `src/lib/fonts/fontCatalog.ts`, `tests/next-tracks-features.test.ts`, `tests/qa-audit-verification.test.ts`.
- Read first: `AGENTS.md`, `docs/KEEPSAKE_EDITOR_PLAN.md`, BRD sections 08, 10 (APR-009), 11, 12, and the Next 16.3.0 guides for `lazy-loading`, `route`, route segment config and `output` (file tracing).
- Not reviewed: `.claude/settings.local.json` (untracked, not part of the feature; do not commit it).

## 2. What was run

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Exit 0, no errors. It rewrote the git-ignored `tsconfig.tsbuildinfo`. |
| `node --import ./scripts/test-loader.mjs --test tests/keepsake-editor.test.ts` | 40 pass, 0 fail. |
| `node --import ./scripts/test-loader.mjs --test 'tests/**/*.test.ts'` | 105 tests: 87 pass, 18 fail. |
| `npx eslint` on the new directories, the new test, `fontCatalog.ts`, `next.config.ts` | Exit 0, no output. |
| Scratch scripts in `/tmp/ke` against the pure modules and the real font files | Results in sections 3 to 5. |

**The 18 failures are environmental.** Every failure message is one of three: `Cannot find module '@resvg/resvg-js-linux-x64-gnu'`; `sharp.libvipsVersion is not a function`; `Prisma Client could not locate the Query Engine`. `node_modules` holds only macOS binaries (`sharp-darwin-x64`, `libquery_engine-darwin.dylib.node`, no Linux resvg binding) and this review ran on Linux. No failure message mentions the keepsake editor. I did not check out the base commit; the conclusion rests on the messages and on what is installed. Which of the three errors a file reports varies between runs, because each is the first native module that file happens to load.

**The two modified tests are not weakened.** `next-tracks-features` changes the font count from 14 to 16, still an exact number; that test ("Track 5") passes when the file is run alone. `qa-audit-verification` adds the two new keys to an exact `deepEqual` of `outputFileTracingIncludes`. The surrounding test dies earlier on the resvg import, so I ran that `deepEqual` on its own against `next.config.ts`: it passes.

## 3. Findings

### Blocker

None.

### High

**KE-H1. Artwork that crosses the film edge is cut off with no warning.**
`src/components/keepsake-editor/draw.ts:149-151` clips every layer to the film rectangle; `src/lib/keepsake-editor/issues.ts:18` has no geometry check at all.
Confirmed input: a text block holding one 2,000-character line on a 100 × 100 mm piece lays out 118,110 px wide on a 1,110 px film; `sceneIssues` returns zero issues. A block moved to x = 1500 mm, y = −900 mm (allowed: positions run to ±2000 mm) also returns zero issues, and its layer still counts as "non-empty", so a blank film is offered for download.
Why it matters: there is no automatic wrapping, so a long verse line runs off the film easily. The preview clips the same way, but a swash or a stacked diacritic (Ẵ, Ữ) losing half a millimetre is not visible in a 620 px preview. The text box uses the font's nominal ascent, and script fonts draw outside it.
Fix: in `sceneIssues`, compute each block's rotated box (the layout functions already exist) and add a warning when it crosses the film edge, a stronger one when it lies wholly outside, and a note when it comes within about 2 mm of the edge. The function needs the sheet and a measurer passed in.

### Medium

**KE-M1. Warnings are not shown where the files are downloaded.**
`ExportPanel.tsx:39` lists only issues that stop export. Warnings (light colour on clear film, photo under 150 ppi, empty text block) appear only when that block is selected (`BlockPanel.tsx:341`) or as the word "check" in the block list.
Scenario: white text on the Front layer, another block selected; the admin presses "Download Front film" and gets an almost invisible print with nothing said at that moment.
Fix: list all warnings above the download buttons, and name them in the success message.

**KE-M2. The films of one piece can come from different states of the project.**
Each layer is a separate download of the current scene (`KeepsakeEditor.tsx:171`). There is no "download all films". The border label carries the date only. Scenario: download Back, nudge a block or tick "Mirror", download Front; the two films no longer match, and only the file name shows the mirror difference. Related, confirmed by script: for a film between about 498 and 508 mm on its longer side, switching the border off changes the resolution (508 mm: 294 ppi with border, 300 without; `units.ts:86`).
Fix: one button that renders every non-empty layer from one snapshot; put a time or a short content hash in the label so a mixed set can be spotted.

**KE-M3. Invisible characters stop export with a message that cannot be read.**
`coverage.ts:59`. Confirmed: text with a zero-width space, soft hyphen or direction mark (common in text pasted from chat apps and web pages) is correctly blocked, but the message is `This font has no glyph for: ​, ‌` with nothing visible after the colon. The admin cannot tell what to delete.
Fix: name invisible and control characters by code and description ("zero-width space U+200B"), and offer a "remove hidden characters" button.

**KE-M4. No bleed and no safe zone inside the film.**
The "safe margin" only makes the film smaller than the piece. Artwork is clipped exactly on the cut line (`draw.ts:149`), so a background meant to reach the edge leaves a clear sliver if the cut lands a fraction outside the marks, and text can sit on the cut line unflagged.
Fix: draw a few millimetres of bleed past the film edge into the border when the border is on (keep the marks on top), and show an inner guide in the preview. Decide with the print shop.

**KE-M5. The default hero font's licence rests on one sentence.** (Existing catalogue entry, now used for paid work.)
`fontCatalog.ts:107`. `UtmThuphapThienAn.ttf` contains the designer's line "Free for everyone" and no licence text; the catalogue records "Free for Personal & Commercial use", verified by "system-seed". The editor picks this font first for "Add hero word".
Fix: get written confirmation from the designer (the file names fontchudep.com) or keep a dated copy of the source page, and record who checked.

### Low

| ID | Where | What | Suggested fix |
| --- | --- | --- | --- |
| KE-L1 | `export.ts:86`, `marks.ts:86` | The label always says "n/3" ("FRONT 3/3") even when only one or two films exist. A print shop may look for missing files. | Number against the non-empty layers, or print "layer 3 of 3 positions, 2 films in this set". |
| KE-L2 | `reducer.ts:231` | Undo is one step and there is no redo (as planned). Confirmed: two separate drags of the same block, or two typing sessions in the same field, undo together, because the run key is never reset on pointer-up or blur. | Dispatch an "end run" on pointer-up and blur. |
| KE-L3 | `KeepsakeEditor.tsx:135,147,195` | `ImageBitmap`s are never closed when an image is removed, replaced or a project is opened. The customer photo's pixels stay in tab memory until the tab closes. No data leaves the browser. | Call `bitmap.close()` on replace and project open; on remove, close once undo can no longer restore it. |
| KE-L4 | `export.ts:63` | The size check compares a value with itself and can never fail. A browser that silently produces a blank oversized canvas is not detected. | After drawing, read one pixel of a crop mark; fail if it is empty. |
| KE-L5 | `export.ts:103`, `draw.ts:290` | The concept band is always drawn (pass), but its text is squeezed into 94% of the width. By arithmetic, pieces narrower than about 60 mm give the 56-character line under 350 px at 12 px type. The on-screen canvas has no band, so a screenshot or "Save image as" gives a proof without it. | Wrap the band to two lines on narrow pieces; draw the band on screen too. |
| KE-L6 | `coverage.ts:48` | Whitespace-class characters skip the glyph check: no-break space, thin spaces, U+3000, U+FEFF. UTM Thư Pháp Thiên Ân has no no-break space glyph, so the browser takes that space from another font (spacing only, nothing visible). | Replace them with a plain space in `normalizeText`. |
| KE-L7 | `issues.ts:14` | The photo warning starts under 150 ppi while films print at 300. A photo at 150 to 299 ppi is enlarged without comment. | Add a mild note under 300; keep the strong one under 150. |
| KE-L8 | `reducer.ts:85,200` | `reduce` throws on `crop: null` and on a non-string name. The interface never sends these; only a caller that breaks the types can. | Guard with `typeof`. |
| KE-L9 | `scene.ts:114` | `parseProjectFile` accepts a `__proto__` key (dropped; no pollution observed), two images both marked as the customer photo, and control characters in the project name (stripped later in labels and file names). | Reject or normalise on load. |
| KE-L10 | `reducer.ts:60` | Cutting text at 2,000 characters can split an emoji in half. Harmless today: the half is reported as a missing glyph. | Cut by code point. |
| KE-L11 | `fonts/[id]/route.ts:23` | Any error in the guard, including a database outage, answers 401. | Answer 500 for errors that are not `AdminAuthError`. |
| KE-L12 | `fontCatalog.ts:292` | Pinyon Script (a round-hand) and Sedgwick Ave Display (a marker face) are filed as "Vietnamese Thư Pháp" under the names "Thanh Nhã" and "Bút Lông". They cover Vietnamese but are not thư pháp. | Use a "Script" category, or say so in the description. |
| KE-L13 | `draw.ts:194` | Crop marks are 1 px lines on whole-pixel coordinates, so each is drawn two pixels wide at half strength. Position is correct; visibility on film is unverified. | Use a 2 px line, or offset by half a pixel. |
| KE-L14 | `use-fonts.ts:38` | Eligibility ignores the catalogue's `defaultEnabled` and the admin Fonts page's on/off switch. Re-running the effect registers duplicate faces. | Document it; skip faces already registered. |
| KE-L15 | Project file, border label | Both carry the image file name or project name, which may hold a customer's name. The help text warns about the project name only. | Add the same hint for file names. |
| KE-L16 | BRD 08, 11 | Gaps against the BRD, all outside the plan's version 1: TIFF is refused (`KeepsakeEditor.tsx:46`; BRD 08 lists TIFF), no white-ink mask, no mold ID on the label, rectangles only. | Track for version 2. |
| KE-L17 | Tests | `export.ts` (`assertFontsReady`, the preview band call, layer export) and all components are pinned by source-text patterns only; the privacy test is a pattern scan. The pure modules and `draw.ts` are tested by behaviour. | Add a behaviour test for `assertFontsReady` and `exportPreviewPng` with a stub `document`. |

## 4. Print-output checks

"Script" means I ran it against the module; "code" means read only; nothing was run in a browser.

| Check | Result | How |
| --- | --- | --- |
| mm to px at 300 ppi: `round(mm / 25.4 × 300)`; 94 mm film = 1110 px, 5 mm border = 59 px, sheet 1228 px | Pass | Script |
| Rounding error of the film against its stated size, 9,288 size/margin/border combinations | Pass (worst 0.049 mm) | Script |
| Every layer has the same pixel size (the sheet depends on size, margin and border only) | Pass | Code, script |
| Longer side never above 6000 px; resolution drops in whole numbers (lowest reachable 249 ppi at 600 mm) and the screen says so | Pass | Script, code |
| Out-of-range size, margin, NaN, Infinity, string: rejected with `RangeError`; the interface shows a message | Pass | Script, code |
| Eight crop marks, all in the border, none inside the film, at least 5 px from the sheet edge | Pass | Script |
| Marks and registration dots identical on every layer | Pass | Script |
| Marks and dots are left-right symmetric, so mirrored films still register with each other | Pass | Script |
| Mirror flips artwork about the film centre; label and marks are not flipped; label and file name say MIRRORED | Pass | Code, developer's recorded-canvas test |
| Safe margin: film = piece − 2 × margin; film sits at the margin offset in the preview | Pass | Script, code |
| Artwork cannot spill into the border | Pass (see KE-H1 for the cost) | Code |
| `pHYs` chunk: valid CRC, directly after `IHDR` and before `IDAT`, 11811 px/m on both axes, unit 1; an old `pHYs` replaced; pixels and alpha unchanged; all other chunk CRCs intact | Pass | Script, on PNGs built with zlib, including one with `sRGB`, an old `pHYs`, `tEXt` and three `IDAT` chunks |
| `pHYs` at reduced resolution (252 ppi = 9921 px/m; 150 = 5906) | Pass | Script |
| Non-PNG, truncated, no `IEND`, empty input: fixed error | Pass | Script |
| Layer export never fills a background (one `clearRect`, no `fillRect`) | Pass | Code, developer's recorded-canvas test |
| Real exported PNG has a real alpha channel | Not verified | Needs a browser |
| Preview download has a backdrop and the "Concept preview" band; the band has no off switch | Pass | Code |
| Band never on print layers (`drawConceptBand` is called from `exportPreviewPng` only) | Pass | Code |
| Band readable on small pieces | Not verified (KE-L5) | Needs a browser |
| Image caps: JPEG/PNG/WebP, 25 MB, 12,000 px, each with a message | Pass | Code |
| Canvas too large for the browser: message when `toBlob` returns nothing | Partial (KE-L4) | Code |
| Export blocked when a font is loading, failed or unknown, or a glyph is missing, or an image is unattached | Pass | Script, code |
| Warning when artwork leaves the film | **Fail (KE-H1)** | Script |

### Text and fonts

- NFC: typed, pasted and loaded text is normalised; decomposed input "Nghĩa mẹ như nước" (23 units) becomes 17 and passes the glyph check. CR and CRLF become LF; "a\r\nb\rc\n\nd" keeps 5 lines including the empty one. Pass.
- "Nghĩa mẹ như nước trong nguồn chảy ra" and "Đ đ ư ơ ằ ẵ ữ ợ": no missing glyphs in Great Vibes. Pass.
- Emoji, ♥, CJK, combining marks with no composed form (q̃), zero-width and direction characters, control characters: all reported as missing and block export. ♥ and ♡ are in none of the seven fonts. Message quality: KE-M3.
- Empty or whitespace-only block: warning only; export proceeds.
- **Eligible fonts, checked independently against all 17 files in `assets/fonts`:** exactly seven are licensed in the catalogue and have all 207 required characters: UTM Thư Pháp Thiên Ân, Great Vibes, Allura, Arizonia, Alex Brush, Pinyon Script, Sedgwick Ave Display. The other ten lack between 80 and 134 Vietnamese letters (Mr Dafoe also has no catalogue entry). In the seven, no required character maps to an empty outline and no two Vietnamese letters share a glyph. How the diacritics look is not something a script can judge.
- Preview and export call the same `drawLayer` with the same registered families (`KE <id>`). Pass by code.
- Font failure: status "error" or "loading" blocks export in `sceneIssues`, and `assertFontsReady` checks again before drawing. The on-screen preview does draw a system font until the real one loads; the download buttons are disabled meanwhile. `document.fonts.check` behaves differently across browsers for unknown families, so the status map is the real guard; it is sufficient by code.

## 5. Other areas

**Font route.** `assertAdminApi()` is the first statement and its failure returns before `params` is read. The id must match `^[a-z0-9-]{1,64}$` and is then compared for equality with the computed list; the file name comes from the catalogue through `path.basename`. Calling the resolver directly with `../../.env`, `..%2F..%2F.env`, `/etc/passwd`, `GreatVibes-Regular.ttf`, `great-vibes/`, an empty string, `__proto__`, `constructor`, `GREAT-VIBES`, a NUL-terminated id, `nanum-brush-script` and `vni-ong-do` returned nothing each time; `great-vibes` returned 457,588 bytes as `font/ttf`. `Cache-Control: private, max-age=3600` and `nosniff` are set. The signature (`params` as a promise) and `runtime`/`dynamic` exports match this version's docs; `dynamic` is only removed when Cache Components is on, and it is not. The proxy matcher skips paths ending `.ttf`/`.otf`; the route's URLs do not end that way, so the session proxy runs. Note: the older public `/api/fonts/[id]` route already serves enabled fonts with a public cache header, so these files are not secret.

**File tracing.** Next normalises app routes to `/admin/keepsake-editor` and `/admin/keepsake-editor/fonts/[id]`. With picomatch, the two new include keys match exactly those two routes and no other; none of the three exclude keys matches them. Other routes are unaffected. Whether the fonts really land in the deployed function can only be seen on a preview deployment.

**Admin page.** `await requireAdmin()` is the first line, the same pattern as `admin/catalog/page.tsx`; `admin/layout.tsx` guards again (`admin/studio/page.tsx` relies on the layout alone). `robots: { index: false, follow: false }` is set on the page and the layout. `ssr: false` sits in a `"use client"` loader, as this version's lazy-loading guide requires.

**Reducer and project file.** Limits hold: 12 add-text and 6 add-image actions leave 8 and 3. NaN, strings, out-of-range numbers, unknown layer/alignment/font-id patterns are ignored or clamped; state is never mutated. 37 hostile project files were rejected with the one fixed message (huge and non-finite numbers, wrong types, extra keys, version 2, 9 texts, 4 images, duplicate ids, path-like font ids and file names, bad colours, bad crops, 100,000-deep arrays, oversize files). Accepted and harmless: an unknown but well-formed font id (export then blocks), an id of `constructor` (lookups use `Object.hasOwn`), the items in KE-L9.

**Wording.** No "glass" or "crystal" in any editor file or the page (scan and the developer's test). The size list is followed directly by "These sizes are placeholders and have not been validated against a real mold or sheet."; the option labels themselves do not say so.

**Missing warnings for a non-designer** (item 7 of the brief):

1. Artwork crossing or outside the film edge (KE-H1).
2. Artwork close to the cut line; no bleed (KE-M4).
3. Any warning at the moment of download (KE-M1).
4. Films downloaded from different states of the project (KE-M2).
5. Photo between 150 and 300 ppi (KE-L7). Under 150 there is a warning.
6. Light or pale areas inside an image: a fixed reminder is shown for every image; nothing is measured. Light text colour does warn.
7. A layer that is "non-empty" only because of an empty text block or an off-film block exports a blank film.
8. Which layers have no film: buttons for empty layers are simply absent, and the label still says "/3" (KE-L1).
9. Mirror left on from a reopened project: shown as a ticked box, in the file name and in the label, but not in the download message.

An unassigned layer cannot happen: every block is created on a layer (text Front, customer photo Middle, artwork Back).

## 6. Can photo data leave the browser?

**No, by reading every file under `src/components/keepsake-editor` and `src/lib/keepsake-editor`.** The photo is read with `createImageBitmap(file)` into memory and drawn to canvases. There is no `fetch`, `XMLHttpRequest`, `sendBeacon`, WebSocket, form, server action, `postMessage`, `localStorage`, `sessionStorage`, IndexedDB, cookie write, `toDataURL` or `console` call in those files. The only request the editor makes is `FontFace` loading font files from `/admin/keepsake-editor/fonts/<id>`, a GET with no body. The only object URLs are for the admin's own downloads and are revoked after 10 seconds. The project file holds the image's file name and placement, never pixels. The root and admin layouts load no analytics or session-replay script that I could find.

Limits of this statement: it is a code reading, not a network capture (step 9 below). Exported PNGs do contain the photo, by design, and are then the admin's files to protect. The photo's file name is stored in the project file (KE-L15). Bitmaps stay in memory until the tab closes (KE-L3).

## 7. What cannot be verified here

No browser was available. Unverified: that the fonts load through the route and draw; that preview and export look the same; that the exported PNG is truly transparent; its pixel size and the size print software reports; drag behaviour; diacritic quality in each font; memory at 6000 px; behaviour in Safari; the production build and file tracing of the font route.

## 8. Hand test before the first real order

Use Chrome on the laptop that will do the real work. Keep the files.

1. Open `/admin/keepsake-editor` signed in as admin. In a private window, signed out, open `/admin/keepsake-editor/fonts/great-vibes`: it must refuse.
2. Choose 100 × 100 mm, margin 3. The panel must read "Film: 94 × 94 mm, 1110 × 1110 px at 300 pixels per inch".
3. Add a hero word and a verse. Type "Nghĩa mẹ như nước trong nguồn chảy ra" and, on a second line, "Đ đ ư ơ ằ ẵ ữ ợ". Try all seven fonts. Zoom the browser in and look at every accent: none missing, none in a different typeface, none colliding.
4. Type ♥ and an emoji: export must stop and name them. Delete them.
5. Add a customer photo (a phone JPEG taken in portrait: it must appear upright) and one artwork PNG with transparency. Put text on Front, photo on Middle, artwork on Back.
6. Set the backdrop to "Checked". Download all three films and the preview.
7. Open each film in an image editor: each must be 1228 × 1228 px and report 300 ppi and 103.97 mm; the background must be transparent (checkerboard), not white; no "Concept preview" band. Stack the three as layers: the corner marks must coincide exactly.
8. Open the preview: backdrop present, band along the bottom, readable.
9. Network check: open DevTools, Network tab, clear it, then add a photo, move it, and download a film. The only requests allowed are font files. Nothing with the photo.
10. Tick "Mirror the films" and download Front again: artwork flipped, label not flipped and reading MIRRORED, marks in the same places as the unmirrored file.
11. Drag the verse half off the film and download: note that it is cut off with no warning (KE-H1). Until that is fixed, check every edge in the preview by eye before each export.
12. Set the text colour to white: confirm the warning appears only with that block selected (KE-M1).
13. Save the project file, reload the page, open it, re-attach the two images, download Front, and compare with the file from step 6: same picture.
14. Try a 20 × 20 mm and a 600 × 400 mm piece: the preview band on the small one must be readable; the large one must download (about 5990 px wide at about 250 ppi; the size panel states the exact figures) and not be blank.
15. Print one set at 100% on plain paper before using film. Measure the distance between crop marks with a ruler: 94 mm. Then print one real film and check light colours, pale photo areas and mark visibility.
16. On the first preview deployment, repeat step 3 to confirm the fonts are present in the deployed build.

## Resolution (2026-11-24)

| Finding | Action |
| --- | --- |
| KE-H1 | Fixed. A block outside, larger than, or running off the film blocks export. "Fill the film" added for full backgrounds |
| KE-M1 | Fixed. All issues are listed at the download buttons; warnings need a "Download anyway" tick |
| KE-M2 | Fixed. "Download all films and the preview" from one snapshot, with one job code on every file |
| KE-M3 | Fixed. Hidden characters are stripped with a note |
| KE-M4 | Partly fixed. Editable safe zone (default 3 mm) as an on-screen guide. No bleed setting |
| KE-M5 | Fixed. Licence basis recorded as found and shown in the picker; default hero font is Great Vibes |
| KE-L1 to L13, L15 | Fixed |
| KE-L14 | Open: the Fonts-page switch is in the database and is not read by the editor |
| KE-L16, L17 | Open: TIFF, white-ink mask and mold ID are for a later version |

After the fixes: type check and lint clean; editor tests 57 pass. The full suite has 18 failures, all from missing Linux binaries in the review environment. Nothing has been run in a browser: follow the hand-test script above before the first real order.
