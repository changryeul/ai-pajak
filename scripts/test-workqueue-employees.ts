/**
 * Workqueue 직원 인사 기록 smoke test:
 *   quick-create(PPh21) → 직원 마스터 sentinel 2명(정상/이슈) + 변경 이력 seed
 *   → GET employees 상세 shape (summary/flags/changeLog) → RBAC 403 → cleanup.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-employees.ts
 * Sentinel period 2099-11 (다른 워크큐 smoke 의 2099-12 와 분리).
 * Sentinel prefix: [WQ-EMP-E2E].
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl = process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const CUSTOMER_ID = '00000000-0000-4000-8000-000000000011'; // company.test
const SENTINEL = '[WQ-EMP-E2E]';
const S_MONTH = 11;
const S_YEAR = 2099;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) console.log(`   ✓ ${label}`);
  else { console.error(`   ❌ ${label}`); failures++; }
}

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`); return null; }
  return data.session.access_token;
}
async function api(token: string, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try { json = await res.json(); } catch { json = { error: await res.text() }; }
  return { status: res.status, json };
}

async function cleanup() {
  const { data: emps } = await admin.from('employee_payroll')
    .select('id').eq('customer_id', CUSTOMER_ID).like('employee_name', `${SENTINEL}%`);
  for (const e of emps ?? []) {
    await admin.from('employee_change_log').delete().eq('employee_id', e.id);
  }
  await admin.from('employee_payroll').delete()
    .eq('customer_id', CUSTOMER_ID).like('employee_name', `${SENTINEL}%`);
  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh21')
    .eq('tax_period_month', S_MONTH).eq('tax_period_year', S_YEAR);
}

async function main() {
  console.log('🧾 Workqueue employee HR smoke test\n');

  console.log('🧹 Pre-cleanup');
  await cleanup();

  const supToken = await login('supervisor.test@aipajak.com');
  const custToken = await login('company.test@example.com');
  if (!supToken || !custToken) process.exit(1);

  console.log('\n━━ 1. quick-create PPh21 queue row (worklist anchor) ━━');
  const created = await api(supToken, 'POST', '/api/operator/queue', {
    customerId: CUSTOMER_ID, taxType: 'PPh21', month: S_MONTH, year: S_YEAR,
  });
  assert(created.status === 200, `quick-create 200 (got ${created.status})`);
  const queueId = (created.json as { data?: { id?: string } }).data?.id;
  assert(!!queueId, 'queue row id returned');
  if (!queueId) { await cleanup(); process.exit(1); }

  console.log('\n━━ 2. seed sentinel employees + change log ━━');
  const { data: empOk, error: e1 } = await admin.from('employee_payroll').insert({
    customer_id: CUSTOMER_ID, employee_name: `${SENTINEL} Budi Clean`,
    employee_npwp: '012345678901234', employee_nik: '3171234567890001',
    ptkp_category: 'K1', hire_date: '2024-01-01', is_active: true, gross_salary: 12_000_000,
  }).select('id').single();
  const { data: empBad, error: e2 } = await admin.from('employee_payroll').insert({
    customer_id: CUSTOMER_ID, employee_name: `${SENTINEL} Siti Issue`,
    employee_npwp: null, employee_nik: null,
    ptkp_category: 'X9', hire_date: null, is_active: true, gross_salary: 0,
  }).select('id').single();
  assert(!e1 && !e2 && empOk && empBad, `employees inserted ${e1?.message ?? e2?.message ?? ''}`);
  if (!empOk || !empBad) { await cleanup(); process.exit(1); }

  const { error: e3 } = await admin.from('employee_change_log').insert({
    employee_id: empOk.id, customer_id: CUSTOMER_ID,
    section: 'payroll', field: 'gross_salary', old_value: '10000000', new_value: '12000000',
  });
  assert(!e3, `change log inserted ${e3?.message ?? ''}`);

  console.log('\n━━ 3. GET employees detail shape ━━');
  const d = await api(supToken, 'GET', `/api/operator/workqueue/${queueId}/employees`);
  const data = (d.json as { data?: {
    summary?: { employeeCount?: number; activeCount?: number; noNpwpCount?: number; issueCount?: number };
    rows?: Array<{ name: string; flags: { level: string; issues: string[] } }>;
    changeLog?: Array<{ employeeName: string; field: string }>;
  } }).data;
  assert(d.status === 200, `detail 200 (got ${d.status})`);
  const sentinelRows = (data?.rows ?? []).filter(r => r.name.startsWith(SENTINEL));
  assert(sentinelRows.length === 2, `2 sentinel employees in rows (got ${sentinelRows.length})`);
  const clean = sentinelRows.find(r => r.name.includes('Budi'));
  const bad = sentinelRows.find(r => r.name.includes('Siti'));
  assert(clean?.flags.level === 'green', `clean employee green (got ${clean?.flags.level})`);
  assert(bad?.flags.level === 'red', `issue employee red (got ${bad?.flags.level})`);
  assert(bad?.flags.issues.some(i => i.includes('유효하지 않은 PTKP')), 'invalid PTKP flagged');
  assert(bad?.flags.issues.includes('급여 미입력'), 'zero salary flagged');
  assert(bad?.flags.issues.includes('무-NPWP (20% 가산)'), 'missing NPWP flagged');
  assert((data?.summary?.issueCount ?? 0) >= 1, 'summary issueCount >= 1');
  assert((data?.changeLog ?? []).some(c => c.employeeName.startsWith(SENTINEL) && c.field === 'gross_salary'),
    'change log entry surfaced');

  console.log('\n━━ 4. RBAC — customer 403 ━━');
  const rbac = await api(custToken, 'GET', `/api/operator/workqueue/${queueId}/employees`);
  assert(rbac.status === 403, `customer blocked with 403 (got ${rbac.status})`);

  console.log('\n🧹 Cleanup');
  await cleanup();

  console.log(`\n📊 ${failures === 0 ? 'PASS' : `${failures} FAILED`}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
