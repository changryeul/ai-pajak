/**
 * Workqueue withholding (PPh23+PPh4(2)) smoke test:
 *   1. operator.test → Bearer. INDIVIDUAL customer.test id.
 *   2. POST /api/operator/queue quick-create (customer × PPh23 × sentinel).
 *   3. GET /api/operator/workqueue/{id}/withholding → shape.
 *   4. POST /api/operator/workqueue/{id}/request → PENDING_DOCS (+400 guard).
 *   5. RBAC: customer.test → 403.
 *   6. Cleanup.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-withholding.ts
 * Sentinel period 2099-12. Sentinel prefix: [WQ-WH-E2E].
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
const SENTINEL_MONTH = 12;
const SENTINEL_YEAR = 2099;

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

async function main() {
  console.log('🧾 Workqueue withholding smoke test\n');
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: customer } = await admin.from('customer').select('id').eq('email', 'customer.test@example.com').maybeSingle();
  if (!customer) { console.error('❌ customer.test not found'); process.exit(1); }
  console.log(`📌 customer: ${customer.id}`);

  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);

  const operatorToken = await login('operator.test@aipajak.com');
  if (!operatorToken) process.exit(1);

  console.log('\n━━ 1. quick-create PPh23 ━━');
  const cr = await api(operatorToken!, 'POST', '/api/operator/queue', {
    customerId: customer.id, taxType: 'PPh23', month: SENTINEL_MONTH, year: SENTINEL_YEAR,
  });
  console.log(`   ${cr.status}`);
  const qid = (cr.json.data as { id?: string } | undefined)?.id;
  assert(cr.json.success === true && !!qid, 'quick-create returns queue id');
  if (!qid) { console.error('❌ no queue id'); process.exit(1); }

  console.log('\n━━ 2. GET withholding shape ━━');
  const detail = await api(operatorToken!, 'GET', `/api/operator/workqueue/${qid}/withholding`);
  console.log(`   ${detail.status}`);
  assert(detail.json.success === true, 'withholding detail success');
  const d = detail.json.data as { summary?: { txnCount?: unknown }; rows?: unknown } | undefined;
  assert(typeof d?.summary?.txnCount === 'number', 'summary.txnCount is number');
  assert(Array.isArray(d?.rows), 'rows is array');

  console.log('\n━━ 3. request → PENDING_DOCS ━━');
  const rq = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, { message: '[WQ-WH-E2E] 원천세 증빙 요청' });
  console.log(`   ${rq.status}`);
  assert(rq.json.success === true && (rq.json.data as { status?: string })?.status === 'PENDING_DOCS', 'request → PENDING_DOCS');
  const rqBad = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, {});
  assert(rqBad.status === 400, 'request without message → 400');

  console.log('\n━━ 4. RBAC: customer → 403 ━━');
  const customerToken = await login('customer.test@example.com');
  if (customerToken) {
    const forbidden = await api(customerToken, 'GET', `/api/operator/workqueue/${qid}/withholding`);
    console.log(`   ${forbidden.status}`);
    assert(forbidden.status === 403, 'non-operator gets 403');
  } else { console.error('   ⚠️ customer.test login failed'); failures++; }

  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', qid);
  console.log(`   deleted sentinel queue row ${qid}`);

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures} assertion(s) failed.`); process.exit(1); }
  console.log('\n✅ PASS — workqueue withholding contract verified.');
}
main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
