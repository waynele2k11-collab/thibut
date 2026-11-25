# Admin Audit and Cleanup Plan

Dated 2026-11-25. Status: PLAN. No code has been changed. Branch read: `feat/admin-sign-in`.

Founder's request: "Audit thibut admin > create the plan to remove unused features: printful related > keep the font lib and calligraphy."

Nothing here was run against a database, a build or a browser. Every claim comes from reading the code and searching for callers.

## 1. Summary

### 1.1 Admin sections

Verdicts: **KEEP**, **HIDE** (leave the sidebar, code stays, page still guarded), **SIMPLIFY**, **REMOVE**.

| Sidebar item | Address under `/adm/admin` | What it does today | Still serves keepsakes? | Verdict |
| --- | --- | --- | --- | --- |
| Dashboard | `/` | Counts users, active sellers, published designs, design products, designs in review, failed orders (worded "failed Printful orders"), held creator earnings; sign-in notices | Partly. Half the numbers are marketplace numbers | SIMPLIFY |
| Fonts | `/fonts` | Font library: list, enable, disable, download, upload | Yes | KEEP |
| Keepsake Editor | `/keepsake-editor` | Layered film print files | Yes | KEEP |
| Catalog | `/catalog`, `/catalog/designs`, `/catalog/categories` | Keepsake products, sizes, prices, multiplier, designs, categories | Yes | KEEP |
| Orders | `/orders` | Orders and in-house fulfilment status | Yes | KEEP, fix two Printful wordings |
| Calligraphy | `/ai/calligraphy` | Calligraphy benchmark bench | Yes (calligraphy) | KEEP |
| Admin Studio | `/studio` | Brush-text composer, tied to a product step | Yes (calligraphy), with baggage | KEEP now, SIMPLIFY later (decision D-5) |
| Knowledge | `/knowledge` | Read-only list of `PhraseKnowledge` | Indirectly: calligraphy keys on it | HIDE |
| Finance | `/finance` | Ledger balances and creator earnings | Ledger yes, earnings no | SIMPLIFY |
| Products | `/products` | Live Printful catalog browser and import | No | REMOVE |
| Sellers | `/sellers`, `/sellers/[id]` | Creator profiles and their earnings | No | HIDE |
| Art | `/art`, `/art/[id]` | Creator design moderation | No | HIDE |
| Gallery | `/gallery`, `/gallery/new`, `/gallery/[id]` | Print-on-demand showcase items | No (public gallery already redirects) | HIDE |
| Presets | `/background-presets` | AI background presets for the Studio | Not today | HIDE (decision D-3) |
| Users | `/users`, `/users/[id]` | Read-only user list | Not until customer accounts exist | HIDE |

No admin page other than the ones the sidebar lists exists. Users, Sellers, Art, Knowledge and Finance are read-only: no form and no write.

### 1.2 Legacy areas

| Area | Verdict | One-line reason |
| --- | --- | --- |
| Printful | REMOVE in code, keep database tables | The business makes pieces in-house |
| Creator marketplace screens | HIDE | No creators exist |
| Creator, earnings and ledger code inside payment settlement | KEEP | Checkout and the Stripe webhook use it for every order |
| AI meaning and background features | HIDE, remove later by decision | Costs money per call; only the paused Studio uses them |
| Gallery | HIDE now | Removing it means editing checkout and pricing |
| Digital downloads | KEEP for now | Links are built into the order pages and emails |
| Device trust tokens | KEEP until the Creator Studio code is removed | Only two paused files use them |
| Public Studio and `/create` | Stay paused | Founder asked to keep the brush-text Studio code |
| Font library | KEEP | Founder decision |
| Calligraphy | KEEP | Founder decision |

### 1.3 First three steps

1. **AC-01:** stop the live site from requiring the two Printful settings.
2. **AC-02:** tidy the admin sidebar and dashboard; Products becomes a 404.
3. **AC-03:** remove the Printful code.

## 2. Principles

1. Small steps. One task, one developer pass, one independent review.
2. Order of removal: settings the site insists on, then screens, then code, then database. The database is last and optional.
3. Never drop a table or column that holds money or order history. `SYSTEM_ARCHITECTURE.md` says financial and legal records are never hard-deleted. Legacy tables stay and are marked unused in the schema comments.
4. Every existing order stays readable in admin, including any old Printful order.
5. Nothing the font library or calligraphy needs is removed. Section 5 lists it.
6. HIDE means: out of the sidebar, page and guard unchanged. A hidden page is still reachable by typing its address while signed in.
7. Deleting files is not possible from the CTO's remote session. Removal tasks either park files in `_to_delete/` for the founder to delete, or run in a session on the founder's computer.

## 3. Audit detail

### 3.1 Admin pages

| Page | Reads | Writes | Outside service |
| --- | --- | --- | --- |
| `(panel)/page.tsx` | `User`, `CreatorProfile`, `Design`, `DesignProduct`, `Order`, `CreatorEarning`, sign-in report | None | None |
| `fonts/page.tsx` (client) | `/api/admin/fonts`, `/api/admin/fonts/download`, `/api/admin/fonts/toggle` | Through those routes: `Font` | Vercel Blob for uploaded fonts |
| `keepsake-editor/page.tsx` and `fonts/[id]/route.ts` | Font files on disk | None | None |
| `catalog/*` | `CatalogProduct`, `CatalogVariant`, `Category`, `Design` | `app/actions/keepsake-admin.ts` | None |
| `orders/page.tsx` | `Order` with items | `updateOrderFulfillmentFormAction` | Email on "shipped" |
| `ai/calligraphy/page.tsx` (client) | `/api/admin/calligraphy/benchmark` | None | None |
| `studio/page.tsx` | `loadStudioSharedCatalog` (products, fonts) | Through the Studio: cart, `PersonalizationSession`, `UserComposition` | Optional AI calls from the Studio panels |
| `knowledge/page.tsx` | `PhraseKnowledge` | None | None |
| `finance/page.tsx` | `LedgerAccount`, `LedgerPosting`, `CreatorEarning` | None | None |
| `products/page.tsx`, `ProductsGrid.tsx` | Live Printful catalog | `app/actions/printful-admin.ts` imports into `CatalogProduct`, `CatalogVariant`, `ProviderVariant` | Printful API |
| `sellers/*` | `CreatorProfile`, `CreatorEarning` | None | None |
| `art/*` | `Design` | None | None |
| `gallery/*` | `GalleryItem`, `Design`, `CatalogProduct` | `app/actions/gallery.ts`, `/api/admin/gallery/*`, `/api/uploads/background` | Vercel Blob |
| `background-presets/*` | `BackgroundPreset` | `background-presets/actions.ts` | None |
| `users/*` | `User` with roles | None | None |

### 3.2 Admin API routes

| Route | Purpose | Verdict |
| --- | --- | --- |
| `api/admin/fonts` | List and register fonts | KEEP |
| `api/admin/fonts/download` | Fetch a font file into the library | KEEP |
| `api/admin/fonts/toggle` | Enable or disable a font | KEEP |
| `api/admin/calligraphy/benchmark` | Run the benchmark suite | KEEP |
| `api/admin/gallery/create`, `api/admin/gallery/[id]` | Create, edit, delete gallery items | Stay with Gallery (HIDE) |

All six call the admin guard (confirmed in `docs/AUTH_MOVE_REVIEW.md`).

### 3.3 Server action files

| File | Used by | Verdict |
| --- | --- | --- |
| `app/actions/keepsake-admin.ts` | Catalog and Orders pages | KEEP. Reword the two Printful messages (lines 357 to 359) |
| `app/actions/printful-admin.ts` | Products page only | REMOVE with the page |
| `app/actions/gallery.ts` | Gallery "new" form | Stays with Gallery |
| `(panel)/background-presets/actions.ts` | Presets pages | Stays with Presets |
| `app/actions/composition.ts` | Studio | KEEP (calligraphy) |
| `app/actions/cart.ts` | Storefront and Studio | KEEP |
| `app/actions/creator-studio.ts` | `components/creator/CreatorStudioControls.tsx`, used by the redirected `/studio` page | Paused. Remove with decision D-1. Only caller of Stripe Connect (`stripe.accounts`, `accountLinks`) |
| `app/actions/fonts.ts` (`toggleFontStatus`) | No caller found | Dead. Remove in AC-03, or keep if the developer finds a use |
| `app/actions/catalog.ts` (`getCatalogProducts`) | No caller in `src`; one test | Dead print-on-demand code. REMOVE in AC-03 |
| `app/actions/indexnow.ts` | No caller found | Dead. Not Printful; leave, note only |

## 4. Printful, end to end

### 4.1 Code that exists only for Printful or print-on-demand

| Item | Depends on it | Safe to remove? | Pinned by |
| --- | --- | --- | --- |
| `src/lib/fulfillment/PrintfulProvider.ts` | `inngest.ts`, `printful-admin.ts`, `CatalogSyncService.ts`, the webhook route, `scripts/update-hex.ts` | Yes, after its four callers | `commerce-ledger-webhooks.test.ts` T-107; `qa-audit-verification.test.ts` (file list near line 1166) |
| `src/lib/fulfillment/types.ts` | The files above and `ProductsGrid.tsx` (type only) | Yes | None directly |
| `src/lib/services/CatalogSyncService.ts` | `printful-admin.ts`, `scripts/import-catalog.ts` | Yes | `commerce-ledger-webhooks.test.ts` T-206 |
| `src/app/actions/printful-admin.ts` | Products page | Yes | `admin-sign-in-wiring.test.ts` (action list near line 865) |
| `(panel)/products/page.tsx`, `ProductsGrid.tsx` | Sidebar link | Yes | Source test that lists admin pages |
| `src/app/api/webhooks/fulfillment/printful/route.ts` | Nothing inside the app | Yes. With no secret set it already refuses every call | T-107; R-104 (Printful half) |
| `src/lib/inngest.ts`: `PrintfulFulfillmentClient`, `defaultPrintful`, `resolvePrintfulExternalVariantId`, `resolveItemPrintMasterUrl`, steps `create-printful-draft` and `confirm-printful-order`, the `printfulClient` parameter | `processOrderFulfillment` | Yes, with care: see 4.3 | `calligraphy-ai-inngest.test.ts` T-203/T-400/T-409 part D; `keepsake-fulfillment.test.ts` |
| `src/config/catalog.ts` (`PRODUCT_CATALOG`: hoodie, tee, poster, canvas, tote) | `app/actions/catalog.ts`, `scripts/seed-catalog.ts` | Yes | `commerce-ledger-webhooks.test.ts` near lines 3219 and 3272 |
| `src/app/actions/catalog.ts` | Nothing in `src` | Yes | Same test |
| `src/lib/services/stripe/webhookLease.ts` provider type `"STRIPE" \| "PRINTFUL"` | The webhook route | Narrow to `"STRIPE"` after the route goes. The column is a string, so old rows are unaffected | R-104 |
| `src/lib/security/headers.ts` image source `https://files.cdn.printful.com` | Nothing once Printful images are gone | Yes, after the check in 4.4 | `runtime-csp-ratelimit.test.ts` line 479; `security-auth.test.ts` line 811 |
| `next.config.ts` `images.remotePatterns` for `files.cdn.printful.com` | Same | Yes, same check | None found |
| `public/mockups/printful/` (12 files, 2 MB) | `src/config/catalog.ts` only | Yes | None |
| Wording: dashboard "failed Printful orders"; Orders column "Printful"; `keepsake-admin.ts` "fulfilled by Printful"; `/artists` page "worldwide Printful fulfillment"; comment in `print/types.ts` | Nothing | Reword | None found |

### 4.2 Scripts

| Script | Verdict |
| --- | --- |
| `fetch-printful-mockups.ts`, `test-printful.js`, `import-catalog.ts`, `update-hex.ts`, `check-providers.ts`, `scratch/test-mockup.js`, `scratch/test-catalog.ts` | REMOVE |
| `seed-catalog.ts` and the `db:seed` line in `package.json` | REMOVE. It seeds the print-on-demand catalog and background presets. Keep `db:seed:keepsakes`. If Presets are kept (D-3), move the preset seeding to its own script first |
| `check-products.ts`, `disable-no-mockups.ts`, `disable-hardcoded.ts`, `check-colors*.ts`, `activate-digital.ts`, `check-digital.ts` | One-off maintenance for the old catalog. Developer reads each; remove those that only touch print-on-demand rows |
| `seed-gallery*.ts`, `update-gallery-images.ts` | Stay with Gallery |
| `test-print.ts`, `test-text-render*.ts`, `test-satori.tsx`, `test-svg.ts`, `import-fonts.ts`, `check-png.ts` | KEEP: calligraphy and font tooling |

### 4.3 The fulfilment job after Printful

Today `executeOrderFulfillmentJob` splits items into in-house and "provider" items. An order with only in-house items never reaches Printful (test: `keepsake-fulfillment.test.ts`).

After removal the job must not quietly accept an item that is not in-house. Rule for the developer: if any item's product is not `IN_HOUSE`, set the order's fulfilment status to `FAILED`, log a fixed sentence, and stop. The admin Orders page then shows it for a person to handle. Do not treat unknown items as in-house.

### 4.4 Settings

| Setting | Where required | Action |
| --- | --- | --- |
| `PRINTFUL_API_KEY`, `PRINTFUL_WEBHOOK_SECRET` | `env.ts` `REQUIRED_PRODUCTION_KEYS`; `scripts/launch-readiness.ts` `REQUIRED_PROD_SECRETS`; `.github/workflows/ci.yml` lines 115 to 116; `.env.example` lines 29 to 31 | AC-01 removes them from both required lists. AC-03 removes the names everywhere |

### 4.5 Database

| Item | Holds | Action |
| --- | --- | --- |
| `CatalogProduct.fulfillmentMode`, default `'PRINTFUL'` (migration `0003_keepsake_catalog`) | Mode per product | Change the default to `'IN_HOUSE'` in a new additive migration, so a product made without a mode can never count as Printful. No row is changed |
| `FulfillmentProviderRecord`, `ProviderVariant` | Printful ids and costs | Leave. `FulfillmentProviderRecord` is unused. `ProviderVariant` is NOT unused: pricing, checkout and the cart still read it (see AC-11). Neither can be dropped while those reads exist |
| `PrintArea`, `ProductMockup` | Print areas and mockup images | Leave. The Studio's product list still reads `ProductMockup` |
| `Order.externalFulfillmentId` | Printful order id on old orders | Leave for ever: order history |
| `WebhookEvent.provider` | Text | Leave |
| `FulfillmentStatus` enum | Used by in-house orders too | Leave |

**How to tell whether Printful orders exist.** In the Neon console, Query tab: `SELECT count(*) FROM "Order" WHERE "externalFulfillmentId" IS NOT NULL;` and `SELECT count(*) FROM "ProviderVariant";`. The Neon database was created on 2026-11-24 from the four migrations and the keepsake seed, so both should be zero. The earlier database (Supabase) may hold test orders; it is not connected any more.

**Printful image check before the image host is removed.** `SELECT count(*) FROM "Asset" WHERE "objectKey" LIKE '%printful%';` and the same on `"GalleryItem"."productImageUrl"`. If either is above zero, keep the host until those rows are gone or Gallery is removed.

## 5. What fonts and calligraphy depend on

Do not remove anything in this section.

### 5.1 Font library

| Piece | Path | Needs |
| --- | --- | --- |
| Catalogue and registry | `src/lib/fonts/fontCatalog.ts`, `FontRegistryService.ts` | `Font` table; `@vercel/blob` for uploaded fonts; `@shuding/opentype.js` |
| Font files | `assets/fonts/` | The tracing keys in `next.config.ts` |
| Routes | `api/fonts/[id]`, `api/fonts/active`, `api/admin/fonts`, `api/admin/fonts/download`, `api/admin/fonts/toggle`, `adm/admin/keepsake-editor/fonts/[id]` | Admin guard on the admin ones |
| Screens | `/adm/admin/fonts`, `/adm/admin/keepsake-editor` | |
| Tools | `scripts/import-fonts.ts`, `scripts/launch-readiness.ts` (font check) | |

**Hidden dependency.** `@shuding/opentype.js` is not in `package.json`. It arrives through `satori`. Five files import it, including the font registry and the keepsake editor. `satori` itself is imported by one script only, so it looks unused. Removing `satori` would break fonts. Before any package clean-up, add `@shuding/opentype.js` to `package.json` directly.

### 5.2 Calligraphy

| Piece | Path | Needs |
| --- | --- | --- |
| Engine | `src/lib/calligraphy/*` and `providers/*` | Font registry; `security/xml`; `DesignCacheService` (`GeneratedDesign` table); `PhraseKnowledge`; `StylePack` |
| Print master | `src/lib/print-generator.tsx`, `src/lib/print/types.ts`, `api/print-master` | `@resvg/resvg-js`, `sharp`, `UploadService` (Blob), `FULFILLMENT_SECRET_KEY` (signs calls to the route) |
| Studio screen | `src/components/studio/*`, `src/lib/studio/*`, `app/actions/composition.ts`, `app/actions/cart.ts` | `fabric`; `PolicyGuard`; tables `PersonalizationSession`, `PersonalizationVersion`, `UserComposition`, `UserCompositionLayer`, `Composition`, `CompositionTemplate` |
| Bench | `/adm/admin/ai/calligraphy`, `api/admin/calligraphy/benchmark` | |

### 5.3 Where calligraphy is tangled with print-on-demand

| # | Tangle | Where | How to keep calligraphy working |
| --- | --- | --- | --- |
| 1 | The print master is fixed at 4500 × 5400 pixels, a Printful print-area size | `print/types.ts` (comment says "Printful Production Spec"), checked in `print-generator.tsx` | Keep the constants. Only the comment changes. The keepsake editor has its own sizes and does not use this |
| 2 | The Studio's product list comes from a file in the Printful folder | `src/lib/fulfillment/getActiveProducts.ts`, called by `lib/studio/loadStudioEntryContext.ts` | It calls no Printful API. Move it to `src/lib/studio/` in AC-03 and drop its "provider cost" price fallback. Do not delete it |
| 3 | The Studio has a product step, garment swatches, a price quote and add-to-cart | `StepProductPanel`, `garmentSwatches.ts`, `studioQuote.ts`, `ProductSelectionModal`, `StudioQuoteFooter` | Leave as is now. Decision D-5 covers turning the Admin Studio into a brush-text tool without a product step |
| 4 | Print masters were rendered inside the Printful order step | `inngest.ts` `resolveItemPrintMasterUrl` | Remove only that call. `api/print-master` and `renderAndStorePrintMaster` stay, and the test that checks the 4500 × 5400 render moves to a print-master test (see AC-03) |
| 5 | The Studio's "meaning" panels call AI routes | `useStudioAnalysis.ts` → `api/personalization/*`; `BackgroundLayerControls.tsx` → `api/backgrounds/generate` | If the AI features go (D-3), the brush renderer still works; those panels must be removed or made to show nothing |
| 6 | `PhraseKnowledge` feeds the calligraphy cache | `CalligraphyService`, `DesignCacheService` | Keep the table and the Knowledge page |

## 6. Other legacy areas

| Area | What exists | What still depends on it | Verdict and reason |
| --- | --- | --- | --- |
| Creator marketplace screens | Admin Sellers and Art; public `/artists`, `/licensing`; `/studio` creator dashboard (redirected); `app/actions/creator-studio.ts`; `components/creator/*` | Nothing in the keepsake flow | HIDE the admin screens now. Public `/artists` and `/licensing` are still live and linked in the footer, and describe a marketplace that is not operating: decision D-1 |
| Creator records in payments | `CreatorProfile` (the "platform creator" owns every catalog design), `CreatorEarning` rows written on each paid order, `LicenseOffer` in the checkout input | `CheckoutService.ts`, `StripeWebhookService.ts`, `lib/catalog/divisions.ts`, `seed-keepsakes.ts` | KEEP. This is live payment code, well tested. Removing it is a rewrite of settlement with no customer benefit |
| Ledger | `LedgerService`, `LedgerAccount`, `LedgerTransaction`, `LedgerPosting`; the zero-sum database trigger | Stripe webhook settlement | KEEP. Financial record |
| Finance page | Ledger balances plus creator earnings table | Above | SIMPLIFY: keep the ledger half, drop the earnings table from view |
| AI meaning | `lib/ai/cultural-provider.ts` (OpenAI, Gemini), `InterpretationEngine.ts`, `services/personalization/*`, `api/personalization/*`, `CulturalKnowledgeService` | Studio "meaning" panel; `generatePersonalizationJob` in `inngest.ts` | HIDE now (reachable only through the paused Studio and Admin Studio). Decision D-3 |
| AI backgrounds | `lib/ai/visual-provider.ts`, `BackgroundGenerationService` (fal), `BackgroundRouteService`, `api/backgrounds/generate`, `BackgroundPreset`, `GeneratedBackground` | Studio background controls; Presets admin | HIDE now. Decision D-3 |
| Background upload | `api/uploads/background`, `BackgroundUploadRouteService` | Studio and the Gallery edit form | KEEP while either exists |
| Gallery | `GalleryItem`; admin Gallery; public `/gallery/[slug]` (redirected); `components/gallery/*`; `api/checkout/gallery`; gallery branch in `CheckoutService.ts` and `pricing/quote.ts`; `lib/studio/fontPairing.ts` | Checkout and pricing code paths | HIDE now. Removal touches checkout and pricing: decision D-2 |
| Digital downloads | `DigitalDownloadService`, `api/download`, download tokens (`DOWNLOAD_TOKEN_SECRET`), links in `checkout/success`, `/orders`, emails, the `order/paid` job | Order pages and emails | KEEP for now. Keepsakes sell no digital item, so the links never show. Decision D-4 |
| Device trust | `signDeviceTrustToken`, `verifyDeviceTrustToken`, `DEVICE_TRUST_SECRET` | `app/studio/layout.tsx` and `creator-studio.ts`, both paused | KEEP until D-1 removes those two files. Then remove the helpers, the `DeviceVerification` use, and the secret from the required list |
| Public Studio | `/create`, `/create/[sessionId]`, four tradition pages; all redirected to `/custom` | `loadStudioEntryContext.ts`, Studio components | Stay paused. The code is the brush-text capability the founder wants kept |
| Users page | Read-only | Nothing | HIDE until customer accounts exist |

## 7. Settings the live site insists on

`src/lib/env.ts` stops the live site at start-up when any of these is missing. A preview deployment needs only the database and the five signing secrets.

| Setting | Needed by the keepsake business? | Action |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Stay |
| `NEXT_PUBLIC_APP_URL` | Yes: links in emails | Stay |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Yes | Stay |
| `INNGEST_SIGNING_KEY` | Yes: the paid-order job sends the confirmation and moves the order to production | Stay |
| `BLOB_READ_WRITE_TOKEN` | Yes: uploaded fonts, print masters, and customer photos in the custom-order plan | Stay |
| `ADMIN_SESSION_SECRET` | Yes: admin sign-in | Stay |
| `ANON_SESSION_SECRET` | Yes: guest cart | Stay |
| `DOWNLOAD_TOKEN_SECRET` | Only for digital downloads | Stay until D-4. It is a random string already set |
| `FULFILLMENT_SECRET_KEY` | Signs calls to the print-master route (calligraphy) | Stay |
| `DEVICE_TRUST_SECRET` | Only the paused Creator Studio | Stay until D-1, then drop |
| **`PRINTFUL_API_KEY`** | **No** | **Drop from the required list in AC-01** |
| **`PRINTFUL_WEBHOOK_SECRET`** | **No** | **Drop from the required list in AC-01** |

Not required today and staying optional: `OPENAI_API_KEY`, `FAL_KEY`, Gemini key, `RESEND_API_KEY`, Upstash, IndexNow. Note for the custom-order work: `RESEND_API_KEY` will need to become required once customers get links by email.

Without AC-01 the live site cannot start unless the founder invents two Printful values.

## 8. Tasks

Each task is one developer pass and one independent review. Line numbers are from `feat/admin-sign-in` on 2026-11-25 and will drift.

### 8.1 Safe now (no founder decision needed)

| ID | Task | Files | Tests to update | Risk | Roll back |
| --- | --- | --- | --- | --- | --- |
| **AC-01** | Stop requiring the Printful settings on the live site | `src/lib/env.ts` (`REQUIRED_PRODUCTION_KEYS`), `scripts/launch-readiness.ts` (`REQUIRED_PROD_SECRETS`), `.env.example` (mark the two lines "legacy, not needed"), `.github/workflows/ci.yml` (leave the two values until AC-03) | `runtime-csp-ratelimit.test.ts` R-002/R-303 (fixture lines 377 to 378 can stay; add a case: production passes with no Printful values); `qa-audit-verification.test.ts` env key list; `next-tracks-features.test.ts` Track 5 if it counts required secrets | Very low. Two names leave two lists | Put the two names back |
| **AC-02** | Tidy the admin sidebar and dashboard | `components/admin/AdminSidebar.tsx`: keep Dashboard, Orders, Catalog, Keepsake Editor, Fonts, Calligraphy, Admin Studio, Finance; remove Products; move Sellers, Art, Gallery, Presets, Knowledge, Users out of the list. `(panel)/page.tsx`: replace the marketplace counts with orders awaiting production, paid orders this month, active keepsake products, published catalog designs; say "failed orders", not "failed Printful orders". `(panel)/orders/page.tsx` line 194 and `keepsake-admin.ts` lines 357 to 359: say "handled by an outside provider (legacy)". `(panel)/finance/page.tsx`: hide the creator earnings table | `keepsake-editor.test.ts` line 835 (sidebar link stays); add a source test listing the sidebar items; `frontend-design-a11y.test.ts` and `e2e/smoke.spec.ts` if they name removed links | Low. Screens only. The Products page still exists until AC-03 but has no link | Restore the sidebar array |
| **AC-03** | Remove the Printful code | Delete: `(panel)/products/*`, `app/actions/printful-admin.ts`, `lib/fulfillment/PrintfulProvider.ts`, `lib/fulfillment/types.ts`, `lib/services/CatalogSyncService.ts`, `api/webhooks/fulfillment/printful/route.ts`, `src/config/catalog.ts`, `app/actions/catalog.ts`, `public/mockups/printful/`, the scripts in 4.2, the `db:seed` script line. Move `lib/fulfillment/getActiveProducts.ts` to `lib/studio/` and drop its provider-cost fallback. Edit `lib/inngest.ts` per 4.3 (remove the Printful client, variant lookup, print-master lookup and the two steps; keep `renderAndStorePrintMaster` importable elsewhere). Narrow `webhookLease.ts`. Remove the two names from `env.ts`, `.env.example`, `ci.yml`. Reword `print/types.ts` comment and the `/artists` sentence | Delete or rewrite: `commerce-ledger-webhooks.test.ts` T-107, T-206, the Printful half of R-104, the `PRODUCT_CATALOG` and `getCatalogProducts` cases near lines 3219 and 3272, the Printful provider stub near line 386. `calligraphy-ai-inngest.test.ts` T-203/T-400/T-409: keep the personalization half, replace part D with "a non-in-house item fails the order", and move the 4500 × 5400 render check into `print-master-fonts.test.ts`. `keepsake-fulfillment.test.ts`: drop the `printfulClient` stub; keep the assertion that the order goes to production. `qa-audit-verification.test.ts` lines 1079 to 1166 (client modules and file list). `admin-sign-in-wiring.test.ts` line 865 | Medium. `inngest.ts` is the paid-order path. The review must run the fulfilment tests on a Mac | Revert the commit. No data changes |
| **AC-04** | Remove the Printful image host | `lib/security/headers.ts` image source; `next.config.ts` `remotePatterns` | `runtime-csp-ratelimit.test.ts` line 479; `security-auth.test.ts` line 811 | Low, after the two counts in 4.5 are zero | Put the host back |
| **AC-05** | New products default to in-house | `prisma/schema.prisma` default; new migration `0005_fulfillment_mode_default` (one `ALTER COLUMN ... SET DEFAULT`). Mark `FulfillmentProviderRecord`, `ProviderVariant`, `PrintArea`, `ProductMockup`, `Order.externalFulfillmentId` as legacy in comments | Schema test if one pins the default | Low. Additive. The founder runs the migration | A migration that sets the default back |

Order: AC-01, AC-02, AC-03, then AC-04 and AC-05 in either order. AC-01 can ship alone today.

If the founder accepts decision D-1 before AC-02 starts, AC-02 also takes `/artists` and `/licensing` out of the footer (`components/layout/Footer.tsx`) and redirects both to `/business-partners` in `next.config.ts`. Otherwise AC-02 leaves them alone.

If the custom-order work has taken migration number `0005` first, AC-05 takes the next free number.

### 8.2 Needs a founder decision first

| ID | Task | Depends on | Size |
| --- | --- | --- | --- |
| AC-06 | Creator marketplace: remove the paused screens and `creator-studio.ts`, the `/studio` creator dashboard, `components/creator/*`, device-trust helpers and `DEVICE_TRUST_SECRET`; decide `/artists` and `/licensing` | D-1 | One cycle. Payment-side creator code stays |
| AC-07 | AI features: remove `api/personalization/*`, `api/backgrounds/generate`, `lib/ai/*`, `services/personalization/*`, `BackgroundGenerationService`, `BackgroundRouteService`, the Presets admin, and the Studio panels that call them; remove `generatePersonalizationJob` from `inngest.ts` | D-3 | Two cycles. Touches the Studio |
| AC-08 | Gallery: remove admin Gallery, `components/gallery/*`, `api/checkout/gallery`, `api/admin/gallery/*`, `app/actions/gallery.ts`, the gallery branch in `CheckoutService.ts` and `pricing/quote.ts`, gallery scripts, `public/gallery` | D-2 | One cycle, with a security-first review because checkout changes |
| AC-09 | Admin Studio as a brush-text tool: no product step, no quote, no cart | D-5 | Two cycles |
| AC-10 | Digital downloads: remove the service, route, tokens, links and the `order/paid` job | D-4 | One cycle |
| AC-11 | Optional database clean-up. `ProviderVariant` CANNOT be dropped while code reads it: `src/lib/pricing/quote.ts` (provider cost per item), `src/lib/services/CheckoutService.ts`, `src/app/actions/cart.ts` and `src/app/checkout/checkoutLoader.ts` all include `providerVariants`, so every cart and checkout query would fail. `FulfillmentProviderRecord` cannot be dropped before it, because `ProviderVariant` points at it. `ProductMockup` is read by the Studio product list and the checkout page loader. Order of work: first a reviewed code change that removes those reads without changing any price, then zero-row counts, then the drop. `PrintArea` has no reader left | AC-03, AC-09, the reads removed in a security-reviewed step, zero-row counts, founder approval | One migration. Never the order, payment, ledger or earnings tables |

## 9. Founder decisions

| ID | Decision | Recommendation |
| --- | --- | --- |
| D-1 | Creator marketplace: remove the paused screens, or keep them paused? And the public `/artists` and `/licensing` pages, which are live and in the footer? | Remove the paused screens (AC-06). Take `/artists` and `/licensing` out of the footer and redirect them to `/business-partners` now, in AC-02, because they describe a service that is not offered. Keep the payment-side creator code |
| D-2 | Gallery: remove, or keep hidden? | Keep hidden for now. Remove after the custom-order checkout is built, so checkout is changed once |
| D-3 | AI meaning and AI backgrounds: remove, or keep for later? | Keep hidden now. They cost money per call and nothing customer-facing uses them. Decide after the first orders whether the keepsake editor should get AI backgrounds; if not, remove (AC-07) |
| D-4 | Digital downloads: keep? | Keep. They cost nothing while unused, and a paid "digital proof file" is a plausible product later |
| D-5 | Admin Studio: keep as it is, or cut it down to a brush-text tool? | Keep as it is until the brush-text feature for keepsakes is specified. Then cut it down (AC-09) |
| D-6 | Hidden pages: reachable by typing the address, or a 404? | Reachable. They are read-only or harmless, and they sit behind the admin sign-in |
| D-7 | Users page: hide until customer accounts exist? | Yes |

## 10. Checks

### 10.1 What cannot be verified here

- `next build`, and whether removed routes leave broken type references.
- Anything in a browser.
- Row counts in the database (section 4.5). The founder runs the two queries.
- The test files that need Mac binaries (`resvg`, `sharp`, the Prisma engine): `commerce-ledger-webhooks`, `calligraphy-ai-inngest`, `print-master-fonts`, `qa-audit-verification`, `runtime-csp-ratelimit`, `security-auth`, `checkout-cart-studio`. Most of AC-03's test edits are in these. `npm test` on the founder's Mac is the real check.
- Whether Vercel has stored Printful values. If it has, they can be deleted after AC-03.

### 10.2 Hand test after each task

| After | Founder does |
| --- | --- |
| AC-01 | `npm test`, then `npm run launch:check`: the Printful lines are gone from "missing". Push; the preview builds |
| AC-02 | Sign in at `/adm/admin/login`. Sidebar shows eight items. Dashboard numbers make sense. Open Orders, Catalog, Fonts, Keepsake Editor, Calligraphy, Admin Studio, Finance. Type `/adm/admin/sellers`: it still opens |
| AC-03 | `npm test` on the Mac. `/adm/admin/products` gives the ordinary 404. Open Admin Studio: products still list, brush text still renders. Fonts page loads. Keepsake Editor exports. When Stripe test keys exist: place one test order and see it move to "In production" with a confirmation email |
| AC-04 | Storefront images still load. Browser console shows no blocked image |
| AC-05 | Run the migration. Catalog page still lists the keepsake products |

## 11. Packages

Remove nothing now. This is what each phase would leave unused.

| After | Would be unused | Note |
| --- | --- | --- |
| Today, before any task | `@stripe/stripe-js`, `motion`, `@types/fabric` (no import found in `src`); `pngjs` and `satori` (scripts and tests only) | `satori` must not go until `@shuding/opentype.js` is added directly (section 5.1). `@prisma/client` sits under `devDependencies`, which is unusual for a package the site needs at run time; the build works, so leave it and review separately |
| AC-03 (Printful) | Nothing | Printful was called with plain `fetch`; it has no package |
| AC-07 (AI) | `openai`, `@google/genai`, `@fal-ai/client` | Three packages |
| AC-09 if the Studio canvas were removed (not proposed) | `fabric`, `@types/fabric` | Kept: the Studio uses it |
| AC-10 (digital downloads) | Nothing | `@vercel/blob` is still used by fonts, uploads and print masters |

**`npm audit` (31 findings):** unknown. `package-lock.json` does not say which packages the findings are in, and no audit could be run here. Removing the three AI packages and their dependencies may remove some. Run `npm audit` on the Mac before and after AC-07 and compare; do not run `npm audit fix --force`.

## Founder go-ahead (2026-11-25)

The founder approved steps 1 to 3 (AC-01, AC-02, AC-03) with "yes, 1-3". He was shown the seven decisions with a recommendation each and asked to proceed on them; the recommendations are used where a step needs one (D-6 hidden pages stay reachable by address; D-7 Users hidden). D-1 to D-5 are not acted on in these three steps. Branch: `feat/admin-cleanup`.

## As built: AC-01, AC-02, AC-03 (2026-11-25)

Not yet reviewed. Nothing here has run in a browser, a build or against a database.

| Task | What was done |
| --- | --- |
| AC-01 | The two provider settings left `env.ts` (required list and schema) and the `launch-readiness` list. A test now proves the live site starts without them and still refuses to start without each setting the business uses |
| AC-02 | Sidebar: Dashboard, Orders, Catalog, Keepsake Editor, Fonts, Calligraphy, Admin Studio, Finance. Dashboard: orders awaiting production, paid orders this month, active keepsake products, published catalog designs, failed orders, recent orders. Orders and the fulfilment action say "handled by an outside provider (legacy)". Finance lists the ledger only. Sellers, Art, Gallery, Presets, Knowledge and Users keep their pages and their guard |
| AC-03 | Removed: the Products page, `printful-admin.ts`, `PrintfulProvider.ts`, `fulfillment/types.ts`, `CatalogSyncService.ts`, the provider webhook route, `config/catalog.ts`, `actions/catalog.ts`, `public/mockups/printful/` and ten scripts. `getActiveProducts.ts` moved to `src/lib/studio/` without its provider-cost fallback. The two names left `.env.example` and CI. `db:seed` left `package.json` |

**The paid-order job now.** Every physical item must be in-house. If one is not (any mode other than exactly `IN_HOUSE`, or a product that cannot be read), the job marks the order `FAILED`, logs one fixed sentence with the order id and a count, and fails without retry. Nothing is confirmed or started for that order, including its in-house items. The Orders page shows it as FAILED, and it can be moved by hand from there. Digital items (no product and no variant) are left to the `order/paid` job.

**Differences from the plan.**

| Plan | As built | Why |
| --- | --- | --- |
| AC-01 marks the two `.env.example` lines "legacy" and AC-03 removes them | Removed once, in AC-03, together with the CI values | One change per file |
| AC-03 list of scripts to remove | Also removed `disable-hardcoded.ts` and `disable-no-mockups.ts` | Each switches off every product without a provider mapping or a mockup, which is every keepsake product |
| `seed-catalog.ts` removed after moving preset seeding | Removed as is | `prisma/seed-presets.ts` already seeds the presets; `create-admin.ts` creates the ADMIN role |
| `app/actions/fonts.ts` removed as dead code | Left | It belongs to the font library, which stays |
| Image host removed (AC-04) | Not done | AC-04 needs the two database counts in section 4.5 first |
| Default of `fulfillmentMode` (AC-05) | Not changed | Needs a migration. Legacy tables and the order's provider id are marked in schema comments only |

**Removed files are parked, not deleted.** They sit in `_to_delete/` with a `.removed` suffix (Git ignores the folder and sees the originals as deleted). On your computer: `rm -rf _to_delete`.

**One thing to do outside the code.** `scripts/fetch-printful-mockups.ts` and `scripts/test-printful.js` both held the same real provider key written into the file. It is in the Git history (commit `fabb491`) and has been pushed. Revoke that key in the provider's dashboard.

## After the review (2026-11-25)

The independent review is `docs/ADMIN_CLEANUP_REVIEW.md`: no Blocker, one High (the provider key above, an action outside the code), two Medium, six Low. What changed afterwards:

| Finding | What was done |
| --- | --- |
| AC-M1 a paid order could end FAILED | Stopped before payment. `assertPhysicalItemsMadeInHouse` in `CheckoutService.ts` refuses the cart, direct and gallery checkouts with "One item in your cart is not available right now" (409) when a physical item's product is not exactly `IN_HOUSE`; both add-to-cart actions refuse such a product too. The rule is in `src/lib/catalog/fulfilmentMode.ts`. It is a validation only: no price, total, ledger, earnings, order-creation or signature code changed. The paid-order job keeps its fail-loudly rule as the last line of defence |
| AC-M1, the admin signal | The dashboard shows an alert at the top, "N paid orders need attention", linking to `Orders?filter=attention`. The Orders page shows the reason under such an order |
| AC-L2 legacy orders stay in the counts | The alert and the "awaiting production" number leave out any order that carries an outside provider's order id |
| AC-M2 wrong "unused" comment | The schema comment on `ProviderVariant` now says it is still read by pricing, checkout and the cart and must not be dropped; the comment on `ProductMockup` names both readers. AC-11 above was rewritten. Schema change: comments only |
| AC-L1 moving a FAILED order was one click | The form shows a required confirmation box for such an order, and the action refuses the move without it. `Order` has no notes field, so no reason is stored |
| AC-L3 digital items | Kept the new behaviour. The old job sent every item that was not in-house, digital items included, to the provider step, which threw for an item with no provider variant: a print-on-demand accident, not a rule. Digital-only orders are no longer counted as "awaiting production" |
| AC-L4 | `renderAndStorePrintMaster` has no caller left in `src/`; it is kept on purpose for calligraphy (it renders and stores the 4500 × 5400 print master). `api/print-master` and the digital download service call `generatePrintMasterPng`. The test comment was corrected |
| Hidden page without its own guard | `background-presets/new/page.tsx` now calls `requireAdmin()` like the other admin pages |
| AC-L5, AC-L6 | Left: already scheduled (AC-04) or cosmetic |

Still to do from AC-M1: AC-05 (make `IN_HOUSE` the column default), which needs a migration the founder runs.
