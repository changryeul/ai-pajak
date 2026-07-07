-- P6.3 (2026-07-07): tax_partner.is_platform_partner → is_default_filing_partner rename.
--
-- 배경: 컬럼 이름이 "플랫폼 파트너" 를 뜻해 "JTC = 플랫폼 owner" 라는 오해를
-- 유발함. P6 재정정 (2026-07-07) 에 따라 MonoFlip 이 플랫폼 owner 이고
-- JTC 는 **default 세무신고 대행 파트너** 라는 실제 의미에 맞춰 컬럼명 변경.
--
--   is_platform_partner       ← 옛 이름 (P6 이전)
--   is_default_filing_partner ← 새 이름 (P6.3)
--
-- 저장된 데이터 (JTC 행 하나만 true) 는 그대로 유지. Postgres 는 컬럼 rename
-- 을 즉시 반영하며 인덱스·정책 안 참조도 자동으로 새 이름을 따른다.

ALTER TABLE tax_partner
  RENAME COLUMN is_platform_partner TO is_default_filing_partner;

COMMENT ON COLUMN tax_partner.is_default_filing_partner IS
  'default 세무신고 대행 파트너 여부. TRUE = 개인·일반법인 고객의 기본 대행자 (현재 JTC 한 행만). MonoFlip 은 플랫폼 owner 라 이 flag 대상 아님 — 플랫폼 관리는 platform 조직으로 별도 표현.';
