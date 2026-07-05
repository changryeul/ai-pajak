-- P3 (2026-07-05): role name `_JTC` suffix 제거.
--
-- 배경: `CONSULTANT_JTC` / `TAX_ADVISOR_JTC` role 은 이름 때문에 JTC 전용으로
-- 오해되지만 실제로는 EXTERNAL tax_partner (세무컨설팅 법인) 직원도 같은
-- role 을 씀. 소속은 `consultant.tax_partner_id` 로만 판정. 이름과 실제
-- 의미의 불일치를 해소하기 위해 `_JTC` 접미사를 벗겨낸다.
--
--   CONSULTANT_JTC  → CONSULTANT
--   TAX_ADVISOR_JTC → TAX_ADVISOR
--
-- 나머지 role 은 그대로. TAX_OPERATOR* 는 여전히 JTC 소속 (roles.md §2.그룹C).
--
-- Postgres 는 `ALTER TYPE ... RENAME VALUE` 로 ENUM label 만 바꿔주고
-- 저장된 데이터·정책 안 캐스팅된 문자열은 새 label 을 자동 참조한다.
-- 그래도 방어적으로 하드코딩된 두 정책 + is_jtc_consultant() 헬퍼 함수를
-- 새 이름으로 재정의한다.

BEGIN;

-- 1) ENUM value rename ------------------------------------------------
ALTER TYPE user_role_type RENAME VALUE 'CONSULTANT_JTC' TO 'CONSULTANT';
ALTER TYPE user_role_type RENAME VALUE 'TAX_ADVISOR_JTC' TO 'TAX_ADVISOR';

-- 2) is_jtc_consultant() 재정의 (여러 정책이 참조) ---------------------
CREATE OR REPLACE FUNCTION is_jtc_consultant()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('CONSULTANT', 'TAX_ADVISOR')
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3) tax_law_analyses 두 정책 재정의 -----------------------------------
DROP POLICY IF EXISTS "tax_advisors_can_view_analyses" ON tax_law_analyses;
CREATE POLICY "tax_advisors_can_view_analyses"
ON tax_law_analyses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'TAX_ADVISOR'
  )
);

DROP POLICY IF EXISTS "tax_advisors_can_update_analyses" ON tax_law_analyses;
CREATE POLICY "tax_advisors_can_update_analyses"
ON tax_law_analyses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'TAX_ADVISOR'
  )
);

COMMIT;
