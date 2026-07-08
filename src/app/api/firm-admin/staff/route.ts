import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { withAudit } from '@/middleware/audit';
import { requireFirmAdmin, RequestWithFirmAdmin } from '@/middleware/requireFirmAdmin';
import { RequestWithSession } from '@/types/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createAndEmailFirmInvitation } from '@/lib/firm-admin/invitation';
import { loggers } from '@/lib/logger';

/**
 * FIRM_ADMIN 직원 관리 (P6 follow-up, 2026-07-07)
 *
 * GET    → { success, data: { staff: StaffRow[], invitations: InvitationRow[] } }
 * POST   → 직원 초대. body { email, fullName?, role: CONSULTANT|TAX_ADVISOR|FIRM_ADMIN }
 *          staff_invitation 에 firm-scoped row 생성 + 초대 메일 발송.
 * PATCH  → 직원 수정. body { consultantId, isActive?, role? (CONSULTANT|TAX_ADVISOR) }
 *          role 변경 = 세무사 자격증 임명/해임 (user_roles 갱신).
 * DELETE → ?invitationId= 대기중 초대 취소 (cancelled_at 마킹).
 *
 * 모든 쿼리는 requireFirmAdmin 이 실어주는 firmTaxPartnerId 로 tenant 고정
 * (Hard Rule #7 — 다른 EXTERNAL tenant 절대 접근 불가).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------- GET

async function handleList(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const admin = getSupabaseAdmin();

  const { data: consultants, error: cErr } = await admin
    .from('consultant')
    .select('id, user_id, full_name, email, is_active, employment_start_date, created_at')
    .eq('tax_partner_id', firmTaxPartnerId)
    .order('full_name');
  if (cErr) {
    loggers.api.error({ err: cErr }, 'firm-admin staff list failed');
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }

  const userIds = (consultants ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  const consultantIds = (consultants ?? []).map((c) => c.id);

  const [{ data: roleRows }, { data: assignRows }, { data: invitations }] = await Promise.all([
    userIds.length
      ? admin.from('user_roles').select('user_id, role').eq('is_active', true).in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    consultantIds.length
      ? admin
          .from('customer_consultant')
          .select('consultant_id')
          .eq('is_active', true)
          .in('consultant_id', consultantIds)
      : Promise.resolve({ data: [] as { consultant_id: string }[] }),
    admin
      .from('staff_invitation')
      .select('id, email, full_name, role, expires_at, created_at')
      .eq('tax_partner_id', firmTaxPartnerId)
      .is('accepted_at', null)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const ROLE_DISPLAY_PRIORITY = ['TAX_ADVISOR', 'FIRM_ADMIN', 'CONSULTANT'];
  const roleByUser = new Map<string, string>();
  for (const r of roleRows ?? []) {
    const cur = roleByUser.get(r.user_id);
    if (
      !cur ||
      ROLE_DISPLAY_PRIORITY.indexOf(r.role) !== -1 &&
        (ROLE_DISPLAY_PRIORITY.indexOf(cur) === -1 ||
          ROLE_DISPLAY_PRIORITY.indexOf(r.role) < ROLE_DISPLAY_PRIORITY.indexOf(cur))
    ) {
      roleByUser.set(r.user_id, r.role);
    }
  }

  const clientCount = new Map<string, number>();
  for (const a of assignRows ?? []) {
    clientCount.set(a.consultant_id, (clientCount.get(a.consultant_id) ?? 0) + 1);
  }

  const now = Date.now();
  return NextResponse.json({
    success: true,
    data: {
      staff: (consultants ?? []).map((c) => ({
        consultantId: c.id,
        fullName: c.full_name,
        email: c.email,
        isActive: c.is_active,
        role: c.user_id ? roleByUser.get(c.user_id) ?? 'CONSULTANT' : null, // null = 로그인 계정 없음
        hasLogin: Boolean(c.user_id),
        clientCount: clientCount.get(c.id) ?? 0,
        since: c.employment_start_date ?? c.created_at,
        isSelf: c.user_id === req.session.userId,
      })),
      invitations: (invitations ?? []).map((i) => ({
        invitationId: i.id,
        email: i.email,
        fullName: i.full_name,
        role: i.role,
        expiresAt: i.expires_at,
        expired: new Date(i.expires_at).getTime() < now,
        createdAt: i.created_at,
      })),
    },
  });
}

// ---------------------------------------------------------------- POST (invite)

const inviteSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().max(120).optional(),
  role: z.enum(['CONSULTANT', 'TAX_ADVISOR', 'FIRM_ADMIN']),
});

async function handleInvite(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, fullName, role } = parsed.data;

  const result = await createAndEmailFirmInvitation({
    email,
    fullName,
    role,
    taxPartnerId: firmTaxPartnerId,
    invitedBy: req.session.userId,
    inviterRole: 'FIRM_ADMIN',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  loggers.api.info(
    { firmTaxPartnerId, email, role, invitedBy: req.session.userId },
    'Firm staff invitation created',
  );
  return NextResponse.json(
    {
      success: true,
      data: {
        invitationId: result.invitationId,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt,
      },
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------- PATCH (toggle / appoint)

const patchSchema = z
  .object({
    consultantId: z.string().regex(UUID_RE),
    isActive: z.boolean().optional(),
    role: z.enum(['CONSULTANT', 'TAX_ADVISOR']).optional(),
  })
  .refine((v) => v.isActive !== undefined || v.role !== undefined, {
    message: 'isActive or role required',
  });

async function handlePatch(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { consultantId, isActive, role } = parsed.data;
  const admin = getSupabaseAdmin();

  const { data: target } = await admin
    .from('consultant')
    .select('id, user_id, tax_partner_id, full_name')
    .eq('id', consultantId)
    .maybeSingle();
  if (!target || target.tax_partner_id !== firmTaxPartnerId) {
    return NextResponse.json({ error: 'Consultant not found in your firm' }, { status: 404 });
  }
  if (target.user_id === req.session.userId && isActive === false) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
  }

  if (isActive !== undefined) {
    const { error } = await admin
      .from('consultant')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', consultantId);
    if (error) {
      loggers.api.error({ err: error }, 'firm-admin staff toggle failed');
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
    // 로그인 계정이 있으면 user_roles 도 같이 (비활성 직원은 로그인해도 role 없음)
    if (target.user_id) {
      await admin
        .from('user_roles')
        .update({ is_active: isActive })
        .eq('user_id', target.user_id)
        .in('role', ['CONSULTANT', 'TAX_ADVISOR']);
    }
  }

  if (role !== undefined) {
    if (!target.user_id) {
      return NextResponse.json(
        { error: 'Consultant has no login account — role change requires an accepted invitation' },
        { status: 409 },
      );
    }
    // 세무사 자격증 임명/해임 = 기존 CONSULTANT/TAX_ADVISOR row 를 in-place 갱신
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', target.user_id)
      .in('role', ['CONSULTANT', 'TAX_ADVISOR'])
      .limit(1)
      .maybeSingle();
    if (existingRole) {
      const { error } = await admin.from('user_roles').update({ role }).eq('id', existingRole.id);
      if (error) {
        loggers.api.error({ err: error }, 'firm-admin role change failed');
        return NextResponse.json({ error: 'Failed to change role' }, { status: 500 });
      }
    } else {
      const { error } = await admin.from('user_roles').insert({
        user_id: target.user_id,
        role,
        is_active: true,
        organization_id: firmTaxPartnerId,
        organization_type: 'TAX_PARTNER',
      });
      if (error) {
        loggers.api.error({ err: error }, 'firm-admin role insert failed');
        return NextResponse.json({ error: 'Failed to change role' }, { status: 500 });
      }
    }
  }

  loggers.api.info(
    { firmTaxPartnerId, consultantId, isActive, role, by: req.session.userId },
    'Firm staff updated',
  );
  return NextResponse.json({ success: true, data: { saved: true } });
}

// ---------------------------------------------------------------- DELETE (cancel invitation)

async function handleCancelInvitation(req: RequestWithSession): Promise<Response> {
  const { firmTaxPartnerId } = req as RequestWithFirmAdmin;
  const invitationId = new URL(req.url).searchParams.get('invitationId');
  if (!invitationId || !UUID_RE.test(invitationId)) {
    return NextResponse.json({ error: 'invitationId (uuid) required' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  const { data: inv } = await admin
    .from('staff_invitation')
    .select('id, tax_partner_id, accepted_at, cancelled_at')
    .eq('id', invitationId)
    .maybeSingle();
  if (!inv || inv.tax_partner_id !== firmTaxPartnerId) {
    return NextResponse.json({ error: 'Invitation not found in your firm' }, { status: 404 });
  }
  if (inv.accepted_at) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
  }
  if (!inv.cancelled_at) {
    await admin
      .from('staff_invitation')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', invitationId);
  }
  return NextResponse.json({ success: true, data: { cancelled: true } });
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
    withAudit('FIRM_STAFF_INVITE'),
  )(request as RequestWithSession, handleInvite);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireFirmAdmin,
    withAudit('FIRM_STAFF_UPDATE'),
  )(request as RequestWithSession, handlePatch);
}

export async function DELETE(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireFirmAdmin,
    withAudit('FIRM_STAFF_INVITE_CANCEL'),
  )(request as RequestWithSession, handleCancelInvitation);
}
