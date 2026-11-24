-- Business Requirements v1.0, Milestone 1: in-house made-to-order keepsake catalog.
-- Additive only: every new column is nullable or has a default, so existing rows are unaffected.

-- AlterTable: CatalogProduct fulfilment mode and configurable double-sided pricing (BRD §09)
ALTER TABLE "CatalogProduct"
  ADD COLUMN "fulfillmentMode" TEXT NOT NULL DEFAULT 'PRINTFUL',
  ADD COLUMN "sidePricing" TEXT NOT NULL DEFAULT 'PLACEMENT_FEE',
  ADD COLUMN "doubleSidedMultiplierBps" INTEGER;

-- AlterTable: Design catalog imagery and concept-render labelling (BRD APR-009)
ALTER TABLE "Design"
  ADD COLUMN "imageKind" TEXT NOT NULL DEFAULT 'CONCEPT_RENDER',
  ADD COLUMN "catalogImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: Order shipment tracking for in-house fulfilment (BRD §10)
ALTER TABLE "Order"
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "trackingCarrier" TEXT;
