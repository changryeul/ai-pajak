import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

interface ReviewItem {
  state?: string;
  invoice?: string;
  vendor?: string;
  taxKind?: string;
  taxCode?: string;
  tax?: number;
  dpp?: number;
  reason?: string;
  checkedAt?: string;
  requestedAt?: string;
  note?: string;
}

interface ReviewSummary {
  items?: ReviewItem[];
  reviewRequired?: number;
  generatedAt?: string;
}

/**
 * PUT /api/operator/cases/:id/review-item
 *
 * 상담원이 검토 화면에서 확인할 항목에 액션을 적용한다.
 *
 * Body:
 *   { invoice: 'INV-W-002', action: 'mark-checked' | 'request-docs', note?: string }
 *
 * 본인이 배정된 케이스에서만 동작 (operator_id === me).
 *
 * 부수효과:
 *   - mark-checked  → review_summary.items[*].state = '자동확인', checkedAt 기록
 *                     모든 항목이 자동확인이면 status를 그대로 두되 reviewRequired=0
 *   - request-docs  → state = '자료요청', requestedAt 기록, status='PENDING_DOCS' 전환
 *                     case_audit_log INSTRUCTED 이벤트 기록
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { invoice, action, note } = body as { invoice?: string; action?: string; note?: string };
  if (!invoice || !action) return NextResponse.json({ error: 'invoice & action required' }, { status: 400 });

  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, status, review_summary')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 본인 케이스 확인.
  const { data: meOp } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  if (meOp?.id && caseRow.operator_id !== meOp.id) {
    return NextResponse.json({ error: 'Forbidden — not your case' }, { status: 403 });
  }

  const rs = (caseRow.review_summary ?? { items: [] }) as ReviewSummary;
  const items: ReviewItem[] = rs.items ?? [];
  const idx = items.findIndex(i => i.invoice === invoice);
  if (idx < 0) return NextResponse.json({ error: 'invoice item not found in review_summary' }, { status: 404 });

  const ts = new Date().toISOString();
  let nextStatus: string | null = null;

  if (action === 'mark-checked') {
    items[idx] = { ...items[idx], state: '자동확인', reason: '', checkedAt: ts };
  } else if (action === 'request-docs') {
    items[idx] = { ...items[idx], state: '자료요청', note: note ?? items[idx].note ?? undefined, requestedAt: ts };
    nextStatus = 'PENDING_DOCS';
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const reviewRequired = items.filter(i => i.state !== '자동확인' && i.state !== '자료요청').length;
  const updatePayload: Record<string, unknown> = {
    review_summary: { ...rs, items, reviewRequired, generatedAt: rs.generatedAt ?? ts },
  };
  if (nextStatus && caseRow.status !== nextStatus) updatePayload.status = nextStatus;

  const { error } = await admin.from('djp_submission_queue').update(updatePayload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 자료요청은 감사로그에 INSTRUCTED 이벤트 기록 (상담원 → 고객).
  if (action === 'request-docs') {
    const actorLabel = meOp ? `${meOp.name} (${meOp.employee_id})` : (user.email ?? 'system');
    try {
      await admin.from('case_audit_log').insert({
        case_id: id, event_type: 'INSTRUCTED',
        actor_user_id: user.id, actor_label: actorLabel,
        payload: { invoice, note: note ?? '자료요청 발송' },
      });
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({
    success: true,
    data: { reviewRequired, items, status: updatePayload.status ?? caseRow.status },
  });
}
