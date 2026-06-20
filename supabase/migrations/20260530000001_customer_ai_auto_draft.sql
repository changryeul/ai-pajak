-- Phase 2.1: auto-draft on customer message arrival
-- Phase 2.1: customer_ai_thread 에 auto_draft 컬럼 추가 (background draft).

ALTER TABLE customer_ai_thread
  ADD COLUMN auto_draft TEXT,
  ADD COLUMN auto_draft_at TIMESTAMPTZ;

COMMENT ON COLUMN customer_ai_thread.auto_draft IS
  'Latest AI-generated draft suggestion for operator (Phase 2.1). NULL when no pending draft.';
COMMENT ON COLUMN customer_ai_thread.auto_draft_at IS
  'When auto_draft was generated. NULL when auto_draft is NULL.';
