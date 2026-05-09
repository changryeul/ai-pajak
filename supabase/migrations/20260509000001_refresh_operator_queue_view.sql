-- Refresh operator_submission_queue view so newly added columns
-- (closing_session_id from 20260507000003) become visible to the API layer.
-- PostgreSQL views snapshot the column list at creation time; SELECT * does
-- NOT auto-pick up columns added later. CREATE OR REPLACE VIEW with the same
-- expression re-resolves the columns.

CREATE OR REPLACE VIEW operator_submission_queue AS
  SELECT * FROM djp_submission_queue;

COMMENT ON VIEW operator_submission_queue IS
  'Alias view over djp_submission_queue. Recreated 2026-05-09 to expose closing_session_id to /api/operator/queue.';
