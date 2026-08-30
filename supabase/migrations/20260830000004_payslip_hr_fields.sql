-- Model B (2026-08-30): the monthly_payslip (filing) row now carries its OWN
-- HR/identity info, fully independent of the employee_payroll master directory.
-- The master is informational only (used to prepare filings, e.g. via CSV);
-- editing HR at filing time must NOT touch the master and vice versa.
--
-- These HR fields previously lived only on employee_payroll and were shown in
-- the filing detail via a join. Add them to monthly_payslip so each filing is
-- a self-contained snapshot editable per period.

ALTER TABLE monthly_payslip
  ADD COLUMN IF NOT EXISTS employee_number   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS employee_nik      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS worker_type       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS position          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS department        VARCHAR(150),
  ADD COLUMN IF NOT EXISTS hire_date         DATE,
  ADD COLUMN IF NOT EXISTS resign_date       DATE;

-- One-time backfill: seed existing payslips from their linked master so nothing
-- shows blank after the switch. New edits are payslip-only from here on.
UPDATE monthly_payslip p SET
  employee_number   = COALESCE(p.employee_number,   e.employee_number),
  employee_nik      = COALESCE(p.employee_nik,      e.employee_nik),
  employment_status = COALESCE(p.employment_status, e.employment_status),
  worker_type       = COALESCE(p.worker_type,       e.worker_type),
  position          = COALESCE(p.position,          e.position),
  department        = COALESCE(p.department,        e.department),
  hire_date         = COALESCE(p.hire_date,         e.hire_date),
  resign_date       = COALESCE(p.resign_date,       e.resign_date)
FROM employee_payroll e
WHERE p.employee_id = e.id;
