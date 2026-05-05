-- Supervisor-Operator 관계 테이블
-- 한 상담원(operator)은 한 명의 supervisor에 배정됨. supervisor 한 명이 N명 관리.
-- "Span of Control" 화면에서 max_managed로 관리 인원 한도 표시.
-- "상담원별 관리 Supervisor 지정" 화면에서 active 토글로 활성/비활성.

CREATE TABLE IF NOT EXISTS supervisor_operator_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID NOT NULL REFERENCES tax_operators(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES tax_operators(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operator_id)  -- 한 operator는 하나의 active supervisor만
);

CREATE INDEX IF NOT EXISTS idx_sup_op_supervisor ON supervisor_operator_assignment(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sup_op_operator ON supervisor_operator_assignment(operator_id);

-- supervisor 별 희망 관리 인원 + 현재 작업 상태 (PDF의 "대기/상담중/검토중/Coretax작업중/휴식/오프라인/퇴사")
ALTER TABLE tax_operators
  ADD COLUMN IF NOT EXISTS max_managed INTEGER,
  ADD COLUMN IF NOT EXISTS work_state VARCHAR(30) DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS auto_assign_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN tax_operators.max_managed IS 'Supervisor only: 본인이 관리하고자 하는 상담원 수 한도';
COMMENT ON COLUMN tax_operators.work_state IS '실시간 작업 상태: available / consulting / reviewing / coretax / break / offline / resigned';
COMMENT ON COLUMN tax_operators.auto_assign_enabled IS '자동배정 후보 여부 (false → 수동만)';

-- check constraint for work_state
DO $$ BEGIN
  ALTER TABLE tax_operators ADD CONSTRAINT tax_operators_work_state_check
    CHECK (work_state IN ('available','consulting','reviewing','coretax','break','offline','resigned'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE supervisor_operator_assignment ENABLE ROW LEVEL SECURITY;

-- 운영팀 전원 read; 슈퍼바이저 이상은 write.
DROP POLICY IF EXISTS sup_op_assignment_read ON supervisor_operator_assignment;
CREATE POLICY sup_op_assignment_read
  ON supervisor_operator_assignment FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR','TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

DROP POLICY IF EXISTS sup_op_assignment_write ON supervisor_operator_assignment;
CREATE POLICY sup_op_assignment_write
  ON supervisor_operator_assignment FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));
