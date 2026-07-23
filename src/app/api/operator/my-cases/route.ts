import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING',
] as const;

const CORETAX_READY_STATUSES = ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING'];

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

interface ReviewSummary {
  items?: Array<Record<string, unknown>>;
  reviewRequired?: number;
}

interface CaseRow {
  id: string;
  case_code: string | null;
  customer_id: string;
  service_label: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  ebilling_code: string | null;
  bpe_number: string | null;
  review_summary: ReviewSummary | null;
  created_at: string;
}

const approvalState = (status: string): '미요청' | '요청중' | '승인됨' | '반려' => {
  if (status === 'PENDING_APPROVAL') return '요청중';
  if (['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'COMPLETED'].includes(status)) return '승인됨';
  if (status === 'FAILED') return '반려';
  return '미요청';
};

const dDay = (due: string | null): string => {
  if (!due) return '—';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due); dueDate.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'D-day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};

// English fallback text kept for non-i18n callers — the staff UIs all derive
// the localized hint from `status` via `operatorStaff.nextAction.*`, so this
// field is only used as a safety net.
const nextAction = (status: string): string => {
  switch (status) {
    case 'PENDING':            return 'Start review. Open the review menu on the right.';
    case 'PENDING_DOCS':       return 'You have requested missing documents from the customer, or are waiting for the customer to respond.';
    case 'DATA_REVIEW':        return 'Review the flagged items or request missing documents.';
    case 'PENDING_APPROVAL':   return 'Waiting for supervisor approval.';
    case 'APPROVED':           return 'Start Coretax processing. Record the ID Billing issuance.';
    case 'EBILLING_GENERATED': return 'Send the ID Billing to the customer.';
    case 'PAYMENT_PENDING':    return 'Waiting for the customer to pay. NTPN is auto-generated in Coretax after payment.';
    default:                   return 'Proceed with the next step.';
  }
};

/**
 * GET /api/operator/my-cases
 *
 * 본인에게 배정된 활성 케이스 + 4 KPI(긴급/검토필요/승인대기/Coretax 대기).
 * /operator/my-work 페이지가 사용. PDF p.1-2.
 *
 * 정렬: priority(URGENT→LOW) → due_date(가까운 순) → created_at(오래된 순).
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: roles } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { data: meRow } = await admin
    .from('tax_operators').select('id, employee_id, name')
    .eq('user_id', user.id).maybeSingle();

  if (!meRow) {
    return NextResponse.json({ success: true, data: { items: [], kpi: { urgent: 0, needsReview: 0, awaitingApproval: 0, coretaxReady: 0 }, me: null } });
  }

  const { data: cases, error } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, customer_id, service_label, status, priority, due_date, ebilling_code, bpe_number, review_summary, created_at')
    .eq('operator_id', meRow.id)
    .in('status', ACTIVE_STATUSES);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (cases ?? []) as CaseRow[];

  const customerIds = Array.from(new Set(rows.map(r => r.customer_id)));
  const custMap = new Map<string, { id: string; full_name: string; company_name: string | null; customer_type: string }>();
  if (customerIds.length > 0) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name, customer_type').in('id', customerIds);
    for (const c of cs ?? []) custMap.set(c.id, c);
  }

  const items = rows.map(r => {
    const cust = custMap.get(r.customer_id);
    const reviewRequired = r.review_summary?.reviewRequired ?? 0;
    // 자료요청 카운트 — 추후 document_request 테이블 연동 전까지는 PENDING_DOCS 상태일 때 1로 간주.
    const docRequested = r.status === 'PENDING_DOCS' ? 1 : 0;
    return {
      id: r.id,
      case_code: r.case_code,
      service_label: r.service_label ?? '—',
      status: r.status,
      priority: r.priority ?? 'NORMAL',
      due_date: r.due_date,
      d_day: dDay(r.due_date),
      customer: {
        id: r.customer_id,
        name: cust?.company_name || cust?.full_name || '—',
        type: cust?.customer_type ?? null,
      },
      operator_emp_id: meRow.employee_id,
      metrics: {
        review_required: reviewRequired,
        doc_requested: docRequested,
        approval: approvalState(r.status),
        ntpn: r.ebilling_code ?? r.bpe_number ?? null,
      },
      next_action: nextAction(r.status),
    };
  }).sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 9;
    const pb = PRIORITY_RANK[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const kpi = {
    urgent:            items.filter(i => i.priority === 'URGENT').length,
    needsReview:       items.reduce((sum, i) => sum + i.metrics.review_required, 0),
    awaitingApproval:  items.filter(i => i.status === 'PENDING_APPROVAL').length,
    coretaxReady:      items.filter(i => CORETAX_READY_STATUSES.includes(i.status)).length,
  };

  return NextResponse.json({
    success: true,
    data: {
      items,
      kpi,
      me: { id: meRow.id, employee_id: meRow.employee_id, name: meRow.name },
    },
  });
}
