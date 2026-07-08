/**
 * Master tenants API — P6 follow-up (2026-07-08)
 *
 * MonoFlip 사업운영 관점의 ERP 테넌트 (EXTERNAL tax_partner) 관리.
 * 화면 구조 §9 "모노플립 마스터 (ERP 테넌트 관리 메뉴 포함)" 의 괄호 구현.
 *
 * GET /api/admin/master/tenants
 *   → { success, data: { tenants: TenantRow[], summary } }
 *     TenantRow = { id, name, licenseNumber, email, isActive, createdAt,
 *                   consultantCount, hasFirmAdmin, managedClientCount,
 *                   subscription: { tierId, status } | null }
 *
 * PATCH /api/admin/master/tenants
 *   body { taxPartnerId, isActive }  → 입점 중지/재개 (audit 기록)
 *
 * 권한: PLATFORM_MASTER (사업운영) + TAX_OPERATOR_MASTER (겸직 하위호환)
 * — /api/admin/master/stats 와 동일 게이트.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveUserRole } from '@/lib/auth/resolve-role';
import { recordAudit } from '@/middleware/audit';
import { loggers } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireMaster(): Promise<
  { ok: true; userId: string; role: string } | { ok: false; res: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const role = await resolveUserRole(supabase, user.id);
  if (role !== 'TAX_OPERATOR_MASTER' && role !== 'PLATFORM_MASTER') {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Master role required (PLATFORM_MASTER or TAX_OPERATOR_MASTER)' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: user.id, role };
}

export async function GET() {
  try {
    const gate = await requireMaster();
    if (!gate.ok) return gate.res;

    const admin = getSupabaseAdmin();

    const { data: partners, error: pErr } = await admin
      .from('tax_partner')
      .select('id, name, legal_name, tax_license_number, email, is_active, created_at')
      .eq('partner_type', 'EXTERNAL')
      .order('created_at', { ascending: false });
    if (pErr) {
      loggers.api.error({ err: pErr }, 'master tenants: partner query failed');
      return NextResponse.json({ error: 'Failed to load tenants' }, { status: 500 });
    }

    const partnerIds = (partners ?? []).map((p) => p.id);
    let consultants: { id: string; user_id: string | null; tax_partner_id: string; is_active: boolean }[] = [];
    let subs: { tax_partner_id: string; tier_id: string; status: string }[] = [];
    if (partnerIds.length > 0) {
      const [{ data: c }, { data: s }] = await Promise.all([
        admin
          .from('consultant')
          .select('id, user_id, tax_partner_id, is_active')
          .in('tax_partner_id', partnerIds),
        admin
          .from('tax_partner_subscription')
          .select('tax_partner_id, tier_id, status')
          .eq('status', 'ACTIVE')
          .in('tax_partner_id', partnerIds),
      ]);
      consultants = c ?? [];
      subs = s ?? [];
    }

    // FIRM_ADMIN 존재 여부: 테넌트 consultant 들의 user_id 에 FIRM_ADMIN role
    const userIds = consultants.map((c) => c.user_id).filter(Boolean) as string[];
    const firmAdminUsers = new Set<string>();
    if (userIds.length > 0) {
      const { data: roles } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'FIRM_ADMIN')
        .eq('is_active', true)
        .in('user_id', userIds);
      for (const r of roles ?? []) firmAdminUsers.add(r.user_id);
    }

    // 관리 클라이언트 수: active customer_consultant per partner
    const activeConsultantIds = consultants.filter((c) => c.is_active).map((c) => c.id);
    const clientCountByPartner = new Map<string, number>();
    if (activeConsultantIds.length > 0) {
      const { data: assigns } = await admin
        .from('customer_consultant')
        .select('consultant_id')
        .eq('is_active', true)
        .in('consultant_id', activeConsultantIds);
      const partnerByConsultant = new Map(consultants.map((c) => [c.id, c.tax_partner_id]));
      for (const a of assigns ?? []) {
        const pid = partnerByConsultant.get(a.consultant_id);
        if (pid) clientCountByPartner.set(pid, (clientCountByPartner.get(pid) ?? 0) + 1);
      }
    }

    const subByPartner = new Map(subs.map((s) => [s.tax_partner_id, s]));
    const tenants = (partners ?? []).map((p) => {
      const own = consultants.filter((c) => c.tax_partner_id === p.id);
      const sub = subByPartner.get(p.id);
      return {
        id: p.id,
        name: p.name,
        legalName: p.legal_name,
        licenseNumber: p.tax_license_number,
        email: p.email,
        isActive: p.is_active,
        createdAt: p.created_at,
        consultantCount: own.filter((c) => c.is_active).length,
        hasFirmAdmin: own.some((c) => c.user_id && firmAdminUsers.has(c.user_id)),
        managedClientCount: clientCountByPartner.get(p.id) ?? 0,
        subscription: sub ? { tierId: sub.tier_id, status: sub.status } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tenants,
        summary: {
          total: tenants.length,
          active: tenants.filter((t) => t.isActive).length,
          withSubscription: tenants.filter((t) => t.subscription).length,
          totalManagedClients: tenants.reduce((sum, t) => sum + t.managedClientCount, 0),
        },
      },
    });
  } catch (error) {
    loggers.api.error({ err: error }, 'master tenants GET error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireMaster();
    if (!gate.ok) return gate.res;

    const body = (await request.json().catch(() => null)) as
      | { taxPartnerId?: string; isActive?: boolean }
      | null;
    if (!body?.taxPartnerId || !UUID_RE.test(body.taxPartnerId) || typeof body.isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'taxPartnerId (uuid) and isActive (boolean) required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data: partner } = await admin
      .from('tax_partner')
      .select('id, name, partner_type, is_active')
      .eq('id', body.taxPartnerId)
      .maybeSingle();
    if (!partner || partner.partner_type !== 'EXTERNAL') {
      return NextResponse.json({ error: 'EXTERNAL tenant not found' }, { status: 404 });
    }

    const { error: upErr } = await admin
      .from('tax_partner')
      .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
      .eq('id', body.taxPartnerId);
    if (upErr) {
      loggers.api.error({ err: upErr }, 'master tenants PATCH failed');
      return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 });
    }

    await recordAudit({
      action: 'MASTER_TENANT_TOGGLE',
      actorUserId: gate.userId,
      actorRole: gate.role,
      details: {
        taxPartnerId: body.taxPartnerId,
        tenantName: partner.name,
        from: partner.is_active,
        to: body.isActive,
      },
    });

    loggers.api.info(
      { taxPartnerId: body.taxPartnerId, isActive: body.isActive, by: gate.userId },
      'Master tenant toggled',
    );
    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (error) {
    loggers.api.error({ err: error }, 'master tenants PATCH error');
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
