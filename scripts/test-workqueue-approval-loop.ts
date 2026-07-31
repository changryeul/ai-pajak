/**
 * Workqueue approval loop smoke test:
 *   supervisor walks review→request-approval→PENDING_APPROVAL,
 *   GET approval canApprove (supervisor true / operator false),
 *   supervisor reject(reason)→DATA_REVIEW + rejectedReason surfaces,
 *   operator approve → 403 (supervisor-only action).
 * Run with: SEED_TARGET=prod npx tsx scripts/test-workqueue-approval-loop.ts
 * Sentinel period 2099-12. Sentinel prefix: [APPRLOOP-E2E].
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
  console.log('🧾 Workqueue approval loop smoke test\n');
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: customer } = await admin.from('customer').select('id').eq('email', 'customer.test@example.com').maybeSingle();
  if (!customer) { console.error('❌ customer.test not found'); process.exit(1); }

  await admin.from('djp_submission_queue').delete()
    .eq('customer_id', customer.id).eq('tax_type', 'PPh23')
    .eq('tax_period_month', SENTINEL_MONTH).eq('tax_period_year', SENTINEL_YEAR);

  const operatorToken = await login('operator.test@aipajak.com');
  const supervisorToken = await login('supervisor.test@aipajak.com');
  if (!operatorToken || !supervisorToken) process.exit(1);

  console.log('━━ 1. quick-create + walk to PENDING_APPROVAL (supervisor) ━━');
  const cr = await api(operatorToken, 'POST', '/api/operator/queue', {
    customerId: customer.id, taxType: 'PPh23', month: SENTINEL_MONTH, year: SENTINEL_YEAR,
  });
  const qid = (cr.json.data as { id?: string } | undefined)?.id;
  if (!qid) { console.error('❌ no queue id'); process.exit(1); }
  await api(supervisorToken, 'PUT', '/api/operator/queue', { id: qid, action: 'review' });
  const ra = await api(supervisorToken, 'PUT', '/api/operator/queue', { id: qid, action: 'request-approval' });
  assert((ra.json.data as { status?: string })?.status === 'PENDING_APPROVAL', 'request-approval → PENDING_APPROVAL');

  console.log('\n━━ 2. GET approval canApprove by role ━━');
  const supApproval = await api(supervisorToken, 'GET', `/api/operator/workqueue/${qid}/approval`);
  assert((supApproval.json.data as { canApprove?: boolean })?.canApprove === true, 'supervisor canApprove=true');
  const opApproval = await api(operatorToken, 'GET', `/api/operator/workqueue/${qid}/approval`);
  assert((opApproval.json.data as { canApprove?: boolean })?.canApprove === false, 'operator canApprove=false');

  console.log('\n━━ 3. operator approve → 403 (supervisor-only) ━━');
  const opApprove = await api(operatorToken, 'PUT', '/api/operator/queue', { id: qid, action: 'approve' });
  assert(opApprove.status === 403, 'operator approve → 403');

  console.log('\n━━ 4. supervisor reject(reason) → DATA_REVIEW + reason surfaces ━━');
  const rej = await api(supervisorToken, 'PUT', '/api/operator/queue', {
    id: qid, action: 'reject', rejectedReason: '[APPRLOOP-E2E] 증빙 보완 필요',
  });
  assert((rej.json.data as { status?: string })?.status === 'DATA_REVIEW', 'reject → DATA_REVIEW');
  const afterRej = await api(operatorToken, 'GET', `/api/operator/workqueue/${qid}/approval`);
  const ad = afterRej.json.data as { status?: string; rejectedReason?: string } | undefined;
  assert(ad?.status === 'DATA_REVIEW', 'approval GET status DATA_REVIEW');
  assert((ad?.rejectedReason ?? '').includes('[APPRLOOP-E2E]'), 'rejectedReason surfaces in approval GET');

  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', qid);
  console.log(`   deleted sentinel queue row ${qid}`);

  if (failures > 0) { console.error(`\n❌ FAIL — ${failures}`); process.exit(1); }
  console.log('\n✅ PASS — workqueue approval loop verified.');
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
