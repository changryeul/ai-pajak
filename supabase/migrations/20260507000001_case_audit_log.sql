-- Case-level audit log — Supervisor 콘솔의 모든 케이스 이벤트(생성/배정/회수/이관/
-- 승인/반려/지시/Bulk Transfer)를 한 곳에 누적해 감사로그 페이지에 그대로 노출.
--
-- 기존 audit_log는 customer/POA 등 다른 도메인용. case 단위 이벤트는 따로 둔다.

CREATE TABLE IF NOT EXISTS case_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES djp_submission_queue(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,  -- ASSIGNED / RECALLED / REASSIGNED /
                                     -- TRANSFERRED_TO_SV / APPROVED / REJECTED /
                                     -- INSTRUCTED / BULK_TRANSFERRED
  actor_user_id UUID REFERENCES auth.users(id),
  actor_label VARCHAR(120),          -- denormalized — e.g. "최수퍼 (SUP001)"
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_audit_case ON case_audit_log(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_event ON case_audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_audit_created ON case_audit_log(created_at DESC);

ALTER TABLE case_audit_log ENABLE ROW LEVEL SECURITY;

-- 운영팀(operator+) 전원 read; supervisor 이상은 write (실제 mutation은 service-role
-- admin client로 들어가니 RLS는 일반 사용자 escalation 차단용).
DROP POLICY IF EXISTS case_audit_read ON case_audit_log;
CREATE POLICY case_audit_read
  ON case_audit_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR','TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

DROP POLICY IF EXISTS case_audit_write ON case_audit_log;
CREATE POLICY case_audit_write
  ON case_audit_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

COMMENT ON TABLE case_audit_log IS
  'Case-level event feed for the Supervisor 감사로그 화면. Application writes via service-role admin client.';
