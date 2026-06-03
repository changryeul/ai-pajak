-- Luxury Item Classifications — MASTER governance.
--
-- Phase 3.3 (commit 70ce9d2) 가 luxury_item_classifications seed (~21 row)
-- 의 description substring 으로 PPN 자동 분류. 분류 정확도 향상 위해 MASTER 가
-- 직접 add/edit/delete 할 수 있는 UI 필요.
--
-- - Operator-tier (TAX_OPERATOR / LEAD / SUPERVISOR / MASTER) SELECT 허용
--   (Phase 3.3 classifyLuxuryBatch() 가 supabase admin client 라 RLS bypass
--    하지만 페이지 server component / 다른 read site 가 anon/auth 로 query 가능).
-- - MASTER 만 INSERT/UPDATE/DELETE.
-- - PLATFORM_ADMIN 은 명시적으로 차단 (hard rule #1).
--
-- 기존 마이그레이션 20251223000006_luxury_items.sql 이 table + trigger 를
-- 만들었지만 RLS 가 미적용 + trigger 함수가 SECURITY DEFINER 가 아니라
-- side-effect 가 없음. 본 마이그레이션은 RLS 만 enable 한다.

ALTER TABLE luxury_item_classifications ENABLE ROW LEVEL SECURITY;

-- ── Read: operator-tier ──
DROP POLICY IF EXISTS luxury_classifications_read ON luxury_item_classifications;
CREATE POLICY luxury_classifications_read
  ON luxury_item_classifications
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
DROP POLICY IF EXISTS luxury_classifications_master_insert ON luxury_item_classifications;
CREATE POLICY luxury_classifications_master_insert
  ON luxury_item_classifications
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

DROP POLICY IF EXISTS luxury_classifications_master_update ON luxury_item_classifications;
CREATE POLICY luxury_classifications_master_update
  ON luxury_item_classifications
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

DROP POLICY IF EXISTS luxury_classifications_master_delete ON luxury_item_classifications;
CREATE POLICY luxury_classifications_master_delete
  ON luxury_item_classifications
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

-- ── audit_log enum: LUXURY_CLASSIFICATION_UPDATE ──
-- TAX_CODE_RULE_UPDATE 와 동일 패턴 (20260527000002_audit_tax_code_rule_enum.sql).
-- withAudit fallback 이 TAX_CALCULATION 으로 떨어지면 audit_log 검색 시
-- 카테고리 필터가 작동하지 않으므로 enum 추가 필수.
DO $$ BEGIN
  ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'LUXURY_CLASSIFICATION_UPDATE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE luxury_item_classifications IS
  'Luxury item classifications for PPN rate (PMK 131/2024). MASTER edits via /admin/master/luxury-classifications. Operator-tier read. Trigger update_luxury_items_updated_at maintains updated_at.';
