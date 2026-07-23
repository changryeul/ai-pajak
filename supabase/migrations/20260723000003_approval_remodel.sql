-- ============================================================
-- 승인대기 리모델 (v13 수퍼바이저 스펙 §4/§12, 트랙 3 — 2026-07-23)
--
-- 1) 4-값 분리 저장: 고객 입력값 / AI 계산값 / 상담원 처리값 / 최종 승인값을
--    consultant_session_calc 에 컬럼으로 분리한다. 기존 amount 는
--    "유효값"(상담원 처리값 ?? AI 계산값) 의미로 유지 — 발행 보드 등
--    하위 소비자는 변경 없음.
-- 2) 상담원 → 수퍼바이저 검토요청: 상담원이 확신 없는 항목만 올리고
--    수퍼바이저가 의견을 남기는 구조 (거래별 진행상태 나열 대체).
-- ============================================================

ALTER TABLE consultant_session_calc
  ADD COLUMN IF NOT EXISTS customer_input_amount NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS ai_amount NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS consultant_amount NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(18, 2),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 기존 행 backfill: 지금까지의 amount 는 AI 계산값이었다.
UPDATE consultant_session_calc SET ai_amount = amount WHERE ai_amount IS NULL;

COMMENT ON COLUMN consultant_session_calc.customer_input_amount IS '고객 입력/제출값 (있을 때만)';
COMMENT ON COLUMN consultant_session_calc.ai_amount IS 'AI 계산 엔진 산출값';
COMMENT ON COLUMN consultant_session_calc.consultant_amount IS '상담원 처리(수정)값 — NULL 이면 AI 값 채택';
COMMENT ON COLUMN consultant_session_calc.approved_amount IS '수퍼바이저 최종 승인값 (APPROVE 시 스탬프)';

-- ── 상담원 → 수퍼바이저 검토요청 ──────────────────────────────
CREATE TABLE IF NOT EXISTS consultant_review_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES consultant_session(id) ON DELETE CASCADE,
  calc_kind VARCHAR(30),                       -- 관련 계산 항목 (선택)
  item_label VARCHAR(200) NOT NULL,            -- 예: 'NPWP/NIK 처리 기준 확인'
  reason TEXT NOT NULL,                        -- 상담원 요청 사유
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ANSWERED', 'RESOLVED')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  supervisor_comment TEXT,                     -- 수퍼바이저 검토의견
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crr_session ON consultant_review_request(session_id, status);

-- RLS: 같은 tax_partner 의 consultant 만 read (세션 경유). 쓰기는 API 경유.
ALTER TABLE consultant_review_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crr_partner_read ON consultant_review_request;
CREATE POLICY crr_partner_read ON consultant_review_request
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM consultant_session s
    WHERE s.id = consultant_review_request.session_id
      AND s.tax_partner_id = get_consultant_tax_partner_id()
  ));
