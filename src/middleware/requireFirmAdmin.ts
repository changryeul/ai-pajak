import { NextResponse } from 'next/server';
import { RequestWithSession, UserRole } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * P6.2 (2026-07-07): FIRM_ADMIN 게이트.
 *
 * 조건:
 *   1. session.role === FIRM_ADMIN
 *   2. consultant row 가 존재하고 tax_partner_id 가 EXTERNAL 인지
 *
 * 통과하면 `request.firmTaxPartnerId` 로 tenant id 를 실어보내 후속 handler
 * 가 자기 tenant scope 로만 쿼리 가능.
 *
 * 다른 tenant 데이터 접근은 RLS + handler 안 tax_partner_id 필터로 이중 차단.
 * (Hard Rule #7)
 */
export interface RequestWithFirmAdmin extends RequestWithSession {
  firmTaxPartnerId: string;
}

export async function requireFirmAdmin(
  request: RequestWithSession,
  handler: (req: RequestWithFirmAdmin) => Promise<Response>,
): Promise<Response> {
  const { session } = request;

  if (session.role !== UserRole.FIRM_ADMIN) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'FIRM_ADMIN role required' },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: consultant, error } = await admin
    .from('consultant')
    .select('id, tax_partner_id, tax_partner:tax_partner_id(partner_type)')
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !consultant?.tax_partner_id) {
    loggers.api.warn(
      { userId: session.userId, err: error },
      'FIRM_ADMIN role but no active consultant row with tax_partner_id',
    );
    return NextResponse.json(
      { error: 'Forbidden', message: 'FIRM_ADMIN must be linked to an EXTERNAL tax_partner' },
      { status: 403 },
    );
  }

  const partner = Array.isArray(consultant.tax_partner)
    ? consultant.tax_partner[0]
    : consultant.tax_partner;
  const partnerType = (partner as { partner_type?: string } | null)?.partner_type;

  if (partnerType !== 'EXTERNAL') {
    loggers.api.warn(
      { userId: session.userId, taxPartnerId: consultant.tax_partner_id, partnerType },
      'FIRM_ADMIN role on non-EXTERNAL tenant — configuration error',
    );
    return NextResponse.json(
      { error: 'Forbidden', message: 'FIRM_ADMIN only applies to EXTERNAL tax_partners' },
      { status: 403 },
    );
  }

  const augmented = request as RequestWithFirmAdmin;
  augmented.firmTaxPartnerId = consultant.tax_partner_id;
  return handler(augmented);
}
