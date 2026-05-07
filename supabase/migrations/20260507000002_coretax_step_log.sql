-- Coretax 4단계 처리 로그 — PDF 「백오피스_상담원」 p.9-11.
--
-- 상담원이 Coretax 외부 사이트에서 수행한 작업을 우리 시스템에 누적 기록한다.
-- 4단계(접속/ID Billing/NTPN/신고완료·BPE) + 체크리스트 5항목 + 자유 로그.
-- step 열은 의미적 단계 키, action 열은 단계 안의 세부 액션.

CREATE TABLE IF NOT EXISTS coretax_step_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES djp_submission_queue(id) ON DELETE CASCADE,

  -- 단계 키 (코드)
  --   ACCESS         : 1. Coretax 접속
  --   ID_BILLING     : 2. ID Billing 발행
  --   CONFIRM_NTPN   : 3. 고객 NTPN 확인
  --   COMPLETE       : 4. 신고완료 / BPE
  --   CHECKLIST      : 우측 체크리스트 5항목
  --   QUICK_ACTION   : 접근권한 요청 / 납부증빙 요청 등 부수 액션
  --   MANUAL         : 자유 입력 로그
  step VARCHAR(40) NOT NULL,

  -- 단계 내 세부 액션 (예: 'opened-new-tab', 'recorded-billing-id', 'verified-ntpn',
  -- 'reflected-bpe', 'checklist:coretax-login=완료', 'request-access', 'manual-note')
  action VARCHAR(60) NOT NULL,

  -- 자유 폼 페이로드 (Billing ID, NTPN, 메모 등)
  value JSONB DEFAULT '{}'::jsonb,

  actor_user_id UUID REFERENCES auth.users(id),
  actor_label VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cstep_case ON coretax_step_log(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cstep_step ON coretax_step_log(step, created_at DESC);

ALTER TABLE coretax_step_log ENABLE ROW LEVEL SECURITY;

-- 운영팀(operator+) 전원 read; insert는 service-role admin client 경유로만 들어가니
-- RLS는 일반 escalation 차단용.
DROP POLICY IF EXISTS coretax_step_read ON coretax_step_log;
CREATE POLICY coretax_step_read
  ON coretax_step_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR','TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

DROP POLICY IF EXISTS coretax_step_write ON coretax_step_log;
CREATE POLICY coretax_step_write
  ON coretax_step_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR','TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

COMMENT ON TABLE coretax_step_log IS
  'Coretax 4단계 처리 + 체크리스트 + 수동 로그. application은 service-role admin client로 insert.';
