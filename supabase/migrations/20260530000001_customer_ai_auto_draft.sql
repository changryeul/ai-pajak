-- Phase 2.1: auto-draft on customer message arrival
-- See docs/superpowers/specs/2026-05-30-customer-ai-chat-phase2-1-design.md

ALTER TABLE customer_ai_thread
  ADD COLUMN auto_draft TEXT,
  ADD COLUMN auto_draft_at TIMESTAMPTZ;

COMMENT ON COLUMN customer_ai_thread.auto_draft IS
  'Latest AI-generated draft suggestion for operator (Phase 2.1). NULL when no pending draft.';
COMMENT ON COLUMN customer_ai_thread.auto_draft_at IS
  'When auto_draft was generated. NULL when auto_draft is NULL.';
