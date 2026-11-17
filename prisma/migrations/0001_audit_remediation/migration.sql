-- DropForeignKey
ALTER TABLE "Cart" DROP CONSTRAINT "Cart_userId_fkey";

-- DropForeignKey
ALTER TABLE "PriceQuote" DROP CONSTRAINT "PriceQuote_cartId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_buyerId_fkey";

-- DropIndex
DROP INDEX "GeneratedDesign_phraseKnowledgeId_stylePackId_rendererVersi_idx";

-- AlterTable
ALTER TABLE "Font" ADD COLUMN     "commercialApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "familyName" TEXT,
ADD COLUMN     "licenseType" TEXT,
ADD COLUMN     "licenseUrl" TEXT,
ADD COLUMN     "licenseVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "licenseVerifiedBy" TEXT,
ADD COLUMN     "printExportAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "supportedScripts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "enabled" SET DEFAULT false;

-- AlterTable (non-destructive rename + widen to BIGINT per INV-006 / T-206)
ALTER TABLE "GalleryItem" RENAME COLUMN "listedPriceCents" TO "listedPriceMinor";
ALTER TABLE "GalleryItem" ALTER COLUMN "listedPriceMinor" TYPE BIGINT USING "listedPriceMinor"::BIGINT;

-- AlterTable (INV-014 private user uploads by default)
ALTER TABLE "Asset" ADD COLUMN     "anonymousSessionId" TEXT,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "LicenseGrant" ALTER COLUMN "buyerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PersonalizationSession" ADD COLUMN     "anonymousSessionId" TEXT;

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "anonymousSessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "placement" TEXT NOT NULL DEFAULT 'front';

-- AlterTable
ALTER TABLE "PriceQuote" ADD COLUMN     "creatorRoyaltyMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillmentCostMinor" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "platformMinor" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "cartId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "anonymousSessionId" TEXT,
ADD COLUMN     "buyerEmail" TEXT,
ADD COLUMN     "externalFulfillmentId" TEXT,
ADD COLUMN     "shippingAddressJson" JSONB,
ADD COLUMN     "stripeCheckoutSessionId" TEXT,
ALTER COLUMN "buyerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "galleryItemId" TEXT,
ADD COLUMN     "licenseOfferId" TEXT;

-- AlterTable
ALTER TABLE "GeneratedDesign" ADD COLUMN     "script" TEXT NOT NULL DEFAULT 'LATIN';

-- AlterTable
ALTER TABLE "DeviceVerification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Font_slug_key" ON "Font"("slug");

-- CreateIndex
CREATE INDEX "PersonalizationSession_anonymousSessionId_idx" ON "PersonalizationSession"("anonymousSessionId");

-- CreateIndex
CREATE INDEX "Cart_anonymousSessionId_status_idx" ON "Cart"("anonymousSessionId", "status");

-- CreateIndex
CREATE INDEX "PriceQuote_orderId_idx" ON "PriceQuote"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalFulfillmentId_key" ON "Order"("externalFulfillmentId");

-- CreateIndex
CREATE INDEX "Order_anonymousSessionId_idx" ON "Order"("anonymousSessionId");

-- CreateIndex (TB-CALLI-010 deterministic cache key)
CREATE UNIQUE INDEX "GeneratedDesign_phraseKnowledgeId_stylePackId_rendererVersi_key" ON "GeneratedDesign"("phraseKnowledgeId", "stylePackId", "rendererVersion", "script");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_designVersionId_fkey" FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_personalizationVersionId_fkey" FOREIGN KEY ("personalizationVersionId") REFERENCES "PersonalizationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_licenseOfferId_fkey" FOREIGN KEY ("licenseOfferId") REFERENCES "LicenseOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- INV-009: Deferred DB constraint trigger enforcing double-entry zero-sum per LedgerTransaction
CREATE OR REPLACE FUNCTION check_ledger_transaction_balanced()
RETURNS TRIGGER AS $$
DECLARE
  tx_id TEXT;
  net_sum BIGINT;
  posting_count INT;
BEGIN
  tx_id := COALESCE(NEW."transactionId", OLD."transactionId");
  SELECT COALESCE(SUM("amountMinor"), 0), COUNT(*)
    INTO net_sum, posting_count
    FROM "LedgerPosting"
   WHERE "transactionId" = tx_id;

  IF posting_count > 0 AND net_sum <> 0 THEN
    RAISE EXCEPTION 'INV-009 violation: LedgerTransaction % postings sum to % (must equal 0)', tx_id, net_sum;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER enforce_ledger_transaction_zero_sum
AFTER INSERT OR UPDATE OR DELETE ON "LedgerPosting"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_ledger_transaction_balanced();
