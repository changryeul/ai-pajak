-- ============================================================================
-- Operator Messenger (PDF: "AI Pajak 상담원화면_2단_메신저 포함")
--
-- 2-channel messaging for the operator workspace:
--   • CUSTOMER  channel — operator ↔ customer, externally visible
--   • INTERNAL  channel — operator ↔ supervisor, hidden from customer
--
-- Hard rules enforced by this schema + RLS:
--   1) Customer can never see the INTERNAL channel.
--   2) Operator messages on the CUSTOMER channel are always masked to the
--      customer as `AI_PAJAK` (display_sender), so the customer never sees
--      that a supervisor exists or which operator is on the case.
--   3) PLATFORM_ADMIN has zero access (no policy = denied).
--
-- The legacy `consultation_message` table stays for the customer↔consultant
-- 1:1 chat used elsewhere; this is a separate surface.
-- ============================================================================

CREATE TYPE operator_message_channel AS ENUM (
  'CUSTOMER',   -- visible to the customer
  'INTERNAL'    -- hidden from customer, operator ↔ supervisor only
);

CREATE TYPE operator_message_sender_role AS ENUM (
  'CUSTOMER',
  'OPERATOR',
  'SUPERVISOR',
  'SYSTEM'
);

-- What the recipient screen renders as the sender label.
-- `AI_PAJAK` is the masking value the customer sees in place of OPERATOR/SUPERVISOR.
CREATE TYPE operator_message_display_sender AS ENUM (
  'CUSTOMER',
  'AI_PAJAK',
  'OPERATOR',
  'SUPERVISOR',
  'SYSTEM'
);

CREATE TABLE operator_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scoping
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  case_id UUID REFERENCES djp_submission_queue(id) ON DELETE SET NULL,
  channel operator_message_channel NOT NULL,

  -- Authorship (audit)
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role operator_message_sender_role NOT NULL,
  display_sender operator_message_display_sender NOT NULL,

  -- Cached operator assignment at write time, used by RLS so we don't have to
  -- re-join djp_submission_queue / operator_client_assignments on every read.
  assigned_operator_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL,

  -- Content
  body TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  reason_code VARCHAR(50),    -- e.g. CORETAX_LOGIN, FISCAL_RECON, PAYMENT
  attachment_url TEXT,

  -- Read tracking — separate per side so the operator inbox and customer inbox
  -- can each show their own unread count without stepping on each other.
  read_at_by_customer TIMESTAMPTZ,
  read_at_by_operator TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Channel/role consistency: enforce masking + internal-channel role rules
  -- at the row level so a bug in the API can't smuggle a wrong display_sender past us.
  CONSTRAINT operator_message_channel_role_check CHECK (
    -- CUSTOMER channel
    (channel = 'CUSTOMER' AND (
      (sender_role = 'CUSTOMER'   AND display_sender = 'CUSTOMER') OR
      (sender_role = 'OPERATOR'   AND display_sender = 'AI_PAJAK') OR
      (sender_role = 'SYSTEM'     AND display_sender = 'SYSTEM')
    ))
    OR
    -- INTERNAL channel — supervisor/operator both seen by their real role,
    -- and the customer role is forbidden here entirely.
    (channel = 'INTERNAL' AND (
      (sender_role = 'OPERATOR'   AND display_sender = 'OPERATOR') OR
      (sender_role = 'SUPERVISOR' AND display_sender = 'SUPERVISOR') OR
      (sender_role = 'SYSTEM'     AND display_sender = 'SYSTEM')
    ))
  )
);

CREATE INDEX idx_operator_message_customer_channel_created
  ON operator_message(customer_id, channel, created_at DESC);
CREATE INDEX idx_operator_message_case_created
  ON operator_message(case_id, created_at DESC) WHERE case_id IS NOT NULL;
CREATE INDEX idx_operator_message_sender
  ON operator_message(sender_user_id);
CREATE INDEX idx_operator_message_assigned_operator
  ON operator_message(assigned_operator_id) WHERE assigned_operator_id IS NOT NULL;
CREATE INDEX idx_operator_message_unread_customer
  ON operator_message(customer_id) WHERE read_at_by_customer IS NULL AND channel = 'CUSTOMER';
CREATE INDEX idx_operator_message_unread_operator
  ON operator_message(assigned_operator_id) WHERE read_at_by_operator IS NULL;

-- ============================================================================
-- Helper functions
-- ============================================================================

-- Any operator-tier role (staff, lead, supervisor, master).
CREATE OR REPLACE FUNCTION is_operator_any()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role::text IN (
      'TAX_OPERATOR',
      'TAX_OPERATOR_LEAD',
      'TAX_OPERATOR_SUPERVISOR',
      'TAX_OPERATOR_MASTER'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Supervisor tier (supervisor + master). Master inherits supervisor powers.
CREATE OR REPLACE FUNCTION is_operator_supervisor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_active = true
    AND role::text IN ('TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- tax_operators.id for the current user, NULL if not an operator.
CREATE OR REPLACE FUNCTION get_tax_operator_id()
RETURNS UUID AS $$
  SELECT id FROM tax_operators
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS — PLATFORM_ADMIN is intentionally given no policy and therefore denied.
-- ============================================================================

ALTER TABLE operator_message ENABLE ROW LEVEL SECURITY;

-- ---------------- Customer side ----------------
-- Customer only ever sees the CUSTOMER channel for their own customer row.
-- INTERNAL channel is invisible to them — Hard Rule #1.

CREATE POLICY "Customer reads own customer-channel messages"
ON operator_message FOR SELECT
TO authenticated
USING (
  channel = 'CUSTOMER'
  AND is_customer()
  AND customer_id = get_customer_id()
);

CREATE POLICY "Customer sends customer-channel messages"
ON operator_message FOR INSERT
TO authenticated
WITH CHECK (
  channel = 'CUSTOMER'
  AND is_customer()
  AND customer_id = get_customer_id()
  AND sender_user_id = auth.uid()
  AND sender_role = 'CUSTOMER'
  AND display_sender = 'CUSTOMER'
);

-- Customer can mark messages addressed to them as read (writes read_at_by_customer).
-- App layer should restrict the column set; RLS just guards the row.
CREATE POLICY "Customer marks own customer-channel read"
ON operator_message FOR UPDATE
TO authenticated
USING (
  channel = 'CUSTOMER'
  AND is_customer()
  AND customer_id = get_customer_id()
)
WITH CHECK (
  channel = 'CUSTOMER'
  AND is_customer()
  AND customer_id = get_customer_id()
);

-- ---------------- Operator side ----------------
-- Operator (non-supervisor) sees both channels but only for rows where
-- assigned_operator_id matches them. Supervisor/Master see everything.

CREATE POLICY "Operator reads assigned messages"
ON operator_message FOR SELECT
TO authenticated
USING (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = get_tax_operator_id()
  )
);

-- Operator INSERT on CUSTOMER channel — must mask as AI_PAJAK (the CHECK
-- constraint enforces sender_role=OPERATOR ⇒ display_sender=AI_PAJAK; we
-- also re-assert sender_user_id matches auth.uid()).
CREATE POLICY "Operator sends customer-channel messages"
ON operator_message FOR INSERT
TO authenticated
WITH CHECK (
  channel = 'CUSTOMER'
  AND is_operator_any()
  AND sender_user_id = auth.uid()
  AND sender_role = 'OPERATOR'
  AND display_sender = 'AI_PAJAK'
);

-- Operator INSERT on INTERNAL channel — supervisor uses SUPERVISOR role,
-- regular operator uses OPERATOR role. Customer is forbidden here.
CREATE POLICY "Operator sends internal-channel messages"
ON operator_message FOR INSERT
TO authenticated
WITH CHECK (
  channel = 'INTERNAL'
  AND sender_user_id = auth.uid()
  AND (
    (is_operator_supervisor() AND sender_role = 'SUPERVISOR' AND display_sender = 'SUPERVISOR')
    OR
    (is_operator_any()        AND sender_role = 'OPERATOR'   AND display_sender = 'OPERATOR')
  )
);

-- Operator marks operator-side read on rows they can see.
CREATE POLICY "Operator updates read receipt"
ON operator_message FOR UPDATE
TO authenticated
USING (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = get_tax_operator_id()
  )
)
WITH CHECK (
  is_operator_supervisor()
  OR (
    is_operator_any()
    AND assigned_operator_id = get_tax_operator_id()
  )
);
