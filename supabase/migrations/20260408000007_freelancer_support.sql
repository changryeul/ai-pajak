-- Freelancer & Non-regular Worker Support
-- PPh 21 non-employee (Bukan Pegawai) — different calculation rules
-- Cumulative expense tracking for freelancers (PP 58/2023 Article 14)

-- Extend employee_payroll to support different worker types
ALTER TABLE employee_payroll
  ADD COLUMN IF NOT EXISTS worker_type VARCHAR(20) DEFAULT 'REGULAR',
  -- REGULAR: 정규직 (TER monthly method)
  -- CONTRACT: 계약직/비정규직 (same as regular but fixed term)
  -- DAILY: 일용직 (PPh 21 daily threshold Rp 450,000)
  -- FREELANCER: 프리랜서 (50% DPP, progressive rate, cumulative)
  -- COMMISSIONER: 위원/감사위원 (cumulative, progressive)

  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(15,2),         -- 일용직 일급
  ADD COLUMN IF NOT EXISTS freelance_service_type VARCHAR(50); -- 프리랜서 서비스 유형

COMMENT ON COLUMN employee_payroll.worker_type IS 'REGULAR|CONTRACT|DAILY|FREELANCER|COMMISSIONER';

-- ──────────────────────────────────────────────────────────
-- Freelancer cumulative income/expense tracker (연간 누적)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_cumulative (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    employee_id UUID NOT NULL REFERENCES employee_payroll(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,

    -- Monthly income entries (누적 관리)
    monthly_entries JSONB DEFAULT '[]'::jsonb,
    -- [{ month: '2026-01', gross: 5000000, expenses: 2500000, net: 2500000, tax: 125000 }]

    -- Cumulative totals (auto-calculated)
    cumulative_gross NUMERIC(18,2) DEFAULT 0,
    cumulative_expenses NUMERIC(18,2) DEFAULT 0,
    cumulative_net NUMERIC(18,2) DEFAULT 0,
    cumulative_ptkp_used NUMERIC(18,2) DEFAULT 0,
    cumulative_pkp NUMERIC(18,2) DEFAULT 0,
    cumulative_tax NUMERIC(18,2) DEFAULT 0,
    cumulative_tax_paid NUMERIC(18,2) DEFAULT 0,  -- 이미 납부한 세액

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_freelancer_cum_customer ON freelancer_cumulative(customer_id, tax_year);
ALTER TABLE freelancer_cumulative ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block admins on freelancer" ON freelancer_cumulative;
DROP POLICY IF EXISTS "Customers view own freelancer" ON freelancer_cumulative;
DROP POLICY IF EXISTS "JTC manage freelancer" ON freelancer_cumulative;

CREATE POLICY "Block admins on freelancer" ON freelancer_cumulative FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own freelancer" ON freelancer_cumulative FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC manage freelancer" ON freelancer_cumulative FOR ALL TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

COMMENT ON TABLE freelancer_cumulative IS 'Freelancer annual cumulative income/expense for PPh 21 Bukan Pegawai calculation';
