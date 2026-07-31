/**
 * Counselor workqueue PPh21 smoke test:
 *   1. operator.test logs in → Bearer. Find the INDIVIDUAL customer.test id.
 *   2. POST /api/operator/queue quick-create (customer × PPh21 × sentinel period)
 *      → 200 with a queue id (created true|false).
 *   3. GET /api/operator/workqueue/{id}/pph21 → shape (summary.employeeCount number,
 *      rows array).
 *   4. POST /api/operator/workqueue/{id}/request → transitions to PENDING_DOCS.
 *   5. RBAC: customer.test token GET → 403.
 *   6. Cleanup the sentinel queue row.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-pph21.ts
 *
 * Sentinel period tax_period_month=12 / tax_period_year=2099 stays within the
 * endpoint's valid range (month 1-12, year 2000-2100) yet never collides with
 * real filings. Sentinel prefix: [WQ-E2E].
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
const SENTINEL_MONTH = 12;
const SENTINEL_YEAR = 2099;

let failures = 0;
function assert(cond: unknown, label: string) {
  if (cond) {
    console.log(`   ✓ ${label}`);
  } else {
    console.error(`   ❌ ${label}`);
    failures++;
  }
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

async function api(token: string, method: string, pathname: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    json = { error: await res.text() };
  }
  return { status: res.status, json };
}

async function main() {
  console.log('🧾 Counselor workqueue PPh21 smoke test\n');

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── Setup: INDIVIDUAL customer.test id ───
  const { data: customer } = await admin
    .from('customer')
    .select('id')
    .eq('email', 'customer.test@example.com')
    .maybeSingle();
  if (!customer) {
    console.error('❌ customer.test not found');
    process.exit(1);
  }
  console.log(`📌 customer: ${customer.id}`);

  // Cleanup any leftovers from prior failed runs
  await admin
    .from('djp_submission_queue')
    .delete()
    .eq('customer_id', customer.id)
    .eq('tax_period_month', SENTINEL_MONTH)
    .eq('tax_period_year', SENTINEL_YEAR);

  const operatorToken = await login('operator.test@aipajak.com');
  if (!operatorToken) process.exit(1);

  // ─── 1. quick-create ───
  console.log('\n━━ 1. quick-create (POST /api/operator/queue) ━━');
  const cr = await api(operatorToken!, 'POST', '/api/operator/queue', {
    customerId: customer.id,
    taxType: 'PPh21',
    month: SENTINEL_MONTH,
    year: SENTINEL_YEAR,
  });
  console.log(`   ${cr.status}`);
  const crData = cr.json.data as { id?: string } | undefined;
  assert(cr.json.success === true && !!crData?.id, 'quick-create returns queue id');
  const qid = crData?.id;
  if (!qid) {
    console.error('❌ no queue id — cannot continue');
    process.exit(1);
  }

  // idempotent second call → same id, created false
  const cr2 = await api(operatorToken!, 'POST', '/api/operator/queue', {
    customerId: customer.id,
    taxType: 'PPh21',
    month: SENTINEL_MONTH,
    year: SENTINEL_YEAR,
  });
  const cr2Data = cr2.json.data as { id?: string } | undefined;
  assert(cr2Data?.id === qid && cr2.json.created === false, 'quick-create is idempotent');

  // ─── 2. GET pph21 detail shape ───
  console.log('\n━━ 2. GET /api/operator/workqueue/{id}/pph21 ━━');
  const detail = await api(operatorToken!, 'GET', `/api/operator/workqueue/${qid}/pph21`);
  console.log(`   ${detail.status}`);
  assert(detail.json.success === true, 'pph21 detail success');
  const d = detail.json.data as {
    summary?: { employeeCount?: unknown; totalPph21?: unknown };
    rows?: unknown;
  } | undefined;
  assert(typeof d?.summary?.employeeCount === 'number', 'summary.employeeCount is number');
  assert(Array.isArray(d?.rows), 'rows is array');

  // ─── 3. request → PENDING_DOCS ───
  console.log('\n━━ 3. POST /api/operator/workqueue/{id}/request ━━');
  const rq = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, {
    message: '[WQ-E2E] NPWP 확인 요청',
  });
  console.log(`   ${rq.status}`);
  const rqData = rq.json.data as { status?: string } | undefined;
  assert(rq.json.success === true && rqData?.status === 'PENDING_DOCS', 'request transitions to PENDING_DOCS');

  // request without message → 400
  const rqBad = await api(operatorToken!, 'POST', `/api/operator/workqueue/${qid}/request`, {});
  assert(rqBad.status === 400, 'request without message → 400');

  // ─── 4. RBAC: customer token → 403 ───
  console.log('\n━━ 4. RBAC: customer.test GET → 403 ━━');
  const customerToken = await login('customer.test@example.com');
  if (customerToken) {
    const forbidden = await api(customerToken, 'GET', `/api/operator/workqueue/${qid}/pph21`);
    console.log(`   ${forbidden.status}`);
    assert(forbidden.status === 403, 'non-operator gets 403');
  } else {
    console.error('   ⚠️ customer.test login failed — skipping RBAC assert');
    failures++;
  }

  // ─── Cleanup ───
  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', qid);
  console.log(`   deleted sentinel queue row ${qid}`);

  if (failures > 0) {
    console.error(`\n❌ FAIL — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\n✅ PASS — workqueue PPh21 contract verified.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
