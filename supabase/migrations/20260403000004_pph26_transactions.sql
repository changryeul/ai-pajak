-- PPh 26 Non-Resident Withholding Tax Transactions
-- Tracks monthly transactions with non-resident recipients
-- Includes treaty rate application and CoD tracking

CREATE TABLE pph26_transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    counterparty_id UUID REFERENCES tax_counterparty(id),
    monthly_payment_id UUID REFERENCES tax_monthly_payment(id),
    tax_period VARCHAR(7) NOT NULL, -- YYYY-MM

    -- Transaction info
    transaction_date DATE NOT NULL,
    description TEXT,
    income_type VARCHAR(30) NOT NULL, -- dividend, interest, royalty, service, salary, pension, insurance, other
    invoice_number VARCHAR(50),

    -- Amounts
    gross_amount NUMERIC(15,2) NOT NULL,
    standard_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20, -- 20%
    applied_rate NUMERIC(5,4) NOT NULL,
    tax_amount NUMERIC(15,2) NOT NULL,

    -- Recipient info (snapshot)
    recipient_name VARCHAR(255),
    recipient_country VARCHAR(2), -- ISO 3166-1 alpha-2
    recipient_npwp VARCHAR(20),

    -- Treaty info
    treaty_applied BOOLEAN DEFAULT FALSE,
    treaty_rate NUMERIC(5,4),
    treaty_reference VARCHAR(255),
    has_cod BOOLEAN DEFAULT FALSE, -- Certificate of Domicile

    -- Bukti Potong
    bukti_potong_number VARCHAR(50),
    bukti_potong_date DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pph26_customer ON pph26_transaction(customer_id);
CREATE INDEX idx_pph26_period ON pph26_transaction(tax_period);
CREATE INDEX idx_pph26_country ON pph26_transaction(recipient_country);
ALTER TABLE pph26_transaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins" ON pph26_transaction FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own" ON pph26_transaction FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC view" ON pph26_transaction FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));
CREATE POLICY "JTC insert" ON pph26_transaction FOR INSERT TO authenticated WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE pph26_transaction IS 'PPh 26 non-resident withholding transactions with treaty tracking';
