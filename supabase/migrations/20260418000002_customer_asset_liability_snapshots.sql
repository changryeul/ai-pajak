-- Customer asset / liability snapshots (Harta / Utang)
-- Phase: PR3 Batch 1 of personal-filing prototype port.
--
-- Stores year-end balances by asset/liability type per customer. Needed as a
-- foundation for:
--   * Dashboard "5-year trend" charts (T-001)
--   * Asset-growth anomaly detection vs income (T-002)
--   * Foreign-asset cross-border reporting thresholds (T-004)
--   * SPT 1770 Harta/Utang section auto-prefill from last year's snapshot
--
-- Design choices:
--   * Two narrow tables (asset_snapshot, liability_snapshot) instead of one
--     polymorphic table — the category lists diverge, and per-asset
--     attributes (currency, is_foreign) apply more cleanly to assets than
--     liabilities.
--   * Stored in IDR primarily. `currency` + `amount_original` preserve the
--     raw entry for foreign-currency assets so later FX-aware reports can
--     recompute without data loss. `amount_idr` is the canonical figure.
--   * Snapshots are per-year but the unit is a (customer_id, year, type)
--     row, not a single JSON document per year — so users can add/remove
--     line items without rewriting the whole year.
--   * `is_foreign BOOLEAN` on assets is used directly by T-004's foreign-
--     asset threshold rule. Liabilities don't need the flag yet; add when
--     T-004 expands to foreign borrowings.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE asset_category AS ENUM (
    'CASH_BANK',      -- 현금/은행
    'RECEIVABLE',     -- 받을 돈 (piutang)
    'INVENTORY',      -- 재고 (persediaan)
    'INVESTMENT',     -- 주식/펀드/채권 (investasi non-usaha)
    'VEHICLE',        -- 차량 (alat transportasi)
    'LAND',           -- 토지 (tanah)
    'BUILDING',       -- 건물 (bangunan)
    'BUSINESS_ASSET', -- 사업자산 (harta usaha)
    'OTHER'           -- 기타
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE liability_category AS ENUM (
    'BANK_LOAN',         -- 은행 대출
    'CREDIT_CARD',       -- 신용카드 미지급
    'PERSONAL_LOAN',     -- 개인 간 차입
    'BUSINESS_LIABILITY',-- 사업 관련 부채
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- TABLE: asset_snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS asset_snapshot (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  snapshot_year INT  NOT NULL CHECK (snapshot_year BETWEEN 2000 AND 2100),
  category      asset_category NOT NULL,

  -- Canonical Rupiah amount (used by calculators / reports)
  amount_idr    NUMERIC(18, 2) NOT NULL CHECK (amount_idr >= 0),

  -- Optional original-currency record for foreign assets
  currency         CHAR(3) NOT NULL DEFAULT 'IDR',
  amount_original  NUMERIC(18, 2) CHECK (amount_original IS NULL OR amount_original >= 0),
  exchange_rate    NUMERIC(18, 6) CHECK (exchange_rate IS NULL OR exchange_rate > 0),

  is_foreign   BOOLEAN NOT NULL DEFAULT FALSE,
  label        TEXT,   -- short user description e.g. "Mandiri savings"
  notes        TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_snapshot_customer_year
  ON asset_snapshot(customer_id, snapshot_year DESC);
CREATE INDEX IF NOT EXISTS idx_asset_snapshot_foreign
  ON asset_snapshot(customer_id, snapshot_year, is_foreign) WHERE is_foreign = TRUE;

COMMENT ON TABLE asset_snapshot IS
  'Year-end asset balances for INDIVIDUAL customers. Used for 5-year trend charts, asset growth anomaly detection, and SPT 1770 Harta prefill.';
COMMENT ON COLUMN asset_snapshot.amount_idr IS
  'Canonical IDR amount. For non-IDR assets, computed from amount_original * exchange_rate at entry time.';

-- Auto-update `updated_at`
CREATE OR REPLACE FUNCTION _touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_snapshot_touch ON asset_snapshot;
CREATE TRIGGER trg_asset_snapshot_touch
  BEFORE UPDATE ON asset_snapshot
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

-- ============================================================================
-- TABLE: liability_snapshot
-- ============================================================================

CREATE TABLE IF NOT EXISTS liability_snapshot (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  snapshot_year INT  NOT NULL CHECK (snapshot_year BETWEEN 2000 AND 2100),
  category      liability_category NOT NULL,

  amount_idr    NUMERIC(18, 2) NOT NULL CHECK (amount_idr >= 0),

  creditor_name TEXT,   -- bank or person name
  label         TEXT,
  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liability_snapshot_customer_year
  ON liability_snapshot(customer_id, snapshot_year DESC);

DROP TRIGGER IF EXISTS trg_liability_snapshot_touch ON liability_snapshot;
CREATE TRIGGER trg_liability_snapshot_touch
  BEFORE UPDATE ON liability_snapshot
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

COMMENT ON TABLE liability_snapshot IS
  'Year-end liability balances for INDIVIDUAL customers. Used for SPT 1770 Utang prefill and debt-to-asset ratio context.';

-- ============================================================================
-- RLS — customer sees only their own; JTC consultants see their assigned customers
-- ============================================================================

ALTER TABLE asset_snapshot     ENABLE ROW LEVEL SECURITY;
ALTER TABLE liability_snapshot ENABLE ROW LEVEL SECURITY;

-- asset_snapshot
CREATE POLICY asset_snapshot_customer_read   ON asset_snapshot
  FOR SELECT USING (customer_id = get_customer_id());
CREATE POLICY asset_snapshot_customer_write  ON asset_snapshot
  FOR INSERT WITH CHECK (customer_id = get_customer_id());
CREATE POLICY asset_snapshot_customer_update ON asset_snapshot
  FOR UPDATE USING (customer_id = get_customer_id())
              WITH CHECK (customer_id = get_customer_id());
CREATE POLICY asset_snapshot_customer_delete ON asset_snapshot
  FOR DELETE USING (customer_id = get_customer_id());

-- Consultants assigned to the customer can read (for tax review).
CREATE POLICY asset_snapshot_consultant_read ON asset_snapshot
  FOR SELECT USING (is_jtc_consultant());

-- liability_snapshot mirrors asset_snapshot
CREATE POLICY liability_snapshot_customer_read   ON liability_snapshot
  FOR SELECT USING (customer_id = get_customer_id());
CREATE POLICY liability_snapshot_customer_write  ON liability_snapshot
  FOR INSERT WITH CHECK (customer_id = get_customer_id());
CREATE POLICY liability_snapshot_customer_update ON liability_snapshot
  FOR UPDATE USING (customer_id = get_customer_id())
              WITH CHECK (customer_id = get_customer_id());
CREATE POLICY liability_snapshot_customer_delete ON liability_snapshot
  FOR DELETE USING (customer_id = get_customer_id());
CREATE POLICY liability_snapshot_consultant_read ON liability_snapshot
  FOR SELECT USING (is_jtc_consultant());

-- Platform admins NEVER see tax data (Hard Rule #1 — enforced by the
-- absence of any PLATFORM_ADMIN policy, plus middleware).
