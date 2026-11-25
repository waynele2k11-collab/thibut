# Custom Order Plan: Request Form, Admin Panel, Proof Link, Checkout

Dated 2026-11-24. Status: PROPOSAL. Depends on `AUTH_MOVE_PLAN.md` (the admin must be able to sign in).

The founder's request: "UI form > select size, upload image, select verse or add input > the request go to backend admin studio, I create the request design via editor or upload. Request panel page, view, edit pricing, status in progress or done (customer can see status) > set to done > send customer a link to view and checkout."

Decisions on record: the request is free and the customer pays after approving the design (founder). The customer uses a private emailed link, no account (CTO assumption). Nothing physical is made before payment.

## 0. Before writing code

Read under `node_modules/next/dist/docs/01-app/`: `02-guides/forms.md`, `02-guides/server-actions.md`, `02-guides/data-security.md`, `01-getting-started/15-route-handlers.md` (the photo and proof routes), `01-getting-started/07-mutating-data.md`, `02-guides/content-security-policy.md`, `01-getting-started/16-proxy.md`.

## 1. The flow

1. The customer opens `/custom/request`, fills in the form, attaches photos and submits.
2. The site saves the request, stores the photos privately, emails the customer a private link and emails the founder.
3. The founder opens `/admin/requests`, reads the brief, downloads the photos and marks the request **In progress**.
4. The founder composes the proof in `/admin/keepsake-editor` (or elsewhere), downloads the preview and uploads it to the request as proof version 1. He sets the price.
5. He clicks **Send to customer**. The status becomes **Proof ready** and the customer is emailed.
6. The customer opens the private link, sees the proof and the price, and either **approves** or **asks for changes** with a comment.
7. Changes: status **Changes requested**; the founder uploads version 2 and sends again. One round is included (BRD section 09); later rounds are the founder's call.
8. Approved: the page shows the checkout button. The customer pays.
9. Paid: the order enters the existing in-house fulfilment path. The founder prints and makes the piece from the approved version only.
10. Shipped: tracking is entered on the existing orders page; the request shows **Shipped**.

### Statuses

| Status | BRD section 10 stage | Customer sees |
| --- | --- | --- |
| `SUBMITTED` | Order submitted (unpaid, by decision) | "Received" |
| `IN_PROGRESS` | Designing, Internal review | "In progress" |
| `PROOF_READY` | Proof ready | "Ready for your review" with the proof |
| `CHANGES_REQUESTED` | Revision requested | "Changes received, in progress" |
| `APPROVED` | Approved (awaiting payment) | "Approved. Pay to start production" |
| `PAID` | Approved and paid | "Paid" |
| `IN_PRODUCTION` | In production, Quality control | "Being made" |
| `SHIPPED` | Shipped | "Shipped" with tracking |
| `CANCELLED` | (none) | "Cancelled" |

### Transitions

| From | To | By |
| --- | --- | --- |
| `SUBMITTED` | `IN_PROGRESS`, `CANCELLED` | Admin |
| `IN_PROGRESS` | `PROOF_READY` (needs a proof and a price), `CANCELLED` | Admin |
| `PROOF_READY` | `APPROVED`, `CHANGES_REQUESTED` | Customer |
| `PROOF_READY` | `IN_PROGRESS` (withdraw), `CANCELLED` | Admin |
| `CHANGES_REQUESTED` | `PROOF_READY` (needs a NEW proof version), `CANCELLED` | Admin |
| `APPROVED` | `PAID` | Payment webhook only |
| `APPROVED` | `IN_PROGRESS` (reopen; clears the approval), `CANCELLED` | Admin |
| `PAID` | `IN_PRODUCTION` | Fulfilment job |
| `IN_PRODUCTION` | `SHIPPED` | Admin (existing order controls) |

A pure function `canTransition(from, to, actor)` enforces the table in the service, not only in the screens. Every write re-checks the status inside the write (`updateMany` with the expected status).

## 2. Request form (`/custom/request`)

| Field | Rule |
| --- | --- |
| Division and occasion | From `src/lib/catalog/divisions.ts`; required |
| Tier | Custom (acrylic) or Premium Custom (resin); Premium shows "limited" until the founder turns it on |
| Size | Active `CatalogVariant` rows of the chosen product; required |
| Sides | Single or double |
| Names, date | Text, 120 characters each; optional |
| Verse | Pick from the verse list, or type your own (600 characters, line breaks kept, NFC), or none. The list moves from `src/app/verse-library/page.tsx` to `src/lib/catalog/verses.ts` so both pages share it |
| Language | English, Vietnamese, or both |
| Notes | 1,000 characters |
| Photos | 1 to 5; see section 3 |
| Email | Required; phone optional |
| Consent | Two required boxes: photo use only for this order; terms and the pay-after-approval rule. Text from section 9 |

Validation runs on the server with zod; the client mirrors it. The estimated price (base by size, with the side multiplier) is shown as "from", marked not final.

Spam: the repo has no captcha. v1 uses a hidden honeypot field, the existing `enforceDistributedRateLimit` (3 requests per address per hour, 20 per day overall), and a cap on open requests per email (3). If spam appears, add Turnstile (a founder decision; it needs a CSP entry).

After submitting: a page that says the request was received, shows the private link once, and says an email is on its way.

## 3. Photo upload

| Topic | Design |
| --- | --- |
| Path | Browser → server action → `UploadService.uploadImage` → Vercel Blob with `access: "private"` (the pattern already in `src/lib/services/UploadService.ts`) |
| Types | JPEG, PNG, WebP, sniffed by magic bytes (`sniffImageMagicBytes`), never trusted from the file name. TIFF (BRD section 08) is left out of v1 |
| Size | 10 MB each (existing limit), 8,192 px longest side, 5 files, 30 MB per request |
| Re-encoding | `validateAndSanitizeImage` decodes and re-encodes, which drops EXIF, GPS and any embedded payload. **Decision: keep it.** Cost: one generation of quality loss; the service keeps PNG for alpha and uses high-quality WebP otherwise. The developer confirms the output is good enough to print at the largest size, or raises the quality setting |
| Public URLs | None. The Blob URL is stored as an opaque key and never sent to a browser |
| Admin download | `GET /api/admin/requests/[id]/photos/[photoId]`: `assertAdminApi` first, then streams from Blob with `Cache-Control: private, no-store` and `Content-Disposition: attachment` |
| Customer view | The customer link does not show the uploaded photos again; it shows the proof only |
| Storage not configured | The form shows "Photo upload is not available right now" and refuses to submit with files. On a preview without `BLOB_READ_WRITE_TOKEN` the form still loads. `UploadService` already answers 503 in production without storage |
| Retention (proposal) | Photos and proofs: deleted 30 days after `CANCELLED` or after 90 days with no activity in `SUBMITTED`/`PROOF_READY`; 12 months after `SHIPPED`. A "Delete now" button per request. An admin "Delete expired" button; no scheduled job in v1 |
| Deletion | Blob object removed first, then the row; a failed Blob delete leaves the row flagged for retry |

## 4. Private customer link (`/r/[token]`)

| Topic | Design |
| --- | --- |
| Token | 32 random bytes, base64url. Only the SHA-256 hash is stored. Looked up by hash |
| Life | Valid until 30 days after the request closes; a new token is issued (and the old one ends) each time a proof is sent |
| Guessing | 256 bits; lookups rate-limited per address; unknown and expired tokens give the same 404 |
| Leaks | `Referrer-Policy: no-referrer`, `noindex`, `Cache-Control: private, no-store`, no third-party scripts or analytics on the page, the token never logged |
| Page content | Status, the brief the customer wrote, the latest proof, the price, the buttons for the current status |
| Proof image | Served by `GET /r/[token]/proof/[version]` after the token check; private storage; labelled **"Concept preview, not a photograph of the finished piece"** until a product photo exists (APR-009). Double-sided orders show front and back (APR-002) |
| Approve | Records proof version, time and the approver's email (APR-004); the artwork is locked (APR-005) |
| Request changes | Comment, 1,000 characters (APR-003) |
| After approval | Any change by the admin reopens the request and clears the approval (APR-006) |
| History | Earlier versions stay listed on the page (APR-008) |

The link is the customer's key. Anyone holding it can approve and reach checkout, so checkout shows the order summary again, and the email warns not to forward the link.

## 5. Admin panel (`/admin/requests`)

| Screen | Content |
| --- | --- |
| List | Newest first; filter by status; search by email or request number; a count past retention |
| Detail | Brief, verse, photos (download), proofs by version, price, internal notes, activity log, status actions |
| Price | Lines in integer minor units: base (`CatalogVariant.baseRetailMinor`), side surcharge from the existing `resolveSideSurchargeMinor`, extras (label and amount), discount. The total is computed on the server and saved as a snapshot (`quoteJson`, `quotedTotalMinor`). Editing the price after `PROOF_READY` reopens the request |
| Proof | Upload an image through `UploadService` into a `proofs` folder. v1: the founder downloads the preview from the keepsake editor and uploads it here. A direct hand-off would need the editor to post its preview to a guarded route and to open with a request id; left for Phase 3 because the editor is browser-only by design |
| Send | Requires a proof and a price; issues a new link token; emails the customer; writes an event |
| Log | `DesignRequestEvent` rows: who, what, when; no photo data, no token |

Every page calls `requireAdmin()` first; every action calls it too and checks the origin.

## 6. Checkout hand-off (Phase 2)

The existing path prices from the catalog at checkout time (`calculateItemQuote`). A custom order has a fixed, agreed price, so it needs its own entry that reuses everything after pricing.

| Step | Detail |
| --- | --- |
| Entry | A server action on `/r/[token]`: checks the token, status `APPROVED`, and an approved proof version |
| New function | `executeDesignRequestCheckout` in `src/lib/services/CheckoutService.ts`, modelled on `executeDirectCheckout`. It reads `quotedTotalMinor` and `quoteJson` from the database. **No amount comes from the browser** |
| Design rows | `ensurePlatformCreator` and `ensureDesignAndVersion` (both exist) create a `PRIVATE` design for the request so `OrderItem` keeps its required links. No `PersonalizationSession` is created |
| Order | One `Order` (`PENDING_PAYMENT`) and one `OrderItem` with `productRevenueMinor` = quoted total, artwork, personalization and royalty 0, `catalogVariantId` from the request, and an `OrderItemSnapshot` holding the quote and the approved proof version |
| Shipping, tax | `calculateFlatShippingMinor` and the existing `STRIPE_TAX_ENABLED` switch, as for other orders |
| Stripe | `createStripeCheckoutSessionWithIdempotency` (exists) with metadata `designRequestId` |
| Idempotency | `DesignRequest.orderId` is unique. A second click returns the open session for the same order (the pattern in `tryFindReusableDirectOrder`) |
| Stripe not set | `assertStripeConfigured` already answers "Payment service is not configured"; the page then says "Payment is not open yet. We will email you" |
| On payment | In the paid-effects step (`executeDeliverOrderPaidEffects` in `src/lib/inngest.ts`; the developer confirms the exact place against the webhook route): if the order has a design request, set it to `PAID` and write an event. `executeOrderFulfillmentJob` already moves `IN_HOUSE` items to `IN_PRODUCTION`; mirror that on the request |
| Price integrity test | A test changes the variant price after approval and asserts the charge equals the snapshot |

Deposit switch (not built): a nullable `depositMinor` and `depositOrderId` on the request are enough to add a deposit later without a second migration.

## 7. Data model

Migration `0005_design_requests` (after `0004_admin_sign_in`). Additive only.

```prisma
enum DesignRequestStatus {
  SUBMITTED
  IN_PROGRESS
  PROOF_READY
  CHANGES_REQUESTED
  APPROVED
  PAID
  IN_PRODUCTION
  SHIPPED
  CANCELLED
}

model DesignRequest {
  id               String              @id @default(uuid())
  requestNumber    String              @unique            // "TBR-…"
  status           DesignRequestStatus @default(SUBMITTED)
  email            String
  phone            String?
  division         String
  occasion         String
  tier             String                                 // "CUSTOM" | "PREMIUM_CUSTOM"
  catalogVariantId String
  catalogVariant   CatalogVariant      @relation(fields: [catalogVariantId], references: [id])
  sides            String                                 // "single" | "double"
  names            String?
  eventDate        String?
  verseId          String?
  verseText        String?
  language         String
  notes            String?
  consentPhotoUse  Boolean
  consentTermsAt   DateTime
  linkTokenHash    String              @unique
  linkExpiresAt    DateTime?
  quoteJson        Json?
  quotedTotalMinor BigInt?
  currency         String              @default("USD")
  approvedProofId  String?             @unique
  approvedAt       DateTime?
  approvedByEmail  String?
  depositMinor     BigInt?
  orderId          String?             @unique
  order            Order?              @relation(fields: [orderId], references: [id])
  internalNotes    String?
  photos           DesignRequestPhoto[]
  proofs           DesignProof[]
  events           DesignRequestEvent[]
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  closedAt         DateTime?

  @@index([status, createdAt])
  @@index([email])
}

model DesignRequestPhoto {
  id        String        @id @default(uuid())
  requestId String
  request   DesignRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  objectKey String
  mimeType  String
  sha256    String
  width     Int
  height    Int
  sizeBytes Int
  deletedAt DateTime?
  createdAt DateTime      @default(now())

  @@index([requestId])
}

model DesignProof {
  id         String        @id @default(uuid())
  requestId  String
  request    DesignRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  version    Int
  side       String        @default("front")              // "front" | "back"
  objectKey  String
  mimeType   String
  sha256     String
  imageKind  String        @default("CONCEPT_RENDER")     // or "PRODUCT_PHOTO"
  sentAt     DateTime?
  createdAt  DateTime      @default(now())

  @@unique([requestId, version, side])
}

model DesignRequestEvent {
  id        String        @id @default(uuid())
  requestId String
  request   DesignRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  actor     String                                        // "ADMIN" | "CUSTOMER" | "SYSTEM"
  type      String
  detail    Json?
  createdAt DateTime      @default(now())

  @@index([requestId, createdAt])
}
```

`Order` and `CatalogVariant` gain back-relations only. No column is changed or dropped.

## 8. Emails

Added to `src/lib/email.ts` in its existing style (zod-checked input, from "Thi Bút <hello@thibut.com>"; without `RESEND_API_KEY` the email is logged as skipped with the request number only, never the link).

| Email | To | When |
| --- | --- | --- |
| Request received, with the private link | Customer | On submit |
| New request | Founder (`ADMIN_EMAIL`) | On submit |
| Proof ready, with a fresh link | Customer | On "Send to customer" |
| Changes received | Founder | Customer asks for changes |
| Approved | Founder | Customer approves |
| Payment received | Customer and founder | Phase 2, existing confirmation email |

Without Resend the customer never gets the link by email. The confirmation page shows it once, and the admin panel can copy a fresh link to send by hand.

## 9. Text the founder or counsel must supply

| Text | Used |
| --- | --- |
| Photo consent: used only for this order, not for marketing, deleted after the stated period | Form checkbox |
| Retention periods (section 3 proposes them) | Privacy page |
| Pay-after-approval, what approval means, no change after approval without a new approval | Form checkbox and the approve button |
| Revision rounds (BRD proposes one included) and what extra rounds cost | Form and proof page |
| Refund, cancellation and remake rules | Terms; checkout page |
| "Concept preview" wording | Proof page (APR-009) |
| Rights: the customer confirms they may use the photos, logos and words they send | Form checkbox |

## 10. Phases and tasks

**Phase 1: request to approved proof.** Needs: the sign-in move, Vercel Blob, Resend.

| ID | Task | Depends on |
| --- | --- | --- |
| CO-01 | Pure modules and tests: transitions, quote lines, token, retention, form schema, verse list | — |
| CO-02 | Migration `0005_design_requests` | AM-02 |
| CO-03 | Request form, server action, photo upload, confirmation page | CO-01, CO-02, Blob |
| CO-04 | Customer link page: status, proof, approve, request changes | CO-02 |
| CO-05 | Admin list and detail, price, proof upload, send, notes, log, photo download route | AM-03, CO-02 |
| CO-06 | Emails; retention and delete | Resend |
| CO-R1 | Security-first review | CO-01 to CO-06 |

**Phase 2: checkout.** Needs: Stripe test keys, then live keys.

| ID | Task |
| --- | --- |
| CO-07 | `executeDesignRequestCheckout`, paid hook, status mirror, price-integrity tests |
| CO-08 | Checkout button and states on the link page |
| CO-R2 | Review, with a full test-mode order by the founder |

**Phase 3: later.** Editor hand-off, deposit switch, customer accounts (option A in the sign-in plan), TIFF, Turnstile if needed.

### Founder steps

| Phase | Outside set-up | Decisions |
| --- | --- | --- |
| 1 | Vercel Blob store on the project; Resend domain for thibut.com | Retention periods; consent and terms text; rounds included; Premium tier on or off |
| 2 | Stripe account for Thi Bút; test keys, webhook secret; later live keys | Refund and cancellation rules; shipping prices; tax on or off |

### Threats

| Threat | Control |
| --- | --- |
| Hostile file upload | Magic-byte sniff, decode and re-encode, size and count caps, private storage, download as attachment |
| Photo exposure | No public URLs; admin-guarded stream; no photos on the customer page; retention and delete |
| Link theft or guessing | 256-bit token, hash stored, rotation on send, no referrer, no cache, rate limit |
| Price tampering | Total from the server snapshot only; price-integrity test |
| Approval forgery or replay | Token check, status re-checked in the write, version recorded |
| Spam and storage abuse | Honeypot, rate limits, per-email cap, total-size cap |
| Stored text in admin screens | Rendered as text only; no HTML from requests |
| Production before approval | Print files are made only from the approved version; a changed proof clears the approval |

### Tests

Transitions for every pair and actor; quote arithmetic including the 1.6× side rule; token hash, expiry and rotation; form limits and NFC; upload refusals (wrong type, too large, too many, storage missing); guards on every admin page, action and route (source test); customer actions refused with a wrong, expired or rotated token; approval records version, time and email; price-integrity; idempotent checkout.

Cannot be verified here: anything in a browser, real Blob uploads and downloads, real emails, Stripe, `next build`, and the migration against Postgres.

## Founder decisions after the proposal (2026-11-24)

| Decision | Detail | By |
| --- | --- | --- |
| Payment order | The customer pays after approving the design. Nothing physical is made before payment | Founder |
| Design deposit | An admin setting, not a code constant: on or off, and the percentage. Default: off, 10%. The founder asked for "a setting to turn on/off and change the %" | Founder |
| Deposit rules | Percentage of the chosen size's price including the side or tier uplift; whole percent from 1 to 50; credited toward the order; not refundable once a design has been sent, fully refundable if no design is delivered. The rate and the amount are copied onto the request when it is submitted, so a later change to the setting never alters an existing request. Deposit and balance are computed on the server. The form shows the deposit and the rule before the customer submits | CTO, from the founder's "10%" |
| Where the setting lives | A single-row settings table edited on an admin page, with every change written to the activity log. It is built with the checkout phase (Phase 2), because a deposit needs Stripe. While Stripe is not configured the switch cannot be turned on | CTO |
| Customer view | Private link by email, no account. The founder was asked and did not answer | CTO (assumption, founder told) |
