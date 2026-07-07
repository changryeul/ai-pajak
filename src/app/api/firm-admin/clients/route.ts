import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { requireFirmAdmin, RequestWithFirmAdmin } from '@/middleware/requireFirmAdmin';
import { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';

/**
 * FIRM_ADMIN 클라이언트 관리 (P6 follow-up, 2026-07-07)
 *
 * GET  → { success, data: { clients: ClientRow[], workload: WorkloadRow[] } }
 *        법인 소속 컨설턴트에게 배정된 고객 전체 + 직원별 분포.
 * POST → 담당 재배정. body { customerId, consultantId }
 *        기존 (법인 내) active 배정 비활성 → 새 배정 insert/재활성.
 *
 * tenant 격리: firmTaxPartnerId 기준 — 법인의 클라이언트 = 그 법인 consultant
 * 에게 active 배정된 customer (customer 테이블에 tax_partner_id 없음).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getFirmConsultants(firmTaxPartnerId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('consultant')
    .select('id, full_name, is_active')
    .eq('tax_partner_id', firmTaxPartnerId);
  return data ?? [];
}

// ---------------------------------------------------------------- GET

async function handleList(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const admin = getSupabaseAdmin();

  const consultants = await getFirmConsultants(firmTaxPartnerId);
  const consultantIds = consultants.map((c) => c.id);
  const nameById = new Map(consultants.map((c) => [c.id, c.full_name]));

  if (consultantIds.length === 0) {
    return NextResponse.json({ success: true, data: { clients: [], workload: [] } });
  }

  const { data: assigns, error: aErr } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant_id')
    .eq('is_active', true)
    .in('consultant_id', consultantIds);
  if (aErr) {
    loggers.api.error({ err: aErr }, 'firm-admin clients assignment query failed');
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
  }

  const customerIds = [...new Set((assigns ?? []).map((a) => a.customer_id))];
  const consultantByCustomer = new Map(
    (assigns ?? []).map((a) => [a.customer_id, a.consultant_id]),
  );

  let clients: unknown[] = [];
  if (customerIds.length > 0) {
    const [{ data: customers, error: cErr }, { data: filings }] = await Promise.all([
      admin
        .from('customer')
        .select('id, full_name, company_name, email, npwp, customer_type, created_at')
        .in('id', customerIds)
        .order('full_name'),
      admin.from('tax_filing').select('customer_id').in('customer_id', customerIds),
    ]);
    if (cErr) {
      loggers.api.error({ err: cErr }, 'firm-admin clients customer query failed');
      return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
    }
    const filingCount = new Map<string, number>();
    for (const f of filings ?? []) {
      filingCount.set(f.customer_id, (filingCount.get(f.customer_id) ?? 0) + 1);
    }
    clients = (customers ?? []).map((c) => {
      const consultantId = consultantByCustomer.get(c.id) ?? null;
      return {
        customerId: c.id,
        name: c.company_name || c.full_name,
        email: c.email,
        npwp: c.npwp,
        customerType: c.customer_type,
        consultantId,
        consultantName: consultantId ? (nameById.get(consultantId) ?? '—') : null,
        filingCount: filingCount.get(c.id) ?? 0,
        since: c.created_at,
      };
    });
  }

  const countByConsultant = new Map<string, number>();
  for (const a of assigns ?? []) {
    countByConsultant.set(a.consultant_id, (countByConsultant.get(a.consultant_id) ?? 0) + 1);
  }

  return NextResponse.json({
    success: true,
    data: {
      clients,
      workload: consultants
        .filter((c) => c.is_active)
        .map((c) => ({
          consultantId: c.id,
          fullName: c.full_name,
          clientCount: countByConsultant.get(c.id) ?? 0,
        }))
        .sort((x, y) => y.clientCount - x.clientCount),
    },
  });
}

// ---------------------------------------------------------------- POST (reassign)

const reassignSchema = z.object({
  customerId: z.string().regex(UUID_RE),
  consultantId: z.string().regex(UUID_RE),
});

async function handleReassign(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const parsed = reassignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { customerId, consultantId } = parsed.data;
  const admin = getSupabaseAdmin();

  const consultants = await getFirmConsultants(firmTaxPartnerId);
  const firmConsultantIds = consultants.map((c) => c.id);

  // 대상 컨설턴트가 우리 법인 소속 + 활성인지
  const target = consultants.find((c) => c.id === consultantId);
  if (!target) {
    return NextResponse.json({ error: 'Consultant not found in your firm' }, { status: 404 });
  }
  if (!target.is_active) {
    return NextResponse.json({ error: 'Consultant is inactive' }, { status: 409 });
  }

  // 고객이 우리 법인의 클라이언트인지 (법인 consultant 에게 active 배정 존재)
  const { data: currentAssigns } = await admin
    .from('customer_consultant')
    .select('id, consultant_id, is_active')
    .eq('customer_id', customerId)
    .in('consultant_id', firmConsultantIds);
  const activeAssign = (currentAssigns ?? []).find((a) => a.is_active);
  if (!activeAssign) {
    return NextResponse.json({ error: 'Customer is not a client of your firm' }, { status: 404 });
  }
  if (activeAssign.consultant_id === consultantId) {
    return NextResponse.json({ error: 'Already assigned to this consultant' }, { status: 409 });
  }

  // 법인 내 기존 active 배정 비활성화 (다른 tenant 배정은 건드리지 않음)
  const { error: deactErr } = await admin
    .from('customer_consultant')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .in('consultant_id', firmConsultantIds);
  if (deactErr) {
    loggers.api.error({ err: deactErr }, 'firm-admin reassign deactivate failed');
    return NextResponse.json({ error: 'Failed to reassign' }, { status: 500 });
  }

  // 과거 배정 이력이 있으면 재활성, 없으면 insert
  const previous = (currentAssigns ?? []).find((a) => a.consultant_id === consultantId);
  const { error: upErr } = previous
    ? await admin
        .from('customer_consultant')
        .update({
          is_active: true,
          assigned_by_user_id: req.session.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', previous.id)
    : await admin.from('customer_consultant').insert({
        customer_id: customerId,
        consultant_id: consultantId,
        assigned_by_user_id: req.session.userId,
        is_active: true,
      });
  if (upErr) {
    loggers.api.error({ err: upErr }, 'firm-admin reassign insert failed');
    return NextResponse.json({ error: 'Failed to reassign' }, { status: 500 });
  }

  loggers.api.info(
    { firmTaxPartnerId, customerId, from: activeAssign.consultant_id, to: consultantId },
    'Firm client reassigned',
  );
  return NextResponse.json({ success: true, data: { saved: true } });
}

// ---------------------------------------------------------------- exports

export async function GET(request: NextRequest) {
  return composeMiddleware(requireAuth, blockPlatformAdmin, requireFirmAdmin)(
    request as RequestWithSession,
    handleList,
  );
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireFirmAdmin,
    withAudit('FIRM_CLIENT_REASSIGN'),
  )(request as RequestWithSession, handleReassign);
}
