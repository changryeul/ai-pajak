-- ============================================================================
-- Repoint operator_message.assigned_operator_id from tax_operators(id) → auth.users(id).
--
-- Why: the rest of the operator workspace (queue, review, approval) authorises
-- via `user_roles` only and never requires a row in `tax_operators`. We
-- accidentally tied messenger RLS to `tax_operators(id)`, so a perfectly valid
-- operator/supervisor whose `tax_operators` row hadn't been provisioned could
-- not see their own thread (RLS matched on get_tax_operator_id() which
-- returned NULL).
--
-- Fix: store the operator's `auth.users.id` directly. RLS then compares to
-- `auth.uid()`. `tax_operators` becomes purely an evaluation/performance
-- bookkeeping table again, not an authorisation gate.
--
-- Safe because: operator_message is empty in every environment we've shipped
-- (verified before this migration runs).
-- ============================================================================

ALTER TABLE operator_message
  DROP CONSTRAINT operator_message_assigned_operator_id_fkey;

ALTER TABLE operator_message
  ADD  CONSTRAINT operator_message_assigned_operator_id_fkey
  FOREIGN KEY (assigned_operator_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ---------------- RLS — re-target operator policies to auth.uid() ----------------

DROP POLICY "Operator reads assigned messages"  ON operator_message;
DROP POLICY "Operator updates read receipt"     ON operator_message;

CREATE POLICY "Operator reads assigned messages"
ON operator_message FOR SELECT
TO authenticated
USING (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = auth.uid()
  )
);

CREATE POLICY "Operator updates read receipt"
ON operator_message FOR UPDATE
TO authenticated
USING (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = auth.uid()
  )
)
WITH CHECK (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = auth.uid()
  )
);

-- get_tax_operator_id() is no longer used by anything else in the schema.
DROP FUNCTION IF EXISTS get_tax_operator_id();
