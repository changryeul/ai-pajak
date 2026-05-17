/**
 * GET  /api/consultant-erp/supervisor/team
 *   → { rubric, teams, members }
 *
 * POST /api/consultant-erp/supervisor/team
 *   body: { fullName, email, taxPartnerId }
 *   → 201 { consultantId }
 *
 * PATCH /api/consultant-erp/supervisor/team
 *   body: { consultantId, isActive? }   (deactivate / reactivate)
 *   → 200 { saved }
 *
 * 팀장용 ERP 팀원 관리 (PDF p.7-9). Add/disable consultant rows + read
 * the aggregated KPI roll-up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildTeamKpi } from '@/lib/consultant-erp/supervisor-views';
import { UserRole, type RequestWithSession } from '@/types/auth';

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  taxPartnerId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID'),
});

const patchSchema = z.object({
  consultantId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID'),
  isActive: z.boolean().optional(),
});

async function handleGet(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const data = await buildTeamKpi();
  return NextResponse.json({ success: true, data });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  // Add the consultant row only. Auth user setup is a separate flow (the
  // PDF says '실제 서비스에서는 계정 초대/초기 비밀번호 발급과 연결됩니다.').
  const { data, error } = await admin
    .from('consultant')
    .insert({
      tax_partner_id: parsed.data.taxPartnerId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { consultantId: data.id } }, { status: 201 });
}

async function handlePatch(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true, data: { saved: false } });
  }
  const { error } = await admin
    .from('consultant')
    .update(patch)
    .eq('id', parsed.data.consultantId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { saved: true } });
}

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handleGet);
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('SUPERVISOR_TEAM_CREATE_CONSULTANT'),
  )(request as unknown as RequestWithSession, handlePost);
}

export async function PATCH(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('SUPERVISOR_TEAM_TOGGLE_CONSULTANT'),
  )(request as unknown as RequestWithSession, handlePatch);
}
