-- PPh21 급여 세금 계산 방식(Gross / Gross-up) 필드. (요청 2026-08-30)
--   GROSS    : 직원이 PPh21 부담(급여에서 차감). 기본값.
--   GROSS_UP : 회사가 PPh21 부담 → 세액수당(tax_allowance)을 gross-up 자동계산.
ALTER TABLE monthly_payslip
  ADD COLUMN IF NOT EXISTS tax_method VARCHAR(10) NOT NULL DEFAULT 'GROSS'
    CHECK (tax_method IN ('GROSS', 'GROSS_UP'));
COMMENT ON COLUMN monthly_payslip.tax_method IS
  'PPh21 부담 방식: GROSS(직원부담) | GROSS_UP(회사부담·세액수당 gross-up). 요청 2026-08-30.';
