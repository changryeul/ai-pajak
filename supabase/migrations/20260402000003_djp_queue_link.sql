-- ============================================================
-- Link operator queue to DJP job system
-- ============================================================

-- 1. Add columns to link djp_submission_queue with djp_job and tax_filing
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS djp_job_id UUID;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS tax_filing_id UUID;
ALTER TABLE djp_submission_queue ADD COLUMN IF NOT EXISTS submitted_to_djp_by UUID REFERENCES auth.users(id);

-- 2. Index for job lookups
CREATE INDEX IF NOT EXISTS idx_dsq_djp_job ON djp_submission_queue(djp_job_id) WHERE djp_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dsq_tax_filing ON djp_submission_queue(tax_filing_id) WHERE tax_filing_id IS NOT NULL;

-- 3. Refresh view
CREATE OR REPLACE VIEW operator_submission_queue AS SELECT * FROM djp_submission_queue;
