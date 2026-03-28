-- Tax Counterparty (거래 상대방) & Transaction Details

-- 거래 상대방 관리
CREATE TABLE tax_counterparty (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    name VARCHAR(255) NOT NULL,
    npwp VARCHAR(20),
    nik VARCHAR(16),
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'VENDOR', -- VENDOR, CLIENT, EMPLOYEE
    is_related_party BOOLEAN DEFAULT FALSE, -- 관계사 여부 (Transfer Pricing)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_counterparty_customer ON tax_counterparty(customer_id);
CREATE INDEX idx_counterparty_npwp ON tax_counterparty(npwp);
ALTER TABLE tax_counterparty ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins" ON tax_counterparty FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own" ON tax_counterparty FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC view assigned" ON tax_counterparty FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));
CREATE POLICY "JTC insert" ON tax_counterparty FOR INSERT TO authenticated WITH CHECK (is_jtc_consultant());
CREATE POLICY "Customers insert own" ON tax_counterparty FOR INSERT TO authenticated
WITH CHECK (is_customer() AND customer_id = get_customer_id());

-- PPh 23 원천징수 거래 내역
CREATE TABLE pph23_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    counterparty_id UUID REFERENCES tax_counterparty(id),
    monthly_payment_id UUID REFERENCES tax_monthly_payment(id),
    tax_period VARCHAR(7) NOT NULL, -- YYYY-MM

    -- 거래 정보
    transaction_date DATE NOT NULL,
    description TEXT,
    service_type VARCHAR(50) NOT NULL, -- JASA_TEKNIK, JASA_MANAJEMEN, SEWA, DIVIDEN, BUNGA, ROYALTI
    invoice_number VARCHAR(50),

    -- 금액
    gross_amount NUMERIC(15,2) NOT NULL,
    tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.02, -- 2% or 15%
    tax_amount NUMERIC(15,2) NOT NULL,

    -- 상대방 정보 (snapshot)
    counterparty_name VARCHAR(255),
    counterparty_npwp VARCHAR(20),

    -- Bukti Potong
    bukti_potong_number VARCHAR(50),
    bukti_potong_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pph23_customer ON pph23_transaction(customer_id);
CREATE INDEX idx_pph23_period ON pph23_transaction(tax_period);
ALTER TABLE pph23_transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins" ON pph23_transaction FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own" ON pph23_transaction FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC view" ON pph23_transaction FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));

-- PPN Faktur 매칭
CREATE TABLE ppn_faktur_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    monthly_payment_id UUID REFERENCES tax_monthly_payment(id),
    tax_period VARCHAR(7) NOT NULL,
    faktur_type VARCHAR(10) NOT NULL, -- KELUARAN (매출), MASUKAN (매입)

    -- Faktur 정보
    faktur_number VARCHAR(20), -- 010.000-24.00000001
    faktur_date DATE NOT NULL,
    counterparty_id UUID REFERENCES tax_counterparty(id),
    counterparty_name VARCHAR(255),
    counterparty_npwp VARCHAR(20),

    -- 금액
    dpp NUMERIC(15,2) NOT NULL, -- Dasar Pengenaan Pajak
    ppn NUMERIC(15,2) NOT NULL, -- PPN 11%
    ppnbm NUMERIC(15,2) DEFAULT 0, -- Luxury tax

    -- Status
    status VARCHAR(20) DEFAULT 'APPROVED', -- APPROVED, CANCELLED, REPLACED

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ppn_faktur_customer ON ppn_faktur_monthly(customer_id);
CREATE INDEX idx_ppn_faktur_period ON ppn_faktur_monthly(tax_period);
CREATE INDEX idx_ppn_faktur_type ON ppn_faktur_monthly(faktur_type);
ALTER TABLE ppn_faktur_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins" ON ppn_faktur_monthly FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own" ON ppn_faktur_monthly FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC view" ON ppn_faktur_monthly FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));

COMMENT ON TABLE tax_counterparty IS 'Tax counterparties (vendors, clients, employees) with NPWP';
COMMENT ON TABLE pph23_transaction IS 'PPh 23 withholding transactions per counterparty';
COMMENT ON TABLE ppn_faktur_monthly IS 'PPN faktur (output/input) for monthly reconciliation';
