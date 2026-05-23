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
  // 상담원이 최종으로 적용할 값. 비어있으면 AI 판단(taxKind/taxCode/tax)을 따름.
  finalTaxKind?: string;
  finalTaxCode?: string;
  finalTax?: number;
  finalDpp?: number;
  vendorOverride?: string;
  // 자료요청 부수.
  note?: string | null;
  checkedAt?: string;
  requestedAt?: string;
}

interface ReviewSummary {
  items?: ReviewItem[];
  reviewRequired?: number;
  generatedAt?: string;
  finalReviewedAt?: string | null;
}

const TAX_KIND_OPTIONS = ['PPh21', 'PPh22', 'PPh23', 'PPh4(2)', 'PPh26', 'PPN'];

const isReviewedItem = (i: ReviewItem) => i.state === '자동확인' || !!i.checkedAt;

/**
 * GET /api/operator/cases/:id/final-review
 *
 * /operator/approval-request/:id (Final Review) 화면이 사용. PDF p.5-7.
 *
 * 응답:
 *   - case + customer + service + 4 KPI(고객/서비스/검토필요/자료요청중)
 *   - finalItems: review_summary.items 를 「최종 적용값」 형태로 평탄화
 *   - taxKindOptions: dropdown 후보
 *   - documents: 제출자료/파싱상태
 *   - editHistory: case_audit_log 중 INSTRUCTED + REASSIGNED + APPROVED + REJECTED만 추출
 *   - myCases: 좌측 pane용
 *   - canSubmit: reviewRequired === 0 && status in (PENDING_DOCS, DATA_REVIEW)
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    .select('id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, priority, operator_id, supervisor_id, due_date, service_label, review_summary, created_at, updated_at')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: customer } = await admin
    .from('customer').select('id, full_name, company_name, npwp, customer_type')
    .eq('id', caseRow.customer_id).maybeSingle();

  const opIds = [caseRow.operator_id, caseRow.supervisor_id].filter(Boolean) as string[];
  const opMap = new Map<string, { employee_id: string; name: string }>();
  if (opIds.length > 0) {
    const { data: ops } = await admin.from('tax_operators').select('id, employee_id, name').in('id', opIds);
    for (const o of ops ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }

  const rs = (caseRow.review_summary ?? null) as ReviewSummary | null;
  const items = rs?.items ?? [];
  const finalItems = items.map(it => ({
    invoice: it.invoice ?? '',
    vendor: it.vendorOverride ?? it.vendor ?? '',
    aiTaxKind: it.taxKind ?? '',
    aiTaxCode: it.taxCode ?? '',
    finalTaxKind: it.finalTaxKind ?? it.taxKind ?? '',
    finalTaxCode: it.finalTaxCode ?? it.taxCode ?? '',
    dpp: it.finalDpp ?? it.dpp ?? 0,
    tax: it.finalTax ?? it.tax ?? 0,
    state: it.state ?? '',
    isReviewed: isReviewedItem(it),
  }));
  const totalTax = finalItems.reduce((s, i) => s + (i.tax ?? 0), 0);
  const dataRequestCount = items.filter(i => i.state === '자료요청').length;
  const reviewRequired = items.filter(i => i.state !== '자동확인' && i.state !== '자료요청').length;

  // case_audit_log → 상담원 수정/처리 이력 (편집/지시/배정 변경 위주).
  const { data: audit } = await admin
    .from('case_audit_log')
    .select('id, event_type, actor_label, payload, created_at')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  const editHistory = (audit ?? []).map(a => ({
    id: a.id,
    event: a.event_type,
    actor: a.actor_label,
    payload: a.payload,
    at: a.created_at,
  }));

  // 본인 활성 케이스 (좌측 pane).
  const { data: meRow } = await admin.from('tax_operators').select('id').eq('user_id', user.id).maybeSingle();
  let myCases: Array<{ id: string; case_code: string | null; service_label: string | null; status: string; priority: string | null; customer_name: string; review_required: number }> = [];
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
      const subRs = (m.review_summary ?? null) as ReviewSummary | null;
      return {
        id: m.id,
        case_code: m.case_code,
        service_label: m.service_label,
        status: m.status,
        priority: m.priority,
        customer_name: custMap.get(m.customer_id) ?? '—',
        review_required: subRs?.reviewRequired ?? 0,
      };
    });
  }

  // 제출자료 (Phase 3과 동일한 데모 데이터).
  const documents = [
    { type: 'INVOICE',  name: 'Invoice_Jasa_Jan.pdf',  parsedFields: 11, status: 'submitted' },
    { type: 'CONTRACT', name: 'Contract_Service.pdf',  parsedFields: 8,  status: 'submitted' },
    { type: 'BANK',     name: 'Bank_Payment_Jan.xlsx', parsedFields: 6,  status: 'submitted' },
  ];

  return NextResponse.json({
    success: true,
    data: {
      case: {
        id: caseRow.id, case_code: caseRow.case_code, status: caseRow.status,
        priority: caseRow.priority, due_date: caseRow.due_date,
      },
      customer: customer ?? null,
      service: {
        label: caseRow.service_label ?? '—',
        taxType: caseRow.tax_type,
        period: { month: caseRow.tax_period_month, year: caseRow.tax_period_year },
        totalTax,
      },
      kpi: {
        customer: customer?.company_name || customer?.full_name || '—',
        serviceLabel: caseRow.service_label ?? '—',
        reviewRequired,
        dataRequestCount,
      },
      finalItems,
      taxKindOptions: TAX_KIND_OPTIONS,
      documents,
      editHistory,
      myCases,
      operator: caseRow.operator_id ? opMap.get(caseRow.operator_id) ?? null : null,
      supervisor: caseRow.supervisor_id ? opMap.get(caseRow.supervisor_id) ?? null : null,
      canSubmit: reviewRequired === 0 && ['PENDING', 'PENDING_DOCS', 'DATA_REVIEW'].includes(caseRow.status),
      finalReviewedAt: rs?.finalReviewedAt ?? null,
    },
  });
}

/**
 * PUT /api/operator/cases/:id/final-review
 *
 * 단일 invoice의 「최종 적용값」을 갱신. 본인 케이스만 가능.
 *
 * Body: { invoice, finalTaxKind?, finalTaxCode?, finalTax?, finalDpp?, vendorOverride? }
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
  const { invoice, finalTaxKind, finalTaxCode, finalTax, finalDpp, vendorOverride } = body as {
    invoice?: string; finalTaxKind?: string; finalTaxCode?: string; finalTax?: number; finalDpp?: number; vendorOverride?: string;
  };
  if (!invoice) return NextResponse.json({ error: 'invoice required' }, { status: 400 });

  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, status, review_summary')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: meOp } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  if (meOp?.id && caseRow.operator_id !== meOp.id) {
    return NextResponse.json({ error: 'Forbidden — not your case' }, { status: 403 });
  }

  const rs = (caseRow.review_summary ?? { items: [] }) as ReviewSummary;
  const items: ReviewItem[] = rs.items ?? [];
  const idx = items.findIndex(i => i.invoice === invoice);
  if (idx < 0) return NextResponse.json({ error: 'invoice item not found' }, { status: 404 });

  const before = items[idx];
  const updated: ReviewItem = {
    ...before,
    finalTaxKind: finalTaxKind ?? before.finalTaxKind,
    finalTaxCode: finalTaxCode ?? before.finalTaxCode,
    finalTax: typeof finalTax === 'number' ? finalTax : before.finalTax,
    finalDpp: typeof finalDpp === 'number' ? finalDpp : before.finalDpp,
    vendorOverride: vendorOverride ?? before.vendorOverride,
  };
  items[idx] = updated;

  const newRs: ReviewSummary = { ...rs, items };
  const { error } = await admin.from('djp_submission_queue').update({ review_summary: newRs }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 변경 이력은 case_audit_log INSTRUCTED 이벤트로 누적 (편집 흔적).
  const actorLabel = meOp ? `${meOp.name} (${meOp.employee_id})` : (user.email ?? 'system');
  try {
    await admin.from('case_audit_log').insert({
      case_id: id, event_type: 'INSTRUCTED',
      actor_user_id: user.id, actor_label: actorLabel,
      payload: {
        kind: 'final-review-edit',
        invoice,
        before: { taxKind: before.finalTaxKind ?? before.taxKind, taxCode: before.finalTaxCode ?? before.taxCode, tax: before.finalTax ?? before.tax },
        after:  { taxKind: updated.finalTaxKind, taxCode: updated.finalTaxCode, tax: updated.finalTax },
      },
    });
  } catch { /* non-blocking */ }

  return NextResponse.json({ success: true, data: { item: updated } });
}
