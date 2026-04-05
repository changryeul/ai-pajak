-- Monthly Payslip — JTC Template Fields (Phase 2 & 3)
-- Phase 2: Specific allowance types (Laptop, Medical, Tax gross-up, Annual Leave)
-- Phase 3: Special payments (Severance, PKWT Compensation)

ALTER TABLE monthly_payslip
  -- Phase 2: Specific allowances
  ADD COLUMN IF NOT EXISTS laptop_allowance NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_allowance NUMERIC(15,2) DEFAULT 0,      -- Gross-up tax allowance
  ADD COLUMN IF NOT EXISTS annual_leave_pay NUMERIC(15,2) DEFAULT 0,   -- Cuti tahunan

  -- Phase 3: Special payments
  ADD COLUMN IF NOT EXISTS severance_allowance NUMERIC(15,2) DEFAULT 0,  -- Pesangon
  ADD COLUMN IF NOT EXISTS pkwt_compensation NUMERIC(15,2) DEFAULT 0;    -- Contract worker compensation

COMMENT ON COLUMN monthly_payslip.laptop_allowance IS 'Laptop/equipment allowance';
COMMENT ON COLUMN monthly_payslip.medical_allowance IS 'Medical reimbursement allowance';
COMMENT ON COLUMN monthly_payslip.tax_allowance IS 'Gross-up tax allowance (employer pays employee tax)';
COMMENT ON COLUMN monthly_payslip.annual_leave_pay IS 'Cuti tahunan (annual leave payout)';
COMMENT ON COLUMN monthly_payslip.severance_allowance IS 'Pesangon (severance payment)';
COMMENT ON COLUMN monthly_payslip.pkwt_compensation IS 'PKWT contract worker end-of-contract compensation';
