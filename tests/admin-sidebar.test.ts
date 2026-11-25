import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Admin tidy-up (docs/ADMIN_CLEANUP_PLAN.md, AC-02). Source-level checks: the sidebar lists the
 * eight sections the keepsake business uses, the pages that left the sidebar still exist and
 * still check access themselves, and the screens no longer name a print-on-demand provider.
 */
const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const PANEL = "src/app/adm/admin/(panel)";

const SIDEBAR_ITEMS: [name: string, href: string][] = [
  ["Dashboard", "adminPath()"],
  ["Orders", 'adminPath("/orders")'],
  ["Catalog", 'adminPath("/catalog")'],
  ["Keepsake Editor", 'adminPath("/keepsake-editor")'],
  ["Fonts", 'adminPath("/fonts")'],
  ["Calligraphy", 'adminPath("/ai/calligraphy")'],
  ["Admin Studio", 'adminPath("/studio")'],
  ["Finance", 'adminPath("/finance")'],
];

const HIDDEN_PAGES = [
  "sellers/page.tsx",
  "art/page.tsx",
  "gallery/page.tsx",
  "background-presets/page.tsx",
  "background-presets/new/page.tsx",
  "knowledge/page.tsx",
  "users/page.tsx",
];

test("the admin sidebar lists exactly the eight keepsake sections, in order, built from adminPath", () => {
  const sidebar = read("src/components/admin/AdminSidebar.tsx");
  const listed = [...sidebar.matchAll(/\{ name: "([^"]+)", href: (adminPath\([^)]*\)), icon: \w+ \}/g)].map(
    (match) => [match[1], match[2]]
  );
  assert.deepEqual(listed, SIDEBAR_ITEMS);

  // No link is written out by hand: every address comes from the one admin base path.
  assert.equal(/href=["'`]\//.test(sidebar), false, "no hard-coded address in the sidebar");
  assert.equal(/["'`]\/adm\/admin/.test(sidebar), false, "the admin address is not written out");

  for (const gone of ["/products", "/sellers", "/art", "/gallery", "/background-presets", "/knowledge", "/users"]) {
    assert.equal(
      sidebar.includes(`adminPath("${gone}")`),
      false,
      `${gone} must not be linked from the sidebar`
    );
  }
});

test("pages that left the sidebar still exist and still check access first (reachable by address)", () => {
  for (const rel of HIDDEN_PAGES) {
    const file = `${PANEL}/${rel}`;
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `${file} must still exist`);
    const source = read(file);
    const guardAt = source.indexOf("await requireAdmin()");
    assert.ok(guardAt > 0, `${file} must call requireAdmin()`);
    const firstQueryAt = source.search(/\bprisma\.\w+\.\w+\(/);
    if (firstQueryAt !== -1) {
      assert.ok(guardAt < firstQueryAt, `${file} must check access before reading data`);
    }
  }
});

test("the dashboard shows keepsake numbers and no marketplace or provider wording", () => {
  const dashboard = read(`${PANEL}/page.tsx`);
  for (const title of [
    "Orders awaiting production",
    "Paid orders this month",
    "Active keepsake products",
    "Published catalog designs",
  ]) {
    assert.ok(dashboard.includes(`title="${title}"`), `dashboard must show "${title}"`);
  }
  assert.match(dashboard, /fulfillmentMode: "IN_HOUSE", status: "ACTIVE"/);
  // Paid orders the in-house rule failed get a prominent alert that links to the filtered list.
  assert.match(dashboard, /role="alert"/);
  assert.match(dashboard, /\{needsAttentionCount === 1 \? "order needs" : "orders need"\} attention/);
  assert.ok(dashboard.includes('ordersNeedingAttentionHref(adminPath("/orders"))'));
  assert.ok(dashboard.includes("where: PAID_ORDERS_NEEDING_ATTENTION_WHERE"));
  assert.ok(dashboard.includes("where: PAID_ORDERS_AWAITING_PRODUCTION_WHERE"));
  assert.equal(
    /count\(\{ where: \{ fulfillmentStatus: "FAILED" \} \}\)/.test(dashboard),
    false,
    "the dashboard must not count every FAILED row: legacy provider orders would stay for ever"
  );
  for (const gone of [
    "Printful",
    "Active Sellers",
    "Total Users",
    "Gallery Products",
    "creator payouts",
    "artwork submissions",
    'adminPath("/art")',
    "creatorProfile",
    "creatorEarning",
  ]) {
    assert.equal(dashboard.includes(gone), false, `dashboard must not mention ${gone}`);
  }
  assert.ok(
    dashboard.indexOf("await requireAdmin()") < dashboard.indexOf("prisma.order.count"),
    "the dashboard checks access before it reads anything"
  );
});

test("Orders and Finance: a legacy provider order reads as plain text, and creator earnings are not listed", () => {
  const orders = read(`${PANEL}/orders/page.tsx`);
  assert.ok(orders.includes('"Handled by an outside provider (legacy)"'));
  assert.equal(orders.includes("Printful"), false);
  // The hand-update form is still offered only for paid orders without an outside provider id.
  assert.match(orders, /order\.paymentStatus === "SUCCEEDED" &&\s*!order\.externalFulfillmentId/);

  const actions = read("src/app/actions/keepsake-admin.ts");
  assert.ok(actions.includes("handled by an outside provider (legacy)"));
  assert.equal(actions.includes("Printful"), false);
  assert.match(actions, /if \(order\.externalFulfillmentId\) \{\s*finish\(/);

  const finance = read(`${PANEL}/finance/page.tsx`);
  assert.equal(finance.includes("Recent Creator Earnings"), false);
  assert.equal(finance.includes("prisma.creatorEarning"), false);
  assert.ok(finance.includes("prisma.ledgerAccount.findMany"));
  assert.ok(finance.includes("prisma.ledgerPosting.groupBy"));
  assert.ok(finance.includes("Ledger Accounts"));
});
