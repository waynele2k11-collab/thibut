# Admin Cleanup Review: AC-01, AC-02, AC-03

Dated 2026-11-25. Independent review. Read-only: no code was edited, nothing was committed.

**Verdict: no blocker. One High item needs action outside the code (revoke a provider key). Two Medium items should be fixed or scheduled before real orders are taken.**

## 1. Scope

All uncommitted changes and untracked files on `feat/admin-cleanup` (head `820547e`): 58 changed tracked files (735 lines added, 4,090 removed), plus `src/lib/studio/getActiveProducts.ts` and `tests/admin-sidebar.test.ts` (new). Parked files under `_to_delete/` were read to see what was removed.

Not in scope and not reviewed: `.claude/settings.local.json` (untracked; do not commit it).

## 2. What was run

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (temp config in `/tmp`, same options, `src` and `tests`, `.next` excluded) | Pass, 0 errors |
| `eslint` on 19 changed source and test files | Pass, no output |
| Import script: every file in `src/lib/fonts`, `src/lib/calligraphy` (and `providers`), `src/lib/print`, `src/lib/studio`, plus `inngest.ts`, `env.ts`, `webhookLease.ts`, `actions/fonts.ts`, `actions/keepsake-admin.ts`, `api/fonts/[id]`, `api/admin/fonts`, `api/admin/calligraphy/benchmark` | 34 of 36 load. `print-generator.tsx` and `api/print-master/route.ts` fail only on the missing Linux `resvg` binary. Print master constants read 4500 x 5400 |
| Tests, one file at a time (the single combined run was killed by the shell limit) | See below |
| Search for every removed file name and exported symbol in `src`, `scripts`, `tests`, `e2e`, `.github`, `package.json`, `next.config.ts`, root docs | No dangling import, link, `revalidatePath`, script, CI step or doc command |
| Secret search in `scripts/` and `_to_delete/` (file names and counts only) | See AC-H1 |

Test results in this Linux VM:

| File | Result | Cause of any failure |
| --- | --- | --- |
| `admin-sidebar` | 4/4 pass | |
| `admin-sign-in-wiring` | 15/15 pass | |
| `admin-sign-in` | 21/21 pass | |
| `keepsake-fulfillment` | 9/9 pass | |
| `commerce-ledger-webhooks` | 14/14 pass | |
| `runtime-csp-ratelimit` | 4/4 pass | |
| `keepsake-editor` | 57/57 pass | |
| `keepsake-pricing` | 9/9 pass | |
| `frontend-design-a11y` | 8/8 pass | |
| `foundation` | 6/6 pass | |
| `keepsake-admin-input` | 5/5 tests pass; file marked failed | Prisma engine built for macOS (async error after tests ended) |
| `next-tracks-features` | 3/3 tests pass; file marked failed | Same Prisma engine error |
| `studio-ux-redesign` | 6/6 tests pass; file marked failed | Same Prisma engine error |
| `qa-audit-verification` | 2 pass, 1 fail | Missing `@resvg/resvg-js-linux-x64-gnu`. Both static sweeps (the ones this change edited) pass |
| `calligraphy-ai-inngest` | did not load | `sharp` has no Linux binary |
| `print-master-fonts` | did not load | `sharp` |
| `checkout-cart-studio` | did not load | `sharp` |
| `security-auth` | did not load | `sharp` |
| `wysiwyg-regression` | did not load | `resvg` |

No output file contains an assertion failure (`AssertionError` / `ERR_ASSERTION`: zero matches). Every failure is a missing native binary.

## 3. Findings

### Blocker

None.

### High

**AC-H1. A provider API key is hard-coded in two removed scripts, and it is on GitHub.**
- Where: `scripts/fetch-printful-mockups.ts` line 5 and `scripts/test-printful.js` line 2 (parked as `_to_delete/scripts/*.removed`). Both hold the same 40-character value. The as-built note names only the first file.
- History: one commit introduced it, `fabb491` (2026-11-15, "chore(audit): snapshot working tree before audit remediation"). That commit is an ancestor of six local branches and of `origin/feat/admin-sign-in` and `origin/feat/keepsake-editor`, so the key has been pushed.
- Why it matters: deleting the files does not remove the key from history. Anyone with read access to the repository can use it against the provider account.
- Fix: revoke the key in the provider's dashboard now. Rewriting history is optional once it is revoked. Update the as-built note to name both files.
- Other secrets: none found. `scripts/` (remaining) has no key-like literal. `_to_delete/q2.removed` and `q_tmp.removed` contain a TOTP secret that is the published RFC test value with issuer "Test": not a real secret.

### Medium

**AC-M1. A customer can pay and then have the order marked FAILED, with only a passive signal.**
- Where: `src/lib/inngest.ts` lines 389 to 400 (mark FAILED, log, throw) and 458 to 461 (no retry).
- What is right: failing a mixed order as a whole is the safe choice. Nothing is half-started, the fixed log line carries no customer data (tested), and a second run changes nothing (tested).
- What is missing: the job runs after payment. Checkout and cart never look at `fulfillmentMode` (no reference in `CheckoutService.ts` or `actions/cart.ts`), and the column default is still `'PRINTFUL'` (`prisma/schema.prisma` line 913, AC-05 deferred). So any active product row that is not exactly `IN_HOUSE` can be bought and will fail afterwards.
- Scenario: a product is added by SQL or a future script without a mode. A customer pays. The job marks the order FAILED. The customer gets no confirmation email and sees "FAILED" on `/orders`. The admin learns of it only by opening the dashboard (red "1 failed order" box) or the Orders page (red FAILED badge), or by reading the server log or the Inngest run. No message is sent to anyone. The Orders page gives no reason. Refund exists only in the Stripe dashboard (the Stripe webhook then posts the refund to the ledger); admin has no refund control.
- Today's reach: with the Neon database seeded only by `seed-keepsakes.ts` (both products `IN_HOUSE`) this cannot happen. That was not verified against the database.
- Fix: (1) do AC-05 soon, so the default is `IN_HOUSE`; (2) in a later, security-reviewed step, refuse a non-in-house product at add-to-cart or checkout, before money moves; (3) on the Orders page, show one line under a paid FAILED order: "Contains an item that cannot be made in-house. Refund in Stripe or contact the customer."

**AC-M2. The schema comment says `ProviderVariant` is unused, but checkout, cart and pricing read it.**
- Where: `prisma/schema.prisma` line 960 ("LEGACY, UNUSED"). Readers: `src/lib/pricing/quote.ts` line 377 (cost per item), `src/lib/services/CheckoutService.ts` lines 838, 1206, 1579, 1595, 1623, `src/app/actions/cart.ts` lines 398 and 575, `src/app/checkout/checkoutLoader.ts` lines 257, 569, 588.
- Scenario: someone follows the comment and drops the table in AC-11. Every cart and checkout query fails. Separately, a leftover active row with a zero cost or non-USD currency makes the quote throw.
- Fix: change the comment to "LEGACY: no code writes it. Checkout, cart and pricing still READ it (provider cost). Do not drop before those reads are removed." The comment on `FulfillmentProviderRecord` (line 947) is correct: nothing reads or writes it.

### Low

**AC-L1. Moving a FAILED order by hand is one click and sends no confirmation.** `orders/page.tsx` lines 153 to 156: FAILED is not in the admin status list, so the select falls back to "IN PRODUCTION"; pressing Update moves the order. `updateOrderFulfillmentFormAction` sends an email only on "shipped", so this customer never gets the order confirmation. Fix: add the reason line from AC-M1 and consider a confirmation send when a FAILED order is moved to production.

**AC-L2. A legacy order with a provider id can never leave the dashboard counts.** `(panel)/page.tsx` line 34 counts paid orders in PENDING or PROCESSING; line 50 counts FAILED. `keepsake-admin.ts` line 359 refuses any change to an order with `externalFulfillmentId`, and the provider webhook that used to advance it is gone. Such an order stays in "awaiting production" or "failed" for ever. It renders without error (plain text "Handled by an outside provider (legacy)"). Expected count in the new database: zero (not verified). Fix if any exist: exclude orders with `externalFulfillmentId` from the two counts.

**AC-L3. Digital items: behaviour changed, for the better, and one side effect.** Before, an order with an in-house item and a digital item sent the digital item to the provider step, which threw; the order stayed PENDING. Now it goes to production (tested). A digital-only order returns "skipped" and stays PENDING, as before in effect (the Stripe webhook does not send `order/placed` for it), but the new dashboard counts it under "Orders awaiting production". No digital item is sold today. The job's digital test (`!catalogVariantId && !catalogProductId`) matches the Stripe webhook's test (`StripeWebhookService.ts` lines 550 and 607).

**AC-L4. `renderAndStorePrintMaster` now has no caller in `src/`.** Its only caller was the removed provider step. `api/print-master/route.ts` and `DigitalDownloadService.ts` call `generatePrintMasterPng`. The comment in `tests/print-master-fonts.test.ts` lines 508 to 510 ("the route that calls it") is wrong. Calligraphy rendering is unaffected. Fix: correct the comment; decide later whether to keep the function.

**AC-L5. The provider image host remains** in `src/lib/security/headers.ts` line 27 and `next.config.ts` line 80. Untidy, not harmful in practice: it only allows images from that CDN. The `next.config.ts` entry also lets the image optimiser fetch any image on that host. Leaving both until the AC-04 database counts are done is correct.

**AC-L6. Leftovers.** `SYSTEM_ARCHITECTURE.md` line 650 still names a `FulfillmentProvider` abstraction. The removed `seed-catalog.ts` also seeded the BUYER and CREATOR roles and creator plans; no code in `src` reads them (searched), so nothing breaks. `prisma/seed-presets.ts` has no `package.json` script. `.gitignore` gains `.env.neon`, unrelated to this task and harmless.

## 4. Answers to the review questions

| Question | Answer |
| --- | --- |
| In-house physical items behave as before? | Yes. Same two steps, same email content, same `IN_PRODUCTION` result. 9/9 tests pass |
| Non-in-house item | Order FAILED, one fixed log line with order id and count, `NonRetriableError`. Exactly `"IN_HOUSE"` counts; lower case, blank, missing variant or product all fail |
| Idempotency | A second event finds the order not PENDING and returns "skipped" (tested) |
| `webhookLease.ts` | One line: the `provider` parameter type narrowed from `"STRIPE" \| "PRINTFUL"` to `"STRIPE"`. No run-time change. Its only caller is `StripeWebhookService.ts` line 1397. Old rows are untouched (the column is text) |
| Money, ledger, earnings, signature code | Unchanged. Under `src/lib/services` the only changes are the deleted `CatalogSyncService.ts` and the lease type. `src/app/api/webhooks/stripe`, `actions/cart.ts`, `src/lib/pricing`, `src/app/checkout`: no diff |
| Env | Only the two provider names left `env.ts` (schema and required list), `launch-readiness.ts`, `.env.example` and CI. Stripe (2), Inngest, database, app URL, Blob and the five signing secrets are still required; a test removes each in turn and expects a refusal (passes). Preview rule unchanged |
| Sidebar | Eight items in the planned order, all from `adminPath()` |
| Hidden pages | All 13 hidden page files exist. 12 call `requireAdmin()`; `background-presets/new/page.tsx` does not (it reads no data and its save action is guarded; unchanged by this diff) |
| `/adm/admin/products` | No `products` folder; no link or `revalidatePath` to it |
| Dashboard, orders, finance queries | Every model, field and enum value exists in `schema.prisma`; `tsc` passes |
| `keepsake-admin.ts` | Comment and message text only |
| Database | `schema.prisma`: seven added comment lines. No migration added |
| `package.json` | Only `db:seed` removed; nothing else refers to it |

## 5. Kept feature: verified how

| Kept feature | Verified how |
| --- | --- |
| Font library (`src/lib/fonts/*`, `api/fonts/[id]`, `api/admin/fonts*`, admin Fonts page, `actions/fonts.ts`) | No diff in any of them. All import cleanly. `tsc` pass. `keepsake-editor` 57/57, launch-readiness font test pass |
| Calligraphy engine and providers | No diff. All 11 modules import cleanly. `tsc` pass |
| Print master (`print-generator.tsx`, `print/types.ts`, `api/print-master`) | Only a comment changed in `print/types.ts`; constants read 4500 and 5400 at run time. Not loadable here (`resvg`); `tsc` pass |
| Calligraphy bench | Route imports cleanly; page untouched |
| Admin Studio | Page untouched and guarded. `getActiveProducts.ts` moved; its one importer (`loadStudioEntryContext.ts` line 7) updated; both import cleanly. Diff against the old file: only the provider-cost fallback and its include removed. Such variants were already refused by pricing (`quote.ts` line 370), so no product that could be bought disappears |
| Keepsake editor | No diff. 57/57 tests |
| Catalog admin | `keepsake-admin.ts` text change only; `keepsake-admin-input` 5/5 |
| Checkout, Stripe webhook, ledger | No diff. `commerce-ledger-webhooks` 14/14 |
| Remaining public images | Every `/mockups/*.jpg` path still used in `src` exists in `public/mockups` |

## 6. Test changes: verdict

| Test | Change | Coverage of kept behaviour reduced? |
| --- | --- | --- |
| `commerce-ledger-webhooks` T-107 (provider webhook auth, dedup) | Deleted; replaced by a check that Stripe is the only webhook route | No. The route is gone. `computeHmacSha256Hex` is still tested in `foundation` and `print-master-fonts` |
| `commerce-ledger-webhooks` T-206 (catalog sync) | Deleted | Slightly. It was the only direct exercise of `roundUpTo99Minor` after a provider cost. The function is still used by `pricing/engine.ts` and `quote.ts` and still referenced in this test file. Acceptable |
| R-104 (stale webhook lease) | Provider half removed, Stripe half kept | No |
| R-201 (pricing) | `PRODUCT_CATALOG` and `getCatalogProducts` cases removed; the quote assertion kept (3398 minor units, "$33.98") | No. The removed cases tested deleted files. The money assertion is as strict as before |
| R-202/R-203 | Fixture id renamed | No |
| `calligraphy-ai-inngest` part C | "bad address" rejection replaced by "empty order" rejection | No. Address parsing was removed with the provider step |
| `calligraphy-ai-inngest` part D | Two-step provider flow replaced by "non-in-house item fails the order" | No. Could not be run here |
| 4500 x 5400 stored print master | Moved to `print-master-fonts` with stricter checks (mime type, visibility, hash, link rows) | No. One loss: the old test rendered through `adaptLegacyComposition`; no test now names that function, though checkout, cart and download code still use it. Could not be run here |
| `keepsake-fulfillment` | Provider stub dropped; six new tests | Increased |
| `qa-audit-verification` | Provider-key check widened from client modules to all modules; file list and `.env.example` list updated | No. Stricter |
| `runtime-csp-ratelimit` | Fixture loses two values; new loop proves 11 settings stay required | Increased |
| `admin-sign-in-wiring` | One removed action file dropped from the list | No |
| `admin-sidebar` (new) | Sidebar, hidden-page guards, wording | New |

No assertion about money, ledger, signature verification or admin access was weakened.

## 7. Not verified

- `next build`, a browser, and any database content.
- `calligraphy-ai-inngest`, `print-master-fonts`, `checkout-cart-studio`, `security-auth`, `wysiwyg-regression` and one `qa-audit-verification` test: they need macOS binaries.
- `npm run typecheck` as written: `tsconfig.json` includes `.next/types`, and the stale `.next/types/validator.ts` on disk still imports removed routes. I excluded `.next`. Delete `.next` or run a build first.
- Whether Vercel stores provider values, and whether the leaked key is still active.

## 8. Hand tests for the founder

1. Revoke the provider key (AC-H1).
2. On the Mac: delete `.next`, then `npm run typecheck`, `npm run lint`, `npm test`. All files must pass, in particular the five listed in section 7.
3. `npm run launch:check`: no provider line under "missing".
4. Sign in at `/adm/admin/login`. Sidebar shows eight items. Open each.
5. Type `/adm/admin/sellers`, `/art`, `/gallery`, `/background-presets`, `/knowledge`, `/users`: each opens. `/adm/admin/products` gives the 404 page.
6. Fonts: list loads, toggle one font off and on. Keepsake Editor: fonts load, export works.
7. Calligraphy bench: run it. Admin Studio: products list, brush text renders.
8. Neon console: `SELECT "slug","fulfillmentMode","status" FROM "CatalogProduct";` Every active row must say `IN_HOUSE` (AC-M1). `SELECT count(*) FROM "Order" WHERE "externalFulfillmentId" IS NOT NULL;` should be 0 (AC-L2).
9. With Stripe test keys: place one keepsake order. It moves to "In production" and the confirmation email arrives.
10. Finance page: ledger accounts list; no earnings table.

## Resolution (2026-11-25)

| Finding | Action |
| --- | --- |
| AC-H1 | Founder action: revoke the provider API key (in history since `fabb491`, pushed on two branches) and confirm the repository is private. The scripts are removed |
| AC-M1 | Fixed. Cart, direct and gallery checkout, and both add-to-cart actions, refuse a physical item that is not made in-house before any order or payment. The dashboard shows "N paid orders need attention" |
| AC-M2 | Fixed. `ProviderVariant` and `ProductMockup` are marked "still read, do not drop"; plan step AC-11 rewritten |
| AC-L1 | Fixed with a required confirmation; no reason is stored because `Order` has no notes field |
| AC-L2, L3, L4 | Fixed |
| AC-L5, L6 | Open, already in the plan |

Not verified: `next build`, a browser, the dashboard queries on a database, and the five suites that need Mac binaries. The fixes have not had a second independent review.
