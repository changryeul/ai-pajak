-- Annual closing submission record.
-- Acts as the bridge between the customer wizard and the operator workflow.
-- When DJP Coretax API is wired the same row receives the API response;
-- until then the row sits in 'SUBMITTED' state for an operator to handle
-- via RPA / manual portal upload.

CREATE TABLE IF NOT EXISTS closing_submission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tax_closing_session(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
    status IN ('SUBMITTED', 'OPERATOR_REVIEW', 'PROCESSING', 'BPE_UPLOADED', 'COMPLETED', 'FAILED', 'CANCELLED')
  ),
  channel TEXT NOT NULL DEFAULT 'RPA' CHECK (channel IN ('RPA', 'CORETAX_API')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  bpe_number TEXT,
  bpe_uploaded_at TIMESTAMPTZ,
  ntpn TEXT,
  operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  failure_reason TEXT,
  package_summary JSONB NOT NULL DEFAULT '{}'::jsonb, -- attached docs, billing code, totals
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_closing_submission_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_closing_submission_session ON closing_submission(session_id);
CREATE INDEX IF NOT EXISTS idx_closing_submission_status ON closing_submission(status);

-- updated_at trigger reusing the existing helper from session migration.
CREATE OR REPLACE FUNCTION touch_closing_submission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_closing_submission ON closing_submission;
CREATE TRIGGER trg_touch_closing_submission
  BEFORE UPDATE ON closing_submission
  FOR EACH ROW
  EXECUTE FUNCTION touch_closing_submission_updated_at();

ALTER TABLE closing_submission ENABLE ROW LEVEL SECURITY;

-- Customer can read/write their own submissions.
CREATE POLICY closing_submission_owner_select ON closing_submission
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

CREATE POLICY closing_submission_owner_modify ON closing_submission
  FOR ALL TO authenticated
  USING (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT s.id FROM tax_closing_session s
    JOIN customer c ON c.id = s.customer_id
    WHERE c.user_id = auth.uid()
  ));

-- Operator roles need to see all submissions to triage them.
-- We rely on the existing user metadata role checks done at API middleware
-- layer; storage-level RLS for operators uses the service role from server
-- code, so no additional policy needed here.

COMMENT ON TABLE closing_submission IS
  'Bridges the customer-facing closing wizard to operator workflow / Coretax submission. status=SUBMITTED until operator picks up; channel switches to CORETAX_API once DJP integration is enabled.';
