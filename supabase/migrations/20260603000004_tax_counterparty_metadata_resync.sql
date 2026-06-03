-- Audit followup (2026-06-03): origin 20260410000001 lost not only columns
-- (recovered in 352f498) but also the CHECK constraint + 2 indexes + 7
-- COMMENTs that accompany them. Columns are functional; this brings back the
-- catalog metadata + query-plan hints + the shareholding range check.

-- CHECK constraint (idempotent via pg_constraint probe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_counterparty_shareholding_pct_range') THEN
    ALTER TABLE tax_counterparty
      ADD CONSTRAINT tax_counterparty_shareholding_pct_range
      CHECK (shareholding_pct IS NULL OR (shareholding_pct >= 0 AND shareholding_pct <= 100));
  END IF;
END $$;

-- Indexes (CREATE INDEX IF NOT EXISTS is native idempotent)
CREATE INDEX IF NOT EXISTS idx_tax_counterparty_shareholder
  ON tax_counterparty(customer_id, is_shareholder)
  WHERE is_shareholder = TRUE;

CREATE INDEX IF NOT EXISTS idx_tax_counterparty_dgt_expiry
  ON tax_counterparty(dgt_form_valid_until)
  WHERE dgt_form_valid_until IS NOT NULL;

-- Column comments (COMMENT ON is always replace)
COMMENT ON COLUMN tax_counterparty.cor_document_url IS 'Certificate of Residence document URL (for non-resident DTA claims)';
COMMENT ON COLUMN tax_counterparty.dgt_form_type IS 'DGT Form 1 (for individual) or DGT Form 2 (for entity), required for Indonesia DTA relief';
COMMENT ON COLUMN tax_counterparty.is_shareholder IS 'TRUE if this counterparty is a shareholder of the customer (relevant for dividend PPh treatment)';
COMMENT ON COLUMN tax_counterparty.shareholding_pct IS 'Shareholding % — used for DTA beneficial ownership tests (>=25% often gets lower treaty rate)';
COMMENT ON COLUMN tax_counterparty.is_beneficial_owner IS 'TRUE if counterparty is the beneficial owner (not a nominee) — required for treaty benefits';
COMMENT ON COLUMN tax_counterparty.receives_reinvested_dividend IS 'TRUE if dividends to this party are domestically reinvested per PMK 18/2021 (individual exemption)';
COMMENT ON COLUMN tax_counterparty.is_entity IS 'TRUE if counterparty is a legal entity (PT/CV/etc), FALSE if individual person — affects UU HPP 7/2021 dividend exemption';
