-- Add new operator roles to user_role_type enum
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'TAX_OPERATOR';
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'TAX_OPERATOR_LEAD';
ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'TAX_OPERATOR_SUPERVISOR';

-- Tax Operators (상담원) for Phase 1 DJP manual submission
CREATE TABLE IF NOT EXISTS tax_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(30) NOT NULL DEFAULT 'tax_operator',
  max_clients INT NOT NULL DEFAULT 35,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (role IN ('tax_operator', 'tax_operator_lead', 'tax_operator_supervisor')),
  CHECK (status IN ('active', 'on_leave', 'inactive'))
);

-- Operator-Client assignments
CREATE TABLE IF NOT EXISTS operator_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL, -- references customers table
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unassigned_date DATE,
  assignment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(operator_id, customer_id, assigned_date)
);

-- DJP submission queue (manual filing tracking)
CREATE TABLE IF NOT EXISTS djp_submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id),
  customer_id UUID NOT NULL,
  tax_type VARCHAR(20) NOT NULL, -- PPh21, PPh23, PPN, PPh_FINAL
  tax_period_month INT NOT NULL,
  tax_period_year INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  ebilling_code VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  -- PENDING -> DATA_REVIEW -> EBILLING_GENERATED -> PAYMENT_CONFIRMED -> DJP_SUBMITTED -> BPE_UPLOADED -> COMPLETED
  bpe_number VARCHAR(50),
  bpe_date DATE,
  bpe_file_url TEXT,
  submitted_to_djp_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (status IN ('PENDING', 'DATA_REVIEW', 'EBILLING_GENERATED', 'PAYMENT_CONFIRMED', 'DJP_SUBMITTED', 'BPE_UPLOADED', 'COMPLETED', 'FAILED')),
  UNIQUE(customer_id, tax_type, tax_period_month, tax_period_year)
);

-- Operator performance tracking
CREATE TABLE IF NOT EXISTS operator_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES tax_operators(id) ON DELETE CASCADE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  total_submissions INT DEFAULT 0,
  successful_submissions INT DEFAULT 0,
  failed_submissions INT DEFAULT 0,
  total_processing_time_minutes INT DEFAULT 0,
  average_processing_time_minutes DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(operator_id, period_month, period_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tax_operators_user_id ON tax_operators(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_operators_status ON tax_operators(status);
CREATE INDEX IF NOT EXISTS idx_oca_operator ON operator_client_assignments(operator_id) WHERE unassigned_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_oca_customer ON operator_client_assignments(customer_id) WHERE unassigned_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_dsq_operator ON djp_submission_queue(operator_id);
CREATE INDEX IF NOT EXISTS idx_dsq_status ON djp_submission_queue(status);
CREATE INDEX IF NOT EXISTS idx_dsq_period ON djp_submission_queue(tax_period_year, tax_period_month);

-- Note: user_roles.role uses user_role_type enum, new values added at top of this file

-- RLS Policies
ALTER TABLE tax_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE djp_submission_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_performance_logs ENABLE ROW LEVEL SECURITY;

-- Operators can see their own data
CREATE POLICY tax_operators_own ON tax_operators FOR SELECT
  USING (user_id = auth.uid());

-- Leads/Supervisors can see all operators (handled via API with role check)
CREATE POLICY tax_operators_admin ON tax_operators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- Assignments: operator sees own, leads see all
CREATE POLICY oca_own ON operator_client_assignments FOR SELECT
  USING (
    operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
  );

CREATE POLICY oca_admin ON operator_client_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- Queue: operator sees own assignments
CREATE POLICY dsq_own ON djp_submission_queue FOR ALL
  USING (
    operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- Performance: same as operators
CREATE POLICY opl_own ON operator_performance_logs FOR SELECT
  USING (
    operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tax_operators_updated_at
  BEFORE UPDATE ON tax_operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dsq_updated_at
  BEFORE UPDATE ON djp_submission_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
