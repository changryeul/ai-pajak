import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const OPERATOR_ROLES = ['TAX_OPERATOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_MASTER'];

/**
 * GET /api/operator/audit?limit=200
 *
 * Returns the case_audit_log feed enriched with each case's case_code +
 * customer name, ordered newest first. Includes a synthetic CASE_CREATED
 * event derived from djp_submission_queue.created_at so newly seeded cases
 * appear in the audit page even before they generate any explicit events.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
  const role = roles?.map(r => r.role).find(r => OPERATOR_ROLES.includes(r));
  if (!role) return NextResponse.json({ error: 'Operator access required' }, { status: 403 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 200), 1000);

  const { data: cases } = await admin
    .from('djp_submission_queue')
    .select('id, case_code, customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const caseIds = (cases ?? []).map(c => c.id);
  const caseMap = new Map<string, { case_code: string | null; customer_id: string; created_at: string }>();
  for (const c of cases ?? []) caseMap.set(c.id, { case_code: c.case_code, customer_id: c.customer_id, created_at: c.created_at });

  const customerIds = Array.from(new Set((cases ?? []).map(c => c.customer_id)));
  const customerNames = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', customerIds);
    for (const c of cs ?? []) customerNames.set(c.id, c.company_name || c.full_name || '—');
  }

  const { data: audit } = caseIds.length > 0
    ? await admin
        .from('case_audit_log')
        .select('id, case_id, event_type, actor_label, payload, created_at')
        .in('case_id', caseIds)
        .order('created_at', { ascending: false })
        .limit(limit)
    : { data: [] };

  // Synthetic CASE_CREATED rows so newly seeded cases without any audit row
  // still appear in the feed.
  const synth = (cases ?? []).map(c => ({
    id: `synth-${c.id}`,
    case_id: c.id,
    event_type: 'CASE_CREATED',
    actor_label: 'system',
    payload: {},
    created_at: c.created_at,
  }));

  // Hide synthetic rows for cases that already have an explicit ASSIGNED/REASSIGNED
  // first-event so we don't double-count.
  const explicitFirstByCase = new Map<string, string>();
  for (const a of audit ?? []) {
    if (!explicitFirstByCase.has(a.case_id)) explicitFirstByCase.set(a.case_id, a.event_type);
  }
  const filteredSynth = synth.filter(s => !explicitFirstByCase.has(s.case_id));

  const merged = [...(audit ?? []), ...filteredSynth]
    .map(a => {
      const meta = caseMap.get(a.case_id);
      return {
        ...a,
        case_code: meta?.case_code ?? null,
        customer_name: meta ? (customerNames.get(meta.customer_id) ?? '—') : '—',
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);

  return NextResponse.json({ success: true, data: { items: merged } });
}
