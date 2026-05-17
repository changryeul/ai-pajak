/**
 * Shared helpers for /api/consultant-erp/* endpoints.
 *
 * Resolves the calling user to a consultant row, fetches sessions with
 * tax_partner scope enforcement, and produces the supervisor-friendly
 * snapshot used at approval time.
 */

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { UserRole } from '@/types/auth';

export interface ConsultantContext {
  userId: string;
  role: UserRole;
  consultantId: string;
  taxPartnerId: string;
  isSupervisor: boolean;
}

export async function resolveConsultantContext(opts: {
  userId: string;
  role: UserRole;
}): Promise<ConsultantContext | null> {
  const { userId, role } = opts;
  const admin = getSupabaseAdmin();

  // TAX_OPERATOR_SUPERVISOR is platform-wide (1-단 결재 권한 across all
  // tax_partners) so it has no consultant row. Return a synthetic context;
  // ensureSessionAccess and buildBoardForConsultant honor isSupervisor.
  if (role === UserRole.TAX_OPERATOR_SUPERVISOR) {
    return {
      userId,
      role,
      consultantId: '',
      taxPartnerId: '',
      isSupervisor: true,
    };
  }

  const { data: c } = await admin
    .from('consultant')
    .select('id, tax_partner_id, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (!c) return null;
  return {
    userId,
    role,
    consultantId: c.id,
    taxPartnerId: c.tax_partner_id,
    isSupervisor: false,
  };
}

export async function ensureSessionAccess(opts: {
  sessionId: string;
  ctx: ConsultantContext;
}): Promise<{ ok: true; partnerId: string } | { ok: false; status: number; error: string }> {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from('consultant_session')
    .select('tax_partner_id')
    .eq('id', opts.sessionId)
    .maybeSingle();
  if (!row) return { ok: false, status: 404, error: 'Session not found' };
  // Supervisors approve sessions across all tax_partners; no scope check.
  if (opts.ctx.isSupervisor) return { ok: true, partnerId: row.tax_partner_id };
  if (row.tax_partner_id !== opts.ctx.taxPartnerId) {
    return { ok: false, status: 403, error: 'Session belongs to another tax_partner' };
  }
  return { ok: true, partnerId: row.tax_partner_id };
}

export type BoardCustomer = {
  sessionId: string | null;
  customerId: string;
  customerName: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  npwp: string | null;
  consultantName: string | null;
  supervisorName: string | null;
  taxPeriod: string | null;
  filingKind: 'MONTHLY' | 'ANNUAL' | null;
  status: string | null;
  currentStep: number | null;
  uploadCount: number;
  parsedCount: number;
  reviewedCount: number;
};

export type BoardStats = {
  totalCustomers: number;
  activeCustomers: number;
  uploadedSessions: number;
  reviewedSessions: number;
};

export async function buildBoardForConsultant(
  ctx: ConsultantContext,
): Promise<{ stats: BoardStats; rows: BoardCustomer[] }> {
  const admin = getSupabaseAdmin();

  // 1) all customers assigned to consultants in the same tax_partner.
  const { data: assignments } = await admin
    .from('customer_consultant')
    .select('customer_id, consultant_id, is_active')
    .eq('is_active', true);

  const partnerConsultantIds = new Set<string>();
  {
    const { data: peers } = await admin
      .from('consultant')
      .select('id, full_name')
      .eq('tax_partner_id', ctx.taxPartnerId);
    (peers ?? []).forEach((p) => partnerConsultantIds.add(p.id));
  }

  const myCustomerIds = new Set<string>(
    (assignments ?? [])
      .filter(
        (a) =>
          a.consultant_id === ctx.consultantId ||
          (ctx.isSupervisor && partnerConsultantIds.has(a.consultant_id)),
      )
      .map((a) => a.customer_id),
  );

  if (myCustomerIds.size === 0) {
    return {
      stats: { totalCustomers: 0, activeCustomers: 0, uploadedSessions: 0, reviewedSessions: 0 },
      rows: [],
    };
  }

  // 2) customer profile + (optional) latest session
  const customerIds = Array.from(myCustomerIds);
  const { data: customers } = await admin
    .from('customer')
    .select('id, customer_type, npwp, full_name, company_name')
    .in('id', customerIds);

  const { data: sessions } = await admin
    .from('consultant_session')
    .select(
      'id, customer_id, consultant_id, supervisor_id, filing_kind, tax_period, status, current_step, updated_at',
    )
    .in('customer_id', customerIds)
    .order('updated_at', { ascending: false });

  type SessionRow = NonNullable<typeof sessions>[number];
  const latestSessionByCustomer = new Map<string, SessionRow>();
  for (const s of sessions ?? []) {
    if (!latestSessionByCustomer.has(s.customer_id)) {
      latestSessionByCustomer.set(s.customer_id, s);
    }
  }

  // 3) consultant name lookup
  const consultantIds = new Set<string>();
  for (const s of latestSessionByCustomer.values()) {
    if (s.consultant_id) consultantIds.add(s.consultant_id);
    if (s.supervisor_id) consultantIds.add(s.supervisor_id);
  }
  let consultantNames: Map<string, string> = new Map();
  if (consultantIds.size > 0) {
    const { data: cs } = await admin
      .from('consultant')
      .select('id, full_name')
      .in('id', Array.from(consultantIds));
    consultantNames = new Map((cs ?? []).map((c) => [c.id, c.full_name as string]));
  }

  // 4) document counts per session
  const sessionIds = Array.from(latestSessionByCustomer.values()).map((s) => s.id);
  const docCountBySession = new Map<string, { up: number; parsed: number; reviewed: number }>();
  if (sessionIds.length > 0) {
    const { data: docs } = await admin
      .from('consultant_session_document')
      .select('session_id, parse_status')
      .in('session_id', sessionIds);
    for (const d of docs ?? []) {
      const e = docCountBySession.get(d.session_id) ?? { up: 0, parsed: 0, reviewed: 0 };
      e.up += 1;
      if (d.parse_status === 'PARSED') e.parsed += 1;
      docCountBySession.set(d.session_id, e);
    }
    const { data: parseRows } = await admin
      .from('consultant_session_parse_row')
      .select('document_id')
      .eq('is_resolved', true);
    const reviewedDocs = new Set((parseRows ?? []).map((p) => p.document_id));
    if (reviewedDocs.size > 0) {
      const { data: docMeta } = await admin
        .from('consultant_session_document')
        .select('id, session_id')
        .in('id', Array.from(reviewedDocs));
      for (const dm of docMeta ?? []) {
        const e = docCountBySession.get(dm.session_id) ?? { up: 0, parsed: 0, reviewed: 0 };
        e.reviewed += 1;
        docCountBySession.set(dm.session_id, e);
      }
    }
  }

  const rows: BoardCustomer[] = (customers ?? []).map((c) => {
    const s = latestSessionByCustomer.get(c.id) ?? null;
    const counts = (s && docCountBySession.get(s.id)) || { up: 0, parsed: 0, reviewed: 0 };
    return {
      sessionId: s?.id ?? null,
      customerId: c.id,
      customerName: (c.company_name || c.full_name) as string,
      customerType: c.customer_type as 'INDIVIDUAL' | 'COMPANY',
      npwp: c.npwp,
      consultantName: s?.consultant_id ? consultantNames.get(s.consultant_id) ?? null : null,
      supervisorName: s?.supervisor_id ? consultantNames.get(s.supervisor_id) ?? null : null,
      taxPeriod: s?.tax_period ?? null,
      filingKind: (s?.filing_kind as 'MONTHLY' | 'ANNUAL' | undefined) ?? null,
      status: s?.status ?? null,
      currentStep: s?.current_step ?? null,
      uploadCount: counts.up,
      parsedCount: counts.parsed,
      reviewedCount: counts.reviewed,
    };
  });

  const activeStatuses = new Set([
    'DRAFT',
    'UPLOADING',
    'PARSING',
    'REVIEWING',
    'PENDING_APPROVAL',
  ]);
  const stats: BoardStats = {
    totalCustomers: rows.length,
    activeCustomers: rows.filter((r) => r.status && activeStatuses.has(r.status)).length,
    uploadedSessions: rows.filter((r) => r.uploadCount > 0).length,
    reviewedSessions: rows.filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
  };

  return { stats, rows };
}
