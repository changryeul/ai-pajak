/**
 * Workqueue visibility + auto queue-hook smoke (2026-08-03 fixes):
 *
 *   A. wht-import → ensureQueueForActivity 계약
 *      고객이 원천세 일괄 임포트(POST /api/tax/wht-import)를 하면
 *      djp_submission_queue 에 PPh23 큐 행이 자동 생성돼야 한다.
 *      (어제까지 이 경로에 훅이 없어서 상담원 워크큐에 안 올라왔음)
 *
 *   B. 미배정 노출 + first-action claim 계약
 *      operator_id NULL 인 큐 행이 비수퍼바이저 상담원 GET 에 보이고,
 *      첫 액션(PUT review) 시 그 상담원에게 자동 배정(claim)돼야 한다.
 *
 * Sentinel: customer=company.test(…0011), period 2027-01, prefix [WQVIS-E2E].
 * Pre-cleanup + post-cleanup — 재실행 안전.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-visibility.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log(`🌐 ${baseUrl}\n`);

const PASSWORD = 'TestPassword123!';
const SENTINEL = '[WQVIS-E2E]';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011'; // company.test
const PERIOD = '2027-01';
const P_MONTH = 1;
const P_YEAR = 2027;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0;
let fail = 0;
function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { pass++; console.log(`   ✅ ${label}`); }
  else { fail++; console.error(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`); }
}

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`);
    return null;
  }
  return data.session.access_token;
}

async function cleanup() {
  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_period_year', P_YEAR).eq('tax_period_month', P_MONTH);
  await admin.from('pph23_transaction').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_period', PERIOD).like('description', `${SENTINEL}%`);
}

async function main() {
  console.log('🗂  Workqueue visibility + queue-hook smoke\n');

  console.log('🧹 Pre-cleanup');
  await cleanup();

  const customerToken = await login('company.test@example.com');
  const operatorToken = await login('operator.test@aipajak.com');
  if (!customerToken || !operatorToken) process.exit(1);

  // operator.test 의 tax_operators 프로필 id (auth uid → user_id 역추적).
  const { data: { user: opUser } } = await createClient(url, anonKey).auth.getUser(operatorToken);
  const { data: opProfile } = await admin.from('tax_operators').select('id').eq('user_id', opUser!.id).maybeSingle();
  assert(!!opProfile, 'operator.test has a tax_operators profile');
  if (!opProfile) { process.exit(1); }

  // ── A. wht-import → PPh23 큐 자동 생성 ────────────────────────────────
  console.log('\n━━ A. wht-import auto queue creation ━━');
  const importRes = await fetch(`${baseUrl}/api/tax/wht-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      taxPeriod: PERIOD,
      rows: [{
        no: 1,
        include: true,
        classified: 'pph23_jasa',
        vatInsert: false,
        expectedRate: 0.02,
        expectedAmount: 20000,
        warnings: [],
        vendor: { nama: `${SENTINEL} PT Vendor Uji`, npwp: '011234567890123', alamat: 'Jl. Uji 1' },
        invoice: { description: `${SENTINEL} jasa konsultan uji`, invoiceNo: 'WQVIS-001', fakturNo: '' },
        dates: { invoice: '2027-01-10', due: null, payment: '2027-01-15' },
        type: { pphLabel: 'PPh 23', pph42Label: '' },
        vat: { dpp: 0, ppn: 0 },
        wht: { base: 1000000, amount: 20000 },
        materai: 0, miscFee: 0, vendorPaid: 980000,
        notes: SENTINEL,
      }],
    }),
  });
  const importJson = await importRes.json().catch(() => ({}));
  assert(importRes.status === 200 && importJson?.data?.insertedPph23 === 1,
    'wht-import inserts 1 PPh23 row', `status=${importRes.status} inserted=${importJson?.data?.insertedPph23}`);

  const { data: hookQueue } = await admin.from('djp_submission_queue')
    .select('id, operator_id, status')
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23')
    .eq('tax_period_month', P_MONTH).eq('tax_period_year', P_YEAR).maybeSingle();
  assert(!!hookQueue, 'PPh23 queue row auto-created by wht-import hook');
  assert(hookQueue?.status === 'PENDING', 'auto-created queue row starts at PENDING', `status=${hookQueue?.status}`);

  // ── B. 미배정 노출 + first-action claim ──────────────────────────────
  console.log('\n━━ B. unassigned visibility + first-action claim ━━');
  // A 의 행은 자동배정으로 operator 가 붙었을 수 있으므로, claim 검증용
  // PPh21 sentinel 은 명시적으로 operator_id NULL 로 만든다.
  const { data: sentinel, error: insErr } = await admin.from('djp_submission_queue').insert({
    customer_id: CUSTOMER_ID, tax_type: 'PPh21',
    tax_period_month: P_MONTH, tax_period_year: P_YEAR,
    operator_id: null, status: 'PENDING',
  }).select('id').single();
  assert(!insErr && !!sentinel, 'sentinel unassigned PPh21 queue row inserted', insErr?.message);
  if (!sentinel) { await cleanup(); process.exit(1); }

  const listRes = await fetch(
    `${baseUrl}/api/operator/queue?taxType=PPh21&year=${P_YEAR}&month=${P_MONTH}&limit=50`,
    { headers: { Authorization: `Bearer ${operatorToken}` } });
  const listJson = await listRes.json().catch(() => ({}));
  const items: Array<{ id: string; operator_id: string | null }> = listJson?.data?.items ?? [];
  assert(listRes.status === 200 && items.some((it) => it.id === sentinel.id),
    'unassigned item visible to non-supervisor operator', `status=${listRes.status} items=${items.length}`);

  const putRes = await fetch(`${baseUrl}/api/operator/queue`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operatorToken}` },
    body: JSON.stringify({ id: sentinel.id, action: 'review' }),
  });
  const putJson = await putRes.json().catch(() => ({}));
  assert(putRes.status === 200, 'first action (review) on unassigned item succeeds',
    `status=${putRes.status} err=${putJson?.error}`);

  const { data: after } = await admin.from('djp_submission_queue')
    .select('status, operator_id').eq('id', sentinel.id).single();
  assert(after?.status === 'DATA_REVIEW', 'status transitioned to DATA_REVIEW', `status=${after?.status}`);
  assert(after?.operator_id === opProfile.id, 'item claimed by acting operator',
    `operator_id=${after?.operator_id} expected=${opProfile.id}`);

  console.log('\n🧹 Cleanup');
  await cleanup();

  console.log(`\n📊 ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
