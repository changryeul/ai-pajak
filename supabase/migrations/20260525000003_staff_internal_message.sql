-- 20260525000003_staff_internal_message.sql
--
-- Supervisor ↔ Operator 1:1 내부 대화 (PDF "수퍼바이저 화면 메신저 포함 20260525" p.21).
--
-- 기존 `operator_message` 와 의도적으로 분리한다:
--   • operator_message: 케이스/고객 단위, CUSTOMER + INTERNAL 2채널, 고객도 볼 수 있는
--     CUSTOMER 채널이 존재. 운영 흐름에 묶임.
--   • staff_internal_message: 고객·케이스 무관, 순수 staff 내부 지시·논의용. 고객은
--     RLS 로 절대 못 본다 ("Hidden from Customer" badge 의 데이터 근거).
--
-- 한 supervisor 와 한 operator (auth.users.id) 의 pair 가 conversation key.
-- supervisor 가 어떤 partner 의 supervisor 인지 / operator 가 어떤 supervisor 산하
-- 인지는 별도 (consultant_supervisor / tax_operators) 테이블이 갖고 있음. 이 테이블은
-- pair-level 사실만 저장.

CREATE TABLE IF NOT EXISTS staff_internal_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_user_id UUID NOT NULL REFERENCES auth.users(id),
  operator_user_id UUID NOT NULL REFERENCES auth.users(id),
  sender_user_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  attachment_url TEXT,
  read_at_by_supervisor TIMESTAMPTZ,
  read_at_by_operator TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- sender 는 둘 중 하나여야 한다.
  CONSTRAINT staff_internal_message_sender_in_pair CHECK (
    sender_user_id = supervisor_user_id OR sender_user_id = operator_user_id
  ),
  -- pair 자체는 self-conversation 금지 (supervisor 와 operator 가 동일 user 면 의미 없음).
  CONSTRAINT staff_internal_message_pair_distinct CHECK (
    supervisor_user_id <> operator_user_id
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_internal_message_pair_created
  ON staff_internal_message(supervisor_user_id, operator_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_internal_message_operator_unread
  ON staff_internal_message(operator_user_id) WHERE read_at_by_operator IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_internal_message_supervisor_unread
  ON staff_internal_message(supervisor_user_id) WHERE read_at_by_supervisor IS NULL;

ALTER TABLE staff_internal_message ENABLE ROW LEVEL SECURITY;

-- ─── RLS ──────────────────────────────────────────────────────────────
--
-- Hard rule: customer / consultant / platform_admin 은 절대 못 본다.
-- supervisor 본인 또는 operator 본인 (auth.uid()) 이 행의 supervisor_user_id
-- 또는 operator_user_id 와 일치할 때만 SELECT.

DROP POLICY IF EXISTS "staff message read own" ON staff_internal_message;
CREATE POLICY "staff message read own"
  ON staff_internal_message FOR SELECT
  TO authenticated
  USING (
    supervisor_user_id = (SELECT auth.uid())
    OR operator_user_id = (SELECT auth.uid())
  );

-- INSERT 도 본인이 sender 일 때만.
DROP POLICY IF EXISTS "staff message send own" ON staff_internal_message;
CREATE POLICY "staff message send own"
  ON staff_internal_message FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_user_id = (SELECT auth.uid())
    AND (
      supervisor_user_id = (SELECT auth.uid())
      OR operator_user_id = (SELECT auth.uid())
    )
  );

-- 본인 측 read_at 만 UPDATE 가능.
DROP POLICY IF EXISTS "staff message mark read own" ON staff_internal_message;
CREATE POLICY "staff message mark read own"
  ON staff_internal_message FOR UPDATE
  TO authenticated
  USING (
    supervisor_user_id = (SELECT auth.uid())
    OR operator_user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    supervisor_user_id = (SELECT auth.uid())
    OR operator_user_id = (SELECT auth.uid())
  );

COMMENT ON TABLE staff_internal_message IS
  'Supervisor ↔ Operator 1:1 내부 대화. 고객·케이스 무관, customer 는 RLS 로 차단.';
