-- ============================================================
-- Auto-Approval: Rules table + queue columns
-- ============================================================

-- 1. Approval rules (configurable thresholds for auto-approval)
CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'default',
  is_active BOOLEAN DEFAULT TRUE,
  -- Individual thresholds
  min_ocr_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.85,
  max_risk_score INT NOT NULL DEFAULT 30,
  min_compliance_score INT NOT NULL DEFAULT 75,
  min_validation_score INT NOT NULL DEFAULT 85,
  min_trust_score INT NOT NULL DEFAULT 70,
  -- Maximum amount for auto-approval (above this → manual review)
  max_auto_approve_amount DECIMAL(15,2) NOT NULL DEFAULT 10000000.00,
  -- Meta
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default rule
INSERT INTO approval_rules (name, is_active) VALUES ('default', true);

-- 2. Add auto-approval columns to djp_submission_queue
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS auto_approval_score DECIMAL(5,2);
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS auto_approval_details JSONB;

-- 3. Index for auto-approved items
CREATE INDEX IF NOT EXISTS idx_dsq_auto_approved
  ON djp_submission_queue(auto_approved) WHERE auto_approved = TRUE;

-- 4. RLS for approval_rules
ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_read ON approval_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

CREATE POLICY ar_admin ON approval_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text IN ('PLATFORM_ADMIN', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR')
    )
  );

-- 5. Trigger
CREATE TRIGGER update_approval_rules_updated_at
  BEFORE UPDATE ON approval_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Refresh view
CREATE OR REPLACE VIEW operator_submission_queue AS SELECT * FROM djp_submission_queue;
