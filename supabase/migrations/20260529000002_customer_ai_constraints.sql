-- Phase 1 Task 1 follow-up: add CHECK constraints + sender_role pinning
-- to the operator-insert policy + auto-bump trigger for updated_at + index
-- on customer_user_id for RLS predicate performance.
--
-- Why a separate migration: 20260529000001 already applied to prod;
-- amending it would cause drift on environments that picked it up.

-- ── CHECK constraints: enum-like TEXT columns ──
ALTER TABLE customer_ai_thread
  ADD CONSTRAINT customer_ai_thread_context_kind_chk
    CHECK (context_kind IN ('PPH21', 'PPH23', 'PPN', 'CLOSING', 'OTHER'));

ALTER TABLE customer_ai_thread
  ADD CONSTRAINT customer_ai_thread_status_chk
    CHECK (status IN ('AWAITING_OPERATOR', 'RESPONDED', 'RESOLVED'));

ALTER TABLE customer_ai_message
  ADD CONSTRAINT customer_ai_message_sender_role_chk
    CHECK (sender_role IN ('customer', 'operator'));

-- ── Sender_role pinning on operator policy ──
-- Without this, a compromised operator could insert sender_role='customer'
-- and impersonate the customer view in their own thread. Pinning at WITH
-- CHECK ensures operator inserts ALWAYS have sender_role='operator'.
DROP POLICY IF EXISTS customer_ai_message_operator_all ON customer_ai_message;
CREATE POLICY customer_ai_message_operator_all ON customer_ai_message
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  )
  WITH CHECK (
    sender_role = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles
                WHERE user_id = auth.uid()
                  AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
                  AND is_active = true)
  );

-- ── updated_at auto-bump trigger ──
-- Use a project-local trigger function (idempotent CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION customer_ai_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_ai_thread_updated_at_trg ON customer_ai_thread;
CREATE TRIGGER customer_ai_thread_updated_at_trg
  BEFORE UPDATE ON customer_ai_thread
  FOR EACH ROW EXECUTE FUNCTION customer_ai_set_updated_at();

-- ── Perf index for RLS predicate ──
CREATE INDEX IF NOT EXISTS customer_ai_thread_user_idx
  ON customer_ai_thread(customer_user_id);
