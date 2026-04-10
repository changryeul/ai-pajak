-- Phase 4: Extend pph23_transaction with withholding context and resolution snapshot
-- Supports: tax regime classification, sub-type income categorization, resolution audit trail

ALTER TABLE pph23_transaction
  -- Tax regime classification (which module applies)
  -- PPH23 | PPH4_2 | PPH26 | PPH_FINAL | EXEMPT
  ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(20),
  -- Income type within the regime (finer granularity than service_type)
  ADD COLUMN IF NOT EXISTS income_type VARCHAR(30),
  -- Sub-type qualifiers (only set when relevant)
  ADD COLUMN IF NOT EXISTS rental_asset_type VARCHAR(20), -- BUILDING_LAND | MACHINE | VEHICLE | OTHER
  ADD COLUMN IF NOT EXISTS interest_source VARCHAR(20),   -- BANK_DEPOSIT | LOAN | BOND | OTHER
  -- Dividend context (when serviceType=DIVIDEN)
  ADD COLUMN IF NOT EXISTS shareholding_pct_at_time NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_reinvested_domestically BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recipient_is_entity BOOLEAN,
  -- Non-resident context
  ADD COLUMN IF NOT EXISTS recipient_country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS treaty_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cor_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dgt_form_verified_at TIMESTAMPTZ,
  -- Resolution snapshot (audit trail — what the engine decided at save time)
  ADD COLUMN IF NOT EXISTS resolution_rule_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolution_legal_basis TEXT,
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS npwp_surcharge_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Constraints
ALTER TABLE pph23_transaction
  ADD CONSTRAINT pph23_tax_regime_values CHECK (
    tax_regime IS NULL OR tax_regime IN ('PPH23', 'PPH4_2', 'PPH26', 'PPH_FINAL', 'EXEMPT')
  );

ALTER TABLE pph23_transaction
  ADD CONSTRAINT pph23_rental_asset_type_values CHECK (
    rental_asset_type IS NULL OR rental_asset_type IN ('BUILDING_LAND', 'MACHINE', 'VEHICLE', 'OTHER')
  );

ALTER TABLE pph23_transaction
  ADD CONSTRAINT pph23_interest_source_values CHECK (
    interest_source IS NULL OR interest_source IN ('BANK_DEPOSIT', 'LOAN', 'BOND', 'OTHER')
  );

ALTER TABLE pph23_transaction
  ADD CONSTRAINT pph23_shareholding_range CHECK (
    shareholding_pct_at_time IS NULL OR (shareholding_pct_at_time >= 0 AND shareholding_pct_at_time <= 100)
  );

-- Index on tax_regime for regime-based queries (e.g., "show me all PPh 4(2) final this month")
CREATE INDEX IF NOT EXISTS idx_pph23_tax_regime
  ON pph23_transaction(customer_id, tax_period, tax_regime);

-- Backfill existing rows with a sensible default (tax_regime='PPH23', income_type derived from service_type)
UPDATE pph23_transaction
SET
  tax_regime = CASE
    WHEN service_type = 'SEWA' THEN 'PPH4_2'
    WHEN service_type IN ('DIVIDEN', 'BUNGA', 'ROYALTI', 'HADIAH') THEN 'PPH23'
    ELSE 'PPH23'
  END,
  income_type = service_type
WHERE tax_regime IS NULL;

COMMENT ON COLUMN pph23_transaction.tax_regime IS 'Resolved tax regime: PPH23 | PPH4_2 | PPH26 | PPH_FINAL | EXEMPT';
COMMENT ON COLUMN pph23_transaction.rental_asset_type IS 'Rental asset sub-type — BUILDING_LAND → PPh 4(2), MACHINE/VEHICLE → PPh 23';
COMMENT ON COLUMN pph23_transaction.interest_source IS 'Interest source — BANK_DEPOSIT → PPh Final 20%, LOAN/BOND → PPh 23 15%';
COMMENT ON COLUMN pph23_transaction.shareholding_pct_at_time IS 'Shareholding % at the time of dividend payment (for DTA 25% threshold)';
COMMENT ON COLUMN pph23_transaction.is_reinvested_domestically IS 'Individual dividend reinvestment exemption (PMK 18/2021)';
COMMENT ON COLUMN pph23_transaction.recipient_is_entity IS 'Recipient legal form — affects UU HPP 7/2021 dividend exemption';
COMMENT ON COLUMN pph23_transaction.resolution_rule_id IS 'Which engine rule decided this (audit trail)';
