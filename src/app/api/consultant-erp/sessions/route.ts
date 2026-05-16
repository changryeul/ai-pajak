/**
 * /api/consultant-erp/sessions
 *
 * POST — create a new session for a customer in the consultant's tax_partner.
 *        body: { customerId, filingKind: 'MONTHLY'|'ANNUAL', taxPeriod: 'YYYY-MM' }
 *        → 201 { sessionId, status: 'DRAFT', currentStep: 1 }
 *
 * GET  — list sessions visible to the caller (own + same-partner if supervisor).
 *        query: ?status=&customerId=
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveConsultantContext } from '@/lib/consultant-erp/session-helpers';
import { UserRole, type RequestWithSession } from '@/types/auth';

const createSchema = z.object({
  customerId: z.string().uuid(),
  filingKind: z.enum(['MONTHLY', 'ANNUAL']),
  taxPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM expected'),
});

async function handleGet(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const customerId = url.searchParams.get('customerId');

  const admin = getSupabaseAdmin();
  let query = admin
    .from('consultant_session')
    .select(
      'id, customer_id, consultant_id, supervisor_id, filing_kind, tax_period, status, current_step, total_estimated_tax, updated_at',
    )
    .eq('tax_partner_id', ctx.taxPartnerId)
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (customerId) query = query.eq('customer_id', customerId);
  if (!ctx.isSupervisor) query = query.eq('consultant_id', ctx.consultantId);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { customerId, filingKind, taxPeriod } = parsed.data;
  const taxPeriodDate = `${taxPeriod}-01`;

  const admin = getSupabaseAdmin();

  // assignment guard: customer must be assigned to someone in the same tax_partner
  const { data: assignment } = await admin
    .from('customer_consultant')
    .select('consultant_id')
    .eq('customer_id', customerId)
    .eq('is_active', true);
  if (!assignment || assignment.length === 0) {
    return NextResponse.json({ error: 'Customer has no active assignment' }, { status: 403 });
  }
  const peerIds = new Set(assignment.map((a) => a.consultant_id));
  const { data: peers } = await admin
    .from('consultant')
    .select('id')
    .eq('tax_partner_id', ctx.taxPartnerId)
    .in('id', Array.from(peerIds));
  if (!peers || peers.length === 0) {
    return NextResponse.json({ error: 'Customer is not in your tax_partner' }, { status: 403 });
  }

  const { data, error } = await admin
    .from('consultant_session')
    .insert({
      customer_id: customerId,
      tax_partner_id: ctx.taxPartnerId,
      consultant_id: ctx.consultantId,
      filing_kind: filingKind,
      tax_period: taxPeriodDate,
      current_step: 2, // step 1 (고객선택) is implicit; jump to upload
      status: 'UPLOADING',
    })
    .select('id, status, current_step')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Session for this customer + period already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

return NextResponse.json({ success: true, data }, { status: 201 });
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
    withAudit('CONSULTANT_ERP_SESSION_CREATE'),
  )(request as unknown as RequestWithSession, handlePost);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typeGuard = UserRole.CONSULTANT_JTC;
