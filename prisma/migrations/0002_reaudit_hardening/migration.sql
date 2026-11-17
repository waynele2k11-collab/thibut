-- Round-2 Audit Remediation: Font webEmbedAllowed, WebhookEvent lease attempts/updatedAt, and append-only Ledger triggers (R-104, R-107, R-204)

-- AlterTable: Font.webEmbedAllowed
ALTER TABLE "Font" ADD COLUMN "webEmbedAllowed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: WebhookEvent lease & retry tracking (R-104)
ALTER TABLE "WebhookEvent"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "WebhookEvent_provider_status_updatedAt_idx"
  ON "WebhookEvent"("provider", "status", "updatedAt");

-- R-204 & INV-009: Enforce strict append-only immutability on LedgerTransaction and LedgerPosting
CREATE OR REPLACE FUNCTION forbid_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger immutability violation (R-204 / INV-009): % on % is strictly prohibited; post a reversing LedgerTransaction instead', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_ledger_posting_append_only
BEFORE UPDATE OR DELETE ON "LedgerPosting"
FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TRIGGER enforce_ledger_transaction_append_only
BEFORE UPDATE OR DELETE ON "LedgerTransaction"
FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
