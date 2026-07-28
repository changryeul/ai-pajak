/**
 * POST /api/operator/supervisor/team/reassign
 *   body: { sessionId, newConsultantId, reason? }
 *   → 200 { saved }
 *
 * 팀장용 ERP 팀원 관리 > 업무 재배정 (PDF p.9). Supervisor reassigns
 * a session from one consultant to another. Validations:
 *   - new consultant must be active
 *   - new consultant.tax_partner_id must match the session.tax_partner_id
 *     (no cross-tenant reassignment)
 *   - COMPLETED / CANCELLED sessions cannot be reassigned (PDF: '진행
 *     업무가 있는 팀원은 먼저 재배정하거나 비활성 처리합니다.')
 *
 * Logs an internal action row into consultant_session_approval with
 * action='WITHDRAW' + reason so the revision history surfaces it. We
 * reuse the existing enum to avoid a schema change; the actor_role
 * makes the supervisor origin clear.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole, type RequestWithSession } from '@/types/auth';

const schema = z.object({
  sessionId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID'),
  newConsultantId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID'),
  reason: z.string().max(2000).optional(),
});

async function handlePost(req: RequestWithSession): Promise<Response> {
  if (req.session.role !== UserRole.TAX_OPERATOR_SUPERVISOR) {
    return NextResponse.json({ error: 'Supervisor only' }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const admin = getSupabaseAdmin();

  // Validate session
  const { data: session } = await admin
    .from('consultant_session')
    .select('id, consultant_id, tax_partner_id, status')
    .eq('id', parsed.data.sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'Completed/cancelled sessions cannot be reassigned' },
      { status: 409 },
    );
  }
  if (session.consultant_id === parsed.data.newConsultantId) {
    return NextResponse.json({ error: 'Already assigned' }, { status: 409 });
  }

  // Validate new consultant: active + same tax_partner
  const { data: newConsultant } = await admin
    .from('consultant')
    .select('id, full_name, tax_partner_id, is_active')
    .eq('id', parsed.data.newConsultantId)
    .maybeSingle();
  if (!newConsultant) {
    return NextResponse.json({ error: 'Consultant not found' }, { status: 404 });
  }
  if (!newConsultant.is_active) {
    return NextResponse.json({ error: 'Consultant is inactive' }, { status: 409 });
  }
  if (newConsultant.tax_partner_id !== session.tax_partner_id) {
    return NextResponse.json(
      { error: 'Cross-tenant reassignment is not allowed' },
      { status: 409 },
    );
  }

  // Reassign + log
  const { error: updErr } = await admin
    .from('consultant_session')
    .update({ consultant_id: parsed.data.newConsultantId })
    .eq('id', parsed.data.sessionId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const comment = `REASSIGN → ${newConsultant.full_name}${parsed.data.reason ? ` · ${parsed.data.reason}` : ''}`;
  await admin.from('consultant_session_approval').insert({
    session_id: parsed.data.sessionId,
    action: 'WITHDRAW',
    actor_id: req.session.userId,
    actor_role: 'TAX_OPERATOR_SUPERVISOR',
    comment,
    snapshot: { reassign: true, newConsultantId: parsed.data.newConsultantId },
  });

  return NextResponse.json({ success: true, data: { saved: true } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
    withAudit('SUPERVISOR_TEAM_REASSIGN'),
  )(request as unknown as RequestWithSession, handlePost);
}
