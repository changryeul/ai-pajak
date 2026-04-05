-- Monthly Payslip — JTC Template Fields (Phase 1)
-- Adds employer-paid BPJS costs, Biaya Jabatan, and bank transfer info
-- to match Jakarta Tax Consulting's real-world salary report format

-- ──────────────────────────────────────────────────────────
-- 1. employee_payroll — bank info (stored per employee)
-- ──────────────────────────────────────────────────────────
ALTER TABLE employee_payroll
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resign_date DATE;

-- ──────────────────────────────────────────────────────────
-- 2. monthly_payslip — employer-paid BPJS + Biaya Jabatan
-- ──────────────────────────────────────────────────────────
ALTER TABLE monthly_payslip
  -- BPJS base (capped) for cap-based calculations
  ADD COLUMN IF NOT EXISTS base_salary_bpjs_kes NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_salary_bpjs_tk NUMERIC(15,2) DEFAULT 0,

  -- Employer-paid BPJS (5 components) — for total labor cost tracking
  ADD COLUMN IF NOT EXISTS bpjs_kes_company NUMERIC(15,2) DEFAULT 0,   -- 4%
  ADD COLUMN IF NOT EXISTS jkk_company NUMERIC(15,2) DEFAULT 0,        -- 0.24%
  ADD COLUMN IF NOT EXISTS jkm_company NUMERIC(15,2) DEFAULT 0,        -- 0.30%
  ADD COLUMN IF NOT EXISTS jht_company NUMERIC(15,2) DEFAULT 0,        -- 3.70%
  ADD COLUMN IF NOT EXISTS jp_company NUMERIC(15,2) DEFAULT 0,         -- 2.00%

  -- Biaya Jabatan (Personal Expense) — PPh 21 deduction
  -- 5% of gross, max Rp 500,000/month (Rp 6,000,000/year)
  ADD COLUMN IF NOT EXISTS personal_expense NUMERIC(15,2) DEFAULT 0,

  -- Bank transfer snapshot (copied from employee_payroll at generation time)
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255);

COMMENT ON COLUMN monthly_payslip.base_salary_bpjs_kes IS 'BPJS Kesehatan base salary (capped at Rp 12,000,000)';
COMMENT ON COLUMN monthly_payslip.base_salary_bpjs_tk IS 'BPJS Ketenagakerjaan base salary (for JP/JHT cap)';
COMMENT ON COLUMN monthly_payslip.personal_expense IS 'Biaya Jabatan: 5% of gross, max Rp 500k/month for PPh 21 deduction';
COMMENT ON COLUMN monthly_payslip.bpjs_kes_company IS 'Employer BPJS Kesehatan contribution (4%)';
COMMENT ON COLUMN monthly_payslip.jkk_company IS 'Employer JKK contribution (0.24%)';
COMMENT ON COLUMN monthly_payslip.jkm_company IS 'Employer JKM contribution (0.30%)';
COMMENT ON COLUMN monthly_payslip.jht_company IS 'Employer JHT contribution (3.70%)';
COMMENT ON COLUMN monthly_payslip.jp_company IS 'Employer JP contribution (2.00%)';
