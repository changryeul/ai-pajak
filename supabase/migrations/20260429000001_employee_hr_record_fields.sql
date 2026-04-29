-- Employee HR Record — Phase C
-- Extend employee_payroll to act as a proper HR record (직원 인사 기록).
-- Adds personal/contact/job columns alongside existing payroll/identity fields.

ALTER TABLE employee_payroll
  -- Personal
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10),                    -- MALE / FEMALE / OTHER
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20),            -- SINGLE / MARRIED / DIVORCED / WIDOWED
  -- Contact
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address TEXT,
  -- Job
  ADD COLUMN IF NOT EXISTS position VARCHAR(100),                 -- 직책 / 직급
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),               -- 부서
  ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50),           -- 사번
  -- Emergency / notes
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN employee_payroll.birth_date IS 'Employee date of birth';
COMMENT ON COLUMN employee_payroll.gender IS 'Employee gender: MALE/FEMALE/OTHER';
COMMENT ON COLUMN employee_payroll.marital_status IS 'Marital status: SINGLE/MARRIED/DIVORCED/WIDOWED';
COMMENT ON COLUMN employee_payroll.position IS 'Job title / position';
COMMENT ON COLUMN employee_payroll.department IS 'Department / team';
COMMENT ON COLUMN employee_payroll.employee_number IS 'Internal employee/staff number';

CREATE INDEX IF NOT EXISTS idx_emp_payroll_emp_number ON employee_payroll(customer_id, employee_number) WHERE employee_number IS NOT NULL;
