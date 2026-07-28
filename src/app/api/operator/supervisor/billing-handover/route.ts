/**
 * GET /api/operator/supervisor/billing-handover (v13 §8 — 트랙 5)
 *
 * ID Billing 이관현황 (read-only 추적). 수퍼바이저 승인완료 후 발행대상으로
 * 넘어간 건과 발행완료 건을 회사/세목/기간/승인자/담당자/상태와 함께 조망.
 * 발행·전송 액션은 발행 보드(/api/id-billing/*)에서 하고, 여기선 추적만.
 *
 * TAX_OPERATOR_SUPERVISOR 전용. tenant = 자기 tax_partner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import { UserRole, type RequestWithSession } from '@/types/auth';

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor role required' }, { status: 403 });
  }
  const ctx = await resolveConsultantContext({ userId: req.session.userId, role: req.session.role });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const admin = getSupabaseAdmin();
  const partnerId = ctx.taxPartnerId;

  // ── 발행완료 (id_billing_issuance) ──
  const { data: issuedRows } = await admin
    .from('id_billing_issuance')
    .select('id, serial_no, customer_id, session_id, tax_type, tax_period, amount, status, customer_email, sent_at, created_at')
    .eq('tax_partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(300);

  // ── 발행대상 (APPROVED 세션 중 미발행) ──
  const issuedSessionIds = new Set((issuedRows ?? []).map(r => r.session_id).filter(Boolean));
  const { data: approvedSessions } = await admin
    .from('consultant_session')
    .select('id, customer_id, tax_period, supervisor_id, consultant_id, total_estimated_tax')
    .eq('tax_partner_id', partnerId)
    .eq('status', 'APPROVED')
    .order('updated_at', { ascending: false })
    .limit(300);
  const pendingSessions = (approvedSessions ?? []).filter(s => !issuedSessionIds.has(s.id));

  // ── 조인용 참조 수집 ──
  const customerIds = new Set<string>();
  const consultantIds = new Set<string>();
  for (const r of issuedRows ?? []) customerIds.add(r.customer_id);
  for (const s of pendingSessions) {
    customerIds.add(s.customer_id);
    if (s.consultant_id) consultantIds.add(s.consultant_id);
    if (s.supervisor_id) consultantIds.add(s.supervisor_id);
  }

  const custMap = new Map<string, string>();
  if (customerIds.size > 0) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', Array.from(customerIds));
    for (const c of cs ?? []) custMap.set(c.id, c.company_name || c.full_name || '—');
  }
  const nameMap = new Map<string, string>();
  if (consultantIds.size > 0) {
    const { data: cons } = await admin.from('consultant').select('id, full_name').in('id', Array.from(consultantIds));
    for (const c of cons ?? []) nameMap.set(c.id, c.full_name || '—');
  }

  const pending = pendingSessions.map(s => ({
    sessionId: s.id,
    company: custMap.get(s.customer_id) ?? '—',
    taxPeriod: String(s.tax_period ?? '').slice(0, 7),
    approver: s.supervisor_id ? (nameMap.get(s.supervisor_id) ?? '—') : '—',
    consultant: s.consultant_id ? (nameMap.get(s.consultant_id) ?? '—') : '—',
    estimatedTax: Number(s.total_estimated_tax ?? 0),
    billingStatus: 'TARGET' as const,   // 발행대상
  }));

  const issued = (issuedRows ?? []).map(r => ({
    id: r.id,
    serialNo: r.serial_no,
    company: custMap.get(r.customer_id) ?? '—',
    taxType: r.tax_type,
    taxPeriod: r.tax_period,
    amount: Number(r.amount),
    billingStatus: 'ISSUED' as const,
    sendStatus: r.status === 'SENT' || r.status === 'PAID' ? 'SENT' : 'NOT_SENT',
    ntpnStatus: r.status === 'PAID' ? 'PAID' : 'AWAITING_CORETAX', // 납부 후 Coretax 자동생성
    createdAt: r.created_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      pending,
      issued,
      summary: {
        pendingCount: pending.length,
        issuedCount: issued.length,
        sentCount: issued.filter(i => i.sendStatus === 'SENT').length,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}
