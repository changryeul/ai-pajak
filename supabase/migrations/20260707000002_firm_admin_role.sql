-- P6.2 (2026-07-07): FIRM_ADMIN role 신설.
--
-- 배경: 세무컨설팅 법인 (EXTERNAL tax_partner) 안에서 CONSULTANT / TAX_ADVISOR
-- 만으로는 "직원 관리, 자격증 임명, 클라이언트 배정, 청구/구독 관리" 를
-- 담당할 사람이 없음. 지금은 대표 컨설턴트가 겸직처럼 처리하는데 권한·화면
-- 이 명확하지 않다. Q2 답 확정 (다 예): FIRM_ADMIN 은 자기 회사 안에서
--
--   * CONSULTANT / TAX_ADVISOR 초대·비활성화
--   * TAX_ADVISOR 임명·해임 (자격증 소지자 인정)
--   * 클라이언트 배정
--   * 청구·구독 관리 (tax_partner_subscription)
--
-- 모두 가능. 다른 EXTERNAL tenant 는 절대 접근 불가 (Hard Rule #7, RLS).
--
-- Postgres ENUM ADD VALUE 는 트랜잭션 내 커밋 후 즉시 사용 가능한 값이
-- 되도록 별도 마이그으로 분리.

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'FIRM_ADMIN';

COMMENT ON TYPE user_role_type IS
  'AI Pajak role catalog. P6.2 (2026-07-07): FIRM_ADMIN 추가로 총 12개. 세무컨설팅 법인 (EXTERNAL tenant) 안의 관리자 권한 (직원·자격증·배정·청구). PLATFORM_MASTER (P6.1) 와 함께 세 마스터 계층 완성.';
