-- Phase 2.2: persist Claude-generated draft suggestions with history.
-- Phase 2 (✨ button) + Phase 2.1 (auto-trigger on customer message) were
-- ephemeral / single-column. Now both pathways INSERT into customer_ai_draft.
-- The customer_ai_thread.auto_draft column is preserved for backward compat
-- and will be deprecated in Phase 2.3.
--
-- Operator-tier only: customers must never see draft history (persona masking
-- depends on customer not knowing a draft was AI-generated). RLS pins this.

CREATE TABLE IF NOT EXISTS customer_ai_draft (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES customer_ai_thread(id) ON DELETE CASCADE,
  draft_text    TEXT NOT NULL,
  source        VARCHAR(20) NOT NULL CHECK (source IN ('manual', 'auto')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'applied')),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_draft_thread_recent
  ON customer_ai_draft(thread_id, generated_at DESC);

COMMENT ON TABLE customer_ai_draft IS
  'Phase 2.2 — Claude-generated reply draft history per thread. Operator-tier RLS only, never exposed to customer (would break AI persona masking).';

ALTER TABLE customer_ai_draft ENABLE ROW LEVEL SECURITY;

-- Operator-tier read drafts
CREATE POLICY "Operator-tier read drafts" ON customer_ai_draft
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

-- Operator-tier write drafts (INSERT/UPDATE/DELETE)
CREATE POLICY "Operator-tier write drafts" ON customer_ai_draft
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

-- Block platform admin explicitly (consistent with thread + message tables)
CREATE POLICY "Block platform admin" ON customer_ai_draft
  FOR ALL TO authenticated
  USING (NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'PLATFORM_ADMIN'
      AND is_active = TRUE
  ));
