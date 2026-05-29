-- Customer ↔ AI 상담원 messenger Phase 1 MVP.
-- - customer_ai_thread: 1 row per (customer × tax case context)
-- - customer_ai_message: messages in a thread, customer or operator sender
-- Customer view always shows operator messages as "AI 상담원" (persona
-- masking enforced at API layer, not DB).

CREATE TABLE customer_ai_thread (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  customer_user_id            UUID NOT NULL REFERENCES auth.users(id),
  context_kind                TEXT NOT NULL,
  context_period              TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'AWAITING_OPERATOR',
  customer_unread_count       INTEGER NOT NULL DEFAULT 0,
  operator_unread_count       INTEGER NOT NULL DEFAULT 0,
  last_customer_message_at    TIMESTAMPTZ,
  last_operator_message_at    TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, context_kind, context_period)
);

CREATE INDEX customer_ai_thread_customer_idx ON customer_ai_thread(customer_id);
CREATE INDEX customer_ai_thread_operator_unread_idx
  ON customer_ai_thread(operator_unread_count)
  WHERE operator_unread_count > 0;

COMMENT ON TABLE customer_ai_thread IS
  'Customer ↔ AI 상담원 thread (Phase 1 MVP). 1 row per (customer × context_kind × period). Operator messages persona-masked to "AI 상담원" on customer endpoints.';

CREATE TABLE customer_ai_message (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id           UUID NOT NULL REFERENCES customer_ai_thread(id) ON DELETE CASCADE,
  sender_role         TEXT NOT NULL,
  sender_user_id      UUID REFERENCES auth.users(id),
  content             TEXT NOT NULL,
  customer_read_at    TIMESTAMPTZ,
  operator_read_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX customer_ai_message_thread_idx ON customer_ai_message(thread_id, created_at);

COMMENT ON TABLE customer_ai_message IS
  'Messages in customer_ai_thread. sender_role = customer | operator. customer endpoint always returns operator messages as "AI 상담원" (persona masking).';

-- ── RLS ──
ALTER TABLE customer_ai_thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ai_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_ai_thread_customer_select ON customer_ai_thread
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY customer_ai_thread_customer_insert ON customer_ai_thread
  FOR INSERT TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

CREATE POLICY customer_ai_thread_operator_all ON customer_ai_thread
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  );

CREATE POLICY customer_ai_message_customer_select ON customer_ai_message
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM customer_ai_thread t
            WHERE t.id = thread_id AND t.customer_user_id = auth.uid())
  );

CREATE POLICY customer_ai_message_customer_insert ON customer_ai_message
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'customer'
    AND EXISTS (SELECT 1 FROM customer_ai_thread t
                WHERE t.id = thread_id AND t.customer_user_id = auth.uid())
  );

CREATE POLICY customer_ai_message_operator_all ON customer_ai_message
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
              AND role IN ('TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER')
              AND is_active = true)
  );
