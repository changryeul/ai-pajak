-- Resync of 20260410000003_company_shareholder.sql
-- Migration history shows applied, but the table itself is missing on prod
-- (verified 2026-06-03 via PostgREST PGRST205 schema-cache miss).
-- Original definition is already idempotent (CREATE TABLE IF NOT EXISTS,
-- CREATE INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF
-- EXISTS). Only the CREATE POLICY statements need guarding:

-- Phase 5: Company shareholder table
-- Tracks shareholders of the customer's company for dividend tax treatment
-- (captured from Articles of Incorporation initially — OCR to be added later)

CREATE TABLE IF NOT EXISTS company_shareholder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

  -- Basic identity
  name VARCHAR(255) NOT NULL,
  is_entity BOOLEAN NOT NULL DEFAULT TRUE,  -- TRUE = corporate shareholder, FALSE = individual
  npwp VARCHAR(20),                          -- for Indonesian entities/individuals
  nik VARCHAR(20),                           -- for Indonesian individuals (KTP number)

  -- Residency and nationality
  country_code VARCHAR(2) NOT NULL DEFAULT 'ID', -- ISO 3166-1 alpha-2
  is_resident BOOLEAN NOT NULL DEFAULT TRUE,

  -- Shareholding details
  shareholding_pct NUMERIC(5,2) NOT NULL,
  capital_amount NUMERIC(18,2),              -- paid-up capital contributed (IDR)
  share_class VARCHAR(50),                    -- 'COMMON', 'PREFERRED', etc.
  is_beneficial_owner BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE if nominee
  is_voting_rights BOOLEAN NOT NULL DEFAULT TRUE,

  -- Director/commissioner flags (additional role info)
  is_director BOOLEAN NOT NULL DEFAULT FALSE,
  is_commissioner BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timeline
  joined_date DATE,        -- date became a shareholder
  exited_date DATE,        -- date ceased (NULL if active)

  -- Optional linkage to counterparty registry (if this shareholder is also a vendor/client)
  counterparty_id UUID REFERENCES tax_counterparty(id) ON DELETE SET NULL,

  -- Source tracking (manual / OCR / etc.)
  source VARCHAR(30) NOT NULL DEFAULT 'MANUAL', -- 'MANUAL', 'AKTA_OCR', 'API_IMPORT'
  source_document_url TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT shareholder_pct_range CHECK (shareholding_pct >= 0 AND shareholding_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_shareholder_customer ON company_shareholder(customer_id);
CREATE INDEX IF NOT EXISTS idx_shareholder_active ON company_shareholder(customer_id) WHERE exited_date IS NULL;

-- RLS
ALTER TABLE company_shareholder ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block platform admin from shareholder data" ON company_shareholder; CREATE POLICY "Block platform admin from shareholder data" ON company_shareholder FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'PLATFORM_ADMIN' AND is_active = TRUE
  ));

DROP POLICY IF EXISTS "Customers view own shareholders" ON company_shareholder; CREATE POLICY "Customers view own shareholders" ON company_shareholder FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Customers manage own shareholders" ON company_shareholder; CREATE POLICY "Customers manage own shareholders" ON company_shareholder FOR ALL TO authenticated
  USING (
    customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "JTC view assigned shareholders" ON company_shareholder; CREATE POLICY "JTC view assigned shareholders" ON company_shareholder FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM customer_consultant cc
      JOIN consultant c ON c.id = cc.consultant_id
      WHERE c.user_id = auth.uid() AND cc.is_active = TRUE
    )
  );

-- Trigger to update updated_at on change
CREATE OR REPLACE FUNCTION update_shareholder_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shareholder_updated_at ON company_shareholder;
CREATE TRIGGER trg_shareholder_updated_at
  BEFORE UPDATE ON company_shareholder
  FOR EACH ROW
  EXECUTE FUNCTION update_shareholder_updated_at();

COMMENT ON TABLE company_shareholder IS 'Shareholders of customer companies — captured from Akta Pendirian or manual entry, used for dividend PPh treatment';
COMMENT ON COLUMN company_shareholder.shareholding_pct IS 'Ownership % — drives DTA 25% threshold for non-resident dividends';
COMMENT ON COLUMN company_shareholder.is_beneficial_owner IS 'FALSE if nominee/intermediary — beneficial owner status required for treaty benefits';
