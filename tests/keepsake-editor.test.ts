import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { CLEAR_FILM_WARNING, faintOnClearFilm, relativeLuminance } from "@/lib/keepsake-editor/color";
import {
  VIETNAMESE_LETTERS,
  VIETNAMESE_REQUIRED_SET,
  VIETNAMESE_TEST_SET,
  coveredChars,
  coversVietnamese,
  missingChars,
  missingGlyphMessage,
} from "@/lib/keepsake-editor/coverage";
import { getEligibleFonts, readEligibleFontFile } from "@/lib/keepsake-editor/eligible-fonts.server";
import { exportFileName, jobCode, projectFileName, projectSlug, sceneHash } from "@/lib/keepsake-editor/filenames";
import {
  blockLabel,
  blocksExport,
  describeIssues,
  geometryIssue,
  sceneIssues,
  warningKey,
  warningsOf,
} from "@/lib/keepsake-editor/issues";
import {
  blockBounds,
  hitTest,
  imagePixelsPerInch,
  layoutImage,
  layoutText,
  rotatedBounds,
  textInkBox,
  type Measure,
} from "@/lib/keepsake-editor/layout";
import {
  asciiLabelText,
  conceptBandSpec,
  cropMarks,
  innerDots,
  markLineWidth,
  sheetLabel,
} from "@/lib/keepsake-editor/marks";
import { NOT_A_PNG, readPngDpi, withPngDpi } from "@/lib/keepsake-editor/png";
import { initialEditorState, reduce, reduceEditor } from "@/lib/keepsake-editor/reducer";
import {
  MAX_IMAGE_BLOCKS,
  MAX_TEXT_BLOCKS,
  PROJECT_FILE_ERROR,
  emptyScene,
  hiddenCharCount,
  layersWithArtwork,
  normalizeName,
  normalizeText,
  parseProjectFile,
  serializeProject,
  truncateText,
  type ImageBlock,
  type Scene,
  type TextBlock,
} from "@/lib/keepsake-editor/scene";
import { KEEPSAKE_SIZES } from "@/lib/keepsake-editor/sizes";
import { MAX_SIDE_PX, mmToPx, mmToPxExact, resolveSheet } from "@/lib/keepsake-editor/units";

const ROOT = process.cwd();

/** A fake measurer: every character is half the font size wide. */
const measure: Measure = (text, _fontId, sizePx) => ({
  width: Array.from(text).length * sizePx * 0.5,
  ascent: sizePx * 0.8,
  descent: sizePx * 0.2,
});

function textBlock(patch: Partial<TextBlock> = {}): TextBlock {
  return {
    id: "t-1",
    kind: "text",
    layer: "front",
    text: "Mẹ",
    fontId: "great-vibes",
    sizeMm: 10,
    colorHex: "#3a2a12",
    align: "center",
    lineHeight: 1.2,
    xMm: 47,
    yMm: 10,
    rotationDeg: 0,
    ...patch,
  };
}

function imageBlock(patch: Partial<ImageBlock> = {}): ImageBlock {
  return {
    id: "i-1",
    kind: "image",
    layer: "middle",
    fileName: "photo.jpg",
    isCustomerPhoto: true,
    xMm: 10,
    yMm: 10,
    widthMm: 50,
    rotationDeg: 0,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    ...patch,
  };
}

function sceneWith(blocks: Scene["blocks"], patch: Partial<Scene> = {}): Scene {
  return { ...emptyScene(100, 100, 3), blocks, ...patch };
}

// ---------------------------------------------------------------- units

test("mmToPx converts millimetres at a resolution", () => {
  assert.equal(mmToPx(25.4, 300), 300);
  assert.equal(mmToPx(100, 300), 1181);
  assert.equal(mmToPx(5, 300), 59);
  assert.equal(mmToPx(0, 300), 0);
});

test("resolveSheet: film is the piece minus the margin, sheet adds the 5 mm border", () => {
  const sheet = resolveSheet(100, 150, 3);
  assert.equal(sheet.filmWmm, 94);
  assert.equal(sheet.filmHmm, 144);
  assert.equal(sheet.dpi, 300);
  assert.equal(sheet.reduced, false);
  assert.equal(sheet.filmWpx, mmToPx(94, 300));
  assert.equal(sheet.filmHpx, mmToPx(144, 300));
  assert.equal(sheet.borderPx, 59);
  assert.equal(sheet.sheetWpx, sheet.filmWpx + 118);
  assert.equal(sheet.sheetHpx, sheet.filmHpx + 118);
});

test("resolveSheet without the border exports the film area only", () => {
  const sheet = resolveSheet(100, 150, 3, false);
  assert.equal(sheet.borderPx, 0);
  assert.equal(sheet.sheetWpx, sheet.filmWpx);
  assert.equal(sheet.sheetHpx, sheet.filmHpx);
  assert.deepEqual(cropMarks(sheet), []);
});

test("resolveSheet lowers the resolution for large pieces, never below 150", () => {
  const big = resolveSheet(600, 400, 3);
  assert.equal(big.reduced, true);
  assert.ok(big.dpi < 300 && big.dpi >= 150, String(big.dpi));
  assert.ok(Math.max(big.sheetWpx, big.sheetHpx) <= MAX_SIDE_PX);
  // The highest whole number that fits: one more would not.
  assert.ok(mmToPx(600 - 6 + 10, big.dpi + 1) > MAX_SIDE_PX);
  const justFits = resolveSheet(500, 100, 3);
  assert.equal(justFits.reduced, false);
});

test("resolveSheet rejects sizes out of range and margins that leave no film", () => {
  for (const args of [
    [19, 100, 3],
    [100, 601, 3],
    [100, 100, -1],
    [100, 100, 46],
    [Number.NaN, 100, 3],
    [100, Number.POSITIVE_INFINITY, 3],
  ] as const) {
    assert.throws(() => resolveSheet(args[0], args[1], args[2]), RangeError, args.join(","));
  }
  assert.equal(resolveSheet(100, 100, 45).filmWmm, 10);
});

test("every size preset resolves at full resolution", () => {
  for (const size of KEEPSAKE_SIZES) {
    const sheet = resolveSheet(size.wMm, size.hMm, 3);
    assert.equal(sheet.reduced, false, size.id);
  }
});

// ---------------------------------------------------------------- marks

test("crop marks are eight segments that stay in the border", () => {
  const sheet = resolveSheet(100, 150, 3);
  const marks = cropMarks(sheet);
  assert.equal(marks.length, 8);
  const left = sheet.borderPx;
  const top = sheet.borderPx;
  const right = left + sheet.filmWpx;
  const bottom = top + sheet.filmHpx;
  for (const s of marks) {
    for (const [x, y] of [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]) {
      assert.ok(x >= 0 && x <= sheet.sheetWpx && y >= 0 && y <= sheet.sheetHpx, "inside the sheet");
      const strictlyInsideFilm = x > left && x < right && y > top && y < bottom;
      assert.equal(strictlyInsideFilm, false, "never inside the film");
    }
    // Each segment lies wholly outside the film rectangle on one side.
    const outside =
      Math.max(s.x1, s.x2) < left || Math.min(s.x1, s.x2) > right || Math.max(s.y1, s.y2) < top || Math.min(s.y1, s.y2) > bottom;
    assert.equal(outside, true);
  }
});

test("marks depend on the sheet only, so every layer carries the same marks", () => {
  const sheet = resolveSheet(100, 150, 3);
  assert.deepEqual(cropMarks(sheet), cropMarks(resolveSheet(100, 150, 3)));
  const dots = innerDots(sheet);
  assert.equal(dots.length, 4);
  for (const dot of dots) {
    assert.ok(dot.x > sheet.borderPx && dot.x < sheet.borderPx + sheet.filmWpx);
    assert.ok(dot.y > sheet.borderPx && dot.y < sheet.borderPx + sheet.filmHpx);
    assert.ok(dot.r >= 1);
  }
});

test("the border label is ASCII and names the layer, film size, resolution and mirror state", () => {
  const sheet = resolveSheet(100, 150, 3);
  const scene = sceneWith([], { name: "Mẹ và Đông — quà", mirror: true });
  const label = sheetLabel(scene, "front", 2, 2, sheet, "20261124-1000-a3f9");
  assert.equal(label, "Me va Dong qua | FRONT 2 of 2 | film 94 x 144 mm | 300 ppi | MIRRORED | job 20261124-1000-a3f9");
  assert.match(label, /^[\x20-\x7e]+$/);
  assert.equal(sheetLabel({ ...scene, mirror: false, name: "" }, "back", 1, 3, sheet, "20261124-1000-a3f9").includes("MIRRORED"), false);
  assert.equal(asciiLabelText("  Tết\n2027‮  "), "Tet 2027");
});

// ---------------------------------------------------------------- layout

test("layoutText keeps line breaks exactly, including empty lines, and never wraps", () => {
  const sheet = resolveSheet(100, 100, 3);
  const block = textBlock({ text: "Công cha như núi Thái Sơn\n\nNghĩa mẹ", align: "left", xMm: 0 });
  const { lines } = layoutText(block, sheet, measure);
  assert.deepEqual(lines.map((l) => l.text), ["Công cha như núi Thái Sơn", "", "Nghĩa mẹ"]);
  const sizePx = (10 / 25.4) * 300;
  assert.ok(Math.abs(lines[1].baselineY - lines[0].baselineY - sizePx * 1.2) < 1e-6);
  assert.ok(Math.abs(lines[2].baselineY - lines[1].baselineY - sizePx * 1.2) < 1e-6);
});

test("layoutText aligns each line to the anchor", () => {
  const sheet = resolveSheet(100, 100, 3);
  const text = "ab\nabcd";
  const sizePx = (10 / 25.4) * 300;
  const anchor = (47 / 25.4) * 300;
  const wide = 4 * sizePx * 0.5;
  const narrow = 2 * sizePx * 0.5;
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

  const left = layoutText(textBlock({ text, align: "left" }), sheet, measure);
  near(left.lines[0].x, anchor);
  near(left.lines[1].x, anchor);
  near(left.box.x, anchor);

  const center = layoutText(textBlock({ text, align: "center" }), sheet, measure);
  near(center.lines[1].x, anchor - wide / 2);
  near(center.lines[0].x, anchor - narrow / 2);
  near(center.box.w, wide);

  const right = layoutText(textBlock({ text, align: "right" }), sheet, measure);
  near(right.lines[0].x + narrow, anchor);
  near(right.lines[1].x + wide, anchor);
});

test("layoutImage keeps the cropped aspect ratio; pixels per inch follow the printed width", () => {
  const sheet = resolveSheet(100, 100, 3);
  const full = layoutImage(imageBlock(), sheet, { w: 2000, h: 1000 });
  assert.ok(Math.abs(full.h - full.w / 2) < 1e-6);
  const cropped = layoutImage(imageBlock({ crop: { x: 0.25, y: 0, w: 0.5, h: 1 } }), sheet, { w: 2000, h: 1000 });
  assert.ok(Math.abs(cropped.h - cropped.w) < 1e-6);
  assert.equal(Math.round(imagePixelsPerInch(imageBlock({ widthMm: 50.8 }), { w: 600, h: 600 })), 300);
  assert.equal(Math.round(imagePixelsPerInch(imageBlock({ widthMm: 50.8, crop: { x: 0, y: 0, w: 0.5, h: 1 } }), { w: 600, h: 600 })), 150);
});

test("hitTest returns the top-most block, front over middle over back", () => {
  const sheet = resolveSheet(100, 100, 3);
  const back = imageBlock({ id: "i-back", layer: "back", xMm: 0, yMm: 0, widthMm: 94 });
  const front = textBlock({ id: "t-front", layer: "front", align: "left", xMm: 20, yMm: 20, text: "abcd" });
  const scene = sceneWith([front, back]);
  const sizes = { "i-back": { w: 100, h: 100 } };
  assert.equal(hitTest(scene, sheet, measure, sizes, 22, 24), "t-front");
  assert.equal(hitTest(scene, sheet, measure, sizes, 80, 80), "i-back");
  assert.equal(hitTest(scene, sheet, measure, {}, 200, 200), null);
});

// ---------------------------------------------------------------- coverage

test("the Vietnamese letter set has the 134 letters with diacritics, each one code point", () => {
  const letters = Array.from(VIETNAMESE_LETTERS);
  assert.equal(letters.length, 134);
  assert.equal(new Set(letters).size, 134);
  for (const ch of letters) assert.equal(ch.normalize("NFC"), ch);
  for (const ch of "ăâêôơưđĂÂÊÔƠƯĐẹảữằốợỵỶ") assert.ok(VIETNAMESE_LETTERS.includes(ch), ch);
  assert.ok(VIETNAMESE_TEST_SET.startsWith(VIETNAMESE_REQUIRED_SET));
});

test("missingChars names characters once, in order, ignoring whitespace and comparing in NFC", () => {
  const covered = "abcẹ";
  assert.deepEqual(missingChars("a b\nc", covered), []);
  assert.deepEqual(missingChars("xa y x\tữ", covered), ["x", "y", "ữ"]);
  // Decomposed input (e + combining dot below) is the same letter as the precomposed one.
  assert.deepEqual(missingChars("ẹ", covered), []);
  // A character outside the editor's test set is treated as missing.
  assert.deepEqual(missingChars("印", coveredChars(() => true)), ["印"]);
  assert.equal(missingGlyphMessage(["ữ", "ằ"]), "This font has no glyph for: ữ, ằ");
});

test("coversVietnamese needs every required character", () => {
  assert.equal(coversVietnamese(coveredChars(() => true)), true);
  assert.equal(coversVietnamese(coveredChars((ch) => ch !== "ữ")), false);
  assert.equal(coversVietnamese(coveredChars((ch) => ch.charCodeAt(0) < 128)), false);
  // Optional punctuation does not decide eligibility.
  assert.equal(coversVietnamese(coveredChars((ch) => VIETNAMESE_REQUIRED_SET.includes(ch))), true);
});

test("the offered fonts are computed from disk, licence and coverage: exactly these seven", async () => {
  const fonts = await getEligibleFonts();
  assert.deepEqual(
    fonts.map((f) => f.id).sort(),
    [
      "alex-brush",
      "allura",
      "arizonia",
      "great-vibes",
      "pinyon-script",
      "sedgwick-ave-display",
      "utm-thuphap-thien-an",
    ]
  );
  for (const font of fonts) {
    assert.equal(coversVietnamese(font.covered), true, font.id);
    assert.deepEqual(missingChars("Nghĩa mẹ như nước trong nguồn chảy ra", font.covered), [], font.id);
    assert.deepEqual(missingChars("Công cha như núi Thái Sơn", font.covered), [], font.id);
  }
});

test("font files are read by catalogue id only; anything else returns nothing", async () => {
  const ok = await readEligibleFontFile("great-vibes");
  assert.ok(ok && ok.bytes.byteLength > 1000);
  assert.equal(ok.contentType, "font/ttf");
  for (const id of [
    "caveat-brush", // on disk and licensed, but without Vietnamese letters
    "ma-shan-zheng",
    "../../package.json",
    "GreatVibes-Regular.ttf",
    "great-vibes/../../../etc/passwd",
    "",
    "__proto__",
  ]) {
    assert.equal(await readEligibleFontFile(id), null, id);
  }
});

// ---------------------------------------------------------------- colour

test("light colours are flagged for clear film; dark ones are not", () => {
  assert.equal(relativeLuminance("#000000"), 0);
  assert.ok(Math.abs(relativeLuminance("#ffffff") - 1) < 1e-9);
  for (const hex of ["#ffffff", "#fff8dc", "#ffd700", "#f5e6a8"]) assert.equal(faintOnClearFilm(hex), true, hex);
  for (const hex of ["#000000", "#3a2a12", "#8b0000", "#1a3a6b"]) assert.equal(faintOnClearFilm(hex), false, hex);
  for (const bad of ["", "red", "#fff", "#gggggg", "#ffffff00"]) {
    assert.ok(Number.isNaN(relativeLuminance(bad)), bad);
    assert.equal(faintOnClearFilm(bad), false, bad);
  }
  assert.match(CLEAR_FILM_WARNING, /clear film/);
});

// ---------------------------------------------------------------- png

function tinyPng(): Uint8Array {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(0);
  png.data[3] = 255;
  return new Uint8Array(PNG.sync.write(png));
}

test("withPngDpi writes the resolution and keeps the pixels", () => {
  const source = tinyPng();
  assert.equal(readPngDpi(source), null);
  const tagged = withPngDpi(source, 300);
  assert.equal(readPngDpi(tagged), 300);
  const decoded = PNG.sync.read(Buffer.from(tagged));
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 2);
  assert.deepEqual(Array.from(decoded.data), Array.from(PNG.sync.read(Buffer.from(source)).data));
  // Replaces an existing tag instead of adding a second one.
  const retagged = withPngDpi(tagged, 150);
  assert.equal(readPngDpi(retagged), 150);
  assert.equal(Buffer.from(retagged).toString("latin1").split("pHYs").length - 1, 1);
  assert.equal(retagged.length, tagged.length);
  // pHYs comes straight after IHDR, before the image data.
  const text = Buffer.from(tagged).toString("latin1");
  assert.ok(text.indexOf("IHDR") < text.indexOf("pHYs") && text.indexOf("pHYs") < text.indexOf("IDAT"));
});

test("withPngDpi rejects anything that is not a whole PNG", () => {
  const source = tinyPng();
  for (const bad of [
    new Uint8Array(0),
    new Uint8Array(64),
    new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>".padEnd(64, " ")),
    source.subarray(0, source.length - 6),
  ]) {
    assert.throws(() => withPngDpi(bad, 300), { message: NOT_A_PNG });
  }
  assert.throws(() => withPngDpi(source, 0), RangeError);
  assert.throws(() => withPngDpi(source, Number.NaN), RangeError);
});

// ---------------------------------------------------------------- project file

test("a project file round-trips, in NFC, without images", () => {
  const scene = sceneWith([textBlock({ text: "Mẹ\r\nCha" }), imageBlock()], { name: "Quà Tết" });
  const json = serializeProject(scene);
  const loaded = parseProjectFile(json);
  assert.equal(loaded.blocks.length, 2);
  const text = loaded.blocks[0];
  assert.ok(text.kind === "text");
  assert.equal(text.text, "Mẹ\nCha");
  assert.equal(normalizeText("a\r\nb\rc"), "a\nb\nc");
  assert.equal(json.includes("data:"), false);
  assert.equal(/bitmap|base64/i.test(json), false);
});

test("parseProjectFile rejects hostile input with one fixed message", () => {
  const good = sceneWith([textBlock()]);
  const hostile: string[] = [
    "",
    "not json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, extra: true }),
    JSON.stringify({ ...good, pieceWmm: 1e9 }),
    JSON.stringify({ ...good, pieceWmm: "100" }),
    JSON.stringify({ ...good, marginMm: 49 }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), id: "../x" }] }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), colorHex: "red;background:url(x)" }] }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), text: "x".repeat(2001) }] }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), fontId: "../../etc/passwd" }] }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), sizeMm: null }] }),
    JSON.stringify({ ...good, blocks: [{ ...textBlock(), onload: "alert(1)" }] }),
    JSON.stringify({ ...good, blocks: [textBlock(), textBlock()] }),
    JSON.stringify({ ...good, blocks: Array.from({ length: 9 }, (_, i) => textBlock({ id: `t-${i}` })) }),
    JSON.stringify({ ...good, blocks: Array.from({ length: 4 }, (_, i) => imageBlock({ id: `i-${i}` })) }),
    JSON.stringify({ ...good, blocks: [imageBlock({ fileName: "../../secret.jpg" })] }),
    JSON.stringify({ ...good, blocks: [imageBlock({ crop: { x: 0.9, y: 0, w: 0.5, h: 1 } })] }),
    JSON.stringify({ ...good, blocks: [{ ...imageBlock(), dataUrl: "data:image/png;base64,AAAA" }] }),
    '{"__proto__":{"polluted":true},"version":1}',
    `{"version":1,"name":"${"a".repeat(300_000)}"}`,
  ];
  for (const json of hostile) {
    assert.throws(() => parseProjectFile(json), { message: PROJECT_FILE_ERROR }, json.slice(0, 60));
  }
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

// ---------------------------------------------------------------- reducer

test("reduce enforces the limits of 8 text blocks and 3 images", () => {
  let scene = emptyScene(100, 100, 3);
  for (let i = 0; i < MAX_TEXT_BLOCKS + 2; i += 1) {
    scene = reduce(scene, { type: "addText", id: `t-${i}`, preset: i === 0 ? "hero" : "verse", fontId: "great-vibes" });
  }
  assert.equal(scene.blocks.filter((b) => b.kind === "text").length, MAX_TEXT_BLOCKS);
  for (let i = 0; i < MAX_IMAGE_BLOCKS + 2; i += 1) {
    scene = reduce(scene, { type: "addImage", id: `i-${i}`, fileName: "a.jpg", aspect: 1.5, isCustomerPhoto: i === 0 });
  }
  assert.equal(scene.blocks.filter((b) => b.kind === "image").length, MAX_IMAGE_BLOCKS);
  // A duplicate id is ignored.
  const before = reduce(emptyScene(100, 100, 3), { type: "addText", id: "t-0", preset: "hero", fontId: "allura" });
  assert.equal(reduce(before, { type: "addText", id: "t-0", preset: "hero", fontId: "allura" }), before);
  // Whatever the reducer produced is a valid project file.
  assert.doesNotThrow(() => parseProjectFile(serializeProject(scene)));
});

test("reduce: presets start on the front layer with Vietnamese text; one customer photo at a time", () => {
  let scene = reduce(emptyScene(100, 150, 3), { type: "addText", id: "t-1", preset: "hero", fontId: "utm-thuphap-thien-an" });
  const hero = scene.blocks[0];
  assert.ok(hero.kind === "text");
  assert.equal(hero.layer, "front");
  assert.equal(hero.text, "Mẹ");
  assert.equal(hero.xMm, 47);
  scene = reduce(scene, { type: "addImage", id: "i-1", fileName: "a/b\\c.jpg", aspect: 1, isCustomerPhoto: true });
  scene = reduce(scene, { type: "addImage", id: "i-2", fileName: "art.png", aspect: 1, isCustomerPhoto: false });
  const first = scene.blocks.find((b) => b.id === "i-1");
  assert.ok(first && first.kind === "image");
  assert.equal(first.layer, "middle");
  assert.equal(first.fileName, "a_b_c.jpg");
  scene = reduce(scene, { type: "update", id: "i-2", patch: { isCustomerPhoto: true } });
  const photos = scene.blocks.filter((b) => b.kind === "image" && b.isCustomerPhoto);
  assert.deepEqual(photos.map((b) => b.id), ["i-2"]);
});

test("reduce clamps updates and ignores values that are not allowed", () => {
  let scene = sceneWith([textBlock()]);
  scene = reduce(scene, { type: "update", id: "t-1", patch: { sizeMm: 9999, colorHex: "red", text: "Mẹ\r\nx", rotationDeg: Number.NaN, fontId: "../x" } });
  const block = scene.blocks[0];
  assert.ok(block.kind === "text");
  assert.equal(block.sizeMm, 300);
  assert.equal(block.colorHex, "#3a2a12");
  assert.equal(block.text, "Mẹ\nx");
  assert.equal(block.rotationDeg, 0);
  assert.equal(block.fontId, "great-vibes");
  assert.equal(reduce(scene, { type: "update", id: "nope", patch: { sizeMm: 5 } }), scene);
  assert.equal(reduce(scene, { type: "setSize", pieceWmm: 5, pieceHmm: 100 }), scene);
  assert.equal(reduce(scene, { type: "setSize", pieceWmm: Number.NaN, pieceHmm: 100 }), scene);
  assert.equal(reduce(scene, { type: "setMargin", marginMm: 46 }), scene);
  assert.equal(reduce(scene, { type: "setMargin", marginMm: -1 }), scene);
  assert.equal(reduce(scene, { type: "setMargin", marginMm: 5 }).marginMm, 5);
  assert.equal(reduce(scene, { type: "setName", name: "x".repeat(200) }).name.length, 80);
});

test("reduce: reorder, remove, mirror and border switches", () => {
  const scene = sceneWith([textBlock({ id: "a" }), textBlock({ id: "b" })]);
  assert.deepEqual(reduce(scene, { type: "reorder", id: "a", direction: "up" }).blocks.map((b) => b.id), ["b", "a"]);
  assert.equal(reduce(scene, { type: "reorder", id: "a", direction: "down" }), scene);
  assert.deepEqual(reduce(scene, { type: "remove", id: "a" }).blocks.map((b) => b.id), ["b"]);
  assert.equal(scene.mirror, false);
  assert.equal(scene.cropBorder, true);
  assert.equal(scene.innerMarks, false);
  assert.equal(reduce(scene, { type: "setMirror", mirror: true }).mirror, true);
  assert.equal(reduce(scene, { type: "setCropBorder", cropBorder: false }).cropBorder, false);
  assert.equal(reduce(scene, { type: "setInnerMarks", innerMarks: true }).innerMarks, true);
});

test("each drag is its own undo step once the pointer is released", () => {
  let state = initialEditorState(sceneWith([textBlock()]));
  const drag = (x: number) => reduceEditor(state, { type: "update", id: "t-1", patch: { xMm: x }, coalesceKey: "t-1:drag" });
  state = drag(48);
  state = drag(49);
  state = reduceEditor(state, { type: "endRun" });
  assert.equal(state.lastKey, null);
  assert.equal(reduceEditor(state, { type: "endRun" }), state, "ending a run twice changes nothing");
  state = drag(60);
  state = drag(61);
  state = reduceEditor(state, { type: "undo" });
  assert.equal(state.scene.blocks[0].xMm, 49, "undo takes back the second drag only");
});

test("the reducer ignores input that breaks its types instead of throwing", () => {
  const scene = sceneWith([textBlock(), imageBlock()]);
  const bad = (action: unknown) => reduce(scene, action as Parameters<typeof reduce>[1]);
  assert.equal(bad(null), scene);
  assert.equal(bad(undefined), scene);
  assert.equal(bad("update"), scene);
  assert.equal(bad({ type: "update", id: "i-1", patch: null }), scene);
  assert.equal(bad({ type: "setName", name: 42 }), scene);
  assert.equal(bad({ type: "setSafeZone", safeZoneMm: "3" }), scene);
  assert.equal(bad({ type: "addText", id: 7, preset: "hero", fontId: "great-vibes" }), scene);
  assert.equal(bad({ type: "addText", id: "t-9", preset: "hero", fontId: "../x" }), scene);
  assert.equal(bad({ type: "fillFilm", id: "i-1", sourceAspect: "tall" }), scene);
  assert.equal(bad({ type: "load", scene: null }), scene);
  const cropped = bad({ type: "update", id: "i-1", patch: { crop: null } });
  assert.deepEqual((cropped.blocks[1] as ImageBlock).crop, { x: 0, y: 0, w: 1, h: 1 });
  const named = bad({ type: "addImage", id: "i-9", fileName: 12, aspect: "x", isCustomerPhoto: "yes" });
  const added = named.blocks.find((b) => b.id === "i-9");
  assert.ok(added && added.kind === "image");
  assert.equal(added.fileName, "image");
  assert.equal(added.isCustomerPhoto, false);
  assert.equal(reduceEditor(initialEditorState(scene), null as unknown as Parameters<typeof reduce>[1]).scene, scene);
});

test("the safe zone is set within limits; fillFilm trims an image to the film and places it edge to edge", () => {
  const scene = sceneWith([imageBlock({ rotationDeg: 12 })]);
  assert.equal(scene.safeZoneMm, 3);
  assert.equal(reduce(scene, { type: "setSafeZone", safeZoneMm: 5 }).safeZoneMm, 5);
  assert.equal(reduce(scene, { type: "setSafeZone", safeZoneMm: -1 }), scene);
  assert.equal(reduce(scene, { type: "setSafeZone", safeZoneMm: 51 }), scene);

  // A 94 × 94 mm film and a source twice as tall as wide: keep the width, trim top and bottom.
  const tall = reduce(scene, { type: "fillFilm", id: "i-1", sourceAspect: 2 }).blocks[0] as ImageBlock;
  assert.deepEqual([tall.xMm, tall.yMm, tall.widthMm, tall.rotationDeg], [0, 0, 94, 0]);
  assert.deepEqual(tall.crop, { x: 0, y: 0.25, w: 1, h: 0.5 });
  // A source twice as wide as tall: keep the height, trim the sides.
  const wide = reduce(scene, { type: "fillFilm", id: "i-1", sourceAspect: 0.5 }).blocks[0] as ImageBlock;
  assert.deepEqual(wide.crop, { x: 0.25, y: 0, w: 0.5, h: 1 });
  // The filled image matches the film exactly: no geometry issue at all.
  const sheet = resolveSheet(100, 100, 3);
  const filled = { ...scene, blocks: [tall] };
  const bounds = blockBounds(tall, sheet, measure, { "i-1": { w: 1000, h: 2000 } });
  assert.ok(bounds);
  assert.equal(geometryIssue("image", bounds, sheet, filled.safeZoneMm), null);
  assert.equal(reduce(scene, { type: "fillFilm", id: "nope", sourceAspect: 1 }), scene);
});

test("one step of undo; a drag counts as one step", () => {
  let state = initialEditorState(sceneWith([textBlock()]));
  assert.equal(state.dirty, false);
  for (const x of [48, 49, 50]) {
    state = reduceEditor(state, { type: "update", id: "t-1", patch: { xMm: x }, coalesceKey: "t-1:drag" });
  }
  assert.equal(state.dirty, true);
  state = reduceEditor(state, { type: "undo" });
  assert.equal(state.scene.blocks[0].xMm, 47);
  assert.equal(state.previous, null);
  assert.equal(reduceEditor(state, { type: "undo" }), state);
  const loaded = reduceEditor(state, { type: "load", scene: emptyScene(150, 100, 3) });
  assert.equal(loaded.dirty, false);
  assert.equal(loaded.previous, null);
});

// ---------------------------------------------------------------- issues

test("issues: a missing letter, a font that is not offered or not loaded, and a missing image stop export", () => {
  const fonts = [{ id: "great-vibes", covered: coveredChars((ch) => ch !== "ữ") }];
  const ready = { "great-vibes": "ready" };
  const clean = sceneIssues(sceneWith([textBlock()]), fonts, ready, {});
  assert.deepEqual(clean, []);

  const missing = sceneIssues(sceneWith([textBlock({ text: "chữ 印" })]), fonts, ready, {});
  assert.deepEqual(missing, [{ blockId: "t-1", level: "block", message: "This font has no glyph for: ữ, 印" }]);
  assert.equal(blocksExport(missing), true);

  assert.equal(blocksExport(sceneIssues(sceneWith([textBlock({ fontId: "ma-shan-zheng" })]), fonts, ready, {})), true);
  assert.equal(blocksExport(sceneIssues(sceneWith([textBlock()]), fonts, {}, {})), true);
  assert.equal(blocksExport(sceneIssues(sceneWith([textBlock()]), fonts, { "great-vibes": "error" }, {})), true);
  assert.equal(blocksExport(sceneIssues(sceneWith([imageBlock()]), fonts, ready, {})), true);
});

test("issues: light text and a low-resolution photo warn without stopping export", () => {
  const fonts = [{ id: "great-vibes", covered: coveredChars(() => true) }];
  const issues = sceneIssues(
    sceneWith([textBlock({ colorHex: "#ffd700" }), imageBlock({ widthMm: 80 })]),
    fonts,
    { "great-vibes": "ready" },
    { "i-1": { w: 300, h: 300 } }
  );
  assert.equal(blocksExport(issues), false);
  assert.deepEqual(issues.map((i) => i.level), ["warn", "warn"]);
  assert.equal(issues[0].message, CLEAR_FILM_WARNING);
  assert.match(issues[1].message, /pixels per inch/);
});

// ---------------------------------------------------------------- file names

test("print file names carry the job code, layer, count and mirror state, and nothing that was typed", () => {
  const scene = sceneWith([], { name: "Quà Tết cho Mẹ / Đông" });
  const code = "20261124-1805-a3f9";
  assert.equal(exportFileName(code, "front", 2, 2, false), "keepsake-20261124-1805-a3f9-film-2of2-front.png");
  assert.equal(exportFileName(code, "back", 1, 3, true), "keepsake-20261124-1805-a3f9-film-1of3-back-mirrored.png");
  assert.equal(exportFileName(code, "preview", 0, 2, false), "keepsake-20261124-1805-a3f9-concept-preview.png");
  // A code that is not a job code never reaches the file name.
  for (const hostile of ["../../etc/passwd", "Nguyễn Văn A", "<script>", "", "a".repeat(200)]) {
    assert.equal(exportFileName(hostile, "middle", 2, 3, false), "keepsake-00000000-0000-0000-film-2of3-middle.png");
  }
  // The project file is the admin's own working file and keeps the project name.
  assert.equal(projectSlug(scene.name), "qua-tet-cho-me-dong");
  assert.equal(projectFileName(scene), "qua-tet-cho-me-dong.keepsake.json");
  assert.equal(projectSlug("../../etc/passwd"), "etc-passwd");
  assert.equal(projectSlug("   "), "keepsake");
});

test("the job code is the UTC minute plus a hash of the whole scene", () => {
  const scene = sceneWith([textBlock()]);
  const hash = sceneHash(scene);
  assert.match(hash, /^[0-9a-f]{4}$/);
  assert.equal(sceneHash(sceneWith([textBlock()])), hash, "the same scene gives the same hash");
  assert.notEqual(sceneHash(sceneWith([textBlock({ xMm: 47.1 })])), hash, "a nudge changes it");
  assert.notEqual(sceneHash({ ...scene, mirror: true }), hash, "the mirror switch changes it");
  assert.notEqual(sceneHash(scene, "i-1:800x600"), hash, "a different attached image changes it");
  assert.equal(jobCode("2026-11-24T18:05:59.123Z", "a3f9"), "20261124-1805-a3f9");
  assert.equal(jobCode("not a date", "zzzz"), "00000000-0000-0000");
});

// ---------------------------------------------------------------- drawing (recorded, no browser)

type Call = { name: string; args: unknown[]; mirrored: boolean; font: string; fillStyle: string };

/** A stand-in for CanvasRenderingContext2D that records calls and tracks the mirror state. */
function recordingContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const stack: { mirrored: boolean; font: string; fillStyle: string }[] = [];
  const state = { mirrored: false, font: "10px sans-serif", fillStyle: "#000000" };
  const target: Record<string, unknown> = {
    measureText(text: string) {
      const size = Number.parseFloat(state.font) || 10;
      return {
        width: Array.from(text).length * size * 0.5,
        fontBoundingBoxAscent: size * 0.8,
        fontBoundingBoxDescent: size * 0.2,
      };
    },
  };
  const ctx = new Proxy(target, {
    get(obj, prop: string) {
      if (prop === "font") return state.font;
      if (prop === "fillStyle") return state.fillStyle;
      if (prop in obj) return obj[prop];
      return (...args: unknown[]) => {
        if (prop === "save") stack.push({ ...state });
        if (prop === "restore") Object.assign(state, stack.pop() ?? {});
        if (prop === "scale" && typeof args[0] === "number" && args[0] < 0) state.mirrored = !state.mirrored;
        calls.push({ name: prop, args, mirrored: state.mirrored, font: state.font, fillStyle: state.fillStyle });
        return undefined;
      };
    },
    set(_obj, prop: string, value: unknown) {
      if (prop === "font") state.font = String(value);
      if (prop === "fillStyle") state.fillStyle = String(value);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const drawAssets = {
  images: new Map([["i-1", { bitmap: {} as ImageBitmap, w: 1000, h: 1000 }]]),
  fontFamily: (fontId: string) => `KE ${fontId}`,
};

test("an exported sheet stays transparent, uses the real font, and mirrors the film but not the label", async () => {
  const { drawSheet } = await import("@/components/keepsake-editor/draw");
  const sheet = resolveSheet(100, 150, 3);
  const scene = sceneWith([imageBlock(), textBlock({ text: "Mẹ\nCha", colorHex: "#112233" })], { mirror: true, pieceHmm: 150 });

  const front = recordingContext();
  drawSheet(front.ctx, scene, "front", sheet, drawAssets, "LABEL");
  const names = front.calls.map((c) => c.name);
  assert.equal(names.includes("fillRect"), false, "nothing is filled behind the artwork");
  assert.equal(names.filter((n) => n === "clearRect").length, 1);
  assert.equal(names.includes("drawImage"), false, "the middle layer's photo is not on the front film");
  const texts = front.calls.filter((c) => c.name === "fillText");
  assert.deepEqual(texts.map((c) => c.args[0]), ["Mẹ", "Cha", "LABEL"]);
  for (const call of texts.slice(0, 2)) {
    assert.equal(call.mirrored, true, "artwork text is mirrored");
    assert.match(call.font, /px "KE great-vibes"$/);
    assert.equal(call.fillStyle, "#112233");
  }
  assert.equal(texts[2].mirrored, false, "the label is never mirrored");
  assert.match(texts[2].font, /Arial/);
  assert.equal(front.calls.filter((c) => c.name === "lineTo").length, 8, "eight crop marks");
  assert.equal(front.calls.filter((c) => c.name === "lineTo").every((c) => c.mirrored === false), true);
  assert.equal(names.includes("arc"), false, "no inner dots unless switched on");

  const middle = recordingContext();
  drawSheet(middle.ctx, { ...scene, mirror: false, innerMarks: true }, "middle", sheet, drawAssets, "LABEL");
  const image = middle.calls.filter((c) => c.name === "drawImage");
  assert.equal(image.length, 1);
  assert.equal(image[0].mirrored, false);
  assert.equal(middle.calls.filter((c) => c.name === "arc").length, 4);
  assert.deepEqual(middle.calls.filter((c) => c.name === "fillText").map((c) => c.args[0]), ["LABEL"]);

  const noBorder = recordingContext();
  drawSheet(noBorder.ctx, { ...scene, mirror: false }, "front", resolveSheet(100, 150, 3, false), drawAssets, "LABEL");
  assert.deepEqual(noBorder.calls.filter((c) => c.name === "fillText").map((c) => c.args[0]), ["Mẹ", "Cha"]);
  assert.equal(noBorder.calls.some((c) => c.name === "lineTo"), false);
});

test("the preview is never mirrored, draws back then middle then front, and hides switched-off layers", async () => {
  const { drawPreview, drawConceptBand, CONCEPT_PREVIEW_BAND } = await import("@/components/keepsake-editor/draw");
  const sheet = resolveSheet(100, 100, 3);
  const scene = sceneWith(
    [textBlock({ id: "t-f", text: "front" }), imageBlock({ id: "i-1", layer: "middle" }), textBlock({ id: "t-b", layer: "back", text: "back" })],
    { mirror: true }
  );
  const all = recordingContext();
  const size = drawPreview(all.ctx, scene, sheet, 0.5, drawAssets, {
    backdrop: "light",
    visible: { back: true, middle: true, front: true },
    guides: false,
  });
  assert.ok(Math.abs(size.width - (100 / 25.4) * 300 * 0.5) < 1e-6);
  assert.equal(all.calls.some((c) => c.mirrored), false);
  const order = all.calls.filter((c) => c.name === "fillText" || c.name === "drawImage").map((c) => (c.name === "drawImage" ? "image" : c.args[0]));
  assert.deepEqual(order, ["back", "image", "front"]);

  const some = recordingContext();
  drawPreview(some.ctx, scene, sheet, 0.5, drawAssets, {
    backdrop: "dark",
    visible: { back: false, middle: true, front: false },
    guides: false,
  });
  assert.equal(some.calls.some((c) => c.name === "fillText"), false);
  assert.equal(some.calls.filter((c) => c.name === "drawImage").length, 1);

  const band = recordingContext();
  drawConceptBand(band.ctx, 100, 400, 20);
  assert.deepEqual(band.calls.filter((c) => c.name === "fillText").map((c) => c.args[0]), [CONCEPT_PREVIEW_BAND]);
});

test("an image that is not attached draws nothing in an export and a placeholder on screen", async () => {
  const { drawLayer } = await import("@/components/keepsake-editor/draw");
  const sheet = resolveSheet(100, 100, 3);
  const scene = sceneWith([imageBlock({ id: "i-missing" })]);
  const exported = recordingContext();
  drawLayer(exported.ctx, scene, "middle", sheet, 1, drawAssets);
  assert.equal(exported.calls.some((c) => c.name === "drawImage" || c.name === "strokeRect"), false);
  const screen = recordingContext();
  drawLayer(screen.ctx, scene, "middle", sheet, 1, drawAssets, { placeholders: true });
  assert.equal(screen.calls.filter((c) => c.name === "strokeRect").length, 1);
});

// ---------------------------------------------------------------- source rules

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** Source without comments, so a comment that mentions a word is not a finding. */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const EDITOR_FILES = [...listFiles("src/components/keepsake-editor"), ...listFiles("src/lib/keepsake-editor")];

test("the font route checks the admin before anything else and never builds a path from the request", () => {
  const src = code("src/app/admin/keepsake-editor/fonts/[id]/route.ts");
  const body = src.slice(src.indexOf("export async function GET"));
  const guard = body.indexOf("await assertAdminApi()");
  assert.ok(guard > 0, "calls assertAdminApi");
  for (const later of ["await params", "readEligibleFontFile", "safeParse"]) {
    assert.ok(body.indexOf(later) > guard, `${later} comes after the guard`);
  }
  assert.equal(/node:fs|node:path|path\.join|readFile/.test(src), false, "the route itself touches no file");
  assert.match(src, /Cache-Control": "private, max-age=3600"/);
  assert.match(src, /runtime = "nodejs"/);

  const server = code("src/lib/keepsake-editor/eligible-fonts.server.ts");
  assert.match(server, /import "server-only"/);
  assert.match(server, /records\.find\(\(font\) => font\.id === id\)/);
  assert.match(server, /path\.basename\(fileName\)/);
});

test("the page is admin-only and loads the editor in the browser only", () => {
  const page = code("src/app/admin/keepsake-editor/page.tsx");
  assert.ok(page.indexOf("await requireAdmin()") > 0);
  assert.ok(page.indexOf("await requireAdmin()") < page.indexOf("getEligibleFonts()"));
  const loader = code("src/components/keepsake-editor/KeepsakeEditorLoader.tsx");
  assert.match(loader, /"use client"/);
  assert.match(loader, /ssr: false/);
  assert.match(read("src/components/admin/AdminSidebar.tsx"), /\/admin\/keepsake-editor/);
  const config = read("next.config.ts");
  assert.match(config, /"\/admin\/keepsake-editor\/fonts\/\*": \["\.\/assets\/fonts\/\*\*\/\*"\]/);
});

test("nothing in the editor sends data anywhere: no fetch, upload, storage or server action", () => {
  assert.ok(EDITOR_FILES.length >= 15, String(EDITOR_FILES.length));
  const banned: [RegExp, string][] = [
    [/\bfetch\s*\(/, "fetch("],
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/sendBeacon/, "sendBeacon"],
    [/WebSocket|EventSource/, "socket"],
    [/localStorage|sessionStorage|indexedDB|document\.cookie/, "browser storage"],
    [/"use server"/, "server action"],
    [/supabase|prisma|@\/app\/actions/i, "server data layer"],
    [/FormData|\.toDataURL\(/, "form or data URL"],
    [/dangerouslySetInnerHTML/, "raw HTML"],
    [/<form\b/, "form element"],
  ];
  for (const file of EDITOR_FILES) {
    if (file.endsWith("eligible-fonts.server.ts")) continue;
    const src = code(file);
    for (const [pattern, name] of banned) {
      assert.equal(pattern.test(src), false, `${file} contains ${name}`);
    }
  }
  // The one request the editor makes is for font files, through FontFace, from the admin route.
  const urlUsers = EDITOR_FILES.filter((file) => /url\(|https?:\/\//.test(code(file)));
  assert.deepEqual(urlUsers, ["src/components/keepsake-editor/use-fonts.ts"]);
  assert.match(code("src/components/keepsake-editor/use-fonts.ts"), /FONT_ROUTE = "\/admin\/keepsake-editor\/fonts"/);
  // Images are read from the file input into memory.
  assert.match(code("src/components/keepsake-editor/KeepsakeEditor.tsx"), /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/);
});

test("the pure modules import no React, DOM or server code", () => {
  for (const file of listFiles("src/lib/keepsake-editor")) {
    if (file.endsWith(".server.ts")) continue;
    const src = code(file);
    assert.equal(/from "react|from "next|server-only|node:|document\.|window\./.test(src), false, file);
  }
});

test("wording: the product is never called glass or crystal, and the preview band is fixed", () => {
  const files = [...EDITOR_FILES, "src/app/admin/keepsake-editor/page.tsx"];
  for (const file of files) {
    assert.equal(/\b(glass|crystal)\b/i.test(read(file)), false, file);
  }
  const draw = read("src/components/keepsake-editor/draw.ts");
  assert.match(draw, /CONCEPT_PREVIEW_BAND = "Concept preview\. Not a photograph of the finished piece\."/);
  const exporter = code("src/components/keepsake-editor/export.ts");
  assert.match(exporter, /drawConceptBand\(ctx, height, width, band\)/);
  assert.match(exporter, /withPngDpi/);
});

test("the two new catalogue fonts are on disk and carry the open licence in the file", async () => {
  const { INITIAL_FONT_CATALOG, isFontLicensedForPrint } = await import("@/lib/fonts/fontCatalog");
  for (const id of ["pinyon-script", "sedgwick-ave-display"]) {
    const item = INITIAL_FONT_CATALOG.find((f) => f.id === id);
    assert.ok(item, id);
    assert.equal(isFontLicensedForPrint(item), true);
    assert.equal(item.defaultEnabled, false, "not switched on for the paused Studio");
    const bytes = fs.readFileSync(path.join(ROOT, "assets", "fonts", item.fileName));
    // The name table is UTF-16BE in these files, so compare without the zero bytes.
    const flat = Buffer.from(bytes.filter((b) => b !== 0)).toString("latin1");
    assert.match(flat, /SIL Open Font License/, id);
  }
});

// ---------------------------------------------------------------- review fixes (KE-H1, M1 to M5, L1 to L13)

const READY = { "great-vibes": "ready" };
const ALL_GLYPHS = [{ id: "great-vibes", covered: coveredChars(() => true) }];

function geometryOf(scene: Scene, sizes: Record<string, { w: number; h: number }> = {}) {
  const sheet = resolveSheet(scene.pieceWmm, scene.pieceHmm, scene.marginMm);
  return sceneIssues(scene, ALL_GLYPHS, READY, sizes, { sheet, measure });
}

test("KE-H1: a block that runs off the film, lies outside it or is larger than it stops the export", () => {
  // The fake measurer makes "Mẹ" at 10 mm about 10 mm wide and 10 mm tall, centred on x.
  assert.deepEqual(geometryOf(sceneWith([textBlock({ xMm: 47, yMm: 40 })])), []);

  const off = geometryOf(sceneWith([textBlock({ xMm: 92, yMm: 40 })]));
  assert.equal(off.length, 1);
  assert.equal(off[0].level, "block");
  assert.match(off[0].message, /runs off the film/);

  const outside = geometryOf(sceneWith([textBlock({ xMm: 1500, yMm: -900 })]));
  assert.equal(outside[0].level, "block");
  assert.match(outside[0].message, /outside the film/);

  // The reviewer's case: one 2,000-character line on a 100 × 100 mm piece.
  const long = geometryOf(sceneWith([textBlock({ text: "a".repeat(2000), yMm: 40 })]));
  assert.equal(long[0].level, "block");
  assert.match(long[0].message, /larger than the film/);
  assert.equal(blocksExport(long), true);

  const photo = geometryOf(sceneWith([imageBlock({ xMm: 60, yMm: 10, widthMm: 50 })]), { "i-1": { w: 3000, h: 3000 } });
  assert.equal(photo[0].level, "block");
  assert.match(photo[0].message, /runs off the film/);
  const huge = geometryOf(sceneWith([imageBlock({ xMm: -5, yMm: -5, widthMm: 120 })]), { "i-1": { w: 3000, h: 3000 } });
  assert.match(huge[0].message, /larger than the film/);

  // Without the geometry argument nothing is measured (the server-side list of fonts, tests).
  assert.deepEqual(sceneIssues(sceneWith([textBlock({ xMm: 1500 })]), ALL_GLYPHS, READY, {}), []);
  // A font that is not loaded is not measured: its bounds would come from a stand-in font.
  const loading = sceneIssues(sceneWith([textBlock({ xMm: 1500 })]), ALL_GLYPHS, {}, {}, {
    sheet: resolveSheet(100, 100, 3),
    measure,
  });
  assert.deepEqual(loading.map((i) => i.message), ["This font is still loading."]);
});

test("KE-H1: rotation is included, about the same centre the draw function turns the block on", () => {
  const rect = { x: 10, y: 20, w: 100, h: 20 };
  const turned = rotatedBounds(rect, { x: 60, y: 30 }, 90);
  assert.ok(Math.abs(turned.x - 50) < 1e-9 && Math.abs(turned.y - -20) < 1e-9);
  assert.ok(Math.abs(turned.w - 20) < 1e-9 && Math.abs(turned.h - 100) < 1e-9);
  assert.equal(rotatedBounds(rect, { x: 60, y: 30 }, 0), rect);
  assert.equal(rotatedBounds(rect, { x: 60, y: 30 }, 360), rect);

  // A long line that fits lying flat near the top runs off the top once it stands upright.
  const flat = textBlock({ text: "a".repeat(16), xMm: 47, yMm: 6 });
  assert.deepEqual(geometryOf(sceneWith([flat])), []);
  const upright = geometryOf(sceneWith([{ ...flat, rotationDeg: 90 }]));
  assert.equal(upright[0].level, "block");
  assert.match(upright[0].message, /runs off the film/);
});

test("KE-H1: the ink box is used when the canvas reports it, so a swash past the nominal box is caught", () => {
  const sheet = resolveSheet(100, 100, 3);
  const swashy: Measure = (text, fontId, sizePx) => ({
    ...measure(text, fontId, sizePx),
    inkLeft: sizePx * 0.6, // ink starts well left of the line's start
    inkRight: Array.from(text).length * sizePx * 0.5 + sizePx * 0.3,
    inkAscent: sizePx * 1.3,
    inkDescent: sizePx * 0.5,
  });
  const block = textBlock({ align: "left", xMm: 4, yMm: 30 });
  const nominal = textInkBox(block, sheet, measure);
  const ink = textInkBox(block, sheet, swashy);
  assert.ok(nominal && ink);
  assert.ok(ink.x < nominal.x && ink.w > nominal.w && ink.h > nominal.h);
  // Nominal box: inside the film. Ink: 2 mm past the left edge.
  assert.deepEqual(sceneIssues(sceneWith([block]), ALL_GLYPHS, READY, {}, { sheet, measure }).filter((i) => i.level === "block"), []);
  const caught = sceneIssues(sceneWith([block]), ALL_GLYPHS, READY, {}, { sheet, measure: swashy });
  assert.equal(caught.some((i) => i.level === "block" && /runs off the film/.test(i.message)), true);
  // Blank text draws nothing and has no bounds.
  assert.equal(textInkBox(textBlock({ text: " \n " }), sheet, measure), null);
  assert.equal(blockBounds(imageBlock(), sheet, measure, {}), null, "an image that is not attached has no bounds");
});

test("KE-M4: a block inside the film but in the safe zone warns; an image may touch the edge exactly", () => {
  const near = geometryOf(sceneWith([textBlock({ xMm: 47, yMm: 1 })]));
  assert.deepEqual(near.map((i) => i.level), ["warn"]);
  assert.match(near[0].message, /within 3 mm of the film edge/);
  assert.equal(blocksExport(near), false);
  // A wider safe zone catches a block that was clear of a narrow one; zero switches the check off.
  const block = textBlock({ xMm: 47, yMm: 5 });
  assert.deepEqual(geometryOf(sceneWith([block])), []);
  assert.equal(geometryOf(sceneWith([block], { safeZoneMm: 6 })).length, 1);
  assert.deepEqual(geometryOf(sceneWith([textBlock({ xMm: 47, yMm: 1 })], { safeZoneMm: 0 })), []);

  const sheet = resolveSheet(100, 100, 3);
  const filmW = mmToPxExact(94, 300);
  // Edge to edge: allowed, and not warned about.
  assert.equal(geometryIssue("image", { x: 0, y: 0, w: filmW, h: filmW }, sheet, 3), null);
  // An image 1 mm inside the edge is in the safe zone like anything else.
  const inset = mmToPxExact(1, 300);
  assert.equal(geometryIssue("image", { x: inset, y: inset, w: filmW - 2 * inset, h: filmW - 2 * inset }, sheet, 3)?.level, "warn");
  // Text touching the edge is always warned about.
  assert.equal(geometryIssue("text", { x: 0, y: 200, w: 300, h: 100 }, sheet, 3)?.level, "warn");
  // One pixel of slack for rounding; two pixels over is cut off.
  assert.equal(geometryIssue("image", { x: -0.6, y: 0, w: filmW + 0.6, h: filmW }, sheet, 3), null);
  assert.equal(geometryIssue("image", { x: -2, y: 0, w: filmW, h: filmW }, sheet, 3)?.level, "block");
});

test("KE-M1, L7: every issue is named by block and layer; warnings need a tick, notes do not", () => {
  const scene = sceneWith([
    textBlock({ id: "t-w", colorHex: "#ffffff", text: "Trắng", yMm: 40 }),
    imageBlock({ id: "i-soft", xMm: 10, yMm: 10, widthMm: 60 }),
    imageBlock({ id: "i-mid", isCustomerPhoto: false, layer: "back", fileName: "art.png", xMm: 10, yMm: 10, widthMm: 60 }),
    textBlock({ id: "t-bad", text: "印", yMm: 60 }),
  ]);
  const sizes = { "i-soft": { w: 300, h: 300 }, "i-mid": { w: 500, h: 500 } };
  const fonts = [{ id: "great-vibes", covered: coveredChars((ch) => ch !== "印") }];
  const issues = sceneIssues(scene, fonts, READY, sizes, { sheet: resolveSheet(100, 100, 3), measure });
  assert.deepEqual(
    issues.map((i) => [i.blockId, i.level]),
    [["t-w", "warn"], ["i-soft", "warn"], ["i-mid", "note"], ["t-bad", "block"]]
  );
  assert.match(issues[2].message, /about 212 pixels per inch/);
  assert.equal(warningsOf(issues).length, 2);

  const described = describeIssues(scene, issues);
  assert.deepEqual(described.map((d) => d.issue.level), ["block", "warn", "warn", "note"]);
  assert.equal(described[0].label, "Front · Text: 印");
  assert.equal(described[1].label, "Front · Text: Trắng");
  assert.equal(described[2].label, "Middle · Customer photo: photo.jpg");
  assert.equal(described[3].label, "Back · Image: art.png");
  assert.equal(blockLabel(textBlock({ text: "" })), "Front · Text: (empty)");

  // The key changes when a warning appears or goes, and not when a note or a blocking issue does.
  const key = warningKey(issues);
  assert.notEqual(key, "");
  assert.equal(warningKey(issues.filter((i) => i.level !== "note" && i.level !== "block")), key);
  assert.notEqual(warningKey(issues.filter((i) => i.blockId !== "t-w")), key);
  assert.equal(warningKey([]), "");
});

test("KE-M2, L1: films are counted among the layers that print; blank text gets no film", () => {
  const scene = sceneWith([
    textBlock({ id: "t-f", layer: "front" }),
    textBlock({ id: "t-blank", layer: "middle", text: "  \n " }),
    imageBlock({ id: "i-b", layer: "back" }),
  ]);
  assert.deepEqual(layersWithArtwork(scene), ["back", "front"]);
  assert.deepEqual(layersWithArtwork(sceneWith([textBlock({ text: "" })])), []);
  const sheet = resolveSheet(100, 100, 3);
  assert.match(sheetLabel(scene, "front", 2, 2, sheet, "20261124-1805-a3f9"), /\| FRONT 2 of 2 \|/);
  assert.match(sheetLabel(scene, "back", 1, 2, sheet, "20261124-1805-a3f9"), /\| job 20261124-1805-a3f9$/);
});

test("KE-M3, L6, L10: hidden characters are removed, odd spaces become spaces, and a cut never splits a pair", () => {
  const pasted = "Me\u200B\u200C\u200D\u00AD\u200E\u200F\u202E\u2066\u2069\uFEFF\u0007 Cha";
  assert.equal(normalizeText(pasted), "Me Cha");
  assert.equal(hiddenCharCount(pasted), 11);
  assert.equal(hiddenCharCount("Mẹ và Cha\n"), 0);
  assert.equal(normalizeText("a\u00A0b\u2009c\u3000d\te\u202Ff"), "a b c d e f");
  assert.equal(normalizeText("a\u2028b\u2029c\r\nd"), "a\nb\nc\nd");
  assert.equal(normalizeText("e\u200B\u0301"), "é", "NFC is applied after stripping");
  // After cleaning, pasted text passes the glyph check: nothing invisible is left to report.
  assert.deepEqual(missingChars(normalizeText("M\u200Be\u00A0Cha\u200F"), VIETNAMESE_REQUIRED_SET), []);

  assert.equal(truncateText("abc", 5), "abc");
  assert.equal(truncateText("ab😀", 3), "ab", "half an emoji is dropped, not kept");
  assert.equal(truncateText("ab😀", 4), "ab😀");
  const scene = reduce(sceneWith([textBlock()]), { type: "update", id: "t-1", patch: { text: "x".repeat(1999) + "😀" } });
  assert.equal((scene.blocks[0] as TextBlock).text, "x".repeat(1999));
  assert.equal(normalizeName("  Tết\n2027\u202E "), "  Tết 2027 ");
});

test("KE-L9: a project file with prototype keys or two customer photos is rejected; an older file still opens", () => {
  const good = sceneWith([textBlock()]);
  const json = serializeProject(good);
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const top = json.replace('"version": 1,', `"version": 1, "${key}": {"x": 1},`);
    const nested = json.replace('"kind": "text",', `"kind": "text", "${key}": 1,`);
    assert.notEqual(top, json);
    assert.notEqual(nested, json);
    assert.throws(() => parseProjectFile(top), { message: PROJECT_FILE_ERROR }, key);
    assert.throws(() => parseProjectFile(nested), { message: PROJECT_FILE_ERROR }, `nested ${key}`);
  }
  assert.equal(({} as Record<string, unknown>).x, undefined, "nothing reached Object.prototype");
  const twoPhotos = sceneWith([imageBlock({ id: "i-1" }), imageBlock({ id: "i-2" })]);
  assert.throws(() => parseProjectFile(serializeProject(twoPhotos)), { message: PROJECT_FILE_ERROR });
  assert.throws(() => parseProjectFile(serializeProject({ ...good, safeZoneMm: 51 })), { message: PROJECT_FILE_ERROR });

  // A file saved before the safe zone existed has no such key: it opens with the default.
  const older = JSON.parse(json) as Record<string, unknown>;
  delete older.safeZoneMm;
  assert.equal(parseProjectFile(JSON.stringify(older)).safeZoneMm, 3);
  // Hidden characters in a saved name or text are cleaned on the way in.
  const dirty = { ...good, name: "Quà\u200B Tết\u0007", blocks: [textBlock({ text: "Mẹ\u200B\u00A0ơi" })] };
  const loaded = parseProjectFile(JSON.stringify(dirty));
  assert.equal(loaded.name, "Quà Tết");
  assert.equal((loaded.blocks[0] as TextBlock).text, "Mẹ ơi");
});

test("KE-L13: crop marks sit on whole pixels and are drawn at an even width of at least 2 px", () => {
  for (const [w, h, m] of [[100, 100, 3], [100, 150, 2.5], [600, 400, 0], [33.3, 47.7, 1.1]] as const) {
    const sheet = resolveSheet(w, h, m);
    for (const s of cropMarks(sheet)) {
      for (const v of [s.x1, s.y1, s.x2, s.y2]) assert.equal(Number.isInteger(v), true, `${w}x${h}: ${v}`);
    }
    const width = markLineWidth(sheet);
    assert.ok(width >= 2 && width % 2 === 0, String(width));
  }
});

test("KE-L5: the concept band keeps its words readable: one line when it fits, two when it does not", () => {
  const wide = conceptBandSpec(1200);
  assert.deepEqual(wide.lines, ["Concept preview. Not a photograph of the finished piece."]);
  assert.ok(wide.fontPx >= 20);
  const usual = conceptBandSpec(480);
  assert.equal(usual.lines.length, 1);
  assert.ok(usual.fontPx >= 11 && usual.height >= 28);
  const narrow = conceptBandSpec(200);
  assert.deepEqual(narrow.lines, ["Concept preview.", "Not a photograph of the finished piece."]);
  assert.ok(narrow.height >= narrow.fontPx * 3, "room for two lines");
  for (const width of [60, 200, 480, 1200, 4000]) {
    const spec = conceptBandSpec(width);
    const longest = Math.max(...spec.lines.map((line) => line.length));
    if (width >= 200) assert.ok(longest * spec.fontPx * 0.5 <= width * 0.94 + 1e-9, `fits at ${width}`);
    assert.equal(spec.lines.join(" "), "Concept preview. Not a photograph of the finished piece.");
  }
});

test("the band is drawn on screen as well as on the download, and the safe-zone guide only on screen", async () => {
  const { drawPreview, drawConceptBand } = await import("@/components/keepsake-editor/draw");
  const sheet = resolveSheet(100, 100, 3);
  const scene = sceneWith([textBlock()]);
  const narrow = recordingContext();
  drawConceptBand(narrow.ctx, 100, 200, 60);
  assert.deepEqual(
    narrow.calls.filter((c) => c.name === "fillText").map((c) => c.args[0]),
    ["Concept preview.", "Not a photograph of the finished piece."]
  );
  const options = { backdrop: "light" as const, visible: { back: true, middle: true, front: true } };
  const screen = recordingContext();
  drawPreview(screen.ctx, scene, sheet, 0.5, drawAssets, { ...options, guides: true });
  assert.equal(screen.calls.filter((c) => c.name === "strokeRect").length, 2, "film edge and safe zone");
  const file = recordingContext();
  drawPreview(file.ctx, scene, sheet, 0.5, drawAssets, { ...options, guides: false });
  assert.equal(file.calls.some((c) => c.name === "strokeRect"), false, "no guide in a downloaded preview");
  const noZone = recordingContext();
  drawPreview(noZone.ctx, { ...scene, safeZoneMm: 0 }, sheet, 0.5, drawAssets, { ...options, guides: true });
  assert.equal(noZone.calls.filter((c) => c.name === "strokeRect").length, 1);

  const canvas = code("src/components/keepsake-editor/PreviewCanvas.tsx");
  assert.match(canvas, /drawConceptBand\(ctx, pieceHpx, pieceWpx, bandPx\)/);
  assert.match(canvas, /onMoveEnd\(\)/);
});

test("source rules for the review fixes", () => {
  const editor = code("src/components/keepsake-editor/KeepsakeEditor.tsx");
  // KE-M5: the presets start in an OFL font; the thư pháp font is chosen on purpose.
  assert.match(editor, /HERO_FONT_ID = "great-vibes"/);
  assert.equal(/HERO_FONT_ID = "utm-thuphap-thien-an"/.test(editor), false);
  // KE-M1: nothing downloads past a blocking issue or an unaccepted warning.
  assert.match(editor, /if \(!sheet \|\| busy \|\| blocksExport\(issues\) \|\| !accepted\) return;/);
  // KE-M2: every file of a download comes from one job (one snapshot of the scene).
  assert.match(editor, /const job = jobForNow\(\);/);
  assert.equal(/export(Layer|Preview)Png\(scene\b/.test(editor), false, "exports take the job, never the live scene");
  // KE-L3: image pixels are freed.
  assert.ok((editor.match(/bitmap\.close\(\)/g) ?? []).length >= 4);
  // KE-L2: leaving a field ends the run.
  assert.match(editor, /onBlur=\{\(\) => dispatch\(\{ type: "endRun" \}\)\}/);

  const panel = code("src/components/keepsake-editor/ExportPanel.tsx");
  assert.match(panel, /label="Download anyway"/);
  assert.match(panel, /warnings\.length > 0 && !accepted/);
  assert.match(panel, /Download all films and the preview/);

  const exporter = code("src/components/keepsake-editor/export.ts");
  // KE-L4: the canvas is proven to hold pixels before anything is drawn on it.
  assert.match(exporter, /getImageData\(w - 1, h - 1, 1, 1\)\.data\[3\]/);
  assert.match(exporter, /if \(alpha !== 255\) throw tooLarge\(w, h\)/);
  assert.match(exporter, /sheetLabel\(job\.scene, layer, index, total, sheet, job\.code\)/);

  // KE-L11: a guard failure that is not about sign-in is a server error, with no detail.
  const route = code("src/app/admin/keepsake-editor/fonts/[id]/route.ts");
  assert.match(route, /if \(error instanceof AdminAuthError\) \{/);
  assert.match(route, /\{ error: "Server error" \}, \{ status: 500 \}/);
  assert.equal(/: 401;/.test(route), false);

  const blocks = code("src/components/keepsake-editor/BlockPanel.tsx");
  assert.match(blocks, /Hidden characters removed/);
  assert.match(blocks, /\{fontNote && /);
});

test("KE-M5, L12: the catalogue records the licence basis as found and does not call script fonts thư pháp", async () => {
  const { INITIAL_FONT_CATALOG } = await import("@/lib/fonts/fontCatalog");
  const utm = INITIAL_FONT_CATALOG.find((f) => f.id === "utm-thuphap-thien-an");
  assert.ok(utm);
  assert.match(utm.license, /"Free for everyone"/);
  assert.match(utm.license, /no formal licence text/);
  assert.match(utm.licenseNote ?? "", /no formal licence text/);
  const bytes = fs.readFileSync(path.join(ROOT, "assets", "fonts", utm.fileName));
  const flat = Buffer.from(bytes.filter((b) => b !== 0)).toString("latin1");
  assert.match(flat, /Free for everyone/, "the statement really is in the file");
  assert.equal(/Open Font License/.test(flat), false, "and there is no open licence text in it");

  const fonts = await getEligibleFonts();
  assert.match(fonts.find((f) => f.id === "utm-thuphap-thien-an")?.note ?? "", /Free for everyone/);
  assert.equal(fonts.find((f) => f.id === "great-vibes")?.note, undefined);
  for (const id of ["pinyon-script", "sedgwick-ave-display"]) {
    const item = INITIAL_FONT_CATALOG.find((f) => f.id === id);
    assert.ok(item, id);
    assert.equal(/Thanh Nhã|Bút Lông/.test(`${item.name} ${(item.aliases ?? []).join(" ")}`), false, id);
    assert.match(item.categoryLabel, /not thư pháp/);
    assert.match(item.description, /not thư pháp/);
  }
});
