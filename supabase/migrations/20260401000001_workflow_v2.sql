-- ============================================================
-- Workflow V2: 14-step operator workflow with supervisor approval
-- ============================================================

-- 1. Create views to unify table names (API uses different names than migration)
CREATE OR REPLACE VIEW operator_submission_queue AS SELECT * FROM djp_submission_queue;
CREATE OR REPLACE VIEW operator_assignments AS SELECT * FROM operator_client_assignments;

-- 2. Drop old CHECK constraint first, then migrate data, then add new constraint
ALTER TABLE djp_submission_queue DROP CONSTRAINT IF EXISTS djp_submission_queue_status_check;
UPDATE djp_submission_queue SET status = 'PAYMENT_VERIFIED' WHERE status = 'PAYMENT_CONFIRMED';
ALTER TABLE djp_submission_queue ADD CONSTRAINT djp_submission_queue_status_check
  CHECK (status IN (
    'PENDING',
    'DATA_REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'EBILLING_GENERATED',
    'PAYMENT_PENDING',
    'PAYMENT_UPLOADED',
    'PAYMENT_VERIFIED',
    'DJP_SUBMITTED',
    'BPE_UPLOADED',
    'COMPLETED',
    'FAILED'
  ));

-- 3. Add approval columns
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS review_summary JSONB;

-- 4. Add payment proof columns
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(15,2);
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS payment_verified_by UUID REFERENCES auth.users(id);
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP WITH TIME ZONE;

-- 5. Add failed_reason column
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS failed_reason TEXT;

-- 6. Add indexes for new workflow queries
CREATE INDEX IF NOT EXISTS idx_dsq_pending_approval
  ON djp_submission_queue(status) WHERE status = 'PENDING_APPROVAL';
CREATE INDEX IF NOT EXISTS idx_dsq_payment_pending
  ON djp_submission_queue(status) WHERE status = 'PAYMENT_PENDING';

-- 7. (Data migration already done in step 2 above)

-- 8. Recreate views after schema change (views need refresh)
CREATE OR REPLACE VIEW operator_submission_queue AS SELECT * FROM djp_submission_queue;

-- 9. Grant permissions on views for RLS to work through them
-- Note: Views inherit RLS from the underlying table, but we need INSERT/UPDATE/DELETE
-- For writable views, we use INSTEAD OF triggers or direct table access via admin client

-- 10. RLS policy for customers to see their own queue items (for payment proof flow)
CREATE POLICY dsq_customer_read ON djp_submission_queue FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customer WHERE user_id = auth.uid()
    )
  );
