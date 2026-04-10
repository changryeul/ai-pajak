-- Phase 2: Extend tax_counterparty with withholding-specific fields
-- Supports: DTA documents (COR/DGT), shareholder info, beneficial ownership, reinvestment tracking

-- Add withholding-specific columns to tax_counterparty
ALTER TABLE tax_counterparty
  -- DTA documents (Certificate of Residence / Domicile, DGT Form 1/2)
  ADD COLUMN IF NOT EXISTS cor_document_url TEXT,
  ADD COLUMN IF NOT EXISTS cor_valid_from DATE,
  ADD COLUMN IF NOT EXISTS cor_valid_until DATE,
  ADD COLUMN IF NOT EXISTS dgt_form_type VARCHAR(10), -- 'DGT_1' | 'DGT_2' | NULL
  ADD COLUMN IF NOT EXISTS dgt_form_url TEXT,
  ADD COLUMN IF NOT EXISTS dgt_form_valid_until DATE,
  -- Shareholder / beneficial ownership
  ADD COLUMN IF NOT EXISTS is_shareholder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shareholding_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_beneficial_owner BOOLEAN NOT NULL DEFAULT FALSE,
  -- Dividend reinvestment tracking (PMK 18/2021)
  ADD COLUMN IF NOT EXISTS receives_reinvested_dividend BOOLEAN NOT NULL DEFAULT FALSE,
  -- Entity flag: corporate vs individual (important for UU HPP 7/2021 dividend exemption)
  ADD COLUMN IF NOT EXISTS is_entity BOOLEAN NOT NULL DEFAULT TRUE;

-- Add check constraint for shareholding %
ALTER TABLE tax_counterparty
  ADD CONSTRAINT tax_counterparty_shareholding_pct_range
  CHECK (shareholding_pct IS NULL OR (shareholding_pct >= 0 AND shareholding_pct <= 100));

-- Index on is_shareholder for quick shareholder lookups
CREATE INDEX IF NOT EXISTS idx_tax_counterparty_shareholder
  ON tax_counterparty(customer_id, is_shareholder)
  WHERE is_shareholder = TRUE;

-- Index on DGT form expiry for expiring-soon alerts
CREATE INDEX IF NOT EXISTS idx_tax_counterparty_dgt_expiry
  ON tax_counterparty(dgt_form_valid_until)
  WHERE dgt_form_valid_until IS NOT NULL;

COMMENT ON COLUMN tax_counterparty.cor_document_url IS 'Certificate of Residence document URL (for non-resident DTA claims)';
COMMENT ON COLUMN tax_counterparty.dgt_form_type IS 'DGT Form 1 (for individual) or DGT Form 2 (for entity), required for Indonesia DTA relief';
COMMENT ON COLUMN tax_counterparty.is_shareholder IS 'TRUE if this counterparty is a shareholder of the customer (relevant for dividend PPh treatment)';
COMMENT ON COLUMN tax_counterparty.shareholding_pct IS 'Shareholding % — used for DTA beneficial ownership tests (>=25% often gets lower treaty rate)';
COMMENT ON COLUMN tax_counterparty.is_beneficial_owner IS 'TRUE if counterparty is the beneficial owner (not a nominee) — required for treaty benefits';
COMMENT ON COLUMN tax_counterparty.receives_reinvested_dividend IS 'TRUE if dividends to this party are domestically reinvested per PMK 18/2021 (individual exemption)';
COMMENT ON COLUMN tax_counterparty.is_entity IS 'TRUE if counterparty is a legal entity (PT/CV/etc), FALSE if individual person — affects UU HPP 7/2021 dividend exemption';
