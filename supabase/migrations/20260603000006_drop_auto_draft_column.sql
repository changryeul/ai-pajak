-- Phase 2.3: customer_ai_thread.auto_draft + auto_draft_at columns DROP.
-- All draft data moved to customer_ai_draft table (Phase 2.2 commit e0ca8e3).
-- Backward-compat guard no longer needed — throttle now reads
-- customer_ai_draft.generated_at directly.
ALTER TABLE customer_ai_thread
  DROP COLUMN IF EXISTS auto_draft,
  DROP COLUMN IF EXISTS auto_draft_at;
