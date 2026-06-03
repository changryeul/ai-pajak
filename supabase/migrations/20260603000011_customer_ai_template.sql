-- Customer AI template snippets — Phase 2.4.
--
-- 운영자가 자주 쓰는 답변 (납부 안내 / 자료 요청 / NPWP 누락 / 신고 마감 /
-- BPE 수령 등) 을 미리 저장 후 customer-inbox dropdown 한 번 클릭으로
-- 즉시 적용. Phase 2.2 draft history 옆에 동등한 위치로 노출.
--
-- - MASTER governance write (TAX_OPERATOR_MASTER 만 add/edit/delete).
-- - Operator-tier (TAX_OPERATOR / LEAD / SUPERVISOR / MASTER) SELECT.
-- - PLATFORM_ADMIN 명시 차단 (hard rule #1).
-- - audit_log enum CUSTOMER_AI_TEMPLATE_UPDATE 추가.

CREATE TABLE IF NOT EXISTS customer_ai_template (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(120) NOT NULL,
  body          TEXT NOT NULL,
  category      VARCHAR(40),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_template_active
  ON customer_ai_template(is_active, display_order, title)
  WHERE is_active = TRUE;

ALTER TABLE customer_ai_template ENABLE ROW LEVEL SECURITY;

-- ── Read: operator-tier ──
DROP POLICY IF EXISTS customer_ai_template_read ON customer_ai_template;
CREATE POLICY customer_ai_template_read
  ON customer_ai_template
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN (
          'TAX_OPERATOR',
          'TAX_OPERATOR_LEAD',
          'TAX_OPERATOR_SUPERVISOR',
          'TAX_OPERATOR_MASTER'
        )
        AND user_roles.is_active = TRUE
    )
  );

-- ── Write: MASTER only ──
DROP POLICY IF EXISTS customer_ai_template_master_insert ON customer_ai_template;
CREATE POLICY customer_ai_template_master_insert
  ON customer_ai_template
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS customer_ai_template_master_update ON customer_ai_template;
CREATE POLICY customer_ai_template_master_update
  ON customer_ai_template
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS customer_ai_template_master_delete ON customer_ai_template;
CREATE POLICY customer_ai_template_master_delete
  ON customer_ai_template
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = TRUE
    )
  );

-- ── updated_at trigger ──
CREATE OR REPLACE FUNCTION update_customer_ai_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_ai_template_updated_at ON customer_ai_template;
CREATE TRIGGER trg_customer_ai_template_updated_at
  BEFORE UPDATE ON customer_ai_template
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_ai_template_updated_at();

-- ── audit_log enum: CUSTOMER_AI_TEMPLATE_UPDATE ──
-- TAX_CODE_RULE_UPDATE / LUXURY_CLASSIFICATION_UPDATE 와 동일 패턴.
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'CUSTOMER_AI_TEMPLATE_UPDATE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE customer_ai_template IS
  'Operator reply snippet templates (Phase 2.4). MASTER edits via /admin/master/customer-ai-templates. Operator-tier read via /api/operator/customer-inbox/templates for inbox dropdown.';
