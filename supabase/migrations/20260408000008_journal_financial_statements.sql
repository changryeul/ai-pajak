-- Chart of Accounts + Journal Entries + Financial Statements
-- SAK EMKM (Indonesian Small Business Accounting Standard) based

-- ──────────────────────────────────────────────────────────
-- 1. Chart of Accounts (계정과목 — Indonesian standard)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    code VARCHAR(10) PRIMARY KEY,
    name_id VARCHAR(100) NOT NULL,       -- Indonesian name
    name_en VARCHAR(100),                -- English name
    account_type VARCHAR(20) NOT NULL,   -- ASSET | LIABILITY | EQUITY | REVENUE | COGS | EXPENSE | OTHER_INCOME | TAX
    normal_balance VARCHAR(6) NOT NULL,  -- DEBIT | CREDIT
    parent_code VARCHAR(10),             -- for hierarchy
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0
);

-- Seed standard CoA for UMKM (SAK EMKM)
INSERT INTO chart_of_accounts (code, name_id, name_en, account_type, normal_balance, display_order) VALUES
  -- Assets (Aktiva)
  ('1000', 'Kas & Bank', 'Cash & Bank', 'ASSET', 'DEBIT', 100),
  ('1100', 'Kas', 'Cash on Hand', 'ASSET', 'DEBIT', 110),
  ('1200', 'Bank', 'Bank Account', 'ASSET', 'DEBIT', 120),
  ('1300', 'Piutang Usaha', 'Accounts Receivable', 'ASSET', 'DEBIT', 130),
  ('1400', 'Persediaan', 'Inventory', 'ASSET', 'DEBIT', 140),
  ('1500', 'Biaya Dibayar Dimuka', 'Prepaid Expenses', 'ASSET', 'DEBIT', 150),
  ('1600', 'Aktiva Tetap', 'Fixed Assets', 'ASSET', 'DEBIT', 160),
  ('1700', 'Akumulasi Penyusutan', 'Accumulated Depreciation', 'ASSET', 'CREDIT', 170),
  ('1800', 'Aktiva Lain-lain', 'Other Assets', 'ASSET', 'DEBIT', 180),
  -- Liabilities (Kewajiban)
  ('2100', 'Hutang Usaha', 'Accounts Payable', 'LIABILITY', 'CREDIT', 210),
  ('2200', 'Hutang Pajak', 'Tax Payable', 'LIABILITY', 'CREDIT', 220),
  ('2300', 'Hutang Bank', 'Bank Loan', 'LIABILITY', 'CREDIT', 230),
  ('2400', 'Hutang Lain-lain', 'Other Payables', 'LIABILITY', 'CREDIT', 240),
  -- Equity (Modal)
  ('3100', 'Modal Disetor', 'Paid-up Capital', 'EQUITY', 'CREDIT', 310),
  ('3200', 'Laba Ditahan', 'Retained Earnings', 'EQUITY', 'CREDIT', 320),
  ('3300', 'Laba Tahun Berjalan', 'Current Year Profit', 'EQUITY', 'CREDIT', 330),
  -- Revenue (Pendapatan)
  ('4100', 'Pendapatan Usaha', 'Sales / Service Revenue', 'REVENUE', 'CREDIT', 410),
  ('4200', 'Pendapatan Jasa', 'Service Revenue', 'REVENUE', 'CREDIT', 420),
  ('4300', 'Pendapatan Lain-lain', 'Other Revenue', 'OTHER_INCOME', 'CREDIT', 430),
  -- COGS (Harga Pokok)
  ('5100', 'Harga Pokok Penjualan', 'Cost of Goods Sold', 'COGS', 'DEBIT', 510),
  ('5200', 'Biaya Langsung Jasa', 'Direct Service Cost', 'COGS', 'DEBIT', 520),
  -- Operating Expenses (Biaya Operasional)
  ('6100', 'Gaji & Upah', 'Salaries & Wages', 'EXPENSE', 'DEBIT', 610),
  ('6200', 'Sewa', 'Rent Expense', 'EXPENSE', 'DEBIT', 620),
  ('6300', 'Listrik, Air & Telepon', 'Utilities', 'EXPENSE', 'DEBIT', 630),
  ('6400', 'Penyusutan', 'Depreciation', 'EXPENSE', 'DEBIT', 640),
  ('6500', 'Transportasi', 'Transportation', 'EXPENSE', 'DEBIT', 650),
  ('6600', 'Peralatan Kantor', 'Office Supplies', 'EXPENSE', 'DEBIT', 660),
  ('6700', 'Biaya Asuransi', 'Insurance', 'EXPENSE', 'DEBIT', 670),
  ('6800', 'Biaya Pemasaran', 'Marketing', 'EXPENSE', 'DEBIT', 680),
  ('6900', 'Biaya Lain-lain', 'Other Expenses', 'EXPENSE', 'DEBIT', 690),
  -- Other Income/Expense
  ('7100', 'Pendapatan Bunga', 'Interest Income', 'OTHER_INCOME', 'CREDIT', 710),
  ('7200', 'Biaya Bunga', 'Interest Expense', 'EXPENSE', 'DEBIT', 720),
  ('7300', 'Laba/Rugi Selisih Kurs', 'Foreign Exchange Gain/Loss', 'OTHER_INCOME', 'CREDIT', 730),
  -- Tax
  ('8100', 'Beban Pajak Penghasilan', 'Income Tax Expense', 'TAX', 'DEBIT', 810)
ON CONFLICT (code) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 2. Journal Entries (Jurnal Umum)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    fiscal_year INTEGER NOT NULL,
    entry_date DATE NOT NULL,
    entry_number VARCHAR(30),          -- Auto-generated: JV-2026-0001
    description TEXT NOT NULL,
    source VARCHAR(20) DEFAULT 'MANUAL', -- MANUAL | BANK_IMPORT | PETTY_CASH | SYSTEM
    reference_doc VARCHAR(100),        -- Invoice #, receipt #, etc.
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
    account_code VARCHAR(10) NOT NULL REFERENCES chart_of_accounts(code),
    debit NUMERIC(18,2) DEFAULT 0,
    credit NUMERIC(18,2) DEFAULT 0,
    description TEXT,
    line_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_journal_customer_year ON journal_entry(customer_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entry(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_line_entry ON journal_entry_line(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_line_account ON journal_entry_line(account_code);

ALTER TABLE journal_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_line ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on journal" ON journal_entry;
DROP POLICY IF EXISTS "Customers view own journal" ON journal_entry;
DROP POLICY IF EXISTS "JTC manage journal" ON journal_entry;
DROP POLICY IF EXISTS "Block admins on journal_line" ON journal_entry_line;
DROP POLICY IF EXISTS "View journal lines" ON journal_entry_line;
DROP POLICY IF EXISTS "JTC manage journal_line" ON journal_entry_line;

CREATE POLICY "Block admins on journal" ON journal_entry FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own journal" ON journal_entry FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage journal" ON journal_entry FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

CREATE POLICY "Block admins on journal_line" ON journal_entry_line FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "View journal lines" ON journal_entry_line FOR SELECT TO authenticated USING (true);
CREATE POLICY "JTC manage journal_line" ON journal_entry_line FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

-- ──────────────────────────────────────────────────────────
-- 3. Generated Financial Statements (snapshot)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_statement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    fiscal_year INTEGER NOT NULL,
    statement_type VARCHAR(20) NOT NULL, -- TRIAL_BALANCE | BALANCE_SHEET | INCOME_STATEMENT
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id),
    data JSONB NOT NULL,    -- Full statement data
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT | REVIEWED | APPROVED
    notes TEXT,
    UNIQUE(customer_id, fiscal_year, statement_type)
);

ALTER TABLE financial_statement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on fs" ON financial_statement;
DROP POLICY IF EXISTS "Customers view own fs" ON financial_statement;
DROP POLICY IF EXISTS "JTC manage fs" ON financial_statement;

CREATE POLICY "Block admins on fs" ON financial_statement FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own fs" ON financial_statement FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage fs" ON financial_statement FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE chart_of_accounts IS 'Standard Chart of Accounts (SAK EMKM)';
COMMENT ON TABLE journal_entry IS 'Double-entry journal entries per customer per fiscal year';
COMMENT ON TABLE journal_entry_line IS 'Debit/Credit lines for each journal entry';
COMMENT ON TABLE financial_statement IS 'Generated financial statements (Trial Balance, Neraca, Laba Rugi)';
