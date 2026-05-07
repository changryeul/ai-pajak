import { NextRequest, NextResponse } from 'next/server';
import { composeMiddleware } from '@/middleware/compose';
import { requireAuth } from '@/middleware/auth';
import { withAudit } from '@/middleware/audit';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import type { RequestWithSession } from '@/types/auth';

async function ensureOwnedSession(sessionId: string, customerId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('tax_closing_session')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!data || data.customer_id !== customerId) return null;
  return data;
}

async function handleGet(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('closing_submission')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();
  return NextResponse.json({ success: true, data: data ?? null });
}

async function handlePost(req: RequestWithSession, sessionId: string): Promise<Response> {
  const customerId = req.session?.customerId;
  if (!customerId) {
    return NextResponse.json({ success: false, error: 'No customer' }, { status: 400 });
  }
  const owned = await ensureOwnedSession(sessionId, customerId);
  if (!owned) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const sb = getSupabaseAdmin();

  // Pre-flight: must have signed financial statements + ID Billing.
  const [{ data: docs }, { data: billing }] = await Promise.all([
    sb.from('closing_document').select('doc_type, file_name').eq('session_id', sessionId),
    sb.from('closing_id_billing').select('billing_code, amount, kap_code, kjs_code').eq('session_id', sessionId).maybeSingle(),
  ]);

  const hasSigned = docs?.some((d) => d.doc_type === 'signedStatements');
  if (!hasSigned) {
    return NextResponse.json(
      { success: false, error: '서명된 재무제표가 업로드되지 않았습니다' },
      { status: 400 }
    );
  }
  if (!billing) {
    return NextResponse.json(
      { success: false, error: 'ID Billing이 발급되지 않았습니다' },
      { status: 400 }
    );
  }

  const packageSummary = {
    documents: (docs ?? []).map((d) => ({ type: d.doc_type, file: d.file_name })),
    billing: {
      code: billing.billing_code,
      amount: Number(billing.amount),
      kap: billing.kap_code,
      kjs: billing.kjs_code,
    },
    closing_type: owned.closing_type,
    fiscal_year: owned.fiscal_year,
    submitted_via: 'wizard',
  };

  const useCoretaxApi = process.env.CORETAX_SUBMIT_ENABLED === 'true';
  const channel = useCoretaxApi ? 'CORETAX_API' : 'RPA';

  // Until Coretax is enabled, sit in SUBMITTED so an operator can pick up.
  const { data, error } = await sb
    .from('closing_submission')
    .upsert(
      {
        session_id: sessionId,
        status: 'SUBMITTED',
        channel,
        submitted_at: new Date().toISOString(),
        package_summary: packageSummary,
      },
      { onConflict: 'session_id' }
    )
    .select()
    .single();

  if (error) {
    loggers.api.error({ err: error, sessionId }, 'closing submission upsert failed');
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Mark the session COMPLETED so the wizard locks the final action.
  await sb
    .from('tax_closing_session')
    .update({ status: 'COMPLETED' })
    .eq('id', sessionId);

  // Phase B — 운영팀 큐와의 브릿지. 결산 wizard 제출은 곧바로 djp_submission_queue
  // 케이스(SPT_TAHUNAN, status=PENDING)를 만들어둔다. 같은 session에서 재제출이
  // 일어나면 closing_session_id 기준으로 upsert 한다. 운영팀이 Coretax 처리해서
  // record-completion 액션을 호출하면 양쪽이 동기화된다.
  try {
    const { data: existingCase } = await sb
      .from('djp_submission_queue')
      .select('id')
      .eq('closing_session_id', sessionId)
      .maybeSingle();

    const caseCode = `CL-${sessionId.slice(0, 8).toUpperCase()}`;
    const queuePayload: Record<string, unknown> = {
      customer_id: customerId,
      closing_session_id: sessionId,
      case_code: caseCode,
      service_label: owned.closing_type === 'UMKM'
        ? 'SPT Tahunan UMKM (PPh Final 0.5%)'
        : 'SPT Tahunan Badan Coretax 2025+',
      tax_type: 'SPT_TAHUNAN',
      tax_period_month: 12,
      tax_period_year: owned.fiscal_year,
      amount: Number(billing.amount),
      status: 'PENDING',
      priority: 'NORMAL',
      ebilling_code: billing.billing_code,
    };

    if (existingCase) {
      await sb.from('djp_submission_queue').update(queuePayload).eq('id', existingCase.id);
    } else {
      await sb.from('djp_submission_queue').insert(queuePayload);
    }
  } catch (linkErr) {
    // 브릿지 실패는 결산 제출 자체를 막지 않는다. 운영팀이 수동으로 케이스를 생성할 수 있음.
    loggers.api.warn({ err: linkErr, sessionId }, 'failed to bridge closing → operator queue');
  }

  return NextResponse.json({ success: true, data });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth)(request as RequestWithSession, (r) => handleGet(r, id));
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return composeMiddleware(requireAuth, withAudit('CLOSING_SUBMIT'))(
    request as RequestWithSession,
    (r) => handlePost(r, id)
  );
}
