/**
 * Supervisor-only data builders for the팀장용 ERP surfaces (PDF p.7-21):
 *   - buildCustomersOverview   — 고객별 진행현황 table
 *   - buildRevisionEventLog    — 수정/재상신 이력 timeline
 *   - buildClosingCalendar     — 마감 캘린더 cards
 *
 * All three are read-only aggregations over consultant_session +
 * consultant + customer + consultant_session_document. No new tables —
 * the supervisor surfaces just slice existing data differently.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';

const REQUIRED_SLOTS = new Set([
  'PAYROLL',
  'WITHHOLDING_INVOICE',
  'CORP_TAX_INPUT',
  'VAT_IN_OUT',
  'BANK_STATEMENT',
]);

/** Risk score 0..50 — higher = more urgent. Heuristic, no ML. */
function computeRiskScore(opts: {
  status: string | null;
  filledRequiredSlots: number;
  daysToDeadline: number | null;
}): number {
  let score = 0;
  switch (opts.status) {
    case null:
    case 'CANCELLED':
      score = 3; // 미시작 / 취소
      break;
    case 'DRAFT':
    case 'UPLOADING':
      score = 15;
      break;
    case 'PARSING':
    case 'REVIEWING':
      score = 18;
      break;
    case 'PENDING_APPROVAL':
      score = 30;
      break;
    case 'REJECTED':
      score = 35;
      break;
    case 'APPROVED':
      score = 5;
      break;
    case 'COMPLETED':
      score = 0;
      break;
    default:
      score = 10;
  }
  // Missing-required penalty (max +10).
  const missing = Math.max(0, REQUIRED_SLOTS.size - opts.filledRequiredSlots);
  score += missing * 2;
  // Deadline urgency (max +20).
  if (opts.daysToDeadline != null) {
    if (opts.daysToDeadline < 0) score += 20; // overdue
    else if (opts.daysToDeadline < 3) score += 12;
    else if (opts.daysToDeadline < 7) score += 6;
  }
  return Math.min(50, Math.max(0, Math.round(score)));
}

/** SPT Masa monthly deadline = 20일. SPT Tahunan annual = 30 April. */
function computeDeadline(filingKind: 'MONTHLY' | 'ANNUAL' | null, taxPeriod: string | null): string | null {
  if (!filingKind || !taxPeriod) return null;
  if (filingKind === 'MONTHLY') {
    // tax_period 'YYYY-MM' → 다음 달 20일.
    const m = taxPeriod.match(/^(\d{4})-(\d{2})/);
    if (!m) return null;
    const yy = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const nextMonth = mm === 12 ? 1 : mm + 1;
    const nextYear = mm === 12 ? yy + 1 : yy;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`;
  }
  // ANNUAL: YYYY → YYYY+1 04-30.
  const y = parseInt(taxPeriod.slice(0, 4), 10);
  if (!Number.isFinite(y)) return null;
  return `${y + 1}-04-30`;
}

export interface CustomerOverviewRow {
  customerId: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  npwp: string | null;
  consultantName: string | null;
  taxPartnerName: string | null;
  currentFilingKind: 'MONTHLY' | 'ANNUAL' | null;
  currentTaxPeriod: string | null;
  status: string | null;
  docReview: { filled: number; total: number };
  riskScore: number;
  deadline: string | null;
  daysToDeadline: number | null;
  sessionId: string | null;
}

/**
 * Returns one row per assigned customer with their latest session +
 * progress + risk score. For supervisors this is platform-wide.
 */
export async function buildCustomersOverview(): Promise<CustomerOverviewRow[]> {
  const admin = getSupabaseAdmin();

  // 1) Assigned customers across all consultants.
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant_id, is_active')
    .eq('is_active', true);
  if (!assignments || assignments.length === 0) return [];

  const customerIds = Array.from(new Set(assignments.map((a) => a.customer_id)));
  const consultantIds = Array.from(new Set(assignments.map((a) => a.consultant_id)));

  // 2) Customer profiles.
  const { data: customers } = await admin
    .from('customer')
    .select('id, customer_type, npwp, full_name, company_name')
    .in('id', customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  // 3) Consultants + their tax_partner.
  const { data: consultants } = await admin
    .from('consultant')
    .select('id, full_name, tax_partner_id')
    .in('id', consultantIds);
  const consultantById = new Map((consultants ?? []).map((c) => [c.id, c]));

  const partnerIds = Array.from(
    new Set((consultants ?? []).map((c) => c.tax_partner_id).filter((v): v is string => !!v)),
  );
  let partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: ps } = await admin
      .from('tax_partner')
      .select('id, name')
      .in('id', partnerIds);
    partnerNames = new Map((ps ?? []).map((p) => [p.id, p.name as string]));
  }

  // 4) Latest session per customer.
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, customer_id, consultant_id, filing_kind, tax_period, status, updated_at')
    .in('customer_id', customerIds)
    .order('updated_at', { ascending: false });

  type SessRow = NonNullable<typeof sessions>[number];
  const latestByCustomer = new Map<string, SessRow>();
  for (const s of sessions ?? []) {
    if (!latestByCustomer.has(s.customer_id)) latestByCustomer.set(s.customer_id, s);
  }

  // 5) Document slot fill per session.
  const sessionIds = Array.from(latestByCustomer.values()).map((s) => s.id);
  const slotsBySession = new Map<string, Set<string>>();
  if (sessionIds.length > 0) {
    const { data: docs } = await admin
      .from('consultant_session_document')
      .select('session_id, slot')
      .in('session_id', sessionIds);
    for (const d of docs ?? []) {
      let set = slotsBySession.get(d.session_id);
      if (!set) {
        set = new Set();
        slotsBySession.set(d.session_id, set);
      }
      set.add(d.slot);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: CustomerOverviewRow[] = [];
  for (const customerId of customerIds) {
    const c = customerById.get(customerId);
    if (!c) continue;
    const assignment = assignments.find((a) => a.customer_id === customerId);
    const consultant = assignment ? consultantById.get(assignment.consultant_id) : null;
    const session = latestByCustomer.get(customerId);
    const slots = session ? slotsBySession.get(session.id) ?? new Set<string>() : new Set<string>();
    const filledRequired = [...slots].filter((s) => REQUIRED_SLOTS.has(s)).length;

    const deadline = computeDeadline(
      (session?.filing_kind as 'MONTHLY' | 'ANNUAL' | undefined) ?? null,
      session?.tax_period ?? null,
    );
    let daysToDeadline: number | null = null;
    if (deadline) {
      const d = new Date(deadline);
      d.setHours(0, 0, 0, 0);
      daysToDeadline = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    }

    rows.push({
      customerId,
      customerName: (c.company_name || c.full_name) as string,
      customerType: c.customer_type as 'INDIVIDUAL' | 'COMPANY',
      npwp: c.npwp,
      consultantName: consultant?.full_name ?? null,
      taxPartnerName: consultant?.tax_partner_id ? partnerNames.get(consultant.tax_partner_id) ?? null : null,
      currentFilingKind: (session?.filing_kind as 'MONTHLY' | 'ANNUAL' | undefined) ?? null,
      currentTaxPeriod: session?.tax_period ?? null,
      status: session?.status ?? null,
      docReview: { filled: filledRequired, total: REQUIRED_SLOTS.size },
      riskScore: computeRiskScore({
        status: session?.status ?? null,
        filledRequiredSlots: filledRequired,
        daysToDeadline,
      }),
      deadline,
      daysToDeadline,
      sessionId: session?.id ?? null,
    });
  }

  // Sort by risk score desc — highest risk first.
  rows.sort((a, b) => b.riskScore - a.riskScore);
  return rows;
}

export interface RevisionEvent {
  id: string;
  kind: 'SUBMIT' | 'REJECT' | 'APPROVE' | 'WITHDRAW';
  at: string;
  customerName: string;
  customerId: string;
  taxPeriod: string;
  filingKind: 'MONTHLY' | 'ANNUAL' | null;
  actorName: string | null;
  actorRole: string;
  comment: string | null;
}

/**
 * Returns the most recent N approval events (SUBMIT / REJECT / APPROVE /
 * WITHDRAW) across all sessions — supervisor sees the platform-wide
 * revision timeline.
 */
export async function buildRevisionEventLog(opts?: { limit?: number }): Promise<RevisionEvent[]> {
  const admin = getSupabaseAdmin();
  const limit = opts?.limit ?? 100;

  const { data: events } = await admin
    .from('consultant_session_approval')
    .select('id, session_id, action, comment, created_at, actor_id, actor_role')
    .in('action', ['SUBMIT', 'REJECT', 'APPROVE', 'WITHDRAW'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!events || events.length === 0) return [];

  const sessionIds = Array.from(new Set(events.map((e) => e.session_id)));
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, customer_id, filing_kind, tax_period')
    .in('id', sessionIds);
  const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));

  const customerIds = Array.from(
    new Set((sessions ?? []).map((s) => s.customer_id).filter((v): v is string => !!v)),
  );
  const { data: customers } = customerIds.length
    ? await admin
        .from('customer')
        .select('id, full_name, company_name')
        .in('id', customerIds)
    : { data: [] };
  const customerNameById = new Map(
    (customers ?? []).map((c) => [c.id, (c.company_name || c.full_name) as string]),
  );

  // Resolve actor names (consultants only — supervisor actor_id is a user_id, not a consultant_id).
  const actorIds = Array.from(new Set(events.map((e) => e.actor_id).filter((v): v is string => !!v)));
  const actorNameById = new Map<string, string>();
  if (actorIds.length > 0) {
    // Try consultant table first.
    const { data: cs } = await admin
      .from('consultant')
      .select('user_id, full_name')
      .in('user_id', actorIds);
    for (const c of cs ?? []) actorNameById.set(c.user_id, c.full_name as string);
  }

  return events
    .filter((e) => sessionMap.has(e.session_id))
    .map((e) => {
      const s = sessionMap.get(e.session_id)!;
      return {
        id: e.id,
        kind: e.action as RevisionEvent['kind'],
        at: e.created_at,
        customerName: customerNameById.get(s.customer_id) ?? '(unknown)',
        customerId: s.customer_id,
        taxPeriod: s.tax_period,
        filingKind: s.filing_kind as 'MONTHLY' | 'ANNUAL',
        actorName: e.actor_id ? actorNameById.get(e.actor_id) ?? null : null,
        actorRole: e.actor_role,
        comment: e.comment,
      };
    });
}

export interface LegalityCustomerSummary {
  customerId: string;
  customerName: string;
  npwp: string | null;
  consultantName: string | null;
  requiredFilled: number;
  requiredTotal: number;
  missingCount: number;
  fileCount: number;
  hasCoretax: boolean;
  expiringCount: number;
  completionPct: number;
}

export interface LegalityDoc {
  id: string;
  category: string;
  category_group: '정관/법인설립' | '사업허가' | '세무등록';
  isRequired: boolean;
  storagePath: string | null;
  originalFilename: string | null;
  validUntil: string | null;
  note: string | null;
  uploadedAt: string;
  version: number;
}

const REQUIRED_CATEGORIES = [
  'AKTA_PENDIRIAN',
  'AKTA_PERUBAHAN',
  'NIB_OSS',
  'COMPANY_NPWP',
];
const CORETAX_CATEGORY = 'CORETAX_ACCESS';
const CATEGORY_GROUP: Record<string, '정관/법인설립' | '사업허가' | '세무등록'> = {
  AKTA_PENDIRIAN: '정관/법인설립',
  AKTA_PERUBAHAN: '정관/법인설립',
  NIB_OSS: '사업허가',
  LICENSE_SBU_SKK: '사업허가',
  COMPANY_NPWP: '세무등록',
  CORETAX_ACCESS: '세무등록',
};

/**
 * Supervisor legality overview (PDF p.11-15 of 팀장용 ERP).
 *
 * Returns one summary row per company customer plus the latest version
 * of each document so the page can render the master-detail layout
 * (left = customer + doc list, right = inline preview metadata).
 */
export async function buildLegalityOverview(): Promise<{
  customers: LegalityCustomerSummary[];
  documents: Record<string, LegalityDoc[]>;
  expiringSoon: Array<{ customerId: string; customerName: string; category: string; validUntil: string }>;
}> {
  const admin = getSupabaseAdmin();

  const { data: customers } = await admin
    .from('customer')
    .select('id, customer_type, full_name, company_name, npwp')
    .eq('customer_type', 'COMPANY');
  if (!customers) return { customers: [], documents: {}, expiringSoon: [] };

  const customerIds = customers.map((c) => c.id);
  if (customerIds.length === 0) return { customers: [], documents: {}, expiringSoon: [] };

  // Consultant assignments
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant_id, is_active')
    .eq('is_active', true)
    .in('customer_id', customerIds);
  const consultantByCustomer = new Map<string, string>();
  for (const a of assignments ?? []) {
    if (!consultantByCustomer.has(a.customer_id)) consultantByCustomer.set(a.customer_id, a.consultant_id);
  }
  const consultantIds = Array.from(new Set(Array.from(consultantByCustomer.values())));
  let consultantNames = new Map<string, string>();
  if (consultantIds.length > 0) {
    const { data: cs } = await admin
      .from('consultant')
      .select('id, full_name')
      .in('id', consultantIds);
    consultantNames = new Map((cs ?? []).map((c) => [c.id, c.full_name as string]));
  }

  // Legality documents (latest version per customer+category)
  const { data: docs } = await admin
    .from('legality_document')
    .select('id, customer_id, category, is_required, storage_path, original_filename, valid_until, note, uploaded_at, version')
    .in('customer_id', customerIds)
    .order('version', { ascending: false });
  const latestByCustCat = new Map<string, typeof docs extends (infer R)[] | null ? R : never>();
  for (const d of docs ?? []) {
    const key = `${d.customer_id}:${d.category}`;
    if (!latestByCustCat.has(key)) latestByCustCat.set(key, d);
  }

  const docsByCustomer: Record<string, LegalityDoc[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryWindow = new Date(today);
  expiryWindow.setDate(today.getDate() + 90);
  const expiringSoon: Array<{ customerId: string; customerName: string; category: string; validUntil: string }> = [];

  // Build documents per customer + count metrics
  const summaries: LegalityCustomerSummary[] = customers.map((c) => {
    const ownDocs = (docs ?? []).filter((d) => d.customer_id === c.id);
    const latestSet = new Map<string, typeof ownDocs[0]>();
    for (const d of ownDocs) {
      if (!latestSet.has(d.category)) latestSet.set(d.category, d);
    }
    const mappedDocs: LegalityDoc[] = Array.from(latestSet.values()).map((d) => ({
      id: d.id,
      category: d.category,
      category_group: CATEGORY_GROUP[d.category] ?? '세무등록',
      isRequired: !!d.is_required,
      storagePath: d.storage_path,
      originalFilename: d.original_filename,
      validUntil: d.valid_until,
      note: d.note,
      uploadedAt: d.uploaded_at,
      version: d.version,
    }));
    docsByCustomer[c.id] = mappedDocs;

    const filledCategories = new Set(mappedDocs.filter((d) => !!d.storagePath).map((d) => d.category));
    const requiredFilled = REQUIRED_CATEGORIES.filter((cat) => filledCategories.has(cat)).length;
    const requiredTotal = REQUIRED_CATEGORIES.length;
    const missingCount = requiredTotal - requiredFilled;
    const fileCount = mappedDocs.filter((d) => !!d.storagePath).length;
    const hasCoretax = filledCategories.has(CORETAX_CATEGORY);

    let expiringCount = 0;
    for (const d of mappedDocs) {
      if (!d.validUntil) continue;
      const exp = new Date(d.validUntil);
      exp.setHours(0, 0, 0, 0);
      if (exp <= expiryWindow) {
        expiringCount++;
        expiringSoon.push({
          customerId: c.id,
          customerName: (c.company_name || c.full_name) as string,
          category: d.category,
          validUntil: d.validUntil,
        });
      }
    }

    return {
      customerId: c.id,
      customerName: (c.company_name || c.full_name) as string,
      npwp: c.npwp,
      consultantName: consultantByCustomer.has(c.id)
        ? consultantNames.get(consultantByCustomer.get(c.id)!) ?? null
        : null,
      requiredFilled,
      requiredTotal,
      missingCount,
      fileCount,
      hasCoretax,
      expiringCount,
      completionPct: Math.round((requiredFilled / Math.max(1, requiredTotal)) * 100),
    };
  });

  // Sort: lowest completion first (most urgent on top), then by name.
  summaries.sort((a, b) => {
    if (a.completionPct !== b.completionPct) return a.completionPct - b.completionPct;
    return a.customerName.localeCompare(b.customerName);
  });
  expiringSoon.sort((a, b) => a.validUntil.localeCompare(b.validUntil));

  return { customers: summaries, documents: docsByCustomer, expiringSoon };
}

export interface QualityHealthSummary {
  totalRegistered: number;
  avgTrust: number;
  needsRemediation: number; // trust < 75
  manageable: number;       // 75-89
  verified: number;         // 90+
  evidenceNeeded: number;   // pending update candidates
  pendingCandidates: number;
  completedToday: number;
}

export interface QualityActionStep {
  step: 1 | 2 | 3 | 4;
  titleKey: string;
  count: number;
}

export interface QualityQueueRow {
  counterpartyId: string;
  name: string;
  npwp: string | null;
  country: string;
  trustScore: number;
  pkpStatus: string | null;
  suggestedPph: string | null;
  status: 'remediation' | 'manageable' | 'verified' | 'evidence-needed';
  insight: string;
  lastVerifiedAt: string | null;
  fieldTrust: Array<{
    fieldName: string;
    fieldValue: string | null;
    source: string | null;
    trustScore: number;
  }>;
}

/**
 * Counterparty DB quality monitoring (PDF p.21-25 of 팀장용 ERP).
 *
 * Aggregates trust score distribution, pending update candidates, and the
 * priority queue of rows that need a supervisor review. The queue is
 * ranked: lowest-trust + evidence-needed first.
 */
export async function buildQualityMonitor(): Promise<{
  summary: QualityHealthSummary;
  actions: QualityActionStep[];
  queue: QualityQueueRow[];
}> {
  const admin = getSupabaseAdmin();

  const { data: counterparties } = await admin
    .from('counterparty_master')
    .select(
      'id, name, npwp, country, overall_trust, pkp_status, suggested_pph_type, last_verified_at',
    )
    .limit(500);

  const list = counterparties ?? [];
  const totalRegistered = list.length;
  const avgTrust = list.length
    ? Math.round(list.reduce((s, r) => s + (Number(r.overall_trust) || 0), 0) / list.length)
    : 0;

  const needsRemediation = list.filter((r) => (Number(r.overall_trust) || 0) < 75).length;
  const manageable = list.filter(
    (r) => (Number(r.overall_trust) || 0) >= 75 && (Number(r.overall_trust) || 0) < 90,
  ).length;
  const verified = list.filter((r) => (Number(r.overall_trust) || 0) >= 90).length;

  const { data: pendingCandidates } = await admin
    .from('counterparty_update_candidate')
    .select('counterparty_id, status')
    .eq('status', 'PROPOSED');
  const pendingByCounterparty = new Set((pendingCandidates ?? []).map((c) => c.counterparty_id));
  const evidenceNeeded = list.filter(
    (r) => pendingByCounterparty.has(r.id) || (Number(r.overall_trust) || 0) < 40,
  ).length;

  // Completed today: counterparties whose last_verified_at is today.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const completedToday = list.filter((r) => {
    if (!r.last_verified_at) return false;
    return new Date(r.last_verified_at) >= todayStart;
  }).length;

  // Field trust lookup for the top 50 priority rows.
  const queueSorted = list
    .slice()
    .sort((a, b) => (Number(a.overall_trust) || 0) - (Number(b.overall_trust) || 0))
    .slice(0, 50);
  const ids = queueSorted.map((r) => r.id);
  const fieldTrustByCounterparty = new Map<
    string,
    Array<{ fieldName: string; fieldValue: string | null; source: string | null; trustScore: number }>
  >();
  if (ids.length > 0) {
    const { data: trustRows } = await admin
      .from('counterparty_field_trust')
      .select('counterparty_id, field_name, field_value, source, trust_score')
      .in('counterparty_id', ids);
    for (const t of trustRows ?? []) {
      const arr = fieldTrustByCounterparty.get(t.counterparty_id) ?? [];
      arr.push({
        fieldName: t.field_name,
        fieldValue: t.field_value,
        source: t.source,
        trustScore: Number(t.trust_score) || 0,
      });
      fieldTrustByCounterparty.set(t.counterparty_id, arr);
    }
  }

  const queue: QualityQueueRow[] = queueSorted.map((r) => {
    const trust = Number(r.overall_trust) || 0;
    let status: QualityQueueRow['status'];
    if (pendingByCounterparty.has(r.id)) status = 'evidence-needed';
    else if (trust >= 90) status = 'verified';
    else if (trust >= 75) status = 'manageable';
    else status = 'remediation';
    const insight =
      status === 'evidence-needed'
        ? 'DGT/Treaty/계약서 증빙 보강 필요'
        : status === 'remediation'
          ? '국내 법인 서비스 거래처 후보. KBLI/계약내용 기준 최종 확인 필요'
          : status === 'manageable'
            ? '검증 양호 — 다음 분기 재확인'
            : '검증 완료';
    return {
      counterpartyId: r.id,
      name: r.name as string,
      npwp: r.npwp,
      country: r.country,
      trustScore: trust,
      pkpStatus: r.pkp_status,
      suggestedPph: r.suggested_pph_type,
      status,
      insight,
      lastVerifiedAt: r.last_verified_at,
      fieldTrust: fieldTrustByCounterparty.get(r.id) ?? [],
    };
  });

  const actions: QualityActionStep[] = [
    { step: 1, titleKey: 'quality.actionStep1', count: needsRemediation },
    { step: 2, titleKey: 'quality.actionStep2', count: evidenceNeeded },
    { step: 3, titleKey: 'quality.actionStep3', count: pendingByCounterparty.size },
    { step: 4, titleKey: 'quality.actionStep4', count: verified },
  ];

  return {
    summary: {
      totalRegistered,
      avgTrust,
      needsRemediation,
      manageable,
      verified,
      evidenceNeeded,
      pendingCandidates: pendingByCounterparty.size,
      completedToday,
    },
    actions,
    queue,
  };
}

export interface PerformanceRubric {
  label: string;
  individual: number;
  team: number;
  description: string;
}

export interface TeamKpi {
  teamId: string;
  teamName: string;
  supervisorName: string | null;
  memberCount: number;
  customerCount: number;
  activeMembers: number;
  transactionsThisMonth: number;
  counterpartyContributions: number;
  completionRatePct: number;
  reviewCompletenessPct: number;
  pendingApproval: number;
  revisionCount: number;
  riskTasks: number;
  totalTaxAmount: number;
  insight: string;
}

export interface TeamMemberDetail {
  consultantId: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  teamName: string;
  customerCount: number;
  activeTasks: number;
  pendingApproval: number;
  revisionCount: number;
  avgProcessingMinutes: number;
}

const PERFORMANCE_RUBRIC: PerformanceRubric[] = [
  { label: 'transactions',       individual: 25, team: 20, description: 'rubric.transactionsDesc' },
  { label: 'docReview',          individual: 25, team: 20, description: 'rubric.docReviewDesc' },
  { label: 'completionFlow',     individual: 20, team: 20, description: 'rubric.completionFlowDesc' },
  { label: 'riskSla',            individual: 15, team: 15, description: 'rubric.riskSlaDesc' },
  { label: 'counterpartyDb',     individual: 10, team: 10, description: 'rubric.counterpartyDbDesc' },
  { label: 'taskCompletion',     individual: 5,  team: 0,  description: 'rubric.taskCompletionDesc' },
  { label: 'queueBottleneck',    individual: 0,  team: 15, description: 'rubric.queueBottleneckDesc' },
];

export interface ReassignableSession {
  sessionId: string;
  customerName: string;
  taxPeriod: string;
  filingKind: 'MONTHLY' | 'ANNUAL';
  status: string;
  currentConsultantId: string | null;
  currentConsultantName: string | null;
  label: string;
}

/**
 * Active sessions list for the 업무 재배정 widget (PDF p.9).
 * Active = DRAFT/UPLOADING/PARSING/REVIEWING/PENDING_APPROVAL/APPROVED.
 * COMPLETED sessions can't be reassigned.
 */
export async function buildReassignableSessions(): Promise<ReassignableSession[]> {
  const admin = getSupabaseAdmin();
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, customer_id, consultant_id, filing_kind, tax_period, status, updated_at')
    .in('status', ['DRAFT', 'UPLOADING', 'PARSING', 'REVIEWING', 'PENDING_APPROVAL', 'APPROVED'])
    .order('updated_at', { ascending: false })
    .limit(200);
  if (!sessions || sessions.length === 0) return [];

  const customerIds = Array.from(new Set(sessions.map((s) => s.customer_id)));
  const { data: customers } = await admin
    .from('customer')
    .select('id, full_name, company_name')
    .in('id', customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const consultantIds = Array.from(
    new Set(sessions.map((s) => s.consultant_id).filter((v): v is string => !!v)),
  );
  let consultantNames = new Map<string, string>();
  if (consultantIds.length > 0) {
    const { data: cs } = await admin
      .from('consultant')
      .select('id, full_name')
      .in('id', consultantIds);
    consultantNames = new Map((cs ?? []).map((c) => [c.id, c.full_name as string]));
  }

  return sessions.map((s) => {
    const c = customerById.get(s.customer_id);
    const name = c ? ((c.company_name || c.full_name) as string) : '(unknown)';
    const period = s.tax_period?.slice(0, 7) ?? '';
    return {
      sessionId: s.id,
      customerName: name,
      taxPeriod: s.tax_period,
      filingKind: s.filing_kind as 'MONTHLY' | 'ANNUAL',
      status: s.status,
      currentConsultantId: s.consultant_id,
      currentConsultantName: s.consultant_id ? consultantNames.get(s.consultant_id) ?? null : null,
      label: `${name} · ${period} · ${s.filing_kind}`,
    };
  });
}

/**
 * Tax-partner-grouped KPI for the 팀원 관리 페이지 (PDF p.7).
 * Each team = one tax_partner. Counts roll up from its active consultants.
 */
export async function buildTeamKpi(): Promise<{
  rubric: PerformanceRubric[];
  teams: TeamKpi[];
  members: TeamMemberDetail[];
}> {
  const admin = getSupabaseAdmin();

  const { data: partners } = await admin
    .from('tax_partner')
    .select('id, name')
    .eq('is_active', true);
  if (!partners) return { rubric: PERFORMANCE_RUBRIC, teams: [], members: [] };

  const { data: consultants } = await admin
    .from('consultant')
    .select('id, full_name, email, tax_partner_id, is_active');
  const consultantList = consultants ?? [];

  // Customer assignments per consultant
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('consultant_id, customer_id, is_active')
    .eq('is_active', true);
  const customersByConsultant = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    if (!customersByConsultant.has(a.consultant_id)) customersByConsultant.set(a.consultant_id, new Set());
    customersByConsultant.get(a.consultant_id)!.add(a.customer_id);
  }

  // Sessions per consultant
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, consultant_id, status, updated_at');
  const sessList = sessions ?? [];

  // Documents this month per session → roll to consultant
  const sessIds = sessList.map((s) => s.id);
  const docsBySession = new Map<string, number>();
  if (sessIds.length > 0) {
    const { data: docs } = await admin
      .from('consultant_session_document')
      .select('session_id, uploaded_at')
      .in('session_id', sessIds)
      .gte('uploaded_at', monthStart.toISOString());
    for (const d of docs ?? []) {
      docsBySession.set(d.session_id, (docsBySession.get(d.session_id) ?? 0) + 1);
    }
  }

  // Counterparty contributions (registered_by consultant_id)
  const cpCountByConsultant = new Map<string, number>();
  if (consultantList.length > 0) {
    const { data: cps } = await admin
      .from('counterparty_master')
      .select('registered_by')
      .in('registered_by', consultantList.map((c) => c.id));
    for (const cp of cps ?? []) {
      if (cp.registered_by) {
        cpCountByConsultant.set(cp.registered_by, (cpCountByConsultant.get(cp.registered_by) ?? 0) + 1);
      }
    }
  }

  // Revisions (last 30 days)
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const { data: rejects } = await admin
    .from('consultant_session_approval')
    .select('session_id, action, created_at')
    .eq('action', 'REJECT')
    .gte('created_at', recentCutoff.toISOString());
  const sessIdsToConsultant = new Map((sessList).map((s) => [s.id, s.consultant_id]));
  const revisionByConsultant = new Map<string, number>();
  for (const r of rejects ?? []) {
    const cid = sessIdsToConsultant.get(r.session_id);
    if (cid) revisionByConsultant.set(cid, (revisionByConsultant.get(cid) ?? 0) + 1);
  }

  // Member-level aggregates
  const ACTIVE = new Set(['DRAFT', 'UPLOADING', 'PARSING', 'REVIEWING', 'PENDING_APPROVAL']);
  const members: TeamMemberDetail[] = consultantList.map((c) => {
    const ownedSessions = sessList.filter((s) => s.consultant_id === c.id);
    return {
      consultantId: c.id,
      fullName: c.full_name as string,
      email: c.email,
      isActive: !!c.is_active,
      teamName: c.tax_partner_id
        ? partners.find((p) => p.id === c.tax_partner_id)?.name ?? 'Independent'
        : 'Independent',
      customerCount: customersByConsultant.get(c.id)?.size ?? 0,
      activeTasks: ownedSessions.filter((s) => ACTIVE.has(s.status)).length,
      pendingApproval: ownedSessions.filter((s) => s.status === 'PENDING_APPROVAL').length,
      revisionCount: revisionByConsultant.get(c.id) ?? 0,
      avgProcessingMinutes: 18, // TODO: derive from doc upload→approval cycle when telemetry is wired.
    };
  });

  // Team-level rollups
  const teams: TeamKpi[] = partners.map((p) => {
    const teamMembers = consultantList.filter((c) => c.tax_partner_id === p.id);
    const activeMembers = teamMembers.filter((c) => c.is_active).length;
    const teamCustomerSet = new Set<string>();
    let transactions = 0;
    let counterpartyContrib = 0;
    let pendingApproval = 0;
    let revisionCount = 0;
    let completedThisMonth = 0;
    let activeThisMonth = 0;
    let riskTasks = 0;
    for (const m of teamMembers) {
      (customersByConsultant.get(m.id) ?? new Set()).forEach((id) => teamCustomerSet.add(id));
      counterpartyContrib += cpCountByConsultant.get(m.id) ?? 0;
      const own = sessList.filter((s) => s.consultant_id === m.id);
      for (const s of own) {
        transactions += docsBySession.get(s.id) ?? 0;
        if (s.status === 'PENDING_APPROVAL') pendingApproval++;
        if (ACTIVE.has(s.status)) activeThisMonth++;
        if (s.status === 'COMPLETED' && new Date(s.updated_at) >= monthStart) completedThisMonth++;
        if (s.status === 'REJECTED') riskTasks++;
      }
      revisionCount += revisionByConsultant.get(m.id) ?? 0;
    }
    const total = activeThisMonth + completedThisMonth;
    const completionRatePct = total > 0 ? Math.round((completedThisMonth / total) * 100) : 0;
    const reviewCompletenessPct = transactions > 0 ? Math.round(Math.min(100, (transactions / Math.max(1, teamMembers.length * 5)) * 100)) : 0;

    const insight =
      riskTasks > 0
        ? `위험업무 ${riskTasks}건`
        : pendingApproval > 0
          ? `결재 병목 ${pendingApproval}건`
          : '정상';

    return {
      teamId: p.id,
      teamName: p.name as string,
      supervisorName: null, // tax_partner doesn't directly map to a supervisor user yet
      memberCount: teamMembers.length,
      activeMembers,
      customerCount: teamCustomerSet.size,
      transactionsThisMonth: transactions,
      counterpartyContributions: counterpartyContrib,
      completionRatePct,
      reviewCompletenessPct,
      pendingApproval,
      revisionCount,
      riskTasks,
      totalTaxAmount: 0, // TODO: aggregate from calc rows once schema firms up
      insight,
    };
  });

  return { rubric: PERFORMANCE_RUBRIC, teams, members };
}

export type CoretaxStage =
  | 'ID_BILLING_PENDING'
  | 'NTPN_PENDING'
  | 'BPE_PENDING'
  | 'COMPLETED';

export interface CoretaxQueueRow {
  sessionId: string;
  customerId: string;
  customerName: string;
  npwp: string | null;
  consultantName: string | null;
  taxPartnerName: string | null;
  filingKind: 'MONTHLY' | 'ANNUAL';
  taxPeriod: string;
  sessionStatus: string;
  stage: CoretaxStage;
  idBilling: string | null;
  ntpn: string | null;
  bpeFilePath: string | null;
  recordedAt: string | null;
  bpeUploadedAt: string | null;
}

/**
 * Coretax 처리 대기 queue for the supervisor (PDF p.27).
 *
 * Walks every APPROVED / COMPLETED consultant_session and pairs it with
 * the optional consultant_session_coretax_record. The resulting stage
 * tells the supervisor where each session is in the
 *   ID_BILLING → NTPN → BPE → COMPLETED
 * pipeline so the supervisor can monitor without having to drill into
 * every session.
 *
 * Sessions in earlier statuses (REVIEWING / PENDING_APPROVAL) are
 * excluded — they're not ready for Coretax processing.
 */
export async function buildCoretaxQueue(): Promise<CoretaxQueueRow[]> {
  const admin = getSupabaseAdmin();

  const { data: sessions } = await admin
    .from('consultant_session')
    .select(
      'id, customer_id, consultant_id, tax_partner_id, filing_kind, tax_period, status, updated_at',
    )
    .in('status', ['APPROVED', 'COMPLETED'])
    .order('updated_at', { ascending: false })
    .limit(200);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: records } = await admin
    .from('consultant_session_coretax_record')
    .select('session_id, id_billing, ntpn, bpe_file_path, bpe_uploaded_at, recorded_at')
    .in('session_id', sessionIds);
  const recordBySession = new Map((records ?? []).map((r) => [r.session_id, r]));

  // Customer lookup
  const customerIds = Array.from(new Set(sessions.map((s) => s.customer_id)));
  const { data: customers } = await admin
    .from('customer')
    .select('id, full_name, company_name, npwp')
    .in('id', customerIds);
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  // Consultant + partner lookup
  const consultantIds = Array.from(
    new Set(sessions.map((s) => s.consultant_id).filter((v): v is string => !!v)),
  );
  let consultantById = new Map<string, { full_name: string; tax_partner_id: string | null }>();
  if (consultantIds.length > 0) {
    const { data: cs } = await admin
      .from('consultant')
      .select('id, full_name, tax_partner_id')
      .in('id', consultantIds);
    consultantById = new Map(
      (cs ?? []).map((c) => [c.id, { full_name: c.full_name as string, tax_partner_id: c.tax_partner_id }]),
    );
  }
  const partnerIds = Array.from(
    new Set(sessions.map((s) => s.tax_partner_id).filter((v): v is string => !!v)),
  );
  let partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: ps } = await admin
      .from('tax_partner')
      .select('id, name')
      .in('id', partnerIds);
    partnerNames = new Map((ps ?? []).map((p) => [p.id, p.name as string]));
  }

  return sessions.map((s) => {
    const r = recordBySession.get(s.id);
    const c = customerById.get(s.customer_id);
    const consultant = s.consultant_id ? consultantById.get(s.consultant_id) : null;

    let stage: CoretaxStage;
    if (s.status === 'COMPLETED') stage = 'COMPLETED';
    else if (!r || !r.id_billing) stage = 'ID_BILLING_PENDING';
    else if (!r.ntpn) stage = 'NTPN_PENDING';
    else if (!r.bpe_file_path) stage = 'BPE_PENDING';
    else stage = 'COMPLETED';

    return {
      sessionId: s.id,
      customerId: s.customer_id,
      customerName: c ? ((c.company_name || c.full_name) as string) : '(unknown)',
      npwp: c?.npwp ?? null,
      consultantName: consultant?.full_name ?? null,
      taxPartnerName: s.tax_partner_id ? partnerNames.get(s.tax_partner_id) ?? null : null,
      filingKind: s.filing_kind as 'MONTHLY' | 'ANNUAL',
      taxPeriod: s.tax_period,
      sessionStatus: s.status,
      stage,
      idBilling: r?.id_billing ?? null,
      ntpn: r?.ntpn ?? null,
      bpeFilePath: r?.bpe_file_path ?? null,
      recordedAt: r?.recorded_at ?? null,
      bpeUploadedAt: r?.bpe_uploaded_at ?? null,
    };
  });
}

export interface TeamMemberCard {
  consultantId: string;
  fullName: string;
  taxPartnerName: string | null;
  teamLabel: string;
  customerCount: number;
  activeTasks: number;
  pendingApproval: number;
  revisionCount: number;
}

/**
 * Per-consultant workload strip for the supervisor dashboard (PDF p.1
 * shows up to 14 cards: name, team label, 업무/승인대기/수정발생 counts).
 *
 * Aggregates across all active consultants in the platform.
 */
export async function buildTeamMemberCards(): Promise<TeamMemberCard[]> {
  const admin = getSupabaseAdmin();

  const { data: consultants } = await admin
    .from('consultant')
    .select('id, full_name, tax_partner_id, is_active')
    .eq('is_active', true);
  if (!consultants || consultants.length === 0) return [];

  const partnerIds = Array.from(
    new Set((consultants).map((c) => c.tax_partner_id).filter((v): v is string => !!v)),
  );
  let partnerNames = new Map<string, string>();
  if (partnerIds.length > 0) {
    const { data: ps } = await admin
      .from('tax_partner')
      .select('id, name')
      .in('id', partnerIds);
    partnerNames = new Map((ps ?? []).map((p) => [p.id, p.name as string]));
  }

  const consultantIds = consultants.map((c) => c.id);

  // Customer counts per consultant.
  const customerCountByConsultant = new Map<string, number>();
  if (consultantIds.length > 0) {
    const { data: assignments } = await admin
      .from('customer_consultant')
      .select('consultant_id, customer_id')
      .eq('is_active', true)
      .in('consultant_id', consultantIds);
    const uniquePerConsultant = new Map<string, Set<string>>();
    for (const a of assignments ?? []) {
      if (!uniquePerConsultant.has(a.consultant_id)) {
        uniquePerConsultant.set(a.consultant_id, new Set());
      }
      uniquePerConsultant.get(a.consultant_id)!.add(a.customer_id);
    }
    for (const [id, set] of uniquePerConsultant) {
      customerCountByConsultant.set(id, set.size);
    }
  }

  // Session-state counts per consultant.
  const ACTIVE = new Set(['DRAFT', 'UPLOADING', 'PARSING', 'REVIEWING', 'PENDING_APPROVAL']);
  const activeByConsultant = new Map<string, number>();
  const pendingByConsultant = new Map<string, number>();
  if (consultantIds.length > 0) {
    const { data: sessions } = await admin
      .from('consultant_session')
      .select('consultant_id, status')
      .in('consultant_id', consultantIds);
    for (const s of sessions ?? []) {
      if (ACTIVE.has(s.status)) {
        activeByConsultant.set(s.consultant_id, (activeByConsultant.get(s.consultant_id) ?? 0) + 1);
      }
      if (s.status === 'PENDING_APPROVAL') {
        pendingByConsultant.set(
          s.consultant_id,
          (pendingByConsultant.get(s.consultant_id) ?? 0) + 1,
        );
      }
    }
  }

  // Revision (REJECT) counts from approval log over the last 30 days.
  const revisionByConsultant = new Map<string, number>();
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  if (consultantIds.length > 0) {
    const { data: approvals } = await admin
      .from('consultant_session_approval')
      .select('session_id, action, created_at')
      .eq('action', 'REJECT')
      .gte('created_at', recentCutoff.toISOString());
    const sessionIds = (approvals ?? []).map((a) => a.session_id);
    if (sessionIds.length > 0) {
      const { data: sessRows } = await admin
        .from('consultant_session')
        .select('id, consultant_id')
        .in('id', sessionIds);
      const sessConsultant = new Map((sessRows ?? []).map((s) => [s.id, s.consultant_id]));
      for (const a of approvals ?? []) {
        const cid = sessConsultant.get(a.session_id);
        if (cid) {
          revisionByConsultant.set(cid, (revisionByConsultant.get(cid) ?? 0) + 1);
        }
      }
    }
  }

  const cards: TeamMemberCard[] = consultants.map((c) => ({
    consultantId: c.id,
    fullName: c.full_name as string,
    taxPartnerName: c.tax_partner_id ? partnerNames.get(c.tax_partner_id) ?? null : null,
    teamLabel: c.tax_partner_id
      ? (partnerNames.get(c.tax_partner_id) ?? 'Team')
      : 'Independent',
    customerCount: customerCountByConsultant.get(c.id) ?? 0,
    activeTasks: activeByConsultant.get(c.id) ?? 0,
    pendingApproval: pendingByConsultant.get(c.id) ?? 0,
    revisionCount: revisionByConsultant.get(c.id) ?? 0,
  }));

  // Sort: most active first, then most customers.
  cards.sort((a, b) => {
    if (a.activeTasks !== b.activeTasks) return b.activeTasks - a.activeTasks;
    return b.customerCount - a.customerCount;
  });
  return cards;
}

export interface CalendarEntry {
  customerId: string;
  customerName: string;
  filingKind: 'MONTHLY' | 'ANNUAL';
  taxPeriod: string;
  deadline: string;
  daysToDeadline: number;
  status: string | null;
  consultantName: string | null;
  riskScore: number;
  sessionId: string | null;
}

/**
 * Returns the upcoming filing deadlines across all customers, sorted by
 * deadline ascending. Used for the 마감 캘린더 page.
 */
export async function buildClosingCalendar(opts?: {
  withinDays?: number;
}): Promise<CalendarEntry[]> {
  const withinDays = opts?.withinDays ?? 60;
  const overview = await buildCustomersOverview();
  return overview
    .filter((r) => r.deadline != null && r.currentFilingKind != null && r.daysToDeadline != null)
    .filter((r) => (r.daysToDeadline as number) <= withinDays)
    .map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      filingKind: r.currentFilingKind as 'MONTHLY' | 'ANNUAL',
      taxPeriod: r.currentTaxPeriod as string,
      deadline: r.deadline as string,
      daysToDeadline: r.daysToDeadline as number,
      status: r.status,
      consultantName: r.consultantName,
      riskScore: r.riskScore,
      sessionId: r.sessionId,
    }))
    .sort((a, b) => a.daysToDeadline - b.daysToDeadline);
}

export interface CustomerTrendPoint {
  /** "YYYY-MM" — the tax_period truncated to month. */
  period: string;
  /** Session id for that period (latest if multiple). */
  sessionId: string | null;
  /** Overall session status, or null if no session exists for that period. */
  status: string | null;
  /** Sum of all consultant_session_calc.amount for that session. */
  totalCalc: number;
  /** Per-kind breakdown (PPH21_TER / WITHHOLDING / CORP_TAX_MONTHLY / PPN_NET / BANK_RECON). */
  byKind: Record<string, number>;
}

/**
 * Returns up to `months` MONTHLY-filing data points for the given customer,
 * oldest → newest. Used by the supervisor approval case-detail trend chart
 * (PDF p.3). Periods with no consultant_session yet are still emitted with
 * totalCalc=0 + status=null so the chart shows the full window without gaps.
 */
export async function buildCustomerTrend(
  customerId: string,
  months: number = 6,
): Promise<CustomerTrendPoint[]> {
  const admin = getSupabaseAdmin();

  // 1) Build the trailing N-month window ending at today (inclusive).
  const periods: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 2) Pull MONTHLY sessions for this customer that fall in the window.
  //    tax_period is a DATE, so the windows are 'YYYY-MM-01'.
  const fromDate = `${periods[0]}-01`;
  const { data: sessions } = await admin
    .from('consultant_session')
    .select('id, tax_period, status, customer_id')
    .eq('customer_id', customerId)
    .eq('filing_kind', 'MONTHLY')
    .gte('tax_period', fromDate)
    .order('tax_period', { ascending: false })
    .order('created_at', { ascending: false });

  // De-dup: only keep the latest session per period (already ordered desc).
  const sessionByPeriod = new Map<
    string,
    { id: string; status: string | null }
  >();
  for (const s of sessions ?? []) {
    const key = s.tax_period.slice(0, 7);
    if (!sessionByPeriod.has(key)) {
      sessionByPeriod.set(key, { id: s.id, status: s.status });
    }
  }

  // 3) Pull calc rows for all those sessions in one shot.
  const sessionIds = Array.from(sessionByPeriod.values()).map((v) => v.id);
  let calcRows: Array<{ session_id: string; kind: string; amount: number | null }> = [];
  if (sessionIds.length > 0) {
    const { data } = await admin
      .from('consultant_session_calc')
      .select('session_id, kind, amount')
      .in('session_id', sessionIds);
    calcRows = (data ?? []) as typeof calcRows;
  }

  const calcsBySession = new Map<string, Array<{ kind: string; amount: number }>>();
  for (const c of calcRows) {
    const arr = calcsBySession.get(c.session_id) ?? [];
    arr.push({ kind: c.kind, amount: Number(c.amount ?? 0) });
    calcsBySession.set(c.session_id, arr);
  }

  // 4) Emit one point per period in the window.
  return periods.map((period) => {
    const session = sessionByPeriod.get(period) ?? null;
    if (!session) {
      return { period, sessionId: null, status: null, totalCalc: 0, byKind: {} };
    }
    const calcs = calcsBySession.get(session.id) ?? [];
    const byKind: Record<string, number> = {};
    let total = 0;
    for (const c of calcs) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + c.amount;
      total += c.amount;
    }
    return {
      period,
      sessionId: session.id,
      status: session.status,
      totalCalc: total,
      byKind,
    };
  });
}
