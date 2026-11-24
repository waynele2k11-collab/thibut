import test from "node:test";
import assert from "node:assert/strict";
import {
  bpsToMultiplierInput,
  isValidSlug,
  parseCatalogImagePaths,
  parseMultiplierToBps,
  slugify,
} from "@/lib/catalog/adminInput";
import { formatMultiplierBps } from "@/lib/catalog/keepsakeCatalog";

test("multiplier input converts to basis points without floating point", () => {
  assert.equal(parseMultiplierToBps("1.6"), 16000);
  assert.equal(parseMultiplierToBps(" 1.8 "), 18000);
  assert.equal(parseMultiplierToBps("2"), 20000);
  assert.equal(parseMultiplierToBps("1.0"), 10000);
  assert.equal(parseMultiplierToBps("1.2345"), 12345);
  assert.equal(parseMultiplierToBps("3"), 30000);
});

test("multiplier input rejects values outside 1.0-3.0 and malformed text", () => {
  for (const raw of ["", "0.9", "3.1", "4", "1.60000", "1,6", "abc", "-1.6", "1.6x", "1e1"]) {
    assert.equal(parseMultiplierToBps(raw), null, raw);
  }
});

test("basis points format back to the same input and display label", () => {
  for (const [bps, input] of [
    [16000, "1.6"],
    [20000, "2"],
    [12345, "1.2345"],
  ] as const) {
    assert.equal(bpsToMultiplierInput(bps), input);
    assert.equal(parseMultiplierToBps(input), bps);
    assert.equal(formatMultiplierBps(bps), `${input}×`);
  }
});

test("slugify strips Vietnamese diacritics and punctuation", () => {
  assert.equal(slugify("Trăm Năm Hạnh Phúc — Wedding Blessing"), "tram-nam-hanh-phuc-wedding-blessing");
  assert.equal(slugify("Nghĩa Mẹ · Công Cha"), "nghia-me-cong-cha");
  assert.equal(slugify("Đại Vệ"), "dai-ve");
  assert.equal(isValidSlug(slugify("Awards & Trophies")), true);
  assert.equal(isValidSlug(""), false);
  assert.equal(isValidSlug("Has Space"), false);
});

test("catalog image paths accept only site-relative image files", () => {
  assert.deepEqual(
    parseCatalogImagePaths("/keepsakes/a.webp\n\n /keepsakes/b.PNG \n/keepsakes/a.webp"),
    ["/keepsakes/a.webp", "/keepsakes/b.PNG"]
  );
  for (const raw of [
    "",
    "https://evil.example/a.webp",
    "//evil.example/a.webp",
    "/keepsakes/../../etc/passwd.png",
    "/keepsakes/a.svg",
    "/keepsakes/a b.webp",
    "keepsakes/a.webp",
    "javascript:alert(1)",
    Array.from({ length: 9 }, (_, i) => `/k/${i}.webp`).join("\n"),
  ]) {
    assert.equal(parseCatalogImagePaths(raw), null, JSON.stringify(raw));
  }
});
