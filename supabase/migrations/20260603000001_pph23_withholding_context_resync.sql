-- Resync of 20260410000002_pph23_transaction_withholding_context.sql
-- Migration history shows the original applied, but the columns are missing on
-- prod (verified 2026-06-03 via PostgREST probe — column does not exist error).
-- All ADD COLUMN clauses use IF NOT EXISTS so this is safe to re-run on any
-- environment regardless of state.

ALTER TABLE pph23_transaction
  ADD COLUMN IF NOT EXISTS tax_regime VARCHAR(20),
  ADD COLUMN IF NOT EXISTS income_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS rental_asset_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS interest_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS shareholding_pct_at_time NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_reinvested_domestically BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recipient_is_entity BOOLEAN,
  ADD COLUMN IF NOT EXISTS recipient_country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS treaty_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cor_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dgt_form_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_rule_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolution_legal_basis TEXT,
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS npwp_surcharge_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Add CHECK constraints (idempotent — drop if exists first, since CHECKs lack IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pph23_tax_regime_values') THEN
    ALTER TABLE pph23_transaction
      ADD CONSTRAINT pph23_tax_regime_values CHECK (
        tax_regime IS NULL OR tax_regime IN ('PPH23', 'PPH4_2', 'PPH26', 'PPH_FINAL', 'EXEMPT')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pph23_rental_asset_type_values') THEN
    ALTER TABLE pph23_transaction
      ADD CONSTRAINT pph23_rental_asset_type_values CHECK (
        rental_asset_type IS NULL OR rental_asset_type IN ('BUILDING_LAND', 'MACHINE', 'VEHICLE', 'OTHER')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pph23_interest_source_values') THEN
    ALTER TABLE pph23_transaction
      ADD CONSTRAINT pph23_interest_source_values CHECK (
        interest_source IS NULL OR interest_source IN ('BANK_DEPOSIT', 'LOAN', 'BOND', 'OTHER')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pph23_shareholding_range') THEN
    ALTER TABLE pph23_transaction
      ADD CONSTRAINT pph23_shareholding_range CHECK (
        shareholding_pct_at_time IS NULL OR (shareholding_pct_at_time >= 0 AND shareholding_pct_at_time <= 100)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pph23_tax_regime
  ON pph23_transaction(customer_id, tax_period, tax_regime);

-- Backfill any rows still missing tax_regime
UPDATE pph23_transaction
SET
  tax_regime = CASE
    WHEN service_type = 'SEWA' THEN 'PPH4_2'
    WHEN service_type IN ('DIVIDEN', 'BUNGA', 'ROYALTI', 'HADIAH') THEN 'PPH23'
    ELSE 'PPH23'
  END,
  income_type = COALESCE(income_type, service_type)
WHERE tax_regime IS NULL;
