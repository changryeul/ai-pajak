-- Column Mapping Memory
-- Stores confirmed column mappings per customer so future uploads
-- with the same Excel format auto-map without user confirmation.

CREATE TABLE IF NOT EXISTS column_mapping_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

    -- Fingerprint: hash of sorted source column headers (identifies Excel format)
    header_fingerprint VARCHAR(64) NOT NULL,

    -- Human-readable source info
    source_name VARCHAR(100),          -- e.g., "PT ABC Payroll Export"
    source_headers JSONB NOT NULL,     -- ["Nama", "Gaji Pokok", "Tunjangan", ...]

    -- Confirmed mappings
    mappings JSONB NOT NULL,
    -- [{ sourceColumn: "Nama Karyawan", targetField: "employee_name" }, ...]

    -- Stats
    used_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, header_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_mapping_memory_customer ON column_mapping_memory(customer_id);

ALTER TABLE column_mapping_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on mapping" ON column_mapping_memory;
DROP POLICY IF EXISTS "Customers view own mapping" ON column_mapping_memory;
DROP POLICY IF EXISTS "JTC manage mapping" ON column_mapping_memory;

CREATE POLICY "Block admins on mapping" ON column_mapping_memory FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own mapping" ON column_mapping_memory FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage mapping" ON column_mapping_memory FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE column_mapping_memory IS 'Stores confirmed Excel column mappings per customer for auto-mapping';
COMMENT ON COLUMN column_mapping_memory.header_fingerprint IS 'SHA-256 of sorted lowercase headers — identifies Excel format';
