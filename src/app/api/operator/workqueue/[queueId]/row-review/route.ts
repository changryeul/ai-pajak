// PATCH /api/operator/workqueue/[queueId]/row-review
//
// 워크큐 팝업 상세의 '저장 및 확인' (수정요청 9·10·15·24, 2026-08-05).
// 필드 저장 자체는 기존 검증된 PUT(/api/tax/{monthly-payslip,
// pph23-transactions,ppn-faktur-monthly})가 수행하고, 이 엔드포인트는
//   1) operator_reviewed_at/by 스탬프 (행 상태 → '완료')
//   2) operator_edits jsonb 에 수정 이력 누적 (상담원/수퍼바이저 색 구분용)
// 만 담당한다. 회계적 진실은 원본 테이블 + audit_log 가 원장.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];
const SUPERVISOR_ROLES = ['TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

// queue.tax_type → (원본 테이블, 큐 소속 검증에 쓸 기간 컬럼)
const SOURCE_BY_TAX_TYPE: Record<string, { table: string; periodCol: string }> = {
  PPh21: { table: 'monthly_payslip', periodCol: 'period' },
  PPh23: { table: 'pph23_transaction', periodCol: 'tax_period' },
  PPN: { table: 'ppn_faktur_monthly', periodCol: 'tax_period' },
};

interface EditEntry { field: string; from: unknown; to: unknown }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ queueId: string }> }) {
  const { queueId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: allRoles } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = allRoles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rowId = body.rowId as string | undefined;
  const confirm = body.confirm === true;
  const edits = (Array.isArray(body.edits) ? body.edits : []) as EditEntry[];
  if (!rowId) return NextResponse.json({ error: 'rowId required' }, { status: 400 });
  if (!confirm && edits.length === 0) {
    return NextResponse.json({ error: 'confirm or edits required' }, { status: 400 });
  }

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year')
    .eq('id', queueId).maybeSingle();
  if (!q) return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });

  const source = SOURCE_BY_TAX_TYPE[q.tax_type];
  if (!source) return NextResponse.json({ error: `row-review unsupported for ${q.tax_type}` }, { status: 400 });

  // 행이 이 큐(고객+귀속기간)에 속하는지 검증 — 임의 행 스탬프 차단
  const period = `${q.tax_period_year}-${String(q.tax_period_month).padStart(2, '0')}`;
  const { data: row } = await admin
    .from(source.table)
    .select(`id, customer_id, ${source.periodCol}, operator_edits`)
    .eq('id', rowId).maybeSingle();
  const rowRecord = row as Record<string, unknown> | null;
  if (!rowRecord || rowRecord.customer_id !== q.customer_id || rowRecord[source.periodCol] !== period) {
    return NextResponse.json({ error: 'Row does not belong to this queue item' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const actorRole = SUPERVISOR_ROLES.includes(role) ? 'SUPERVISOR' : 'COUNSELOR';

  const update: Record<string, unknown> = {};
  if (confirm) {
    update.operator_reviewed_at = now;
    update.operator_reviewed_by = user.id;
  }
  if (edits.length > 0) {
    const prev = (rowRecord.operator_edits as Record<string, unknown> | null) ?? {};
    const merged = { ...prev };
    for (const e of edits.slice(0, 40)) {
      if (typeof e?.field !== 'string' || !e.field) continue;
      merged[e.field] = { from: e.from ?? null, to: e.to ?? null, by: user.id, role: actorRole, at: now };
    }
    update.operator_edits = merged;
  }

  const { error } = await admin.from(source.table).update(update).eq('id', rowId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, data: { rowId, confirmed: confirm, actorRole } });
}
