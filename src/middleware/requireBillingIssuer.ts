/**
 * requireBillingIssuer middleware
 *
 * ID Billing 발행 보드 (`/api/id-billing/*`) 접근 제어.
 * v19 결정: ID Billing 발행은 JTC 운영팀과 외부 세무법인(ERP) 상담원
 * **둘 다**의 업무다. tenant 분리는 핸들러에서 resolveIssuerScope 로 수행
 * (consultant → 자기 tax_partner, 운영팀 → JTC 기본 파트너).
 *
 *   • CONSULTANT / TAX_ADVISOR — JTC 내부 + EXTERNAL 세무법인 상담원
 *   • TAX_OPERATOR / LEAD / SUPERVISOR / MASTER — JTC 신고운영팀
 *
 * CUSTOMER / PLATFORM_* / FIRM_ADMIN / SYSTEM 은 403.
 */

import { NextResponse } from 'next/server';
import { UserRole, type RequestWithSession } from '@/types/auth';

const ALLOWED_ROLES = new Set<UserRole>([
  UserRole.CONSULTANT,
  UserRole.TAX_ADVISOR,
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
]);

export async function requireBillingIssuer(
  req: RequestWithSession,
  next: (req: RequestWithSession) => Promise<Response>,
): Promise<Response> {
  const { session } = req;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json(
      { error: 'ID Billing issuance is restricted to consultants and tax operators', role: session.role },
      { status: 403 },
    );
  }
  return next(req);
}
