/**
 * Workqueue supervisor reassign smoke test:
 *   GET /workqueue/operators (operator) → active operators list,
 *   supervisor reassign(target, reason) → 200 + operator_id changed in DB,
 *   operator reassign → 403, reassign without reason → 400.
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-reassign.ts
 * Sentinel period 2099-12. Sentinel prefix: [REASSIGN-E2E].
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
const SENTINEL_MONTH = 12, SENTINEL_YEAR = 2099;

let failures = 0;
function assert(c: unknown, l: string) { if (c) console.log(`   ✓ ${l}`); else { console.error(`   ❌ ${l}`); failures++; } }

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) { console.error(`   ❌ login failed ${email}: ${error?.message}`); return null; }
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
  console.log('🧾 Workqueue reassign smoke test\n');
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: customer } = await admin.from('customer').select('id').eq('email', 'customer.test@example.com').maybeSingle();
  if (!customer) { console.error('❌ customer.test not found'); process.exit(1); }

  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);

  const operatorToken = await login('operator.test@aipajak.com');
  const supervisorToken = await login('supervisor.test@aipajak.com');
  if (!operatorToken || !supervisorToken) process.exit(1);

  console.log('━━ 1. GET operators list (operator) ━━');
  const ops = await api(operatorToken, 'GET', '/api/operator/workqueue/operators');
  console.log(`   ${ops.status}`);
  assert(ops.json.success === true, 'operators list success');
  const list = (ops.json.data as { operators?: Array<{ id: string; name: string }> })?.operators ?? [];
  assert(Array.isArray(list) && list.length > 0, 'operators array non-empty');
  assert(list.every(o => o.id && typeof o.name === 'string'), 'each operator has id + name');
  const target = list[0];

  console.log('\n━━ 2. quick-create + supervisor reassign ━━');
  const cr = await api(operatorToken, 'POST', '/api/operator/queue', {
    customerId: customer.id, taxType: 'PPh23', month: SENTINEL_MONTH, year: SENTINEL_YEAR,
  });
  const qid = (cr.json.data as { id?: string } | undefined)?.id;
  if (!qid) { console.error('❌ no queue id'); process.exit(1); }

  const reassign = await api(supervisorToken, 'PUT', '/api/operator/queue', {
    id: qid, action: 'reassign', targetOperatorId: target.id, reassignmentReason: '[REASSIGN-E2E] 담당 이동',
  });
  console.log(`   reassign ${reassign.status}`);
  assert(reassign.status === 200, 'supervisor reassign → 200');
  const { data: after } = await admin.from('djp_submission_queue').select('operator_id').eq('id', qid).maybeSingle();
  assert((after as { operator_id?: string } | null)?.operator_id === target.id, 'queue operator_id changed to target');

  console.log('\n━━ 3. operator reassign → 403 ━━');
  const opReassign = await api(operatorToken, 'PUT', '/api/operator/queue', {
    id: qid, action: 'reassign', targetOperatorId: target.id, reassignmentReason: 'x',
  });
  assert(opReassign.status === 403, 'operator reassign → 403');

  console.log('\n━━ 4. reassign without reason → 400 ━━');
  const noReason = await api(supervisorToken, 'PUT', '/api/operator/queue', {
    id: qid, action: 'reassign', targetOperatorId: target.id,
  });
  assert(noReason.status === 400, 'reassign without reason → 400');

  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', qid);
  console.log(`   deleted sentinel queue row ${qid}`);

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures}`); process.exit(1); }
  console.log('\n✅ PASS — workqueue reassign verified.');
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
