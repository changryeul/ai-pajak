/**
 * POST /api/consultant-erp/sessions/:id/parse-rows/message
 *   body: { locale?: 'ko' | 'id', includeInfo?: boolean }
 *   → 200 { markdown }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireConsultantOrSupervisor } from '@/middleware/requireConsultantOrSupervisor';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  ensureSessionAccess,
  resolveConsultantContext,
} from '@/lib/consultant-erp/session-helpers';
import { buildClientMessage } from '@/lib/consultant-erp/client-message-builder';
import type { RequestWithSession } from '@/types/auth';

const schema = z.object({
  locale: z.enum(['ko', 'id']).optional(),
  includeInfo: z.boolean().optional(),
});

function getSessionId(req: NextRequest): string | null {
  const m = req.nextUrl.pathname.match(/\/sessions\/([^/]+)\/parse-rows\/message/);
  return m?.[1] ?? null;
}

async function handlePost(req: RequestWithSession): Promise<Response> {
  const sessionId = getSessionId(req as unknown as NextRequest);
  if (!sessionId) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const ctx = await resolveConsultantContext({
    userId: req.session.userId,
    role: req.session.role,
  });
  if (!ctx) return NextResponse.json({ error: 'Consultant profile not found' }, { status: 404 });

  const guard = await ensureSessionAccess({ sessionId, ctx });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: sessionRow } = await admin
    .from('consultant_session')
    .select('customer_id, consultant_id')
    .eq('id', sessionId)
    .single();
  const { data: docs } = await admin
    .from('consultant_session_document')
    .select('id')
    .eq('session_id', sessionId);
  const docIds = (docs ?? []).map((d) => d.id);
  let rows: Array<{
    entity_label: string | null;
    field_name: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
    message_ko: string | null;
    message_id: string | null;
    is_resolved: boolean;
  }> = [];
  if (docIds.length > 0) {
    const { data: raw } = await admin
      .from('consultant_session_parse_row')
      .select('entity_label, field_name, severity, message_ko, message_id, is_resolved')
      .in('document_id', docIds);
    rows = raw ?? [];
  }

  // Names for greeting
  const { data: customer } = await admin
    .from('customer')
    .select('full_name, company_name')
    .eq('id', sessionRow!.customer_id)
    .single();
  const { data: consultant } = await admin
    .from('consultant')
    .select('full_name')
    .eq('id', sessionRow!.consultant_id)
    .single();

  const markdown = buildClientMessage({
    rows,
    customerName: (customer?.company_name || customer?.full_name || '고객사') as string,
    consultantName: (consultant?.full_name || '담당 컨설턴트') as string,
    locale: parsed.data.locale ?? 'ko',
    includeInfo: parsed.data.includeInfo,
  });

  return NextResponse.json({ success: true, data: { markdown } });
}

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireConsultantOrSupervisor,
  )(request as unknown as RequestWithSession, handlePost);
}
