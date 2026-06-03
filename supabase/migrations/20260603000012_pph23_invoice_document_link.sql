-- Phase 5: explicit invoice photo link for wholesale rows (and migrate
-- manual-entry later). Replaces the implicit customer+period+type linkage
-- with a precise per-transaction FK.
--
-- Wholesale xlsx import previously bypassed photo capture entirely; this
-- column lets the operator attach (optional) photo evidence row-by-row
-- post-import. Manual entry still uses the implicit /api/documents/upload
-- path — a follow-up will migrate it to this same column.

ALTER TABLE pph23_transaction
  ADD COLUMN IF NOT EXISTS invoice_document_id UUID
    REFERENCES document(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pph23_invoice_document
  ON pph23_transaction(invoice_document_id)
  WHERE invoice_document_id IS NOT NULL;

-- Add the explicit audit action so audit_log filtering by this action
-- returns real rows (instead of falling back to TAX_CALCULATION and
-- hiding the original action inside activity_details.action).
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'PPH23_INVOICE_ATTACH';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
