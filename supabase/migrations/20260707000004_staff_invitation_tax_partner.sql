-- P6 follow-up (2026-07-07): staff_invitation.tax_partner_id — firm-scoped invitations.
--
-- 배경: 기존 초대 흐름 (/api/admin/invitations + /api/auth/accept-invitation) 은
-- JTC 전용이었다 — accept 시 consultant row 를 `ilike('name','%jakarta tax%')`
-- 로 JTC 에 하드코딩 연결. FIRM_ADMIN 이 자기 세무컨설팅 법인 (EXTERNAL) 의
-- 직원을 초대하려면 초대장이 어느 tax_partner 소속인지 알아야 한다.
--
--   tax_partner_id IS NULL → 기존 JTC 흐름 (하위 호환, accept 가 JTC lookup)
--   tax_partner_id 있음    → 해당 법인으로 consultant row 연결
--
-- RLS 는 기존 그대로 (USING(false), service-role 만 접근).

ALTER TABLE staff_invitation
  ADD COLUMN IF NOT EXISTS tax_partner_id UUID REFERENCES tax_partner(id) ON DELETE CASCADE;

COMMENT ON COLUMN staff_invitation.tax_partner_id IS
  '초대장이 속한 tax_partner. NULL = 기존 JTC 초대 (accept 시 JTC lookup 하위 호환). 값 있음 = FIRM_ADMIN 이 발행한 firm-scoped 초대 — accept 시 이 법인으로 consultant row 생성.';

CREATE INDEX IF NOT EXISTS idx_staff_invitation_tax_partner
  ON staff_invitation(tax_partner_id) WHERE tax_partner_id IS NOT NULL;
