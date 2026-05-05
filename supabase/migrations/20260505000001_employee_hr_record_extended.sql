-- Employee HR Record — extended fields for AI Payroll Employee Master.
-- Adds the personal/employment/payroll/contract fields required by the
-- EmployeePersonnelRecord screen plus JSONB columns for sub-records
-- (family, education, career, promotions, movements, rewards).

ALTER TABLE employee_payroll
  -- Personal extras
  ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(40),
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(120),
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10),

  -- Employment / contract status
  ADD COLUMN IF NOT EXISTS work_location VARCHAR(120),
  ADD COLUMN IF NOT EXISTS supervisor VARCHAR(120),
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30),  -- PKWTT / PKWT / Probation / Intern / Daily Worker
  ADD COLUMN IF NOT EXISTS contract_status VARCHAR(30),    -- Active / Probation / Resigned / Terminated / Suspended
  ADD COLUMN IF NOT EXISTS probation_end DATE,
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(30),      -- PKWTT / PKWT / Internship / Consultant / Daily Worker

  -- Family / PTKP
  ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dependents VARCHAR(10),

  -- Payroll components (granular allowances)
  ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS meal_allowance NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS other_allowance NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS pph21_method VARCHAR(20),       -- Gross / Gross-up / Nett

  -- BPJS / insurance
  ADD COLUMN IF NOT EXISTS bpjs_kesehatan VARCHAR(30),     -- Active / Inactive / Not Registered
  ADD COLUMN IF NOT EXISTS bpjs_kesehatan_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS bpjs_tk VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bpjs_tk_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS private_insurance VARCHAR(255),

  -- Expat
  ADD COLUMN IF NOT EXISTS passport_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS kitas_no VARCHAR(40),
  ADD COLUMN IF NOT EXISTS work_permit_expiry DATE,
  ADD COLUMN IF NOT EXISTS tax_residency VARCHAR(60),

  -- Photo (Supabase storage path or CDN url)
  ADD COLUMN IF NOT EXISTS photo_url TEXT,

  -- Sub-records as JSONB arrays (rarely queried independently)
  ADD COLUMN IF NOT EXISTS family JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS career JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS movements JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN employee_payroll.preferred_name IS 'Latin / preferred name shown alongside full_name';
COMMENT ON COLUMN employee_payroll.employment_status IS 'PKWTT / PKWT / Probation / Intern / Daily Worker';
COMMENT ON COLUMN employee_payroll.contract_status IS 'Active / Probation / Resigned / Terminated / Suspended';
COMMENT ON COLUMN employee_payroll.basic_salary IS 'Base monthly salary (excluding allowances). Distinct from gross_salary which is the legacy aggregate.';
COMMENT ON COLUMN employee_payroll.pph21_method IS 'Gross / Gross-up / Nett — drives PPh 21 withholding behavior.';
COMMENT ON COLUMN employee_payroll.family IS 'Array of family members: [{ relation, name, dob, nik, occupation, dependent }]';
COMMENT ON COLUMN employee_payroll.education IS 'Array of education entries: [{ level, major, school, city, year }]';
COMMENT ON COLUMN employee_payroll.career IS 'Array of prior career entries: [{ period, company, jobTitle, reason }]';
COMMENT ON COLUMN employee_payroll.promotions IS 'Array of promotions: [{ date, previousTitle, newTitle, reason }]';
COMMENT ON COLUMN employee_payroll.movements IS 'Array of internal department movements: [{ date, previousDept, newDept, reason }]';
COMMENT ON COLUMN employee_payroll.rewards IS 'Array of rewards & disciplinary records: [{ date, type, title, note }]';

-- Speed up search by name and number
CREATE INDEX IF NOT EXISTS idx_emp_payroll_name_lower
  ON employee_payroll (customer_id, lower(employee_name));
