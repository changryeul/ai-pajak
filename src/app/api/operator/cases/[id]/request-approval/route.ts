import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

interface ReviewSummary {
  items?: Array<{ state?: string }>;
  reviewRequired?: number;
}

/**
 * PUT /api/operator/cases/:id/request-approval
 *
 * 상담원이 검토를 끝내고 Supervisor 승인을 요청. status: DATA_REVIEW → PENDING_APPROVAL.
 *
 * 가드:
 *   - 본인 케이스만 가능 (operator_id === me)
 *   - review_summary.reviewRequired === 0 (미확인 항목 0건)
 *   - status가 DATA_REVIEW/PENDING/PENDING_DOCS 중 하나
 */
export async function PUT(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { id } = await ctx.params;
  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, status, review_summary')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: meOp } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  if (meOp?.id && caseRow.operator_id !== meOp.id) {
    return NextResponse.json({ error: 'Forbidden — not your case' }, { status: 403 });
  }

  const rs = (caseRow.review_summary ?? null) as ReviewSummary | null;
  const reviewRequired = rs?.reviewRequired ?? 0;
  if (reviewRequired > 0) {
    return NextResponse.json({ error: `검토필요 항목 ${reviewRequired}건이 미완료 상태입니다` }, { status: 400 });
  }
  if (!['PENDING', 'PENDING_DOCS', 'DATA_REVIEW'].includes(caseRow.status)) {
    return NextResponse.json({ error: `현재 상태(${caseRow.status})에서는 승인요청을 보낼 수 없습니다` }, { status: 400 });
  }

  const { error } = await admin.from('djp_submission_queue').update({ status: 'PENDING_APPROVAL' }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const actorLabel = meOp ? `${meOp.name} (${meOp.employee_id})` : (user.email ?? 'system');
  try {
    await admin.from('case_audit_log').insert({
      case_id: id, event_type: 'INSTRUCTED',
      actor_user_id: user.id, actor_label: actorLabel,
      payload: { note: 'Supervisor 승인요청 상신', from: caseRow.status, to: 'PENDING_APPROVAL' },
    });
  } catch { /* non-blocking */ }

  return NextResponse.json({ success: true });
}
