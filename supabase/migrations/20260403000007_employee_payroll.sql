-- Employee Payroll Master Data
-- Stores employee details for monthly PPh21 calculation
-- Linked to tax_counterparty for NPWP/identity info

CREATE TABLE employee_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    counterparty_id UUID REFERENCES tax_counterparty(id),

    -- Employee info
    employee_name VARCHAR(255) NOT NULL,
    employee_npwp VARCHAR(20),
    employee_nik VARCHAR(16),
    ptkp_category VARCHAR(5) NOT NULL DEFAULT 'TK0', -- TK0~KI3
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Salary info (monthly)
    gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
    jht_employee NUMERIC(15,2) DEFAULT 0,
    jp_employee NUMERIC(15,2) DEFAULT 0,
    position_allowance NUMERIC(15,2) DEFAULT 0,
    other_allowances NUMERIC(15,2) DEFAULT 0,
    other_deductions NUMERIC(15,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_emp_payroll_customer ON employee_payroll(customer_id);
CREATE INDEX idx_emp_payroll_active ON employee_payroll(is_active);

ALTER TABLE employee_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block admins" ON employee_payroll FOR ALL TO authenticated
USING (NOT is_platform_admin()) WITH CHECK (NOT is_platform_admin());
CREATE POLICY "Customers view own" ON employee_payroll FOR SELECT TO authenticated
USING (is_customer() AND customer_id = get_customer_id());
CREATE POLICY "JTC view assigned" ON employee_payroll FOR SELECT TO authenticated
USING (is_jtc_consultant() AND customer_id IN (
    SELECT customer_id FROM customer_consultant WHERE consultant_id = get_consultant_id() AND is_active = true));
CREATE POLICY "JTC insert" ON employee_payroll FOR INSERT TO authenticated WITH CHECK (is_jtc_consultant());
CREATE POLICY "JTC update" ON employee_payroll FOR UPDATE TO authenticated
USING (is_jtc_consultant()) WITH CHECK (is_jtc_consultant());

CREATE OR REPLACE FUNCTION update_employee_payroll_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_emp_payroll_updated_at BEFORE UPDATE ON employee_payroll
FOR EACH ROW EXECUTE FUNCTION update_employee_payroll_updated_at();

COMMENT ON TABLE employee_payroll IS 'Employee master data for monthly PPh21 payroll calculation';
