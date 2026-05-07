import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED',
];

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
  // 자료요청 사유 메모.
  note?: string;
}

interface ReviewSummary {
  items?: ReviewItem[];
  reviewRequired?: number;
  generatedAt?: string;
}

const STATE_FALLBACK_REASON: Record<string, string> = {
  '불확실 높음': '계약서에서 임대료/서비스료 구분 불명확',
  '정보부족': '수입 PIB 또는 구매 성격 자료 부족',
  '자동확인': '',
  '자료요청': '고객 응답 대기',
};

/**
 * GET /api/operator/cases/:id/review-detail
 *
 * /operator/review-case/:id 페이지(검토 3-pane)에서 사용.
 *
 * 응답:
 *   - case: {id, case_code, status, priority, ...}
 *   - customer: {name, type, npwp}
 *   - service: {label, taxType, period, totalTax}
 *   - approval: {state, supervisorName, approvedAt}
 *   - reviewItems: [{invoice, vendor, taxKind, taxCode, dpp, tax, state, reason, checkedAt, requestedAt}]
 *   - submitted: {ntpn, buktiFile}
 *   - documents: [{type:'INVOICE'|'CONTRACT'|'BANK', name, parsedFields}]
 *   - myCases: 본인의 다른 활성 케이스(좌측 pane의 「내 고객」)
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: roles } = await admin
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const { id } = await ctx.params;
  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, priority, operator_id, supervisor_id, due_date, service_label, ebilling_code, bpe_number, bpe_date, review_summary, notes, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 고객 + 담당자/슈퍼바이저.
  const { data: customer } = await admin
    .from('customer').select('id, full_name, company_name, npwp, customer_type')
    .eq('id', caseRow.customer_id).maybeSingle();
  const opIds = [caseRow.operator_id, caseRow.supervisor_id].filter(Boolean) as string[];
  const opMap = new Map<string, { employee_id: string; name: string }>();
  if (opIds.length > 0) {
    const { data: ops } = await admin.from('tax_operators').select('id, employee_id, name').in('id', opIds);
    for (const o of ops ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }

  // 본인의 다른 활성 케이스 (좌측 pane의 「내 고객」).
  const { data: meRow } = await admin.from('tax_operators').select('id').eq('user_id', user.id).maybeSingle();
  let myCases: Array<{
    id: string; case_code: string | null; service_label: string | null; status: string; priority: string | null;
    customer_name: string; review_required: number;
  }> = [];
  if (meRow?.id) {
    const { data: mine } = await admin
      .from('djp_submission_queue')
      .select('id, case_code, service_label, status, priority, customer_id, review_summary')
      .eq('operator_id', meRow.id)
      .in('status', ACTIVE_STATUSES.concat(['COMPLETED']));
    const custIds = Array.from(new Set((mine ?? []).map(m => m.customer_id)));
    const custMap = new Map<string, string>();
    if (custIds.length > 0) {
      const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', custIds);
      for (const c of cs ?? []) custMap.set(c.id, c.company_name || c.full_name || '—');
    }
    myCases = (mine ?? []).map(m => {
      const rs = (m.review_summary ?? null) as ReviewSummary | null;
      return {
        id: m.id,
        case_code: m.case_code,
        service_label: m.service_label,
        status: m.status,
        priority: m.priority,
        customer_name: custMap.get(m.customer_id) ?? '—',
        review_required: rs?.reviewRequired ?? 0,
      };
    });
  }

  // 검토 항목.
  const rs = (caseRow.review_summary ?? null) as ReviewSummary | null;
  const reviewItems: ReviewItem[] = (rs?.items ?? []).map(it => ({
    ...it,
    reason: it.reason ?? (it.state ? STATE_FALLBACK_REASON[it.state] : ''),
  }));
  const reviewRequired = reviewItems.filter(i => i.state !== '자동확인' && i.state !== '자료요청').length;

  // 가짜 제출자료 (Phase 3에선 데모 데이터). 추후 document/document_request 연동 예정.
  const submittedDocs = [
    { type: 'INVOICE',  name: 'Invoice_Jasa_Jan.pdf',     parsedFields: 11, status: '제출' },
    { type: 'CONTRACT', name: 'Contract_Service.pdf',     parsedFields: 8,  status: '제출' },
    { type: 'BANK',     name: 'Bank_Payment_Jan.xlsx',    parsedFields: 6,  status: '제출' },
  ];

  // 고객이 제출한 NTPN/증빙 (Phase 6 Coretax 화면에서도 사용).
  const submitted = caseRow.ebilling_code
    ? { ntpn: caseRow.ebilling_code, buktiFile: 'Bukti_Bayar_PPh23_Jan.pdf', submittedAt: caseRow.updated_at ?? caseRow.created_at }
    : { ntpn: '2026-0001-2345-6789', buktiFile: 'Bukti_Bayar_PPh23_Jan.pdf', submittedAt: caseRow.updated_at ?? caseRow.created_at };

  return NextResponse.json({
    success: true,
    data: {
      case: {
        id: caseRow.id,
        case_code: caseRow.case_code,
        status: caseRow.status,
        priority: caseRow.priority,
        due_date: caseRow.due_date,
        notes: caseRow.notes,
      },
      customer: customer ?? null,
      service: {
        label: caseRow.service_label ?? '—',
        taxType: caseRow.tax_type,
        period: { month: caseRow.tax_period_month, year: caseRow.tax_period_year },
        totalTax: Number(caseRow.amount ?? 0),
      },
      approval: {
        state: caseRow.status === 'PENDING_APPROVAL' ? '요청중'
             : ['APPROVED','EBILLING_GENERATED','PAYMENT_PENDING','PAYMENT_UPLOADED','PAYMENT_VERIFIED','DJP_SUBMITTED','BPE_UPLOADED','COMPLETED'].includes(caseRow.status) ? '승인됨'
             : caseRow.status === 'FAILED' ? '반려'
             : '미요청',
        supervisor: caseRow.supervisor_id ? opMap.get(caseRow.supervisor_id) ?? null : null,
      },
      operator: caseRow.operator_id ? opMap.get(caseRow.operator_id) ?? null : null,
      reviewItems,
      reviewRequired,
      submitted,
      documents: submittedDocs,
      myCases,
    },
  });
}
