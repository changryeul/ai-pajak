-- Inventory Ledger (재고관리대장)
-- Used for HPP (Harga Pokok Penjualan / COGS) calculation in Koreksi Fiskal

CREATE TABLE IF NOT EXISTS inventory_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    fiscal_year INTEGER NOT NULL,

    -- Inventory type
    item_name VARCHAR(255) NOT NULL,
    item_category VARCHAR(50), -- RAW_MATERIAL | WORK_IN_PROGRESS | FINISHED_GOODS | SUPPLIES

    -- Stock values
    beginning_stock NUMERIC(18,2) DEFAULT 0,   -- Persediaan Awal
    purchases NUMERIC(18,2) DEFAULT 0,         -- Pembelian
    ending_stock NUMERIC(18,2) DEFAULT 0,      -- Persediaan Akhir
    -- HPP = beginning + purchases - ending

    -- Additional fields
    unit VARCHAR(20),           -- pcs, kg, liter, etc.
    beginning_qty NUMERIC(12,2) DEFAULT 0,
    purchase_qty NUMERIC(12,2) DEFAULT 0,
    ending_qty NUMERIC(12,2) DEFAULT 0,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_customer_year ON inventory_record(customer_id, fiscal_year);

ALTER TABLE inventory_record ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on inventory" ON inventory_record;
DROP POLICY IF EXISTS "Customers view own inventory" ON inventory_record;
DROP POLICY IF EXISTS "JTC manage inventory" ON inventory_record;

CREATE POLICY "Block admins on inventory" ON inventory_record FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own inventory" ON inventory_record FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage inventory" ON inventory_record FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- Koreksi Fiskal snapshot (auto-calculated result)
CREATE TABLE IF NOT EXISTS koreksi_fiskal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    fiscal_year INTEGER NOT NULL,

    -- Commercial profit (from financial statements)
    commercial_profit NUMERIC(18,2) DEFAULT 0,

    -- Auto-calculated corrections
    positive_corrections JSONB DEFAULT '[]'::jsonb,
    -- [{ code, label, amount, source, reason }]
    negative_corrections JSONB DEFAULT '[]'::jsonb,
    total_positive NUMERIC(18,2) DEFAULT 0,
    total_negative NUMERIC(18,2) DEFAULT 0,

    -- Result
    fiscal_profit NUMERIC(18,2) DEFAULT 0,  -- PKP

    -- HPP calculation
    hpp_commercial NUMERIC(18,2) DEFAULT 0,
    hpp_fiscal NUMERIC(18,2) DEFAULT 0,
    hpp_difference NUMERIC(18,2) DEFAULT 0,

    -- Depreciation
    depreciation_commercial NUMERIC(18,2) DEFAULT 0,
    depreciation_fiscal NUMERIC(18,2) DEFAULT 0,
    depreciation_difference NUMERIC(18,2) DEFAULT 0,

    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT | REVIEWED | APPROVED
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),

    UNIQUE(customer_id, fiscal_year)
);

ALTER TABLE koreksi_fiskal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on koreksi" ON koreksi_fiskal;
DROP POLICY IF EXISTS "Customers view own koreksi" ON koreksi_fiskal;
DROP POLICY IF EXISTS "JTC manage koreksi" ON koreksi_fiskal;

CREATE POLICY "Block admins on koreksi" ON koreksi_fiskal FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own koreksi" ON koreksi_fiskal FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage koreksi" ON koreksi_fiskal FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE inventory_record IS 'Inventory ledger for HPP/COGS calculation';
COMMENT ON TABLE koreksi_fiskal IS 'Auto-calculated fiscal adjustment (Koreksi Fiskal) results';
