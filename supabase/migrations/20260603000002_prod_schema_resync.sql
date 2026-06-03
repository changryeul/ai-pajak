-- Prod schema resync — drift audit 2026-06-03 (followup to 96f4da6).
-- Migration history said these columns were applied but PostgREST probe
-- found them missing. ADD COLUMN IF NOT EXISTS everywhere — safe to re-run.
--
-- Tables affected: 2
-- Columns recovered: 13

-- customer: 2 drifted columns
-- origin: 20260410000004_customer_pph25_election.sql
ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS npwp_pph25_elected BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS npwp_pph25_elected_at DATE;

-- tax_counterparty: 11 drifted columns
-- origin: 20260410000001_counterparty_withholding_fields.sql
ALTER TABLE tax_counterparty
  ADD COLUMN IF NOT EXISTS cor_document_url TEXT,
  ADD COLUMN IF NOT EXISTS cor_valid_from DATE,
  ADD COLUMN IF NOT EXISTS cor_valid_until DATE,
  ADD COLUMN IF NOT EXISTS dgt_form_type VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dgt_form_url TEXT,
  ADD COLUMN IF NOT EXISTS dgt_form_valid_until DATE,
  ADD COLUMN IF NOT EXISTS is_shareholder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shareholding_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_beneficial_owner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receives_reinvested_dividend BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_entity BOOLEAN NOT NULL DEFAULT TRUE;
