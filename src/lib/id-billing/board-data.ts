/**
 * ID Billing 발행 보드 데이터 (v19 §4).
 *
 * 발행대상 = 수퍼바이저 승인완료(APPROVED) + 아직 발행되지 않은 건.
 *   • ERP_SESSION:    consultant_session (JTC + EXTERNAL 세무법인 공용)
 *   • OPERATOR_QUEUE: djp_submission_queue (JTC 운영팀 월신고 큐)
 *
 * tenant 분리: 모든 조회는 tax_partner_id 로 스코프. 운영팀 role 은
 * consultant 행이 없으므로 JTC 기본 파트너(is_default_filing_partner) 스코프.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserRole } from '@/types/auth';
import { kapKjsForTaxType, taxTypeForCalc } from './kap-kjs';

const OPERATOR_ROLES = new Set<UserRole>([
  UserRole.TAX_OPERATOR,
  UserRole.TAX_OPERATOR_LEAD,
  UserRole.TAX_OPERATOR_SUPERVISOR,
  UserRole.TAX_OPERATOR_MASTER,
]);

export interface IssuerScope {
  taxPartnerId: string;
  isOperator: boolean;
}

/** 호출자의 tenant 스코프 결정. consultant → 자기 파트너, 운영팀 → JTC 기본 파트너. */
export async function resolveIssuerScope(
  admin: SupabaseClient,
  userId: string,
  role: UserRole,
): Promise<IssuerScope | null> {
  if (OPERATOR_ROLES.has(role)) {
    const { data } = await admin
      .from('tax_partner')
      .select('id')
      .eq('is_default_filing_partner', true)
      .maybeSingle();
    return data ? { taxPartnerId: data.id, isOperator: true } : null;
  }
  const { data } = await admin
    .from('consultant')
    .select('tax_partner_id, is_active')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return { taxPartnerId: data.tax_partner_id, isOperator: false };
}

export interface BillingItem {
  taxType: string;
  period: string; // YYYY-MM
  kap: string;
  kjs: string;
  taxBase: number | null;
  rateLabel: string;
  amount: number;
}

export interface BillingTarget {
  sourceKind: 'ERP_SESSION' | 'OPERATOR_QUEUE';
  sourceId: string;
  customer: { id: string; name: string; npwp: string | null; email: string | null };
  items: BillingItem[];
  totalAmount: number;
  workbookGeneratedAt: string | null;
  canIssue: boolean;
  isException?: boolean;      // 수정요청 #26 — 승인 전 예외 발행 대상
  sourceStatus?: string;      // 예외 대상의 원 소스 상태 (감사/표시용)
}

export interface IssuedRow {
  id: string;
  serial_no: string;
  customer_name: string;
  tax_type: string;
  tax_period: string;
  amount: number;
  billing_code: string | null;
  status: string;
  customer_email: string | null;
  sent_at: string | null;
  ntpn: string | null;
  paid_at: string | null;
  created_at: string;
}

function period(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function buildBillingBoard(
  admin: SupabaseClient,
  scope: IssuerScope,
): Promise<{ targets: BillingTarget[]; issued: IssuedRow[] }> {
  // ── 이미 발행된 소스 ─────────────────────────────────────────
  const { data: issuedRefs } = await admin
    .from('id_billing_issuance')
    .select('session_id, queue_item_id')
    .eq('tax_partner_id', scope.taxPartnerId);
  const issuedSessions = new Set((issuedRefs ?? []).map(r => r.session_id).filter(Boolean));
  const issuedQueueItems = new Set((issuedRefs ?? []).map(r => r.queue_item_id).filter(Boolean));

  // ── 작성본 생성 이력 (발행 게이트) ───────────────────────────
  const { data: logs } = await admin
    .from('id_billing_workbook_log')
    .select('session_id, queue_item_id, created_at')
    .eq('tax_partner_id', scope.taxPartnerId)
    .order('created_at', { ascending: false });
  const wbBySession = new Map<string, string>();
  const wbByQueue = new Map<string, string>();
  for (const l of logs ?? []) {
    if (l.session_id && !wbBySession.has(l.session_id)) wbBySession.set(l.session_id, l.created_at);
    if (l.queue_item_id && !wbByQueue.has(l.queue_item_id)) wbByQueue.set(l.queue_item_id, l.created_at);
  }

  const targets: BillingTarget[] = [];
  const customerIds = new Set<string>();

  // ── 발행대상 1: ERP 승인완료 세션 ───────────────────────────
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, customer_id, tax_period, filing_kind, status, total_estimated_tax')
    .eq('tax_partner_id', scope.taxPartnerId)
    .eq('status', 'APPROVED')
    .order('updated_at', { ascending: false });

  const sessionRows = (sessions ?? []).filter(s => !issuedSessions.has(s.id));
  const sessionIds = sessionRows.map(s => s.id);
  const calcsBySession = new Map<string, Array<{ kind: string; amount: number; basis: Record<string, unknown> | null }>>();
  if (sessionIds.length > 0) {
    const { data: calcs } = await admin
      .from('consultant_session_calc')
      .select('session_id, kind, amount, basis, is_saved')
      .in('session_id', sessionIds)
      .eq('is_saved', true);
    for (const c of calcs ?? []) {
      const arr = calcsBySession.get(c.session_id) ?? [];
      arr.push({ kind: c.kind, amount: Number(c.amount ?? 0), basis: c.basis });
      calcsBySession.set(c.session_id, arr);
    }
  }

  for (const s of sessionRows) {
    const p = String(s.tax_period ?? '').slice(0, 7);
    const items: BillingItem[] = [];
    for (const c of calcsBySession.get(s.id) ?? []) {
      const mapped = taxTypeForCalc(c.kind, c.basis);
      if (!mapped || c.amount <= 0) continue;
      const codes = kapKjsForTaxType(mapped.taxType);
      items.push({
        taxType: mapped.taxType, period: p, kap: codes.kap, kjs: codes.kjs,
        taxBase: mapped.taxBase, rateLabel: mapped.rateLabel, amount: c.amount,
      });
    }
    if (items.length === 0) continue; // 세액 없는 세션은 발행대상 아님
    customerIds.add(s.customer_id);
    targets.push({
      sourceKind: 'ERP_SESSION', sourceId: s.id,
      customer: { id: s.customer_id, name: '', npwp: null, email: null },
      items, totalAmount: items.reduce((a, i) => a + i.amount, 0),
      workbookGeneratedAt: wbBySession.get(s.id) ?? null,
      canIssue: wbBySession.has(s.id),
    });
  }

  // ── 발행대상 2: 운영팀 큐 APPROVED (JTC 스코프에서만) ─────────
  if (scope.isOperator) {
    const { data: queueRows } = await admin
      .from('djp_submission_queue')
      .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status')
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    for (const q of (queueRows ?? []).filter(q => !issuedQueueItems.has(q.id))) {
      const amount = Number(q.amount ?? 0);
      if (amount <= 0) continue;
      const codes = kapKjsForTaxType(q.tax_type);
      customerIds.add(q.customer_id);
      targets.push({
        sourceKind: 'OPERATOR_QUEUE', sourceId: q.id,
        customer: { id: q.customer_id, name: '', npwp: null, email: null },
        items: [{
          taxType: q.tax_type, period: period(q.tax_period_year, q.tax_period_month),
          kap: codes.kap, kjs: codes.kjs, taxBase: null, rateLabel: '—', amount,
        }],
        totalAmount: amount,
        workbookGeneratedAt: wbByQueue.get(q.id) ?? null,
        canIssue: wbByQueue.has(q.id),
      });
    }
  }

  // ── 고객 정보 join ──────────────────────────────────────────
  if (customerIds.size > 0) {
    const { data: customers } = await admin
      .from('customer')
      .select('id, full_name, company_name, npwp, email')
      .in('id', Array.from(customerIds));
    const custMap = new Map((customers ?? []).map(c => [c.id, c]));
    // 고객 행이 사라진 고아 소스는 발행대상에서 제외 (빈 이름 카드 방지).
    for (let i = targets.length - 1; i >= 0; i--) {
      if (!custMap.has(targets[i].customer.id)) targets.splice(i, 1);
    }
    for (const t of targets) {
      const c = custMap.get(t.customer.id);
      if (c) t.customer = { id: c.id, name: c.company_name || c.full_name || '—', npwp: c.npwp, email: c.email };
    }
  }

  // ── 발행완료 리스트 ─────────────────────────────────────────
  const { data: issuedRows } = await admin
    .from('id_billing_issuance')
    .select('id, serial_no, customer_id, tax_type, tax_period, amount, billing_code, status, customer_email, sent_at, ntpn, paid_at, created_at')
    .eq('tax_partner_id', scope.taxPartnerId)
    .order('created_at', { ascending: false })
    .limit(200);

  const issuedCustIds = Array.from(new Set((issuedRows ?? []).map(r => r.customer_id)));
  const issuedCustMap = new Map<string, string>();
  if (issuedCustIds.length > 0) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', issuedCustIds);
    for (const c of cs ?? []) issuedCustMap.set(c.id, c.company_name || c.full_name || '—');
  }

  const issued: IssuedRow[] = (issuedRows ?? []).map(r => ({
    id: r.id, serial_no: r.serial_no,
    customer_name: issuedCustMap.get(r.customer_id) ?? '—',
    tax_type: r.tax_type, tax_period: r.tax_period, amount: Number(r.amount),
    billing_code: r.billing_code, status: r.status,
    customer_email: r.customer_email, sent_at: r.sent_at,
    ntpn: r.ntpn ?? null, paid_at: r.paid_at ?? null, created_at: r.created_at,
  }));

  return { targets, issued };
}

/**
 * 예외 발행 대상 (수정요청 #26) — 워크큐 큐 항목 하나를 상태와 무관하게(승인 전 포함)
 * 발행 대상으로 해석한다. 정상 발행보드(buildBillingBoard)는 APPROVED 만 노출하지만,
 * 예외 경로는 상담원이 이미 특정 (고객, 세목, 기간) 큐를 보고 판단하므로 그 큐를 직접 조회.
 *
 * 게이트: 미발행(중복 방지) + 세액>0. 작성본(workbook) 이력은 요구하지 않는다
 * (예외 발행의 취지 = 승인·준비 절차 우회). null = 발행 불가(없음/이미 발행/세액 0/스코프 밖).
 */
export async function buildExceptionQueueTarget(
  admin: SupabaseClient,
  scope: IssuerScope,
  queueId: string,
): Promise<BillingTarget | null> {
  if (!scope.isOperator) return null; // 큐 발행은 JTC 운영팀 스코프 전용

  const { data: alreadyIssued } = await admin
    .from('id_billing_issuance')
    .select('id')
    .eq('queue_item_id', queueId)
    .limit(1);
  if ((alreadyIssued ?? []).length > 0) return null;

  const { data: q } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount, status')
    .eq('id', queueId)
    .maybeSingle();
  if (!q) return null;

  const amount = Number(q.amount ?? 0);
  if (amount <= 0) return null;

  const { data: c } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp, email')
    .eq('id', q.customer_id)
    .maybeSingle();
  if (!c) return null;

  const codes = kapKjsForTaxType(q.tax_type);
  return {
    sourceKind: 'OPERATOR_QUEUE',
    sourceId: q.id,
    customer: { id: c.id, name: c.company_name || c.full_name || '—', npwp: c.npwp, email: c.email },
    items: [{
      taxType: q.tax_type, period: period(q.tax_period_year, q.tax_period_month),
      kap: codes.kap, kjs: codes.kjs, taxBase: null, rateLabel: '—', amount,
    }],
    totalAmount: amount,
    workbookGeneratedAt: null,
    canIssue: true,
    isException: true,
    sourceStatus: q.status,
  };
}

/** BIL-YYYYMM-NNN 일련번호 — 파트너별 당월 카운트 기반. */
export async function nextSerials(
  admin: SupabaseClient,
  taxPartnerId: string,
  count: number,
): Promise<string[]> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { count: existing } = await admin
    .from('id_billing_issuance')
    .select('id', { count: 'exact', head: true })
    .eq('tax_partner_id', taxPartnerId)
    .like('serial_no', `BIL-${ym}-%`);
  const start = (existing ?? 0) + 1;
  return Array.from({ length: count }, (_, i) => `BIL-${ym}-${String(start + i).padStart(3, '0')}`);
}
