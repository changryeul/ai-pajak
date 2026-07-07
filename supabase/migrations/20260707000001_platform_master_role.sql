-- P6.1 (2026-07-07): PLATFORM_MASTER role 신설.
--
-- 배경: TAX_OPERATOR_MASTER 하나가 "JTC 신고운영 최고권한 + MonoFlip 사업운영
-- 최고권한" 을 겸하고 있었음. 세무신고 대행 자격이 없는 MonoFlip 이 신고
-- 실무를 통제하는 것처럼 보이는 문제 → 두 개로 분리.
--
--   PLATFORM_MASTER (신규)  ← 통계, 요금, 상품, 커스텀 가격, EXTERNAL 입점
--   TAX_OPERATOR_MASTER      ← Coretax, Tax Rule, Luxury (기존, 좁혀서 유지)
--
-- Postgres ENUM 은 ADD VALUE 는 트랜잭션 내에서 커밋 후 즉시 사용 못하는
-- 제약이 있으므로 별도 transaction. 정책·view 안 하드코딩은 없음 (앱 레벨
-- 만 사용).

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'PLATFORM_MASTER';

COMMENT ON TYPE user_role_type IS
  'AI Pajak role catalog. P6.1 (2026-07-07): PLATFORM_MASTER 추가로 총 11개. MonoFlip 사업권한 (PLATFORM_MASTER) 과 JTC 신고운영권한 (TAX_OPERATOR_MASTER) 분리.';
