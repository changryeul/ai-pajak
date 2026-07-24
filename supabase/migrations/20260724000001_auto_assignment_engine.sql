-- ============================================================
-- 자동배정 엔진 (v13 수퍼바이저 스펙 §5, 트랙 4 — 2026-07-24)
--
-- 신규 고객은 접수 즉시 자동으로 상담원(tax_operator)에게 배정하는 것을
-- 원칙으로 한다. 배정대기 큐는 자동배정 실패(전원 만석/오프라인) 시의
-- fallback 으로만 남긴다. 7개 기준 중 스키마에 데이터가 있는 것만 스코어에
-- 반영하고, 없는 기준(언어 등)은 배정 로그에 '미적용'으로 남긴다.
--
-- specialties 컬럼: 세목 전문성 매칭(§5 기준 3)의 입력. 빈 배열이면 중립.
-- ============================================================

ALTER TABLE tax_operators
  ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tax_operators.specialties IS
  '세목 전문성 (자동배정 스코어 입력): PPh21/PPh23/PPh26/PPN/PPh25/SPT_TAHUNAN 등. 빈 배열=중립.';

-- 자동배정 결과 감사 로그 (§5/§10 — 배정자, 근거, 사유 기록).
-- audit_log 를 재사용하지 않고 전용 테이블로 두어 배정 튜닝 분석을 쉽게 한다.
CREATE TABLE IF NOT EXISTS operator_assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL,
  method VARCHAR(20) NOT NULL,                  -- sticky | scored | overflow | manual
  score NUMERIC(6, 2),                          -- 선택된 operator 의 총점
  breakdown JSONB,                              -- 기준별 점수 + 미적용 기준 목록
  candidates_considered SMALLINT,
  triggered_by VARCHAR(20) NOT NULL DEFAULT 'AUTO', -- AUTO(접수즉시) | SUPERVISOR(수동실행)
  actor_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oal_customer ON operator_assignment_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oal_operator ON operator_assignment_log(operator_id) WHERE operator_id IS NOT NULL;
