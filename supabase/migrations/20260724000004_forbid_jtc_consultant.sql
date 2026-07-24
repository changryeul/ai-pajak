-- ============================================================
-- 불변식: CONSULTANT/TAX_ADVISOR = EXTERNAL 전용 (product-identity 결정 ①)
-- 계획: docs/01-plan/features/jtc-consultant-to-operator-migration.md Phase 4
--
-- consultant 테이블에 JTC(기본 신고 파트너) 소속 row 를 새로 만들지 못하게
-- DB 레벨에서 막는다. JTC 신고 실무는 tax_operators 로 수행한다.
--
-- INSERT 만 차단(기존 은퇴 row 의 is_active 토글 등 UPDATE 는 허용).
-- 마이그레이션 시점 이후 어떤 애플리케이션 경로(signup/invitation/seed)든
-- JTC consultant 를 만들면 예외로 즉시 실패한다.
-- ============================================================

CREATE OR REPLACE FUNCTION forbid_jtc_consultant()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tax_partner
    WHERE id = NEW.tax_partner_id AND is_default_filing_partner
  ) THEN
    RAISE EXCEPTION
      'CONSULTANT/TAX_ADVISOR is EXTERNAL-only. JTC staff must be created in tax_operators (product-identity 결정 ①).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_forbid_jtc_consultant ON consultant;
CREATE TRIGGER trg_forbid_jtc_consultant
  BEFORE INSERT ON consultant
  FOR EACH ROW EXECUTE FUNCTION forbid_jtc_consultant();

COMMENT ON FUNCTION forbid_jtc_consultant() IS
  'consultant = EXTERNAL 전용 불변식 (결정 ①). JTC(default filing partner) 소속 consultant INSERT 차단.';
