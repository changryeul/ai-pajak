-- Create function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
-- Monthly Tax Payment Tracking
-- Tracks PPh 21, PPh 23, PPh 25, PPN, PPh Final monthly payments

CREATE TABLE tax_monthly_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    consultant_id UUID REFERENCES consultant(id),
    tax_type VARCHAR(20) NOT NULL, -- PPh21, PPh23, PPh25, PPN, PPh_FINAL
    tax_period VARCHAR(7) NOT NULL, -- YYYY-MM
    tax_year INTEGER NOT NULL,

    -- Amounts
    amount_due NUMERIC(15,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
    penalty_amount NUMERIC(15,2) NOT NULL DEFAULT 0, -- Denda/bunga

    -- Payment info
    kode_billing VARCHAR(20),
    ntpn VARCHAR(20), -- Nomor Transaksi Penerimaan Negara
    payment_date DATE,
    payment_method VARCHAR(50), -- BANK_TRANSFER, ATM, INTERNET_BANKING, MOBILE_BANKING

    -- Filing info
    spt_masa_filed BOOLEAN DEFAULT FALSE,
    spt_masa_filed_at TIMESTAMP WITH TIME ZONE,
    bpe_number VARCHAR(50),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID, OVERDUE, PARTIAL
    payment_deadline DATE, -- Setor deadline
    reporting_deadline DATE, -- Lapor deadline

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_monthly_payment_customer ON tax_monthly_payment(customer_id);
CREATE INDEX idx_monthly_payment_period ON tax_monthly_payment(tax_period);
CREATE INDEX idx_monthly_payment_type ON tax_monthly_payment(tax_type);
CREATE INDEX idx_monthly_payment_status ON tax_monthly_payment(status);
CREATE UNIQUE INDEX idx_monthly_payment_unique ON tax_monthly_payment(customer_id, tax_type, tax_period);

-- RLS
ALTER TABLE tax_monthly_payment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block platform admins" ON tax_monthly_payment FOR ALL
TO authenticated USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own payments" ON tax_monthly_payment FOR SELECT
TO authenticated USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC consultants view assigned" ON tax_monthly_payment FOR SELECT
TO authenticated USING (
    is_jtc_consultant() AND customer_id IN (
        SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true
    )
);

CREATE POLICY "JTC consultants can insert" ON tax_monthly_payment FOR INSERT
TO authenticated WITH CHECK (is_jtc_consultant());

CREATE POLICY "JTC consultants can update" ON tax_monthly_payment FOR UPDATE
TO authenticated USING (is_jtc_consultant());

-- Auto-update
CREATE TRIGGER update_monthly_payment_updated_at
BEFORE UPDATE ON tax_monthly_payment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tax_monthly_payment IS 'Monthly tax payment tracking for PPh 21/23/25, PPN, PPh Final';
