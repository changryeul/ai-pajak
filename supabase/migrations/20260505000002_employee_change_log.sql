-- Employee HR Record — change history.
-- Captures field-level diffs whenever an employee_payroll row is updated
-- (and a single row when a new employee is registered).
--
-- The application layer fills in `section` (which UI block the field belongs
-- to) so the same log can drive every "기본정보 변경 이력 / 고용정보 변경 이력 …"
-- panel in the Employee Master detail screen.

CREATE TABLE IF NOT EXISTS employee_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employee_payroll(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,

  -- Which UI section the change belongs to (basic, employment, family, education,
  -- career, movements, promotions, rewards, payroll, tax_bpjs, bank, contract,
  -- expat, notes, employee).
  section VARCHAR(40) NOT NULL,

  -- Affected field. For scalar columns this is the column name (snake_case);
  -- for JSONB sub-record changes we use the array name itself ("family",
  -- "education", etc) and store the entire array snapshot in old_value/new_value.
  field VARCHAR(80) NOT NULL,

  old_value TEXT,
  new_value TEXT,

  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_label VARCHAR(120),  -- denormalized actor label (e.g. "HR Admin", "Tax Admin")
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_change_log_employee ON employee_change_log(employee_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_change_log_section ON employee_change_log(employee_id, section, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_change_log_customer ON employee_change_log(customer_id, changed_at DESC);

ALTER TABLE employee_change_log ENABLE ROW LEVEL SECURITY;

-- Customers see their own employees' change logs.
CREATE POLICY emp_change_log_customer_select
  ON employee_change_log FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid()));

-- Block platform admins from any access (Hard Rule 1: PLATFORM_ADMIN cannot see tax/HR data).
CREATE POLICY emp_change_log_block_admin
  ON employee_change_log FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'PLATFORM_ADMIN'
      AND is_active = TRUE
  ));

-- Consultants of the same tax_partner can read.
CREATE POLICY emp_change_log_consultant_select
  ON employee_change_log FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT cc.customer_id
      FROM customer_consultant cc
      JOIN consultant c ON c.id = cc.consultant_id
      WHERE c.tax_partner_id = get_consultant_tax_partner_id()
        AND cc.is_active = TRUE
    )
  );

COMMENT ON TABLE employee_change_log IS 'Field-level history for employee_payroll rows. Application-layer writes diffs on every update.';
