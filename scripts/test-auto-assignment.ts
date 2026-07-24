/**
 * 자동배정 엔진 smoke (v13 §5 — 트랙 4).
 *
 * 검증 계약:
 *   1. RBAC — consultant 403, supervisor 200 (auto-assign POST)
 *   2. sentinel 고객(미배정) + 큐 아이템 생성 → auto-assign 실행
 *   3. 고객이 operator_client_assignments 에 스코어 기반 배정됨
 *   4. operator_assignment_log 에 근거(method/score/breakdown/unapplied) 기록
 *   5. unappliedCriteria 에 language/risk 명시 (no silent caps)
 *   6. 재실행 idempotent — 이미 배정된 고객 재배정 안 함
 *
 * 실행: SEED_TARGET=prod npx tsx scripts/test-auto-assignment.ts
 * sentinel prefix: [AUTOASSIGN-E2E]
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.E2E_BASE_URL || 'https://ai-pajak.vercel.app';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const PASSWORD = 'TestPassword123!';
const SENTINEL = '[AUTOASSIGN-E2E]';

let pass = 0;
function ok(msg: string) { pass++; console.log(`  ✓ ${msg}`); }
function fail(msg: string): never { console.error(`  ✗ ${msg}`); process.exit(1); }

async function login(email: string): Promise<string> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) fail(`login failed: ${email} — ${error?.message}`);
  return data.session.access_token;
}

async function api(token: string, method: string, p: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

async function main() {
  console.log(`🧪 auto-assignment engine smoke on ${baseUrl}\n`);
  const cleanup: { customerId?: string; queueId?: string } = {};

  try {
    // ── sentinel 고객 + 큐 아이템 (미배정) ──
    const { data: customer } = await admin.from('customer').insert({
      customer_type: 'COMPANY',
      full_name: `${SENTINEL} PT AutoAssign`,
      company_name: `${SENTINEL} PT AutoAssign`,
      npwp: `66${Date.now().toString().slice(-13)}`.slice(0, 15),
      email: `autoassign-${Date.now()}@example.com`,
      is_pkp: false,
    }).select('id').single();
    if (!customer) fail('customer insert failed');
    cleanup.customerId = customer.id;

    const { data: queueRow } = await admin.from('djp_submission_queue').insert({
      customer_id: customer.id, tax_type: 'PPh23', tax_period_month: 6, tax_period_year: 2026,
      amount: 2_000_000, status: 'PENDING', notes: `${SENTINEL} queue`,
    }).select('id').single();
    if (!queueRow) fail('queue insert failed');
    cleanup.queueId = queueRow.id;
    ok(`sentinel customer + PENDING queue item ready`);

    // 사전 정리 — 혹시 남은 배정/로그 제거 (idempotent 재실행 대비)
    await admin.from('operator_client_assignments').delete().eq('customer_id', customer.id);
    await admin.from('operator_assignment_log').delete().eq('customer_id', customer.id);

    // ── 1. RBAC ──
    const consultantToken = await login('consultant.test@jakartatax.co.id');
    const r1 = await api(consultantToken, 'POST', '/api/operator/auto-assign');
    if (r1.status !== 403) fail(`consultant expected 403, got ${r1.status}`);
    ok('RBAC: consultant → 403');

    const supervisorToken = await login('supervisor.test@aipajak.com');
    const r2 = await api(supervisorToken, 'POST', '/api/operator/auto-assign');
    if (r2.status !== 200) fail(`supervisor expected 200, got ${r2.status}: ${JSON.stringify(r2.json).slice(0, 200)}`);
    ok('RBAC: supervisor → 200');

    // ── 2/3. 고객 배정 확인 ──
    const { data: assignment } = await admin
      .from('operator_client_assignments')
      .select('operator_id, is_active, assignment_reason')
      .eq('customer_id', customer.id)
      .eq('is_active', true)
      .maybeSingle();

    // 배정 결과는 가용 operator 유무에 따라 배정 or overflow.
    const { data: logRow } = await admin
      .from('operator_assignment_log')
      .select('method, score, breakdown, candidates_considered, triggered_by')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!logRow) fail('no operator_assignment_log row written');
    ok(`assignment log recorded — method=${logRow.method}, candidates=${logRow.candidates_considered}`);

    if (assignment) {
      if (!assignment.assignment_reason?.startsWith('auto:')) fail(`assignment_reason not auto: ${assignment.assignment_reason}`);
      if (!['sticky', 'scored'].includes(logRow.method)) fail(`assigned but method=${logRow.method}`);
      ok(`customer assigned to operator ${assignment.operator_id?.slice(0, 8)}… (${assignment.assignment_reason})`);
    } else {
      if (logRow.method !== 'overflow') fail(`no assignment but method=${logRow.method} (expected overflow)`);
      ok('no eligible operator → overflow (미배정 큐 fallback), logged');
    }

    // ── 4/5. breakdown 에 unappliedCriteria 명시 ──
    const breakdown = (logRow.breakdown ?? {}) as Record<string, unknown>;
    const unapplied = (breakdown.unappliedCriteria ?? []) as string[];
    if (!unapplied.includes('language') || !unapplied.includes('risk')) {
      fail(`unappliedCriteria must list language+risk, got ${JSON.stringify(unapplied)}`);
    }
    if (logRow.triggered_by !== 'SUPERVISOR') fail(`triggered_by expected SUPERVISOR, got ${logRow.triggered_by}`);
    ok('breakdown reports unappliedCriteria [language, risk] — no silent caps');

    // ── 6. idempotent 재실행 ──
    if (assignment) {
      const before = await admin.from('operator_assignment_log').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id);
      await api(supervisorToken, 'POST', '/api/operator/auto-assign');
      const after = await admin.from('operator_assignment_log').select('id', { count: 'exact', head: true }).eq('customer_id', customer.id);
      if ((after.count ?? 0) !== (before.count ?? 0)) fail('re-run created a duplicate assignment log for already-assigned customer');
      ok('idempotent — already-assigned customer not reassigned on re-run');
    } else {
      ok('idempotent check skipped (customer was overflow — no assignment to dedup)');
    }

    console.log(`\n✅ ${pass} assertions passed`);
  } finally {
    console.log('\n🧹 cleanup');
    if (cleanup.customerId) {
      await admin.from('operator_assignment_log').delete().eq('customer_id', cleanup.customerId);
      await admin.from('operator_client_assignments').delete().eq('customer_id', cleanup.customerId);
    }
    if (cleanup.queueId) await admin.from('djp_submission_queue').delete().eq('id', cleanup.queueId);
    if (cleanup.customerId) await admin.from('customer').delete().eq('id', cleanup.customerId);
    console.log('   sentinel rows removed');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
