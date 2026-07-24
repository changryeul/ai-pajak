-- ============================================================
-- 상담원 소속관리 (v13 수퍼바이저 스펙 §6, 트랙 5-C — 2026-07-24)
--
-- 상담원(tax_operator)은 특정 수퍼바이저 그룹에 소속된다. 소속 이동은
-- 단순 드롭다운 변경이 아니라 이동 요청 → 상대 수퍼바이저 승인 →
-- 고객 처리범위 선택 → 감사 기록의 워크플로우를 따른다.
-- ============================================================

-- 소속 = 담당 수퍼바이저(tax_operators 중 supervisor role 의 행)를 가리킨다.
ALTER TABLE tax_operators
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tax_operators_supervisor ON tax_operators(supervisor_id) WHERE supervisor_id IS NOT NULL;

COMMENT ON COLUMN tax_operators.supervisor_id IS '소속 수퍼바이저(tax_operators.id). NULL=미소속.';

-- 소속 이동 요청 워크플로우.
CREATE TABLE IF NOT EXISTS operator_affiliation_transfer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES tax_operators(id) ON DELETE CASCADE,
  from_supervisor_id UUID REFERENCES tax_operators(id) ON DELETE SET NULL,
  to_supervisor_id UUID NOT NULL REFERENCES tax_operators(id) ON DELETE CASCADE,
  -- 고객 처리범위 (§6 3옵션):
  --   WITH_CLIENTS     : 상담원 + 진행 고객 함께 이동 (배정 유지)
  --   OPERATOR_ONLY    : 상담원만 이동, 기존 고객은 상담원과 함께 유지(배정 무변)
  --   REASSIGN_CLIENTS : 상담원 이동, 기존 고객은 기존팀에 남겨 재배정 대상으로
  client_mode VARCHAR(20) NOT NULL CHECK (client_mode IN ('WITH_CLIENTS', 'OPERATOR_ONLY', 'REASSIGN_CLIENTS')),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  decision_comment TEXT,
  decided_at TIMESTAMPTZ,
  reassigned_customer_ids UUID[] DEFAULT '{}',  -- REASSIGN_CLIENTS 처리 결과 감사
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oat_to_supervisor ON operator_affiliation_transfer(to_supervisor_id, status);
CREATE INDEX IF NOT EXISTS idx_oat_operator ON operator_affiliation_transfer(operator_id);

-- 한 상담원에 대해 REQUESTED 상태 요청은 하나만 (중복 이동요청 방지).
CREATE UNIQUE INDEX IF NOT EXISTS uq_oat_open_per_operator
  ON operator_affiliation_transfer(operator_id) WHERE status = 'REQUESTED';
