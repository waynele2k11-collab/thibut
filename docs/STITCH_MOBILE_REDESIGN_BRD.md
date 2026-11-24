# Thi Bút — Business Requirements: Mobile-First UI/UX Redesign (Google Stitch)

| | |
|:---|:---|
| **Status** | Draft v1 for review |
| **Date** | 2026-11-23 |
| **Audited build** | branch `fix/audit-remediation` (working tree), run locally |
| **Design tool** | Google Stitch — new screens extend the existing project in `/stitch_thi_b_t_system_architecture/` |
| **Design system** | `DESIGN.md` v0.2 remains authoritative for tokens; this document adds the mobile rules it lacks |

---

## 1. Purpose

Thi Bút sells personalized calligraphy (digital masters and print-on-demand products). The buying journey is
**Home → Studio (`/create`) → Cart → Checkout → Orders**, with the Gallery as a second entry point.

The current UI was designed desktop-first and then made responsive. It does not break on a phone, but the
phone experience is a compressed desktop layout rather than a designed one. This document states what the
business needs from a mobile-first redesign and gives Stitch a screen-by-screen brief.

**The redesign succeeds when a first-time visitor on a phone can go from the home page to a paid order with
one thumb, always seeing their artwork and the price.**

## 2. How the audit was done

- Walked the customer routes at **375 × 812** in a real browser: `/`, `/create` (all three steps), `/gallery`,
  one gallery detail page, `/cart`, `/checkout`, `/orders`, `/auth/login`, and the navigation drawer.
- Measured on each page: horizontal overflow, page height, interactive elements smaller than 44 × 44 px,
  and text rendered below 12 px.
- Read the layout code for the same routes plus `/studio` (creator dashboard).

**Not covered** — treat these as open until checked:

- Cart, checkout and orders **with items in them** (only empty states were seen live; populated layouts were read in code only).
- The signed-in creator dashboard `/studio` (requires an account; code only).
- All `/admin/*` screens (out of scope, see §4).
- Real devices, iOS Safari toolbar behaviour, landscape, and screen readers.

## 3. Audit findings

### 3.1 What already works (keep)

- No horizontal overflow on any page tested at 375 px.
- Design tokens are applied consistently; the paper-and-ink identity carries to mobile.
- Navigation drawer is a proper modal with focus return, and closes on route change.
- Studio has a sticky price bar with safe-area padding and a sticky mini-preview ribbon.
- Empty states (cart, checkout, orders) are clear and offer a next step.

### 3.2 Problems, by business impact

| # | Finding | Evidence | Impact |
|:--|:---|:---|:---|
| F1 | **Artwork is hidden while the customer edits it.** In Studio steps 1 and 2 the canvas is collapsed to a 48 px thumbnail; the full stage only appears on step 3 or after tapping "Canvas", which then pushes the controls off screen. | `StudioWorkspace.tsx` (`mobileCanvasExpanded`), live at 375 px | Customers pick a font, ink and seal without seeing the result. This is the core value of the product. |
| F2 | **Artwork did not render on the product mockup** in the mobile session — step 3 showed a blank black tee. The console logged Content-Security-Policy blocks on `data:` and `blob:` fetches at the same time; that is the likely cause but was not confirmed. | Step 3 screenshot; console errors | If reproducible in production, the customer is asked to pay for a product they cannot preview. **Engineering fix, prerequisite to design sign-off.** |
| F3 | **Studio steps are long scrolls.** Page height at 375 px: step 1 ≈ 1,170 px, step 2 ≈ 2,080 px, step 3 ≈ 1,520 px. Step 2 stacks typeface, expression, layout, ink, seal and background in one column. | Measured | High effort before purchase; controls far from the preview. |
| F4 | **Tap targets below 44 px on the purchase path.** Cart icon 36 × 36, menu 40 × 40, Save 36 high, suggestion and seal chips 36 high, canvas toolbar buttons 36 × 36, seal toggle 44 × 24, "Inc. License" 79 × 15, "Skip to Buy" 84 × 17, "All (9)" 51 × 15. Home page: 16 of 36 controls under size. Footer links are 12 px high. | Measured | Mis-taps on the controls that lead to checkout. |
| F5 | **Text below 12 px** in dense areas: 12 elements on Studio step 1, 27 on step 2, 15 on step 3. Hard-coded `text-[10px]`/`[11px]` also appear in cart, checkout, orders and success pages. | Measured + code scan | Prices, licence terms and option labels are hard to read; also breaks `DESIGN.md` rule 2 (token type pairs only). |
| F6 | **Home hero hides the product.** The first screen shows headline, input, CTA and four trust lines; the artwork preview starts below the fold and is cut off. The style tabs wrap to two rows with a pause button floating beside them. | Live at 375 px | The visitor is asked to type before seeing what they get. |
| F7 | **Gallery is slow to browse.** One card per row, each about 800 px tall with two full-width buttons; four items produce a 3,550 px page. Filter chips scroll sideways with no cue that more exist. | Measured | Few designs seen per session; filters go undiscovered. |
| F8 | **Internal wording leaks into customer copy.** Titles read `"Có Chí Thì Nên" in VIETNAMESE THU PHAP`; detail page shows "ORIGINAL Edition", "Pigment: black", "Alignment: VERTICAL + Seal", "Print calibration — Offset X: -5px". A product blank is named "Digital Download (All 6)" with the description "A high-quality blank garment" and a t-shirt photo. | Gallery card, detail page, Studio step 3 | Reads as unfinished; undermines the "quiet luxury" positioning. |
| F9 | **Gallery detail cannot be bought from.** Colour and size both say "Available at checkout"; the Buy button scrolls away with the page. | Detail page | Customer commits before knowing the variant; no persistent CTA. |
| F10 | **Size chip text is clipped** on Studio step 3 ("4500×540…" cut off inside a fixed-width chip). | Step 3 screenshot | Looks broken at the moment of purchase. |
| F11 | **Account entry is creator-branded.** "My Account" opens a card titled "Creator Studio — access your studio dashboard". Buyers have no account home; orders live in a "browser session archive". | Drawer → `/auth/login` | Buyers do not know whether signing in is for them. |
| F12 | **No mobile navigation pattern beyond the drawer.** Search, Orders and Account icons are hidden below `md`; only Cart and the menu remain. | `Header.tsx` | Repeat customers need two taps to reach orders. |
| F13 | **Creator dashboard uses a 760 px-wide table** that scrolls sideways on phones. | `studio/page.tsx:255` (code only) | Creators cannot manage designs comfortably on mobile, though Stitch already has `artist_dashboard_mobile`. |
| F14 | **Fixed pixel offsets tie the layout to the header height** (`top-[57px]`, `100dvh-57px`). | `StudioWorkspace.tsx` | Any header change breaks the sticky ribbon; needs a layout token. |

## 4. Scope

**In scope (customer-facing, phone first, then tablet and desktop):**

1. Global shell — header, navigation, footer
2. Home `/`
3. Studio `/create` and `/create/[sessionId]` — highest priority
4. Gallery `/gallery` and `/gallery/[slug]`
5. Cart `/cart`
6. Checkout `/checkout` and `/checkout/success`
7. Orders and downloads `/orders`
8. Sign in / account `/auth/*`
9. Creator dashboard `/studio` (mobile layout only)
10. Content pages: tradition landing pages, how-it-works, cultural guide, about, support, legal

**Out of scope:**

- `/admin/*` — stays desktop-only.
- Pricing, licensing rules, checkout logic, print pipeline, fonts catalogue.
- New features. Stitch screens with no route today (artist onboarding, certificates, shipment tracking, licence tiers) are not part of this redesign.
- Brand identity: palette, typefaces and the flat paper-and-ink style do not change.

## 5. Business objectives and success measures

Baselines are not known from this audit — analytics must supply them before launch.

| Objective | Measure | Target |
|:---|:---|:---|
| More phone visitors start creating | Home → Studio start rate (mobile) | Improve on baseline; set after 2 weeks of measurement |
| More creations reach the cart | Studio start → add-to-cart (mobile) | Mobile within 10 % of desktop rate |
| Fewer abandoned checkouts | Cart → paid (mobile) | Mobile within 10 % of desktop rate |
| Gallery drives sales | Gallery view → "Buy" or "Make it yours" tap | Improve on baseline |
| Usable by everyone | WCAG 2.2 AA on in-scope screens | 0 blocking issues |
| Fast on phones | LCP on 4G mid-range device, Home and Studio | ≤ 2.5 s |

## 6. Users

| Persona | Device context | Needs |
|:---|:---|:---|
| **Gift buyer / first-timer** | Phone, arrives from social or search, one-handed | See an example fast, type a name, trust the meaning, pay quickly |
| **Heritage customer** | Phone or tablet, reads the cultural explanation carefully | Confidence the rendering is authentic; readable meaning and romanization |
| **Returning customer** | Phone | Reach orders and downloads in one tap |
| **Creator** | Phone for checking, desktop for uploading | See earnings, quota and design status at a glance |

## 7. Requirements

Priority: **M** = must, **S** = should, **C** = could.

### 7.1 Global mobile rules (apply to every screen)

| ID | Requirement | Pri |
|:---|:---|:--|
| G1 | Design at 375 px first; verify at 320, 390, 430, 768, 1024 and 1280 px. No horizontal page scroll at any width. | M |
| G2 | Every interactive element has a touch area of at least 44 × 44 px with 8 px between adjacent targets. | M |
| G3 | Minimum text size 12 px, used only for `label-caps`. Body text 16 px. Prices and legal terms never below 14 px. No hard-coded pixel font sizes. | M |
| G4 | The primary action of each screen sits in the lower third, within thumb reach, and respects safe-area insets. | M |
| G5 | Text inputs render at 16 px or larger so iOS does not zoom on focus; use the correct keyboard type per field. | M |
| G6 | Nothing depends on hover. Every hover effect has a tap or always-visible equivalent. | M |
| G7 | Sideways-scrolling rows show a visible cue (partial next item or fade edge). | S |
| G8 | Colour contrast meets WCAG AA; focus is visible; motion respects "reduce motion". | M |
| G9 | Customer-facing copy uses plain names, never internal codes or enum values (fixes F8). | M |
| G10 | Loading, empty and error states are designed for every screen, not only the happy path. | M |
| G11 | Sticky elements use shared layout tokens for header and bar heights, not literal pixel values (fixes F14). | S |

### 7.2 Global shell

| ID | Requirement | Pri |
|:---|:---|:--|
| N1 | Compact mobile header: brand mark, cart with count, menu. Height defined as a token. | M |
| N2 | Orders and Account are reachable in one tap from any non-Studio page — either a bottom tab bar (Explore · Create · Gallery · Orders) or persistent header icons. Stitch to propose both; pick one. | M |
| N3 | Inside the Studio the global navigation collapses to a back arrow and cart so the canvas gets the space. | M |
| N4 | Footer links stack as full-width rows at least 44 px high. | S |

### 7.3 Home

| ID | Requirement | Pri |
|:---|:---|:--|
| H1 | The first screen at 375 × 812 shows, without scrolling: a real artwork example, the headline, the text input and the Create button. | M |
| H2 | Typing in the input updates the example artwork live, or the Create button carries the text into the Studio (current behaviour) — the example must at least be visible while typing. | S |
| H3 | Trust signals collapse to a single line or row of three; they must not push the artwork below the fold. | M |
| H4 | Style switcher (Name / Poetry / Heritage) fits one row; auto-rotation has an obvious pause control at 44 px. | S |
| H5 | "Curated themes" and "The process" keep the swipe carousel on phones, with a position indicator. | S |

### 7.4 Studio — highest priority

| ID | Requirement | Pri |
|:---|:---|:--|
| S1 | **The live artwork is always visible while any control is changed.** Canvas pinned in the top ~40–45 % of the screen; controls in a bottom sheet beneath it (fixes F1). | M |
| S2 | The bottom sheet has three heights: peek (step tabs + price + CTA), half (current control group), full (long lists such as fonts). | M |
| S3 | Keep the three steps Meaning → Brush → Product, with visible progress and free movement back. | M |
| S4 | Step 2 is split into sub-tabs inside the sheet — Typeface · Style · Ink · Seal · Background — so no group needs more than one screen of scrolling (fixes F3). | M |
| S5 | Option sets (fonts, ink colours, seals, products, variants) use horizontal swatch carousels with large previews; selection updates the canvas immediately. | M |
| S6 | Canvas supports pinch to scale, drag to move and two-finger rotate; toolbar buttons remain as the accessible alternative at 44 px. | S |
| S7 | A persistent bar shows total price and the single next action. Tapping the price opens the breakdown (artwork, personalization, product, licence) in a sheet. | M |
| S8 | "Skip to buy", "Inc. licence" and "Save" become full-size controls, not inline text links (fixes F4). | M |
| S9 | The cultural meaning (rendered text, romanization, meaning, tradition) is one tap away on every step and never truncated to one line when opened. | M |
| S10 | Product mockup always shows the customer's artwork on the selected product and colour; if it cannot render, show an explicit error and block add-to-cart (fixes F2). | M |
| S11 | Size and variant chips grow to fit their label; no clipped text (fixes F10). | M |
| S12 | Poor ink-on-garment contrast is flagged next to the colour picker with a one-tap fix. | S |
| S13 | Add-to-cart confirmation is a sheet with two choices: Checkout now / Keep creating. | M |
| S14 | A locked session (order already placed) shows a clear read-only state with a "Create a new piece" action. | M |
| S15 | On-screen keyboard must not cover the text field or the preview. | M |

### 7.5 Gallery

| ID | Requirement | Pri |
|:---|:---|:--|
| L1 | Two-column grid on phones with image, short title and price; actions move to the detail page or a long-press/quick-view sheet (fixes F7). | M |
| L2 | Filters: a sticky chip row with scroll cue, plus a "Filter" sheet when there are more than five options. Active filters and result count are visible. | M |
| L3 | Titles use the phrase and a readable tradition name ("Có Chí Thì Nên — Vietnamese Thư Pháp"). | M |
| L4 | Detail page: swipeable image gallery, then title, price, meaning; colour and size are chosen on this page (fixes F9). | M |
| L5 | Detail page has a sticky bottom bar: **Buy as shown** (primary) and **Make it yours** (secondary). | M |
| L6 | Technical print data (offsets, calibration, internal style codes) is removed from the customer view or placed in a collapsed "Details" section in plain language. | M |

### 7.6 Cart, checkout, confirmation

| ID | Requirement | Pri |
|:---|:---|:--|
| C1 | Cart items are cards: artwork thumbnail, phrase, product, variant, price, quantity stepper, remove, and "Edit in Studio". | M |
| C2 | Sticky summary bar with total and Checkout button; full cost breakdown expands above it. | M |
| C3 | Checkout is a single column with at most three clearly labelled sections; order summary collapses to one line with the total. | M |
| C4 | Express payment (Apple Pay / Google Pay) appears first when available. *Assumes Stripe is configured for wallets — confirm with engineering.* | S |
| C5 | The licence snapshot is summarised in two or three plain lines with a "Read full terms" link opening a sheet. | M |
| C6 | Confirmation screen shows the artwork, order number, what happens next, and direct links to download (digital) or track (physical). | M |
| C7 | Form errors appear next to the field, in words, and the page scrolls to the first error. | M |

### 7.7 Orders and account

| ID | Requirement | Pri |
|:---|:---|:--|
| O1 | Orders are a card list: thumbnail, status chip, date, total; tap opens detail with timeline and downloads. | M |
| O2 | Download buttons are full width, state the file type and size, and show progress. | M |
| O3 | Guests see a plain explanation that orders are stored on this device, with a sign-in prompt to keep them. | M |
| O4 | Sign-in screen is neutral ("Sign in to Thi Bút"); creator access is a secondary path, not the title (fixes F11). | M |

### 7.8 Creator dashboard

| ID | Requirement | Pri |
|:---|:---|:--|
| D1 | On phones the design table becomes a card list (thumbnail, title, status, sales, actions menu); no sideways table scroll (fixes F13). | M |
| D2 | Quota and earnings metrics stack as full-width cards at the top. | S |
| D3 | Upload works from the phone's photo library and files, with clear size and format limits. | S |

### 7.9 Content pages

| ID | Requirement | Pri |
|:---|:---|:--|
| P1 | One shared article template: single column, 16 px body, max line length ~65 characters, headings from the type scale. | S |
| P2 | Each tradition landing page ends with a sticky "Create in this style" action that opens the Studio with that tradition preselected. | S |

## 8. Design constraints for Stitch

- **Tokens:** use the `DESIGN.md` colour, type, spacing and radius tokens exactly. Flat design, borders not shadows, maximum 8 px radius, light mode only.
- **Additions needed in `DESIGN.md`** as part of this work: touch-target minimum, bottom-sheet and sticky-bar patterns, bottom-navigation pattern, header-height and bar-height tokens, a 14 px `body-sm` and a 12 px `label-sm` type token to replace hard-coded sizes.
- **Calligraphy fonts** appear only in artwork previews, never in UI text.
- **Icons:** `lucide-react` set.
- **Breakpoints:** phone < 640, tablet 640–1023, desktop ≥ 1024 (the Studio currently switches at 1024).
- **Existing Stitch mobile screens to start from:** `personalization_lab_meaning_mobile`, `personalization_lab_style_mobile`, `personalization_lab_design_preview_mobile`, `explore_art_mobile`, `secure_checkout_mobile`, `artist_dashboard_mobile`.

## 9. Stitch deliverables

For each item, a **375 px** frame and a **1280 px** frame; 768 px where the layout changes.

| # | Screen | States required |
|:--|:---|:---|
| 1 | Header, navigation, footer | Default, drawer or tab bar open, Studio variant |
| 2 | Home | Default, input focused with keyboard |
| 3 | Studio — Meaning | Default, analysing, interpretation chosen, keyboard open |
| 4 | Studio — Brush | One frame per sub-tab; sheet at half and full height |
| 5 | Studio — Product | Physical, digital, contrast warning, mockup error |
| 6 | Studio — overlays | Price breakdown, meaning detail, added-to-cart, locked session |
| 7 | Gallery list | Default, filtered, empty, loading |
| 8 | Gallery detail | Default, variant selected, sold-out/unavailable |
| 9 | Cart | With items, empty |
| 10 | Checkout | Default, field error, payment processing |
| 11 | Confirmation | Digital, physical, payment pending |
| 12 | Orders | List, detail, empty, guest |
| 13 | Sign in / create account | Default, error |
| 14 | Creator dashboard | With designs, empty |
| 15 | Article template | One tradition page |

## 10. Acceptance criteria

1. Every in-scope screen passes G1–G6 and G8 when measured in a browser at 375 px (same checks as this audit: zero overflow, zero targets under 44 px, zero text under 12 px).
2. In the Studio at 375 × 812, the artwork is on screen while each of these is changed: text, tradition, font, ink, seal, background, product, colour, placement.
3. A tester completes Home → Studio → Cart → Checkout on a phone using one hand, without zooming or scrolling sideways.
4. No internal code, enum value or pixel offset appears in customer-facing text.
5. Desktop layouts show no regression against the current Stitch baselines.
6. `DESIGN.md` is updated with the mobile patterns in §8 before build starts.

## 11. Suggested phasing

| Phase | Content | Reason |
|:---|:---|:---|
| 0 | Fix F2 (mockup rendering) and F10 (clipped chips); confirm analytics baselines | Bugs, not design; needed before measuring |
| 1 | Global shell + Studio | Largest effect on conversion |
| 2 | Home + Gallery list and detail | Acquisition and second entry point |
| 3 | Cart, checkout, confirmation, orders, sign-in | Completes the purchase path |
| 4 | Creator dashboard + content pages | Lower traffic |

## 12. Open questions

1. Bottom tab bar or header icons for mobile navigation (N2)?
2. Is a buyer account planned, or do orders stay device-bound with optional sign-in (O3, O4)?
3. Are Apple Pay and Google Pay enabled in Stripe (C4)?
4. Should the Home input preview the customer's own text live (H2), given the rendering cost?
5. Is Vietnamese-language UI in scope? All UI copy audited is English.
6. What are the current mobile conversion baselines (§5)?
