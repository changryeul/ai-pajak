-- Track B/D 의 RLS UPDATE policy 들이 USING 만 가짐 → 다른 UPDATE policy 들과
-- 일관 되도록 동일 predicate 를 WITH CHECK 에도 적용. 기능적으로 현재는 동일
-- (predicate 가 caller role 만 보고 row content 무관) 이지만, 미래에 predicate
-- 가 row-content-based 가 되면 WITH CHECK 가 없으면 post-write 검증이 빠짐.

-- ── tax_code_rule (Track B) ──
DROP POLICY IF EXISTS tax_code_rule_master_update ON tax_code_rule;
CREATE POLICY tax_code_rule_master_update ON tax_code_rule
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );

-- ── system_setting (Track D) ──
DROP POLICY IF EXISTS system_setting_master_update ON system_setting;
CREATE POLICY system_setting_master_update ON system_setting
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'TAX_OPERATOR_MASTER'
        AND user_roles.is_active = true
    )
  );
