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
