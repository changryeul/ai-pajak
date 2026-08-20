/**
 * GET /api/operator/supervisor/console/approval-extra
 *   ?customerId=&taxType=&period=YYYY-MM
 *
 * 승인대기 상세(콘솔)의 PPT 요소 중 ERP(consultant_session) 파이프라인에만
 * 있는 두 가지를 큐 항목에 best-effort 로 붙인다:
 *   - 4-값 비교 (고객입력/AI계산/상담원처리/최종승인값)  ← consultant_session_calc
 *   - 상담원 검토요청 카드 (의견 작성 대상)             ← consultant_review_request
 *
 * 큐(djp_submission_queue)와 세션은 (customer_id, tax_period[YYYY-MM]) 로 매칭한다.
 * 매칭 세션이 없으면 빈 배열 → 프론트는 섹션을 숨긴다(값 없으면 표시 안 함).
 * 수퍼바이저(및 상위) 전용. admin 클라이언트로 조회(미들웨어 인증 후).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUP_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_MASTER'];

// 큐 세목 → ERP calc_kind
const KIND_BY_TAX: Record<string, string> = {
  PPh21: 'PPH21_TER',
  PPh23: 'WITHHOLDING_SUMMARY', PPh4_2: 'WITHHOLDING_SUMMARY', PPh15: 'WITHHOLDING_SUMMARY',
  PPh22: 'WITHHOLDING_SUMMARY', PPh26: 'WITHHOLDING_SUMMARY',
  PPh25: 'CORP_TAX_MONTHLY', PPh_FINAL: 'CORP_TAX_MONTHLY',
  PPN: 'PPN_NET',
};

async function gate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !SUP_ROLES.includes(roleRow.role)) {
    return { error: NextResponse.json({ error: 'Supervisor only' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: NextRequest) {
  const g = await gate(); if (g.error) return g.error;
  const sp = request.nextUrl.searchParams;
  const customerId = sp.get('customerId');
  const taxType = sp.get('taxType') ?? '';
  const period = sp.get('period') ?? ''; // YYYY-MM
  const empty = { success: true, data: { session: null, fourValues: [], reviewRequests: [] } };
  if (!customerId || !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json(empty);

  const admin = getSupabaseAdmin();
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  // (customer, period) 매칭 세션 — 최근 갱신 우선.
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, tax_period, status, updated_at')
    .eq('customer_id', customerId)
    .gte('tax_period', start).lt('tax_period', next)
    .order('updated_at', { ascending: false })
    .limit(1);
  const session = sessions?.[0] ?? null;
  if (!session) return NextResponse.json(empty);

  const kind = KIND_BY_TAX[taxType] ?? null;

  const { data: calcs } = await admin
    .from('consultant_session_calc')
    .select('kind, amount, customer_input_amount, ai_amount, consultant_amount, approved_amount')
    .eq('session_id', session.id);
  const relevant = (calcs ?? []).filter(c => (kind ? c.kind === kind : true));
  const fourValues = relevant.map(c => ({
    kind: c.kind,
    customerInput: c.customer_input_amount != null ? Number(c.customer_input_amount) : null,
    ai: c.ai_amount != null ? Number(c.ai_amount) : (c.amount != null ? Number(c.amount) : null),
    consultant: c.consultant_amount != null ? Number(c.consultant_amount) : null,
    approved: c.approved_amount != null ? Number(c.approved_amount) : null,
  }));

  const { data: rr } = await admin
    .from('consultant_review_request')
    .select('id, calc_kind, item_label, reason, status, supervisor_comment, created_at')
    .eq('session_id', session.id)
    .neq('status', 'RESOLVED')
    .order('created_at', { ascending: false });
  const reviewRequests = (rr ?? []).map(r => ({
    id: r.id, calcKind: r.calc_kind ?? null, itemLabel: r.item_label,
    reason: r.reason, status: r.status, supervisorComment: r.supervisor_comment ?? null,
  }));

  return NextResponse.json({
    success: true,
    data: { session: { id: session.id, status: session.status, period }, fourValues, reviewRequests },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
