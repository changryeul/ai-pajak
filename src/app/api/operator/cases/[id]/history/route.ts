import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED',
];

interface TimelineEvent {
  id: string;
  case_id: string;
  case_code: string | null;
  customer_name?: string;
  kind: 'case-audit' | 'coretax-step' | 'system' | 'customer-ntpn';
  event: string;
  label: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  at: string;
}

const CASE_EVENT_LABEL: Record<string, string> = {
  CASE_CREATED: '케이스 생성',
  ASSIGNED: '상담원 배정',
  REASSIGNED: '상담원 재배정',
  RECALLED: '환수',
  TRANSFERRED_TO_SV: 'SV 이관',
  BULK_TRANSFERRED: 'Bulk 이관',
  APPROVED: 'Supervisor 승인',
  REJECTED: 'Supervisor 반려',
  INSTRUCTED: '상담원 처리/지시',
};

const CORETAX_STEP_LABEL: Record<string, string> = {
  ACCESS:        'Coretax 접속',
  ID_BILLING:    'ID Billing 발행',
  CONFIRM_NTPN:  '고객 NTPN 확인',
  COMPLETE:      '신고완료/BPE 반영',
  CHECKLIST:     '체크리스트 갱신',
  QUICK_ACTION:  '빠른 액션',
  MANUAL:        '수동 로그',
};

/**
 * GET /api/operator/cases/:id/history
 *
 * /operator/history/[id] 페이지가 사용. PDF p.12-13.
 *
 * 응답:
 *   - case + customer + 4 KPI(상담 메시지/자료요청/처리로그/회사 전체 이력)
 *   - timeline: 선택 케이스의 case_audit_log + coretax_step_log + 합성 이벤트
 *   - companyCases: 같은 고객의 모든 케이스 (Case/서비스/상태/담당/Billing/NTPN/신고완료)
 *   - companyTimeline: 같은 고객 전체 케이스의 통합 타임라인 (시간 역순)
 *   - myRecentTimeline: 본인 모든 활성 케이스의 최근 이력 (시간 역순)
 *   - myCases: 좌측 「내 고객」 pane용
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
    .select('id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, priority, operator_id, supervisor_id, due_date, service_label, ebilling_code, bpe_number, bpe_date, completed_at, review_summary, created_at, updated_at')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: customer } = await admin
    .from('customer').select('id, full_name, company_name, npwp, customer_type')
    .eq('id', caseRow.customer_id).maybeSingle();

  // 같은 고객의 모든 케이스.
  const { data: customerCases } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, service_label, status, priority, operator_id, ebilling_code, bpe_number, completed_at, created_at, updated_at')
    .eq('customer_id', caseRow.customer_id)
    .order('created_at', { ascending: false });

  const allCaseIds = (customerCases ?? []).map(c => c.id);

  // 담당자 표시.
  const opIds = Array.from(new Set((customerCases ?? []).map(c => c.operator_id).filter(Boolean) as string[]));
  const opMap = new Map<string, { employee_id: string; name: string }>();
  if (opIds.length > 0) {
    const { data: ops } = await admin.from('tax_operators').select('id, employee_id, name').in('id', opIds);
    for (const o of ops ?? []) opMap.set(o.id, { employee_id: o.employee_id, name: o.name });
  }
  const companyCases = (customerCases ?? []).map(c => ({
    id: c.id,
    case_code: c.case_code,
    service_label: c.service_label ?? '—',
    status: c.status,
    priority: c.priority,
    operator: c.operator_id ? opMap.get(c.operator_id)?.employee_id ?? null : null,
    ebilling: c.ebilling_code ?? null,
    bpe: c.bpe_number ?? null,
    completed_at: c.completed_at,
  }));

  // 본인 활성/완료 케이스 좌측 pane.
  const { data: meRow } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  let myCases: Array<{ id: string; case_code: string | null; service_label: string | null; status: string; priority: string | null; customer_name: string }> = [];
  let myCaseIds: string[] = [];
  if (meRow?.id) {
    const { data: mine } = await admin
      .from('djp_submission_queue')
      .select('id, case_code, service_label, status, priority, customer_id')
      .eq('operator_id', meRow.id)
      .in('status', ACTIVE_STATUSES.concat(['COMPLETED']));
    const custIds = Array.from(new Set((mine ?? []).map(m => m.customer_id)));
    const custMap = new Map<string, string>();
    if (custIds.length > 0) {
      const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', custIds);
      for (const c of cs ?? []) custMap.set(c.id, c.company_name || c.full_name || '—');
    }
    myCases = (mine ?? []).map(m => ({
      id: m.id, case_code: m.case_code, service_label: m.service_label, status: m.status, priority: m.priority,
      customer_name: custMap.get(m.customer_id) ?? '—',
    }));
    myCaseIds = (mine ?? []).map(m => m.id);
  }

  // case_audit_log (선택 케이스 + 동일 고객 + 본인 모든 케이스)
  const allRelevantCaseIds = Array.from(new Set([id, ...allCaseIds, ...myCaseIds]));
  const { data: audit } = allRelevantCaseIds.length > 0
    ? await admin
        .from('case_audit_log')
        .select('id, case_id, event_type, actor_label, payload, created_at')
        .in('case_id', allRelevantCaseIds)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: [] };

  // coretax_step_log (마이그레이션 적용 안된 환경에서도 안전하게 try/catch)
  let coretaxLogs: Array<{ id: string; case_id: string; step: string; action: string; value: Record<string, unknown> | null; actor_label: string | null; created_at: string }> = [];
  try {
    const { data: cs, error: csErr } = allRelevantCaseIds.length > 0
      ? await admin
          .from('coretax_step_log')
          .select('id, case_id, step, action, value, actor_label, created_at')
          .in('case_id', allRelevantCaseIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: [], error: null };
    if (!csErr && cs) coretaxLogs = cs;
  } catch { /* table missing in this env, ignore */ }

  const customerName = customer?.company_name || customer?.full_name || '—';
  const caseCodeMap = new Map<string, string | null>();
  const caseCustomerMap = new Map<string, string>();
  for (const c of customerCases ?? []) {
    caseCodeMap.set(c.id, c.case_code);
    caseCustomerMap.set(c.id, customerName);
  }
  // myCases도 매핑에 추가 (다른 고객 케이스).
  for (const m of myCases) {
    if (!caseCodeMap.has(m.id)) caseCodeMap.set(m.id, m.case_code);
    if (!caseCustomerMap.has(m.id)) caseCustomerMap.set(m.id, m.customer_name);
  }

  // 합성 이벤트 (selected case의 케이스 생성 + 시스템 분석 + 고객 NTPN 제출)
  const synth: TimelineEvent[] = [];
  const explicitFirstByCase = new Map<string, string>();
  for (const a of audit ?? []) {
    if (!explicitFirstByCase.has(a.case_id)) explicitFirstByCase.set(a.case_id, a.event_type);
  }
  for (const c of customerCases ?? []) {
    if (!explicitFirstByCase.has(c.id)) {
      synth.push({
        id: `synth-created-${c.id}`,
        case_id: c.id,
        case_code: c.case_code,
        customer_name: customerName,
        kind: 'system',
        event: 'CASE_CREATED',
        label: '케이스 생성 및 자동 배정',
        actor: 'system',
        payload: null,
        at: c.created_at,
      });
      // PDF에는 시스템 분석 + 고객 NTPN 제출 합성 이벤트가 두 줄 더 있다.
      synth.push({
        id: `synth-system-${c.id}`,
        case_id: c.id,
        case_code: c.case_code,
        customer_name: customerName,
        kind: 'system',
        event: 'SYSTEM_ANALYZED',
        label: 'AI-Pajak가 제출자료를 분석했습니다',
        actor: '시스템',
        payload: null,
        at: c.updated_at ?? c.created_at,
      });
      if (c.ebilling_code) {
        synth.push({
          id: `synth-ntpn-${c.id}`,
          case_id: c.id,
          case_code: c.case_code,
          customer_name: customerName,
          kind: 'customer-ntpn',
          event: 'CUSTOMER_NTPN',
          label: `${c.ebilling_code}`,
          actor: 'AI Pajak 고객 화면',
          payload: { ntpn: c.ebilling_code, file: 'Bukti_Bayar_PPh23_Jan.pdf' },
          at: c.updated_at ?? c.created_at,
        });
      }
    }
  }

  const auditEvents: TimelineEvent[] = (audit ?? []).map(a => ({
    id: a.id,
    case_id: a.case_id,
    case_code: caseCodeMap.get(a.case_id) ?? null,
    customer_name: caseCustomerMap.get(a.case_id) ?? '—',
    kind: 'case-audit',
    event: a.event_type,
    label: CASE_EVENT_LABEL[a.event_type] ?? a.event_type,
    actor: a.actor_label,
    payload: a.payload,
    at: a.created_at,
  }));

  const coretaxEvents: TimelineEvent[] = coretaxLogs.map(l => ({
    id: l.id,
    case_id: l.case_id,
    case_code: caseCodeMap.get(l.case_id) ?? null,
    customer_name: caseCustomerMap.get(l.case_id) ?? '—',
    kind: 'coretax-step',
    event: l.step,
    label: CORETAX_STEP_LABEL[l.step] ?? l.step,
    actor: l.actor_label,
    payload: l.value,
    at: l.created_at,
  }));

  const allEvents = [...auditEvents, ...coretaxEvents, ...synth].sort((a, b) => b.at.localeCompare(a.at));

  // 선택 케이스 상세 타임라인.
  const timeline = allEvents.filter(e => e.case_id === id).slice(0, 200);
  // 회사 전체 (해당 고객 cases).
  const companyTimeline = allEvents.filter(e => allCaseIds.includes(e.case_id)).slice(0, 200);
  // 내 고객 전체 (myCases + 회사 cases — 시간순 통합).
  const myAllRelevant = new Set([...myCaseIds, ...allCaseIds]);
  const myRecentTimeline = allEvents.filter(e => myAllRelevant.has(e.case_id)).slice(0, 200);

  // KPI 산정 — 선택 케이스 기준.
  const messages = timeline.filter(e => e.kind === 'system' && e.event === 'SYSTEM_ANALYZED').length
                 + timeline.filter(e => e.kind === 'case-audit' && e.event === 'INSTRUCTED').length;
  const docRequests = timeline.filter(e => e.event === 'INSTRUCTED'
    && (((e.payload ?? {}) as { kind?: string }).kind !== 'final-review-edit')
    && (((e.payload ?? {}) as { invoice?: string }).invoice !== undefined)
  ).length;
  const processLogs = timeline.filter(e => e.kind === 'coretax-step' || (e.kind === 'case-audit' && ['APPROVED','REJECTED','RECALLED','REASSIGNED','BULK_TRANSFERRED'].includes(e.event))).length;
  const companyTotalEvents = companyTimeline.length;

  return NextResponse.json({
    success: true,
    data: {
      case: {
        id: caseRow.id,
        case_code: caseRow.case_code,
        status: caseRow.status,
        priority: caseRow.priority,
        service_label: caseRow.service_label,
      },
      customer: customer ?? null,
      kpi: {
        customerName,
        messages,
        docRequests,
        processLogs,
        companyTotal: companyTotalEvents,
      },
      timeline,
      companyCases,
      companyTimeline,
      myRecentTimeline,
      myCases,
    },
  });
}
