import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import * as coretax from '@/lib/coretax/client';
import { CoretaxError } from '@/lib/coretax/types';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

const ACTIVE_STATUSES = [
  'PENDING', 'PENDING_DOCS', 'DATA_REVIEW', 'PENDING_APPROVAL',
  'APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED',
];

const CHECKLIST_KEYS = [
  'coretax-login',
  'id-billing-issue',
  'reflect-billing-info',
  'verify-ntpn-bukti',
  'submit-spt-masa',
  'upload-bpe',
] as const;

/** djp_submission_queue.tax_type → Coretax KAP/JENIS_SETORAN. */
function mapTaxTypeToKap(taxType: string): { kap: string; kjs: string } {
  switch (taxType) {
    case 'PPh21':       return { kap: '411121', kjs: '100' };
    case 'PPh22':       return { kap: '411122', kjs: '100' };
    case 'PPh23':       return { kap: '411124', kjs: '100' };
    case 'PPh4_2':
    case 'PPh4(2)':     return { kap: '411128', kjs: '420' };
    case 'PPh26':       return { kap: '411127', kjs: '100' };
    case 'PPN':         return { kap: '411211', kjs: '100' };
    case 'SPT_TAHUNAN': return { kap: '411126', kjs: '200' };
    default:            return { kap: '411124', kjs: '100' };
  }
}

interface ChecklistMap { [key: string]: '대기' | '진행' | '완료' | '미완' }

interface ReviewSummary {
  finalReviewedAt?: string | null;
}

/**
 * GET /api/operator/cases/:id/coretax
 *
 * Coretax 4단계 + 체크리스트 + 수동 로그를 한 번에 반환.
 * /operator/coretax/[id] 페이지가 사용. PDF p.9-11.
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
    .select('id, case_code, customer_id, tax_type, tax_period_month, tax_period_year, amount, status, priority, operator_id, supervisor_id, due_date, service_label, ebilling_code, bpe_number, bpe_date, bpe_file_url, submitted_to_djp_at, completed_at, review_summary, closing_session_id, created_at, updated_at')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: customer } = await admin
    .from('customer').select('id, full_name, company_name, npwp, customer_type')
    .eq('id', caseRow.customer_id).maybeSingle();

  const { data: meRow } = await admin.from('tax_operators').select('id').eq('user_id', user.id).maybeSingle();
  let myCases: Array<{ id: string; case_code: string | null; service_label: string | null; status: string; priority: string | null; customer_name: string }> = [];
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
  }

  // step log fetch.
  const { data: logs } = await admin
    .from('coretax_step_log')
    .select('id, step, action, value, actor_label, created_at')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  // 체크리스트 최신 상태 도출 — checklist 단계의 action 들 중 가장 최근 항목.
  const checklist: ChecklistMap = {};
  for (const k of CHECKLIST_KEYS) checklist[k] = '대기';
  for (const l of (logs ?? []).slice().reverse()) {
    if (l.step === 'CHECKLIST') {
      const v = l.value as { key?: string; state?: ChecklistMap[string] } | null;
      if (v?.key && v.state) checklist[v.key] = v.state;
    }
  }

  const manualLogs = (logs ?? []).filter(l => l.step === 'MANUAL').map(l => ({
    id: l.id, at: l.created_at, actor: l.actor_label, note: ((l.value ?? {}) as { note?: string }).note ?? '',
  }));

  const stepLogs = (logs ?? []).map(l => ({
    id: l.id, step: l.step, action: l.action, value: l.value, actor: l.actor_label, at: l.created_at,
  }));

  // 4단계 진행 상태 도출.
  const status = caseRow.status;
  const approved = ['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED', 'COMPLETED'].includes(status);
  const billingIssued = !!caseRow.ebilling_code || ['EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED', 'COMPLETED'].includes(status);
  const paymentVerified = ['PAYMENT_VERIFIED', 'DJP_SUBMITTED', 'BPE_UPLOADED', 'COMPLETED'].includes(status);
  const submitted = ['DJP_SUBMITTED', 'BPE_UPLOADED', 'COMPLETED'].includes(status);
  const bpeReflected = ['BPE_UPLOADED', 'COMPLETED'].includes(status) || !!caseRow.bpe_number;

  const stepStates = {
    access:    { state: '진행가능' },
    billing:   { state: billingIssued ? '완료' : approved ? '진행가능' : '대기' },
    ntpn:      { state: caseRow.ebilling_code ? '진행가능' : '대기' },
    complete:  { state: bpeReflected ? '완료' : submitted ? '진행가능' : 'BPE 대기' },
  };

  // 고객이 제출한 NTPN — Phase 3와 같은 데모 기본값.
  const submittedNtpn = caseRow.ebilling_code ?? '2026-0001-2345-6789';
  const submittedBukti = 'Bukti_Bayar_PPh23_Jan.pdf';

  return NextResponse.json({
    success: true,
    data: {
      case: {
        id: caseRow.id, case_code: caseRow.case_code, status, priority: caseRow.priority,
        due_date: caseRow.due_date, service_label: caseRow.service_label,
      },
      customer: customer ?? null,
      service: {
        label: caseRow.service_label ?? '—',
        taxType: caseRow.tax_type,
        period: { month: caseRow.tax_period_month, year: caseRow.tax_period_year },
        expectedAmount: Number(caseRow.amount ?? 0),
        coretaxMode: (await coretax.isEnabled()) ? 'API (auto)' : 'Manual access',
      },
      apiEnabled: await coretax.isEnabled(),
      stepStates,
      billing: {
        state: billingIssued ? 'Issued' : 'Not issued',
        billingId: caseRow.ebilling_code ?? null,
        amount: Number(caseRow.amount ?? 0),
        method: 'Coretax manual (pending)',
      },
      submitted: {
        ntpn: submittedNtpn,
        buktiFile: submittedBukti,
        submittedAt: caseRow.updated_at ?? caseRow.created_at,
      },
      complete: {
        ntpnConfirmed: paymentVerified,
        submitted,
        bpeReflected,
        bpeNumber: caseRow.bpe_number ?? null,
        bpeDate: caseRow.bpe_date ?? null,
      },
      checklist,
      manualLogs,
      stepLogs,
      myCases,
      coretaxUrl: 'https://coretaxdjp.pajak.go.id/',
      canRecordBilling: approved, // Supervisor 승인 후만
      finalReviewedAt: ((caseRow.review_summary ?? null) as ReviewSummary | null)?.finalReviewedAt ?? null,
      closingSessionId: caseRow.closing_session_id ?? null,
    },
  });
}

/**
 * PUT /api/operator/cases/:id/coretax
 *
 * Body actions:
 *   { action: 'open-coretax' }                                  — 단순 로그
 *   { action: 'confirm-ntpn',     ntpn }                        — 상담원 NTPN 확인 + 로그
 *   { action: 'record-billing',   billingId, method? }          — ID Billing 발행완료 (status → EBILLING_GENERATED)
 *   { action: 'record-completion', bpeNumber, bpeDate? }        — 신고완료/BPE 반영 (status → COMPLETED)
 *   { action: 'set-checklist',    key, state }                  — 체크리스트 갱신
 *   { action: 'request-access' | 'request-bukti' }              — 빠른 액션
 *   { action: 'log-manual',       note }                        — 자유 로그
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
  const { action } = body as { action?: string };
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

  const { data: caseRow } = await admin
    .from('djp_submission_queue')
    .select('id, operator_id, status, ebilling_code, bpe_number, closing_session_id')
    .eq('id', id).maybeSingle();
  if (!caseRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: meOp } = await admin.from('tax_operators').select('id, employee_id, name').eq('user_id', user.id).maybeSingle();
  if (meOp?.id && caseRow.operator_id !== meOp.id) {
    return NextResponse.json({ error: 'Forbidden — not your case' }, { status: 403 });
  }
  const actorLabel = meOp ? `${meOp.name} (${meOp.employee_id})` : (user.email ?? 'system');

  const stepFor: Record<string, { step: string; action: string }> = {
    'open-coretax':       { step: 'ACCESS',       action: 'opened-new-tab' },
    'confirm-ntpn':       { step: 'CONFIRM_NTPN', action: 'verified-ntpn' },
    'record-billing':     { step: 'ID_BILLING',   action: 'recorded-billing-id' },
    'record-completion':  { step: 'COMPLETE',     action: 'reflected-bpe' },
    'set-checklist':      { step: 'CHECKLIST',    action: 'updated' },
    'request-access':     { step: 'QUICK_ACTION', action: 'request-access' },
    'request-bukti':      { step: 'QUICK_ACTION', action: 'request-bukti' },
    'log-manual':         { step: 'MANUAL',       action: 'manual-note' },
  };
  const meta = stepFor[action];
  if (!meta) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  let queueUpdate: Record<string, unknown> | null = null;
  let logValue: Record<string, unknown> = {};

  switch (action) {
    case 'record-billing': {
      if (!['APPROVED', 'EBILLING_GENERATED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED', 'DJP_SUBMITTED'].includes(caseRow.status)) {
        return NextResponse.json({ error: 'ID Billing can only be recorded after supervisor approval.' }, { status: 400 });
      }
      let billingId = (body.billingId as string | undefined)?.trim();
      let method = body.method ?? 'Coretax manual';
      let apiResult: Record<string, unknown> | null = null;

      // Coretax API 자동 모드 — 환경변수가 켜졌고 사용자가 billingId 입력 안 했을 때만 호출.
      // (수동 입력값이 있으면 그걸 그대로 신뢰 — 운영팀 권한 우선)
      if (!billingId && (await coretax.isEnabled())) {
        try {
          // 자세한 케이스 데이터를 다시 fetch.
          const { data: full } = await admin
            .from('djp_submission_queue')
            .select('amount, tax_type, tax_period_month, tax_period_year, customer_id')
            .eq('id', id).maybeSingle();
          const { data: cust } = full?.customer_id
            ? await admin.from('customer').select('npwp').eq('id', full.customer_id).maybeSingle()
            : { data: null };
          if (!cust?.npwp) {
            return NextResponse.json({ error: 'Customer NPWP missing — cannot call Coretax API. Enter billingId manually.' }, { status: 400 });
          }
          const kapKjs = mapTaxTypeToKap(full!.tax_type);
          const billing = await coretax.issueIdBilling({
            npwp: cust.npwp,
            kap: kapKjs.kap,
            kjs: kapKjs.kjs,
            taxPeriod: `${full!.tax_period_year}-${String(full!.tax_period_month).padStart(2, '0')}`,
            amount: Number(full!.amount ?? 0),
          });
          billingId = billing.billingCode;
          method = `Coretax API (auto, expires ${billing.expiresAt.slice(0, 10)})`;
          apiResult = { billing };
        } catch (err) {
          if (err instanceof CoretaxError && err.code === 'NOT_CONFIGURED') {
            return NextResponse.json({ error: 'Coretax API not configured — enter billingId manually.' }, { status: 400 });
          }
          return NextResponse.json({ error: `Coretax API issue failed: ${(err as Error).message}` }, { status: 502 });
        }
      }

      if (!billingId) return NextResponse.json({ error: 'billingId required' }, { status: 400 });
      logValue = { billingId, method, apiResult };
      queueUpdate = { ebilling_code: billingId, status: caseRow.status === 'APPROVED' ? 'EBILLING_GENERATED' : caseRow.status };
      break;
    }
    case 'confirm-ntpn': {
      const ntpn = (body.ntpn as string | undefined)?.trim();
      if (!ntpn) return NextResponse.json({ error: 'ntpn required' }, { status: 400 });
      logValue = { ntpn };
      // NTPN 확인 자체는 status 전환 없음. PAYMENT_VERIFIED 전환은 record-completion에서.
      break;
    }
    case 'record-completion': {
      let bpeNumber = (body.bpeNumber as string | undefined)?.trim();
      let bpeDate = (body.bpeDate as string | undefined) ?? new Date().toISOString().slice(0, 10);
      let apiResult: Record<string, unknown> | null = null;

      // Coretax API 자동 모드 — 사용자가 BPE 입력 안 했고 API 활성화된 경우 자동 제출.
      if (!bpeNumber && (await coretax.isEnabled())) {
        try {
          const { data: full } = await admin
            .from('djp_submission_queue')
            .select('tax_type, tax_period_month, tax_period_year, customer_id, ebilling_code')
            .eq('id', id).maybeSingle();
          const { data: cust } = full?.customer_id
            ? await admin.from('customer').select('npwp').eq('id', full.customer_id).maybeSingle()
            : { data: null };
          if (!cust?.npwp) {
            return NextResponse.json({ error: 'Customer NPWP missing — cannot call Coretax API.' }, { status: 400 });
          }
          const sptType = full!.tax_type === 'SPT_TAHUNAN' ? 'SPT_TAHUNAN_BADAN' : `SPT_MASA_${full!.tax_type}`;
          const result = await coretax.submitSpt({
            npwp: cust.npwp,
            sptType,
            taxPeriod: `${full!.tax_period_year}-${String(full!.tax_period_month).padStart(2, '0')}`,
            billingCode: full!.ebilling_code ?? undefined,
            payload: { caseId: id }, // 실제 SPT XML 페이로드는 추후 추가
          });
          bpeNumber = result.bpeNumber;
          bpeDate = result.bpeDate;
          apiResult = { submission: result };
        } catch (err) {
          if (err instanceof CoretaxError && err.code === 'NOT_CONFIGURED') {
            return NextResponse.json({ error: 'Coretax API not configured — enter bpeNumber manually.' }, { status: 400 });
          }
          // 자동 제출 실패 시 closing_submission도 FAILED로 표시.
          if (caseRow.closing_session_id) {
            try {
              await admin.from('closing_submission').update({
                status: 'FAILED',
                failure_reason: (err as Error).message,
              }).eq('session_id', caseRow.closing_session_id);
            } catch { /* non-blocking */ }
          }
          return NextResponse.json({ error: `Coretax API submission failed: ${(err as Error).message}` }, { status: 502 });
        }
      }

      if (!bpeNumber) return NextResponse.json({ error: 'bpeNumber required' }, { status: 400 });
      logValue = { bpeNumber, bpeDate, closing_session_id: caseRow.closing_session_id, apiResult };
      queueUpdate = {
        bpe_number: bpeNumber, bpe_date: bpeDate,
        submitted_to_djp_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: 'COMPLETED',
      };
      break;
    }
    case 'set-checklist': {
      const key = body.key as string | undefined;
      const state = body.state as string | undefined;
      if (!key || !state) return NextResponse.json({ error: 'key & state required' }, { status: 400 });
      if (!['대기', '진행', '완료', '미완'].includes(state)) {
        return NextResponse.json({ error: 'invalid state' }, { status: 400 });
      }
      logValue = { key, state };
      break;
    }
    case 'request-access':
    case 'request-bukti': {
      logValue = { type: action };
      break;
    }
    case 'log-manual': {
      const note = (body.note as string | undefined)?.trim();
      if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });
      logValue = { note };
      break;
    }
    default: break;
  }

  if (queueUpdate) {
    const { error } = await admin.from('djp_submission_queue').update(queueUpdate).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase B — record-completion 시 결산 wizard와 동기화.
  // 운영팀이 BPE를 입력하면 closing_submission(status, bpe_number, ntpn, completed_at)도 함께 갱신.
  // closing_session_id가 없는 일반 운영 케이스는 건너뜀.
  if (action === 'record-completion' && caseRow.closing_session_id) {
    try {
      const ntpn = caseRow.ebilling_code ?? null;
      await admin.from('closing_submission').update({
        status: 'COMPLETED',
        bpe_number: (logValue as { bpeNumber?: string }).bpeNumber,
        bpe_uploaded_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        ntpn,
        operator_id: user.id,
      }).eq('session_id', caseRow.closing_session_id);

      // closing_id_billing 도 ntpn / status 갱신해 결산 wizard에서 즉시 PAID로 보이게.
      if (ntpn) {
        await admin.from('closing_id_billing').update({
          ntpn,
          status: 'PAID',
        }).eq('session_id', caseRow.closing_session_id);
      }
    } catch { /* non-blocking */ }
  }

  // record-billing 시에도 closing_submission status를 PROCESSING으로 진전시킨다.
  if (action === 'record-billing' && caseRow.closing_session_id) {
    try {
      await admin.from('closing_submission').update({
        status: 'PROCESSING',
        operator_id: user.id,
      }).eq('session_id', caseRow.closing_session_id).in('status', ['SUBMITTED', 'OPERATOR_REVIEW']);
    } catch { /* non-blocking */ }
  }

  try {
    await admin.from('coretax_step_log').insert({
      case_id: id,
      step: meta.step,
      action: meta.action,
      value: logValue,
      actor_user_id: user.id,
      actor_label: actorLabel,
    });
  } catch { /* non-blocking */ }

  return NextResponse.json({ success: true });
}
