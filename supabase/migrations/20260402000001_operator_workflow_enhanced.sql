-- ============================================================
-- Operator Workflow Enhanced: Auto-assign, Reassignment, Complaints, Statistics
-- ============================================================

-- 1. Add reassignment columns to djp_submission_queue
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS reassigned_from UUID REFERENCES tax_operators(id);
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS reassignment_reason TEXT;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS reassigned_by UUID REFERENCES auth.users(id);

-- 2. Add missing columns to operator_client_assignments (used by API but not in original migration)
ALTER TABLE operator_client_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE operator_client_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);
ALTER TABLE operator_client_assignments ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMP WITH TIME ZONE;

-- 3. Queue reassignment history
CREATE TABLE IF NOT EXISTS queue_reassignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID NOT NULL REFERENCES djp_submission_queue(id) ON DELETE CASCADE,
  from_operator_id UUID REFERENCES tax_operators(id),
  to_operator_id UUID REFERENCES tax_operators(id),
  reassigned_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status_at_reassignment VARCHAR(30) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qrh_queue_item ON queue_reassignment_history(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_qrh_from_operator ON queue_reassignment_history(from_operator_id);
CREATE INDEX IF NOT EXISTS idx_qrh_to_operator ON queue_reassignment_history(to_operator_id);

-- 4. Customer complaints
CREATE TABLE IF NOT EXISTS customer_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  operator_id UUID REFERENCES tax_operators(id),
  queue_item_id UUID REFERENCES djp_submission_queue(id),
  complaint_type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CHECK (complaint_type IN ('delay', 'error', 'communication', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_cc_customer ON customer_complaints(customer_id);
CREATE INDEX IF NOT EXISTS idx_cc_operator ON customer_complaints(operator_id);
CREATE INDEX IF NOT EXISTS idx_cc_status ON customer_complaints(status);
CREATE INDEX IF NOT EXISTS idx_cc_queue_item ON customer_complaints(queue_item_id);

-- 5. Index for unassigned queue items (auto-assign queries)
CREATE INDEX IF NOT EXISTS idx_dsq_unassigned
  ON djp_submission_queue(status) WHERE operator_id IS NULL AND status = 'PENDING';

-- 6. Index for active assignment lookups
CREATE INDEX IF NOT EXISTS idx_oca_active
  ON operator_client_assignments(customer_id, operator_id) WHERE is_active = TRUE;

-- 7. RLS Policies

ALTER TABLE queue_reassignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_complaints ENABLE ROW LEVEL SECURITY;

-- Reassignment history: operators see own, supervisors see all
CREATE POLICY qrh_read ON queue_reassignment_history FOR SELECT
  USING (
    from_operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
    OR to_operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

CREATE POLICY qrh_admin ON queue_reassignment_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- Complaints: operator sees own, customer sees own, supervisors see all
CREATE POLICY cc_read ON customer_complaints FOR SELECT
  USING (
    operator_id IN (SELECT id FROM tax_operators WHERE user_id = auth.uid())
    OR customer_id IN (SELECT id FROM customer WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

CREATE POLICY cc_admin ON customer_complaints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- 8. Trigger for updated_at on customer_complaints
CREATE TRIGGER update_customer_complaints_updated_at
  BEFORE UPDATE ON customer_complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Refresh views after schema changes
CREATE OR REPLACE VIEW operator_submission_queue AS SELECT * FROM djp_submission_queue;
CREATE OR REPLACE VIEW operator_assignments AS SELECT * FROM operator_client_assignments;
