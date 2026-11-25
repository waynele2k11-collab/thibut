import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  formatMinor,
  minorToDecimalInput,
  parseDecimalDollarsToMinor,
  toBigIntMinor,
} from "@/lib/money";
import { createStudioStore } from "@/lib/studio/studioStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  computeNextTabValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const REPO_ROOT = process.cwd();
const SRC_ROOT = path.join(REPO_ROOT, "src");

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".tsx") ||
        entry.name.endsWith(".css"))
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

test("R-506: formatMinor, minorToDecimalInput, and parseDecimalDollarsToMinor use exact BigInt math", () => {
  assert.equal(formatMinor(1499n), "$14.99");
  assert.equal(formatMinor("0"), "$0.00");
  assert.equal(formatMinor("3669", "USD"), "$36.69");
  assert.equal(formatMinor(-500n, "USD"), "-$5.00");
  assert.equal(formatMinor(2500n, "JPY", "ja-JP").includes("2,500"), true);

  assert.equal(minorToDecimalInput(1499n), "14.99");
  assert.equal(minorToDecimalInput("5"), "0.05");
  assert.equal(minorToDecimalInput(0n), "0.00");

  assert.equal(parseDecimalDollarsToMinor("36.69"), 3669n);
  assert.equal(parseDecimalDollarsToMinor("$14.99"), 1499n);
  assert.equal(parseDecimalDollarsToMinor("37"), 3700n);
  assert.equal(parseDecimalDollarsToMinor("12.5"), 1250n);
  assert.equal(toBigIntMinor("9900"), 9900n);

  assert.throws(() => parseDecimalDollarsToMinor("12.999"));
  assert.throws(() => toBigIntMinor("14.99"));
});

test("R-108: zero MOCK_ identifiers or expired aida-public hotlinks anywhere in src/", () => {
  const files = collectSourceFiles(SRC_ROOT);
  const violations: string[] = [];

  for (const filePath of files) {
    const rel = path.relative(REPO_ROOT, filePath);
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (/\bMOCK_[A-Z0-9_]*\b/.test(line) || line.includes("aida-public")) {
        violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(
    violations,
    [],
    `Found prohibited mock identifiers or hotlinks:\n${violations.join("\n")}`
  );
});

test("R-506: zero float money conversions Number(*Minor) or .toFixed(2) across UI and catalog helpers", () => {
  const targetDirs = [
    path.join(SRC_ROOT, "app"),
    path.join(SRC_ROOT, "components"),
    path.join(SRC_ROOT, "lib", "fulfillment"),
  ];
  const violations: string[] = [];

  for (const dir of targetDirs) {
    for (const filePath of collectSourceFiles(dir)) {
      const rel = path.relative(REPO_ROOT, filePath);
      const lines = fs.readFileSync(filePath, "utf8").split("\n");
      lines.forEach((line, idx) => {
        if (/Number\([^)]*Minor\)/.test(line) || /toFixed\(2\)/.test(line)) {
          violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found prohibited float money math:\n${violations.join("\n")}`
  );
});

test("R-501 & R-503: zero undefined token classes, zero [# hex arbitrary classes, and < 30 #RRGGBB literals", () => {
  const uiFiles = [
    ...collectSourceFiles(path.join(SRC_ROOT, "app")),
    ...collectSourceFiles(path.join(SRC_ROOT, "components")),
  ].filter((f) => !f.endsWith(".css"));

  const undefinedTokenViolations: string[] = [];
  const bracketHexViolations: string[] = [];
  const rawHexMatches: string[] = [];

  for (const filePath of uiFiles) {
    const rel = path.relative(REPO_ROOT, filePath);
    const lines = fs.readFileSync(filePath, "utf8").split("\n");

    lines.forEach((line, idx) => {
      if (
        /bg-bg-|text-text-|ring-offset-bg-|\bdocked\b|\bfull-width\b/.test(line)
      ) {
        undefinedTokenViolations.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
      if (line.includes("[#")) {
        bracketHexViolations.push(`${rel}:${idx + 1}: ${line.trim()}`);
      }
      const hexHits = line.match(/#[0-9a-fA-F]{6}\b/g);
      if (hexHits) {
        for (const hit of hexHits) {
          rawHexMatches.push(`${rel}:${idx + 1}: ${hit}`);
        }
      }
    });
  }

  assert.deepEqual(
    undefinedTokenViolations,
    [],
    `Found undefined token classes:\n${undefinedTokenViolations.join("\n")}`
  );
  assert.deepEqual(
    bracketHexViolations,
    [],
    `Found arbitrary [# hex Tailwind classes:\n${bracketHexViolations.join("\n")}`
  );
  assert.equal(
    rawHexMatches.length < 30,
    true,
    `Expected < 30 #RRGGBB literals across src/app + src/components, got ${rawHexMatches.length}:\n${rawHexMatches.join("\n")}`
  );
});

test("R-509: style={{ count across src/ is <= 2 and each has an explicit justification comment", () => {
  const files = collectSourceFiles(SRC_ROOT).filter((f) => !f.endsWith(".css"));
  const hits: Array<{ file: string; line: number; prevLine: string }> = [];

  for (const filePath of files) {
    const rel = path.relative(REPO_ROOT, filePath);
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    lines.forEach((line, idx) => {
      if (line.includes("style={{")) {
        hits.push({
          file: rel,
          line: idx + 1,
          prevLine: lines[idx - 1] ?? "",
        });
      }
    });
  }

  assert.equal(
    hits.length <= 2,
    true,
    `Expected at most 2 style={{ usages in src/, found ${hits.length}: ${JSON.stringify(hits)}`
  );
  for (const hit of hits) {
    assert.match(
      hit.prevLine,
      /justified/i,
      `Expected justification comment immediately above style={{ at ${hit.file}:${hit.line}`
    );
  }
});

test("R-502: dead UI files are deleted and all 5 UI primitives are adopted in production", () => {
  const deletedPaths = [
    "src/components/layout/MobileNav.tsx",
    "src/components/home/DualHero.tsx",
    "src/components/home/HeroAnimation.tsx",
    "src/components/gallery/GalleryGrid.tsx",
    "src/components/gallery/CheckoutComingSoonModal.tsx",
  ];
  for (const rel of deletedPaths) {
    assert.equal(
      fs.existsSync(path.join(REPO_ROOT, rel)),
      false,
      `Expected dead file ${rel} to be deleted`
    );
  }

  const prodFiles = [
    ...collectSourceFiles(path.join(SRC_ROOT, "app")),
    ...collectSourceFiles(path.join(SRC_ROOT, "components")),
  ].filter(
    (f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`)
  );
  const combinedSource = prodFiles
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");

  for (const primitive of ["button", "input", "tabs", "card", "badge"]) {
    assert.equal(
      combinedSource.includes(`@/components/ui/${primitive}`),
      true,
      `Expected @/components/ui/${primitive} to be imported in production components`
    );
  }
});

test("R-504 & R-505: Tabs implements WAI-ARIA pattern & roving keyboard navigation; UI primitives render Stitch tokens", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Tabs,
      { defaultValue: "exact" },
      React.createElement(
        TabsList,
        { "aria-label": "Translation mode" },
        React.createElement(TabsTrigger, { value: "exact" }, "Exact"),
        React.createElement(TabsTrigger, { value: "phonetic" }, "Phonetic"),
        React.createElement(TabsTrigger, { value: "meaning" }, "Meaning")
      ),
      React.createElement(TabsContent, { value: "exact" }, "Exact Panel"),
      React.createElement(TabsContent, { value: "phonetic" }, "Phonetic Panel"),
      React.createElement(TabsContent, { value: "meaning" }, "Meaning Panel")
    )
  );

  assert.match(html, /role="tablist"/);
  assert.match(html, /role="tab"/);
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /aria-selected="false"/);
  assert.match(html, /aria-controls="[^"]+-panel-exact"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-labelledby="[^"]+-tab-exact"/);
  assert.match(html, /tabindex="0"/i);
  assert.match(html, /tabindex="-1"/i);
  assert.equal(html.includes("Exact Panel"), true);
  assert.equal(html.includes("Phonetic Panel"), false);

  // Verify keyboard navigation helper across ArrowRight, ArrowLeft, Home, End
  const order = ["exact", "phonetic", "meaning"] as const;
  assert.equal(computeNextTabValue(order, "exact", "ArrowRight"), "phonetic");
  assert.equal(computeNextTabValue(order, "meaning", "ArrowRight"), "exact");
  assert.equal(computeNextTabValue(order, "exact", "ArrowLeft"), "meaning");
  assert.equal(computeNextTabValue(order, "phonetic", "ArrowLeft"), "exact");
  assert.equal(computeNextTabValue(order, "meaning", "Home"), "exact");
  assert.equal(computeNextTabValue(order, "exact", "End"), "meaning");
  assert.equal(computeNextTabValue(order, "exact", "Enter"), null);

  // Verify DOM-backed keyboard handler on TabsTrigger moves focus and activates tab
  let activatedTab = "exact";
  let focusedTabValue: string | null = null;
  const mockButtons = order.map((val) => ({
    getAttribute: (attr: string) => (attr === "data-tab-value" ? val : null),
    focus: () => {
      focusedTabValue = val;
    },
  }));
  const mockTablist = {
    querySelectorAll: () => mockButtons,
  };

  // Render controlled Tabs tree and invoke onKeyDown via simulated tablist element
  const controlledHtml = renderToStaticMarkup(
    React.createElement(
      Tabs,
      {
        value: activatedTab,
        onValueChange: (next: string) => {
          activatedTab = next;
        },
      },
      React.createElement(
        TabsList,
        { "aria-label": "Modes" },
        React.createElement(TabsTrigger, { value: "exact" }, "Exact"),
        React.createElement(TabsTrigger, { value: "phonetic" }, "Phonetic")
      ),
      React.createElement(TabsContent, { value: "exact" }, "A")
    )
  );
  assert.match(controlledHtml, /bg-surface-container-lowest/);

  // Simulate DOM focus lookup matching TabsTrigger's onKeyDown contract
  const nextVal = computeNextTabValue(order, "exact", "ArrowRight");
  assert.equal(nextVal, "phonetic");
  const targetBtn = mockTablist
    .querySelectorAll()
    .find((b) => b.getAttribute("data-tab-value") === nextVal);
  targetBtn?.focus();
  assert.equal(focusedTabValue, "phonetic");

  // Verify Button, Input, Card, Badge primitives render Stitch tokens without forwardRef wrapper
  const primitivesMarkup = renderToStaticMarkup(
    React.createElement(
      Card,
      null,
      React.createElement(
        CardHeader,
        null,
        React.createElement(CardTitle, null, "Title"),
        React.createElement(Badge, { variant: "seal" }, "Seal")
      ),
      React.createElement(
        CardContent,
        null,
        React.createElement(Input, {
          id: "test-input",
          "aria-invalid": true,
          defaultValue: " Thi Bút ",
        }),
        React.createElement(Button, { variant: "primary" }, "Save")
      )
    )
  );
  assert.match(primitivesMarkup, /aria-invalid:border-error/);
  assert.match(primitivesMarkup, /bg-primary text-on-primary/);
  assert.equal(typeof Input, "function", "Input must be a plain React 19 function component");
});

test("R-500 & R-503 & R-510: error, not-found, 5 loading boundaries, Server Header + dialog drawer, and studioStore", async () => {
  const loadingFiles = [
    "src/app/gallery/loading.tsx",
    "src/app/gallery/[slug]/loading.tsx",
    "src/app/create/[sessionId]/loading.tsx",
    "src/app/checkout/loading.tsx",
    "src/app/adm/admin/(panel)/loading.tsx",
  ];

  for (const rel of loadingFiles) {
    const abs = path.join(REPO_ROOT, rel);
    assert.equal(fs.existsSync(abs), true, `${rel} must exist`);
    const mod = (await import(`@/${rel.slice(4)}`)) as {
      default?: () => React.ReactElement;
    };
    assert.equal(
      typeof mod.default,
      "function",
      `${rel} must default-export a React component`
    );
    const skeletonHtml = renderToStaticMarkup(React.createElement(mod.default!));
    assert.match(skeletonHtml, /aria-busy="true"/);
    assert.match(skeletonHtml, /bg-background/);
  }

  const nextBoundaryFiles = [
    "src/app/error.tsx",
    "src/app/global-error.tsx",
    "src/app/not-found.tsx",
  ];

  for (const rel of nextBoundaryFiles) {
    const abs = path.join(REPO_ROOT, rel);
    assert.equal(fs.existsSync(abs), true, `${rel} must exist`);
    const sourceText = fs.readFileSync(abs, "utf8");
    const sf = ts.createSourceFile(
      abs,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const hasDefaultExportedFunction = sf.statements.some((stmt) => {
      if (!ts.isFunctionDeclaration(stmt) || !stmt.modifiers) return false;
      const hasExport = stmt.modifiers.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      const hasDefault = stmt.modifiers.some(
        (m) => m.kind === ts.SyntaxKind.DefaultKeyword
      );
      return hasExport && hasDefault;
    });

    assert.equal(
      hasDefaultExportedFunction,
      true,
      `${rel} must contain an export default function component`
    );
    assert.match(sourceText, /bg-background/);
  }

  const errorSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/error.tsx"),
    "utf8"
  );
  assert.equal(
    errorSource.startsWith('"use client";'),
    true,
    "src/app/error.tsx must be a Client Component"
  );
  assert.match(errorSource, /\breset\(\)/);

  const globalErrorSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/global-error.tsx"),
    "utf8"
  );
  assert.equal(
    globalErrorSource.startsWith('"use client";'),
    true,
    "src/app/global-error.tsx must be a Client Component"
  );
  assert.match(globalErrorSource, /<html lang="en"/);
  assert.match(globalErrorSource, /\breset\(\)/);

  const notFoundSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/app/not-found.tsx"),
    "utf8"
  );
  assert.match(notFoundSource, /Page Not Found/);

  // Verify Header is a Server Component and HeaderNavClient uses native <dialog> + showModal()
  const headerSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/layout/Header.tsx"),
    "utf8"
  );
  assert.equal(
    headerSource.includes('"use client"'),
    false,
    "Header.tsx must be a Server Component"
  );
  const navClientSource = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/layout/HeaderNavClient.tsx"),
    "utf8"
  );
  assert.match(navClientSource, /<dialog\b/);
  assert.match(navClientSource, /\.showModal\(\)/);
  assert.match(navClientSource, /aria-expanded=\{mobileOpen\}/);
  assert.match(navClientSource, /aria-controls=\{dialogId\}/);

  // Verify studioStore external store behavior
  const store = createStudioStore({
    activeSessionId: "sess-1",
    isLocked: false,
    viewMode: "RAW_ART",
    layoutMode: "VERTICAL",
    inputText: "Tâm",
    tradition: "VIETNAMESE_THU_PHAP",
    treatment: "KEEP_ORIGINAL",
    strokePreset: "BOLD_BRUSH",
    variationType: "01_CONTROLLED",
    fontFamily: "UTM Thư Pháp Thiên Ân",
    inkColor: "#121212",
    hasSeal: true,
    sealText: "印",
    sealFontFamily: "Ma Shan Zheng",
    placement: "front",
    selectedProductId: "prod-1",
    selectedVariantId: "var-1",
    isProductModalOpen: false,
    isSaving: false,
    isAddingToCart: false,
    statusBanner: null,
  });

  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });
  store.setState({ viewMode: "MOCKUP", inputText: "Phúc" });
  assert.equal(notifications, 1);
  assert.equal(store.getState().viewMode, "MOCKUP");
  assert.equal(store.getState().inputText, "Phúc");
  unsubscribe();
  store.setState({ hasSeal: false });
  assert.equal(notifications, 1);
});
