-- Income snapshots + funding-source questionnaire
-- Phase: PR3 Batch 2 (T-002 asset-growth anomaly + T-003 funding-source survey).
--
-- Why both at once: the anomaly check needs both asset totals (PR3 Batch 1,
-- already landed) and annual income, and the funding-source survey only
-- makes sense when an anomaly fires. Shipping the underlying data together
-- keeps the migration pair that produced the warning and the audit of the
-- user's explanation adjacent in the history.

-- ============================================================================
-- ENUM: income source
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE income_source AS ENUM (
    'EMPLOYMENT',    -- 급여 / gaji
    'BUSINESS',      -- 사업 / usaha
    'INVESTMENT',    -- 투자 / investasi
    'RENTAL',        -- 임대 / sewa
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE funding_source_kind AS ENUM (
    'SALARY',        -- 급여소득
    'BUSINESS',      -- 사업소득
    'INVESTMENT',    -- 투자수익
    'LOAN',          -- 차입금
    'INHERITANCE',   -- 증여/상속
    'OTHER'          -- 기타
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: income_snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS income_snapshot (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  snapshot_year  INT  NOT NULL CHECK (snapshot_year BETWEEN 2000 AND 2100),
  source         income_source NOT NULL,

  gross_income_idr NUMERIC(18, 2) NOT NULL CHECK (gross_income_idr >= 0),
  withheld_idr     NUMERIC(18, 2) CHECK (withheld_idr IS NULL OR withheld_idr >= 0),

  -- Optional origin hint so the user knows where a row came from
  -- ('A1' when populated from a 1721-A1 OCR; 'MANUAL' when hand-entered).
  origin         TEXT,
  label          TEXT,
  notes          TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_snapshot_customer_year
  ON income_snapshot(customer_id, snapshot_year DESC);

COMMENT ON TABLE income_snapshot IS
  'Annual gross income per source. Feeds T-002 asset-growth anomaly check (compare vs asset_snapshot growth) and 1770 prefill.';

DROP TRIGGER IF EXISTS trg_income_snapshot_touch ON income_snapshot;
CREATE TRIGGER trg_income_snapshot_touch
  BEFORE UPDATE ON income_snapshot
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

ALTER TABLE income_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY income_snapshot_customer_read   ON income_snapshot
  FOR SELECT USING (customer_id = get_customer_id());
CREATE POLICY income_snapshot_customer_write  ON income_snapshot
  FOR INSERT WITH CHECK (customer_id = get_customer_id());
CREATE POLICY income_snapshot_customer_update ON income_snapshot
  FOR UPDATE USING (customer_id = get_customer_id())
              WITH CHECK (customer_id = get_customer_id());
CREATE POLICY income_snapshot_customer_delete ON income_snapshot
  FOR DELETE USING (customer_id = get_customer_id());
CREATE POLICY income_snapshot_consultant_read ON income_snapshot
  FOR SELECT USING (is_jtc_consultant());

-- ============================================================================
-- TABLE: customer_funding_source
-- ============================================================================
--
-- Records the user's explanation when an asset-growth anomaly is flagged.
-- One row per (customer, year). Sources is an array so multi-select works.
-- Preserved for tax-review; never auto-deleted.

CREATE TABLE IF NOT EXISTS customer_funding_source (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  snapshot_year  INT  NOT NULL CHECK (snapshot_year BETWEEN 2000 AND 2100),

  sources        funding_source_kind[] NOT NULL DEFAULT '{}',
  note           TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (customer_id, snapshot_year)
);

COMMENT ON TABLE customer_funding_source IS
  'User-provided explanation of asset-growth anomalies (T-003). One row per customer-year, upsert-able.';

DROP TRIGGER IF EXISTS trg_funding_source_touch ON customer_funding_source;
CREATE TRIGGER trg_funding_source_touch
  BEFORE UPDATE ON customer_funding_source
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

ALTER TABLE customer_funding_source ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_source_customer_read   ON customer_funding_source
  FOR SELECT USING (customer_id = get_customer_id());
CREATE POLICY funding_source_customer_write  ON customer_funding_source
  FOR INSERT WITH CHECK (customer_id = get_customer_id());
CREATE POLICY funding_source_customer_update ON customer_funding_source
  FOR UPDATE USING (customer_id = get_customer_id())
              WITH CHECK (customer_id = get_customer_id());
CREATE POLICY funding_source_consultant_read ON customer_funding_source
  FOR SELECT USING (is_jtc_consultant());
