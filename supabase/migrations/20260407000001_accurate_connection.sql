-- Accurate Online API Connection
-- Stores session key + host URL per customer for Accurate integration
-- Session/host is obtained by calling /api/open-db.do with an access token

CREATE TABLE IF NOT EXISTS accurate_connection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

    -- OAuth / Access Token (refreshable)
    access_token TEXT,               -- Bearer token from Accurate OAuth
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Session (from /api/open-db.do)
    session_key TEXT NOT NULL,       -- X-Session-ID header value
    host TEXT NOT NULL,              -- e.g., https://public.accurate.id
    database_id TEXT,                -- Accurate DB ID
    database_name TEXT,              -- Human-readable DB name

    -- Sync state
    last_sync_at TIMESTAMPTZ,
    last_sales_cursor TEXT,          -- Pagination cursor for incremental sync
    last_purchase_cursor TEXT,
    sync_status VARCHAR(20) DEFAULT 'IDLE', -- IDLE, SYNCING, ERROR
    last_error TEXT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_accurate_conn_customer ON accurate_connection(customer_id);
CREATE INDEX IF NOT EXISTS idx_accurate_conn_active ON accurate_connection(is_active) WHERE is_active;

-- RLS
ALTER TABLE accurate_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on accurate" ON accurate_connection FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own accurate conn" ON accurate_connection FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned accurate conn" ON accurate_connection FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant
    WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "JTC manage accurate conn" ON accurate_connection FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_accurate_conn_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_accurate_conn_updated_at
BEFORE UPDATE ON accurate_connection
FOR EACH ROW EXECUTE FUNCTION update_accurate_conn_updated_at();

-- ──────────────────────────────────────────────────────────
-- Accurate Invoice Import Cache
-- Raw invoice data imported from Accurate, before transformation
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accurate_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

    accurate_id BIGINT NOT NULL,     -- Accurate's invoice ID
    invoice_type VARCHAR(20) NOT NULL, -- SALES, PURCHASE
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,

    -- Counterparty
    counterparty_name VARCHAR(255),
    counterparty_npwp VARCHAR(20),

    -- Amounts
    subtotal NUMERIC(18,2) DEFAULT 0,
    tax_amount NUMERIC(18,2) DEFAULT 0,
    total_amount NUMERIC(18,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'IDR',

    -- Tax classification
    has_ppn BOOLEAN DEFAULT FALSE,
    has_pph BOOLEAN DEFAULT FALSE,
    pph_type VARCHAR(20), -- PPh21, PPh23, PPh4_FINAL, PPh22, PPh26

    -- Raw payload for debugging
    raw_data JSONB,

    -- Processing state
    status VARCHAR(20) DEFAULT 'IMPORTED', -- IMPORTED, CLASSIFIED, APPLIED, IGNORED
    applied_to_calculation_id UUID REFERENCES tax_calculation(id),

    imported_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(customer_id, invoice_type, accurate_id)
);

CREATE INDEX IF NOT EXISTS idx_accurate_inv_customer_type ON accurate_invoice(customer_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_accurate_inv_date ON accurate_invoice(invoice_date);
CREATE INDEX IF NOT EXISTS idx_accurate_inv_status ON accurate_invoice(status);

ALTER TABLE accurate_invoice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on accurate inv" ON accurate_invoice FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own accurate inv" ON accurate_invoice FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned accurate inv" ON accurate_invoice FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant
    WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "JTC manage accurate inv" ON accurate_invoice FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE accurate_connection IS 'Accurate Online API session credentials per customer';
COMMENT ON TABLE accurate_invoice IS 'Raw invoice data imported from Accurate Online';
