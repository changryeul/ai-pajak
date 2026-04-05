-- Monthly Payslip — 월별 직원 급여 명세
-- 직원 마스터(employee_payroll)를 기반으로 매월 근태/수당/보너스/공제를 기록
-- PPh 21 자동 계산 결과 포함

CREATE TABLE IF NOT EXISTS monthly_payslip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    employee_id UUID NOT NULL REFERENCES employee_payroll(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- YYYY-MM (e.g., '2026-04')

    -- 근태 (Attendance)
    working_days INTEGER DEFAULT 22,
    absent_days INTEGER DEFAULT 0,
    overtime_hours NUMERIC(6,2) DEFAULT 0,

    -- 기본 급여 (복사됨, 수정 가능)
    base_salary NUMERIC(15,2) NOT NULL DEFAULT 0,

    -- 수당 (Allowances)
    overtime_pay NUMERIC(15,2) DEFAULT 0,
    meal_allowance NUMERIC(15,2) DEFAULT 0,
    transport_allowance NUMERIC(15,2) DEFAULT 0,
    position_allowance NUMERIC(15,2) DEFAULT 0,
    other_allowances NUMERIC(15,2) DEFAULT 0,

    -- 보너스 (Bonus)
    bonus NUMERIC(15,2) DEFAULT 0,
    thr NUMERIC(15,2) DEFAULT 0, -- Tunjangan Hari Raya (명절 보너스)
    commission NUMERIC(15,2) DEFAULT 0,

    -- 공제 (Deductions)
    bpjs_kesehatan NUMERIC(15,2) DEFAULT 0, -- 건강보험
    bpjs_ketenagakerjaan NUMERIC(15,2) DEFAULT 0, -- 고용/산재보험
    jht_employee NUMERIC(15,2) DEFAULT 0, -- 고용보험료 (직원 부담)
    jp_employee NUMERIC(15,2) DEFAULT 0, -- 연금 (직원 부담)
    loan_deduction NUMERIC(15,2) DEFAULT 0, -- 대출 상환
    other_deductions NUMERIC(15,2) DEFAULT 0,

    -- 계산 결과
    total_gross NUMERIC(15,2) DEFAULT 0, -- 총 지급액 (기본급+수당+보너스)
    total_deduction NUMERIC(15,2) DEFAULT 0, -- 총 공제액
    taxable_income NUMERIC(15,2) DEFAULT 0, -- 과세 소득
    pph21_tax NUMERIC(15,2) DEFAULT 0, -- PPh 21 세금
    ter_rate NUMERIC(6,4) DEFAULT 0, -- TER 세율
    net_salary NUMERIC(15,2) DEFAULT 0, -- 실수령액

    -- 상태
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, FINALIZED, FILED
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(employee_id, period)
);

CREATE INDEX IF NOT EXISTS idx_payslip_customer_period ON monthly_payslip(customer_id, period);
CREATE INDEX IF NOT EXISTS idx_payslip_employee ON monthly_payslip(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslip_status ON monthly_payslip(status);

-- RLS
ALTER TABLE monthly_payslip ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block admins on payslip" ON monthly_payslip FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());

CREATE POLICY "Customers view own payslip" ON monthly_payslip FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());

CREATE POLICY "JTC view assigned payslip" ON monthly_payslip FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true
));

CREATE POLICY "JTC insert payslip" ON monthly_payslip FOR INSERT TO authenticated
WITH CHECK (is_jtc_consultant());

CREATE POLICY "JTC update payslip" ON monthly_payslip FOR UPDATE TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

CREATE POLICY "JTC delete payslip" ON monthly_payslip FOR DELETE TO authenticated
USING (is_jtc_consultant());

-- Auto-update
CREATE OR REPLACE FUNCTION update_payslip_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_payslip_updated_at BEFORE UPDATE ON monthly_payslip
FOR EACH ROW EXECUTE FUNCTION update_payslip_updated_at();

COMMENT ON TABLE monthly_payslip IS 'Monthly payslip with attendance, allowances, bonuses, deductions, and PPh 21 calculation';
