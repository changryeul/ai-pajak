-- 성과/평가 화면 데이터 모델.
--   tax_operators 에 정확도/평균처리시간/승인품질/고객응대 컬럼 추가 (성과 비교 표 입력용).
--   operator_evaluation_settings: weights + incentive 정책 (싱글톤 row).

ALTER TABLE tax_operators
  ADD COLUMN IF NOT EXISTS accuracy_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS avg_processing_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS approval_quality_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS customer_satisfaction_score NUMERIC(5,2);

COMMENT ON COLUMN tax_operators.accuracy_pct IS 'Tax-filing accuracy % (0-100)';
COMMENT ON COLUMN tax_operators.avg_processing_minutes IS 'Average minutes per case (lower is better)';
COMMENT ON COLUMN tax_operators.approval_quality_score IS 'Quality score from supervisor approvals (0-100)';
COMMENT ON COLUMN tax_operators.customer_satisfaction_score IS 'Customer-facing communication score (0-100)';

CREATE TABLE IF NOT EXISTS operator_evaluation_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weights JSONB NOT NULL DEFAULT '{"processing":20,"accuracy":30,"speed":20,"approval":20,"satisfaction":10}'::jsonb,
  incentive JSONB NOT NULL DEFAULT '{"monthlyPool":5000000,"perPoint":75000,"maxPerPerson":2000000,"minScore":75,"improvementThreshold":60}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO operator_evaluation_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE operator_evaluation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eval_settings_read ON operator_evaluation_settings;
CREATE POLICY eval_settings_read
  ON operator_evaluation_settings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR','TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));

DROP POLICY IF EXISTS eval_settings_write ON operator_evaluation_settings;
CREATE POLICY eval_settings_write
  ON operator_evaluation_settings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('TAX_OPERATOR_LEAD','TAX_OPERATOR_SUPERVISOR','TAX_OPERATOR_MASTER')
      AND is_active = TRUE
  ));
