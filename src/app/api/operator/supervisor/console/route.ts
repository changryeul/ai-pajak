/**
 * GET /api/operator/supervisor/console — v13 수퍼바이저 콘솔 집계.
 * 대시보드 KPI + 자동배정 완료 고객 + 배정/변경 이력 + 팀 + 상담원 랭킹을 한 번에.
 * 수퍼바이저(및 상위) 전용. admin 클라이언트로 조회(미들웨어 인증 후).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const SUP_ROLES = ['TAX_OPERATOR_SUPERVISOR', 'TAX_OPERATOR_LEAD', 'TAX_OPERATOR_MASTER'];

async function gate() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roleRow } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!roleRow || !SUP_ROLES.includes(roleRow.role)) {
    return { error: NextResponse.json({ error: 'Supervisor only' }, { status: 403 }) };
  }
  return { user };
}

// 수동 재배정 (팀/상담원 수동변경) — 활성 배정 교체 + 감사로그(method='MANUAL').
export async function POST(request: NextRequest) {
  const g = await gate(); if (g.error) return g.error;
  const parsed = z.object({
    customerId: z.string().uuid(),
    operatorId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { customerId, operatorId, reason } = parsed.data;
  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  await admin.from('operator_client_assignments')
    .update({ is_active: false, unassigned_at: nowIso, unassigned_date: nowIso.slice(0, 10) })
    .eq('customer_id', customerId).eq('is_active', true);
  const { error: insErr } = await admin.from('operator_client_assignments').insert({
    customer_id: customerId, operator_id: operatorId, is_active: true,
    assigned_date: nowIso.slice(0, 10), assignment_reason: reason, assigned_by: g.user!.id,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  await admin.from('operator_assignment_log').insert({
    customer_id: customerId, operator_id: operatorId, method: 'MANUAL',
    triggered_by: 'SUPERVISOR', actor_user_id: g.user!.id,
  });
  return NextResponse.json({ success: true });
}

export async function GET(_req: NextRequest) {
  const g = await gate(); if (g.error) return g.error;

  const admin = getSupabaseAdmin();

  // 상담원(operator) 마스터
  const { data: ops } = await admin
    .from('tax_operators')
    .select('id, name, work_state, status, max_clients, approval_quality_score, accuracy_pct, specialties, auto_assign_enabled, supervisor_id');
  const opById = new Map((ops ?? []).map(o => [o.id, o]));

  // 활성 배정
  const { data: assigns } = await admin
    .from('operator_client_assignments')
    .select('customer_id, operator_id, assigned_date, is_active')
    .eq('is_active', true)
    .order('assigned_date', { ascending: false })
    .limit(50);

  const custIds = [...new Set((assigns ?? []).map(a => a.customer_id))];
  const custById = new Map<string, { name: string }>();
  if (custIds.length) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', custIds);
    for (const c of cs ?? []) custById.set(c.id, { name: c.company_name || c.full_name || '—' });
  }
  // 고객별 세목 (djp_submission_queue distinct)
  const taxByCust = new Map<string, Set<string>>();
  if (custIds.length) {
    const { data: q } = await admin.from('djp_submission_queue').select('customer_id, tax_type').in('customer_id', custIds);
    for (const r of q ?? []) {
      if (!taxByCust.has(r.customer_id)) taxByCust.set(r.customer_id, new Set());
      taxByCust.get(r.customer_id)!.add(r.tax_type);
    }
  }
  // 최근 배정 방식 (log)
  const { data: logs } = await admin
    .from('operator_assignment_log')
    .select('customer_id, operator_id, method, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  const methodByCust = new Map<string, string>();
  for (const l of logs ?? []) if (!methodByCust.has(l.customer_id)) methodByCust.set(l.customer_id, l.method);

  const assignedCustomers = (assigns ?? []).slice(0, 30).map(a => ({
    customerId: a.customer_id,
    name: custById.get(a.customer_id)?.name ?? '—',
    operator: opById.get(a.operator_id)?.name ?? '—',
    method: methodByCust.get(a.customer_id) ?? 'AUTO',
    taxTypes: [...(taxByCust.get(a.customer_id) ?? [])].slice(0, 3),
    assignedAt: a.assigned_date,
  }));

  const history = (logs ?? []).slice(0, 12).map(l => ({
    name: custById.get(l.customer_id)?.name ?? '—',
    operator: opById.get(l.operator_id)?.name ?? '—',
    method: l.method,
    at: l.created_at,
  }));

  // 팀: 상담원별 활성 배정 수(load)
  const loadByOp = new Map<string, number>();
  for (const a of assigns ?? []) loadByOp.set(a.operator_id, (loadByOp.get(a.operator_id) ?? 0) + 1);
  const team = (ops ?? []).map(o => ({
    id: o.id, name: o.name, workState: o.work_state ?? 'active',
    load: loadByOp.get(o.id) ?? 0, maxClients: o.max_clients ?? 0,
    score: Number(o.approval_quality_score ?? 0), autoAssign: !!o.auto_assign_enabled,
  }));
  const ranking = [...team].sort((a, b) => b.score - a.score).slice(0, 6);

  // 팀 비교 (supervisor_id 로 그룹) — 인원/평균 품질/총 담당
  const bySup = new Map<string, { name: string; count: number; scoreSum: number; load: number }>();
  for (const o of ops ?? []) {
    const supId = o.supervisor_id ?? 'none';
    const supName = o.supervisor_id ? (opById.get(o.supervisor_id)?.name ?? '미지정') : '미지정';
    const g = bySup.get(supId) ?? { name: supName, count: 0, scoreSum: 0, load: 0 };
    g.count += 1; g.scoreSum += Number(o.approval_quality_score ?? 0);
    g.load += loadByOp.get(o.id) ?? 0;
    bySup.set(supId, g);
  }
  const teamCompare = [...bySup.values()]
    .map(g => ({ team: g.name, members: g.count, avgScore: g.count ? Math.round(g.scoreSum / g.count) : 0, totalLoad: g.load }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // 승인대기 (djp PENDING_APPROVAL)
  const { data: pendingQ } = await admin
    .from('djp_submission_queue')
    .select('id, customer_id, tax_type, tax_period_month, tax_period_year, amount')
    .eq('status', 'PENDING_APPROVAL')
    .order('created_at', { ascending: false })
    .limit(30);
  const pendCustIds = [...new Set((pendingQ ?? []).map(r => r.customer_id))];
  const pendCustName = new Map<string, string>();
  if (pendCustIds.length) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', pendCustIds);
    for (const c of cs ?? []) pendCustName.set(c.id, c.company_name || c.full_name || '—');
  }
  const approvalPending = (pendingQ ?? []).map(r => ({
    id: r.id, company: pendCustName.get(r.customer_id) ?? '—', taxType: r.tax_type,
    period: `${r.tax_period_year}-${String(r.tax_period_month).padStart(2, '0')}`, amount: Number(r.amount ?? 0),
  }));

  // 감사로그 (audit_log 최근)
  const { data: auditRows } = await admin
    .from('audit_log')
    .select('id, activity_type, actor_role, tax_type, customer_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  const audCustIds = [...new Set((auditRows ?? []).map(a => a.customer_id).filter(Boolean))];
  const audCustName = new Map<string, string>();
  if (audCustIds.length) {
    const { data: cs } = await admin.from('customer').select('id, full_name, company_name').in('id', audCustIds);
    for (const c of cs ?? []) audCustName.set(c.id, c.company_name || c.full_name || '—');
  }
  const audit = (auditRows ?? []).map(a => ({
    activity: a.activity_type, role: a.actor_role, taxType: a.tax_type,
    company: a.customer_id ? (audCustName.get(a.customer_id) ?? '—') : '—', at: a.created_at,
  }));

  const offline = team.filter(t => t.workState === 'offline').length;
  const kpis = {
    pendingManual: 0, // 신규는 즉시 자동배정 — 수동 대기 없음(원칙)
    autoAssigned: (logs ?? []).filter(l => l.method === 'AUTO').length,
    excludedOffline: offline,
    changes: (logs ?? []).filter(l => l.method && l.method !== 'AUTO').length,
  };

  return NextResponse.json({
    success: true,
    data: { kpis, assignedCustomers, history, team, ranking, teamCompare, approvalPending, audit,
      operators: team.map(t => ({ id: t.id, name: t.name })) },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
