# THI BÚT — SYSTEM ARCHITECTURE & PRODUCT SPECIFICATION
### Version 0.1 — Production Baseline

---

# PART 1: PRODUCT FOUNDATION & BUSINESS CONCEPT

## 1. WHAT IS THI BÚT?
**Thi Bút** is an AI-powered creative marketplace that transforms words, names, quotes, personal stories, and creator artwork into personalized Asian-inspired visual designs that can be purchased digitally or printed on physical products.

The name **Thi Bút** combines:
- **Thi / 詩** — poetry
- **Bút / 筆** — pen, brush, artistic writing

### Brand Positioning
> **THI BÚT: Words Become Art.** *(Consumer Tagline: "Wear Your Story.")*

Positioned as: **An AI personalization studio and creator marketplace for culturally inspired typography, calligraphy, artwork, and merchandise.**

---

## 2. THE THI BÚT FORMULA & PARTICIPANTS

### The Core Transaction:
> **CREATOR ARTWORK + THI BÚT PERSONALIZATION + PRODUCT = UNIQUE CUSTOMER PRODUCT**

### Participant Roles:
1. **Buyer:** Inputs names/quotes/stories, selects creator artwork, picks languages & calligraphy styles, previews, and purchases physical/digital items.
2. **Creator / Seller:** Uploads original artwork, sets license prices, defines personalization permissions, enables supported products, and earns royalties.
3. **Thi Bút Platform:** Provides AI cultural intelligence, calligraphy rendering, product mockups, licensing infrastructure, Stripe payment processing, POD fulfillment, and order/creator ledger management.

---

## 3. MARKETPLACE PRINCIPLES & SELLER MODEL

### 3.1 One Artwork = One Design Listing
Thi Bút does NOT count each physical product variant as a separate seller listing. 
Enabling 10 shirt colors, 8 sizes, and 5 product categories on a single artwork still consumes **1 Active Design Listing**. This prevents marketplace spam while encouraging product variety.

### 3.2 Seller Pricing & License Types
Creators dictate the value of their artwork license (e.g., $1.99, $4.99, $14.99). Thi Bút controls platform fees, AI fees, and product margins separately.

#### MVP License Types:
- **Personal Product License:** For physical products purchased by an individual. No resale rights.
- **Personal Digital License:** For downloading the personalized artwork for personal use.
- **Commercial License (Post-MVP):** Defined business usage rights.

### 3.3 Visual Presentation Principles ("Art First → Product Second → Person Optional")
To ensure scalable consistency, avoid the AI-fashion catalog uncanny valley, and reinforce that "Words Become Art":
- **The 80/20 Rule**: 80% of all platform imagery (gallery, search, cards) must be **product-only** (folded apparel, flat lays, mannequins, framed posters, tattoo stencils). Only 20% should be lifestyle/human imagery (used deliberately for campaigns).
- **Hero Entity**: The core design/calligraphy is the hero. Customers select the artwork first, then choose its physical manifestation (product).
- **Reusability**: A single piece of generated artwork must be clean and reusable across multiple product mockups without requiring regeneration of the artwork itself.

---

## 4. CREATOR PERMISSION MATRIX & BUYER CREATION MODES

### 4.1 Permission Matrix (Granular Control)
Creators explicitly toggle allowed AI/customer interactions:
- Add name / quote / date / seal
- Translate customer text
- Change composition / background / colors / crop
- AI restyle artwork / Generate derivatives
- Commercial use / Model training *(Defaults to NO)*

### 4.2 Buyer Creation Modes
1. **MY NAME:** Cultural & phonetic representations (transliteration vs. translation vs. semantic interpretation).
2. **MY QUOTE:** Literal, Natural, or Poetic translations.
3. **MY STORY:** AI extracts core emotional themes (perseverance, family) and proposes short poetic concepts.
4. **CREATOR ART:** Merges customer personalization directly with seller artwork.

---

## 5. LANGUAGE, STYLE, & COMPOSITION ENGINES

- **Languages:** Vietnamese (Thư pháp), Japanese (Kanji/Hiragana/Katakana), Chinese (Simplified/Traditional), Korean (Hangul), English (Asian brush-inspired styles). *Language and visual art style remain separate settings.*
- **Style Packs:** Thi Bút Classic, Shodō, Ink, Zen, Seal, Modern, Luxury, Street, Minimal.
- **Composition Engine (Layouts):** Auto-proposes base templates (Vertical, Centered, Signature, Statement, Seal, Back Print, Left Chest, Sleeve).

### 5.2 The User Composition Editor & Print Safety
The COMPOSE flow allows users to overlay generated, deterministic artwork onto placeholder backgrounds or personal image uploads.
- **Linguistic Integrity**: The image AI model is NEVER used to redraw or "re-style" text into an uploaded photo. Text is generated once as a transparent SVG/PNG, and then manipulated (scaled, rotated, colored) as an immutable layer.
- **Safe Print Area**: The frontend editor must enforce physical product bounds. If a composition layer exceeds the printable region, a warning must be displayed.
- **State Storage**: User compositions are saved to the database as deterministic `UserComposition` JSON layers. This allows users to return later to edit their work.

---

# PART 2: SYSTEM ARCHITECTURE & DATABASE SPECIFICATION

## 6. ARCHITECTURAL PRINCIPLES & INVARIANTS

### Critical Invariants (Must NEVER be violated):
- **INV-001:** Original artwork is immutable. Never overwrite uploaded source files; create derivatives.
- **INV-002:** Published design count determines listing quota. Product variants do not.
- **INV-003:** Every purchased order references an immutable design/personalization version snapshot.
- **INV-004:** Every purchased license contains an immutable license terms snapshot.
- **INV-005:** No creator royalty is recalculated from live marketplace pricing after checkout.
- **INV-006:** Client-provided prices are NEVER authoritative.
- **INV-007:** External webhooks MUST be idempotent (deduplicated by `externalEventId`).
- **INV-008:** Every creator transfer maps to specific creator earnings.
- **INV-009:** Double-entry ledger transactions MUST balance to zero (`SUM(amountMinor) = 0`).
- **INV-010:** AI model-training permission defaults to `FALSE`.
- **INV-011:** Language meaning MUST be displayed separately from visual calligraphy.
- **INV-012:** Personalization cannot exceed creator policy permissions.
- **INV-013:** Print Masters must be deterministically rendered from Composition JSON data + high-res assets; NEVER from browser DOM screenshots.
- **INV-014:** User uploaded imagery is strictly PRIVATE + PERSONAL USE ONLY by default.

---

## 7. HIGH-LEVEL SYSTEM DIAGRAM

```text
                        ┌────────────────────┐
                        │      CUSTOMER      │
                        └─────────┬──────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │      NEXT.JS WEB APP     │
                    │                          │
                    │ Marketplace              │
                    │ Creator Studio           │
                    │ Personalization Lab      │
                    │ Checkout / Account       │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │     APPLICATION SERVICES     │
                  ├──────────────────────────────┤
                  │ Identity | Creator | Design  │
                  │ Cultural AI | Personalize    │
                  │ Catalog | Pricing | Orders   │
                  │ Licensing | Payments | POD   │
                  │ Ledger | Moderation          │
                  └───────┬─────────┬────────────┘
                          │         │
              ┌───────────┘         └──────────────┐
              ▼                                    ▼
     ┌───────────────────┐               ┌──────────────────┐
     │  POSTGRESQL       │               │   OBJECT STORAGE │
     │                   │               │                  │
     │ Prisma ORM        │               │ Originals        │
     │ Marketplace       │               │ Derivatives      │
     │ Double-Entry      │               │ Mockups          │
     │ Ledger & Orders   │               │ Print Masters    │
     └─────────┬─────────┘               └──────────────────┘
               │
               ▼
     ┌──────────────────────┐
     │ BACKGROUND JOB LAYER │
     │ (BullMQ / Worker)    │
     │                      │
     │ Translation          │
     │ Generation           │
     │ Print Rendering      │
     │ Webhook Processing   │
     └───────┬──────────────┘
             │
      ┌──────┼───────────────┐
      ▼      ▼               ▼
     AI    Stripe         Fulfillment
  Providers Connect        Providers

  8. STRIPE CONNECT & FINANCIAL LEDGER ARCHITECTURE8.1 Separate Charges and TransfersTo support multi-creator carts, checkout uses Stripe's Separate Charges and Transfers model:PlaintextCustomer Payment ($34.99)
       ↓
Thi Bút Platform Clearing
       ├── Creator A Royalty ($5.00)  ──► Creator Payable Account
       ├── AI Personalization ($3.00) ──► Platform AI Revenue
       └── Product + Print ($26.99)   ──► Platform Product Revenue
8.2 Internal Double-Entry LedgerThi Bút maintains its own accounting truth in PostgreSQL:LedgerAccount (PLATFORM_CASH, CREATOR_PAYABLE, AI_REVENUE, FULFILLMENT_PAYABLE, etc.)LedgerTransactionLedgerPosting (SUM(amountMinor) = 0)9. CORE PRISMA SCHEMA SKELETONCode snippetdatasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  CLOSED
  PENDING
}

enum CreatorStatus {
  DRAFT
  ONBOARDING
  ACTIVE
  RESTRICTED
  SUSPENDED
}

enum DesignStatus {
  DRAFT
  REVIEW
  PUBLISHED
  PAUSED
  REJECTED
  ARCHIVED
  TAKEDOWN
}

enum Visibility {
  PRIVATE
  UNLISTED
  PUBLIC
}

enum AssetType {
  ORIGINAL
  WORKING
  CUTOUT
  THUMBNAIL
  PREVIEW
  MOCKUP
  PRINT_MASTER
  SOURCE_VECTOR
}

enum LicenseType {
  PERSONAL_PRODUCT
  PERSONAL_DIGITAL
  COMMERCIAL
  EXTENDED_COMMERCIAL
  EXCLUSIVE
}

enum PersonalizationMode {
  NAME
  QUOTE
  STORY
  CREATOR_ART
}

enum PersonalizationStatus {
  DRAFT
  ANALYZING
  READY_FOR_STYLE
  GENERATING
  READY
  SELECTED
  CHECKED_OUT
  EXPIRED
  FAILED
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  PROCESSING
  PARTIALLY_FULFILLED
  FULFILLED
  COMPLETED
  CANCELLED
  REFUNDED
}

enum CreatorEarningStatus {
  PENDING
  ELIGIBLE
  TRANSFERRED
  REVERSED
  HELD
}

model User {
  id        String     @id @default(uuid())
  email     String     @unique
  name      String?
  status    UserStatus @default(ACTIVE)

  roles     UserRole[]
  creator   CreatorProfile?

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Role {
  id    String     @id @default(uuid())
  code  String     @unique
  name  String
  users UserRole[]
}

model UserRole {
  userId    String
  roleId    String
  user      User     @relation(fields: [userId], references: [id])
  role      Role     @relation(fields: [roleId], references: [id])
  createdAt DateTime @default(now())

  @@id([userId, roleId])
}

model CreatorProfile {
  id               String        @id @default(uuid())
  userId           String        @unique
  user             User          @relation(fields: [userId], references: [id])
  slug             String        @unique
  displayName      String
  stripeAccountId  String?       @unique
  status           CreatorStatus @default(DRAFT)

  designs          Design[]
  earnings         CreatorEarning[]

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
}

model Design {
  id          String        @id @default(uuid())
  creatorId   String
  creator     CreatorProfile @relation(fields: [creatorId], references: [id])
  slug        String        @unique
  title       String
  description String?
  status      DesignStatus  @default(DRAFT)
  visibility  Visibility    @default(PRIVATE)

  versions    DesignVersion[]
  licenses    LicenseOffer[]

  publishedAt DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([creatorId, status])
  @@index([status, visibility, publishedAt])
}

model DesignVersion {
  id            String               @id @default(uuid())
  designId      String
  design        Design               @relation(fields: [designId], references: [id])
  versionNumber Int
  assets        DesignVersionAsset[]
  createdAt     DateTime             @default(now())

  @@unique([designId, versionNumber])
}

model Asset {
  id           String               @id @default(uuid())
  objectKey    String               @unique
  mimeType     String
  sha256       String
  width        Int?
  height       Int?
  createdAt    DateTime             @default(now())
  designAssets DesignVersionAsset[]

  @@index([sha256])
}

model DesignVersionAsset {
  id              String        @id @default(uuid())
  designVersionId String
  designVersion   DesignVersion @relation(fields: [designVersionId], references: [id])
  assetId         String
  asset           Asset         @relation(fields: [assetId], references: [id])
  type            AssetType

  @@unique([designVersionId, assetId, type])
}

model LicenseOffer {
  id         String      @id @default(uuid())
  designId   String
  design     Design      @relation(fields: [designId], references: [id])
  type       LicenseType
  priceMinor BigInt
  currency   String
  active     Boolean     @default(true)
  createdAt  DateTime    @default(now())
}

model PersonalizationSession {
  id              String                @id @default(uuid())
  userId          String
  designId        String
  designVersionId String
  mode            PersonalizationMode
  inputText       String
  inputLanguage   String?
  targetLanguage  String?
  status          PersonalizationStatus

  interpretations Interpretation[]

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
}

model Interpretation {
  id           String                 @id @default(uuid())
  sessionId    String
  session      PersonalizationSession @relation(fields: [sessionId], references: [id])
  type         String
  language     String
  text         String
  romanization String?
  meaning      String?
  confidence   Float?
  createdAt    DateTime               @default(now())
}

model Order {
  id            String      @id @default(uuid())
  orderNumber   String      @unique
  buyerId       String
  currency      String
  status        OrderStatus
  subtotalMinor BigInt
  shippingMinor BigInt
  taxMinor      BigInt
  totalMinor    BigInt

  items         OrderItem[]

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model OrderItem {
  id                          String   @id @default(uuid())
  orderId                     String
  order                       Order    @relation(fields: [orderId], references: [id])
  creatorId                   String
  designId                    String
  designVersionId             String
  personalizationVersionId    String?
  quantity                    Int
  artworkRevenueMinor         BigInt
  personalizationRevenueMinor BigInt
  productRevenueMinor         BigInt
  creatorRoyaltyMinor         BigInt
  platformRevenueMinor        BigInt
  totalMinor                  BigInt
  createdAt                   DateTime @default(now())
}

model CreatorEarning {
  id              String               @id @default(uuid())
  creatorId       String
  creator         CreatorProfile       @relation(fields: [creatorId], references: [id])
  orderItemId     String
  netCreatorMinor BigInt
  currency        String
  status          CreatorEarningStatus
  eligibleAt      DateTime?
  createdAt       DateTime             @default(now())
}

model WebhookEvent {
  id              String    @id @default(uuid())
  provider        String
  externalEventId String
  eventType       String
  payloadJson     Json
  status          String
  receivedAt      DateTime  @default(now())
  processedAt     DateTime?

  @@unique([provider, externalEventId])
}
10. TECHNICAL CONVENTIONS & BOUNDARIES10.1 Money & Database StorageMoney: Store as BIGINT (amountMinor) + currency (VARCHAR 3). Example: $19.99 = 1999 USD.  Soft Deletes: Use archivedAt or status. Never hard-delete financial or legal records.  Print-Master Generation: Generated at 4500x5400 px @ 300 DPI transparent PNG from DesignVersion + PersonalizationVersion + ProductVariant + PrintArea via background worker jobs.  10.2 Next.js Project StructurePlaintextapp/
├── (marketing)/       # Marketplace & Creator Landing
├── create/            # Personalization Lab ([sessionId])
├── studio/            # Creator Studio (Designs, Earnings, Licensing)
├── account/ | cart/ | checkout/ | orders/
└── api/               # API Boundary routes & Webhooks
11. AI DEVELOPMENT AGENT RULESWhen executing tasks on this repository, the AI Agent MUST follow these rules:Determine bounded context ownership before adding features.  Extend existing entities (Design, CreatorEarning, Ledger). Do NOT invent duplicate parallel concepts like ArtworkListing or SellerPayment.  Ensure all checkout transactions produce immutable snapshots (DesignVersion, LicenseGrant, OrderItemSnapshot).  Keep provider implementation behind abstractions (AIProvider, FulfillmentProvider).  Ensure every external webhook route logs to WebhookEvent and enforces idempotency.  
---

