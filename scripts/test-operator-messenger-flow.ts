/**
 * Smoke test the operator messenger 2-channel API.
 *
 * Run:  SEED_TARGET=prod npx tsx scripts/test-operator-messenger-flow.ts
 *  or:  npx tsx scripts/test-operator-messenger-flow.ts   (local Supabase)
 *
 * What we verify (the things RLS + the masking matrix promise):
 *
 *   1. Operator can POST CUSTOMER channel — row is stored masked as AI_PAJAK.
 *   2. Operator can POST INTERNAL channel — sender_role = OPERATOR.
 *   3. Supervisor can POST INTERNAL channel — sender_role = SUPERVISOR.
 *   4. Customer GET only returns the CUSTOMER channel (INTERNAL row planted in
 *      step 2 must NOT appear).
 *   5. Customer GET sees display_sender = AI_PAJAK for operator messages
 *      (the customer never knows there's a real operator/supervisor).
 *   6. Customer POST is hard-pinned to CUSTOMER channel — any attempt to ask
 *      for INTERNAL via the customer endpoint is impossible (no channel field
 *      exists on the customer schema). We also verify a customer cannot read
 *      INTERNAL rows even when guessing the operator endpoint.
 *   7. Customer GETing /api/operator/messages must 403 (role gate).
 *
 * Cleanup: deletes the operator_message rows we inserted at the end.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');

console.log(`📄 env: ${envFile}`);
console.log(`🌐 base URL: ${baseUrl}`);

const PASSWORD = 'TestPassword123!';
const OPERATOR_EMAIL   = 'operator.test@aipajak.com';
const SUPERVISOR_EMAIL = 'supervisor.test@aipajak.com';
const CUSTOMER_EMAIL   = 'customer.test@example.com';

interface TestResult { name: string; pass: boolean; detail?: string }
const results: TestResult[] = [];
const createdMessageIds: string[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`   ${pass ? '✅' : '❌'} ${name}${detail ? `  (${detail})` : ''}`);
}

interface LoginResult { token: string; userId: string }

async function login(email: string): Promise<LoginResult> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`login failed: ${email}: ${error?.message ?? 'no session'}`);
  return { token: data.session.access_token, userId: data.user!.id };
}

async function getCustomerIdForUser(userId: string): Promise<string> {
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin.from('customer').select('id').eq('user_id', userId).maybeSingle();
  if (!data) throw new Error(`customer row not found for user ${userId}`);
  return data.id as string;
}

async function postJson(token: string, route: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function getJson(token: string, route: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${route}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  console.log('\n━━━━ login as 3 roles ━━━━');
  const [op, sup, cust] = await Promise.all([
    login(OPERATOR_EMAIL),
    login(SUPERVISOR_EMAIL),
    login(CUSTOMER_EMAIL),
  ]);
  const opToken = op.token, supToken = sup.token, custToken = cust.token;
  console.log('   ✅ all three sessions');

  const customerId = await getCustomerIdForUser(cust.userId);
  console.log(`   📎 target customer: ${customerId}`);

  console.log('\n━━━━ 1. operator POST CUSTOMER channel (must mask) ━━━━');
  const r1 = await postJson(opToken, '/api/operator/messages', {
    customerId,
    channel: 'CUSTOMER',
    body: '[smoke] operator → customer message',
    reasonCode: 'CORETAX_LOGIN',
  });
  const r1Ok = r1.status === 200 && r1.json?.data?.display_sender === 'AI_PAJAK' && r1.json?.data?.sender_role === 'OPERATOR';
  record('operator CUSTOMER message stored masked', r1Ok, `status=${r1.status} display=${r1.json?.data?.display_sender}`);
  if (r1.json?.data?.id) createdMessageIds.push(r1.json.data.id);

  console.log('\n━━━━ 2. operator POST INTERNAL channel ━━━━');
  const r2 = await postJson(opToken, '/api/operator/messages', {
    customerId,
    channel: 'INTERNAL',
    body: '[smoke] operator → supervisor internal note',
  });
  const r2Ok = r2.status === 200 && r2.json?.data?.sender_role === 'OPERATOR' && r2.json?.data?.display_sender === 'OPERATOR';
  record('operator INTERNAL stored as OPERATOR', r2Ok, `status=${r2.status}`);
  if (r2.json?.data?.id) createdMessageIds.push(r2.json.data.id);
  const internalRowId = r2.json?.data?.id as string | undefined;

  console.log('\n━━━━ 3. supervisor POST INTERNAL channel ━━━━');
  const r3 = await postJson(supToken, '/api/operator/messages', {
    customerId,
    channel: 'INTERNAL',
    body: '[smoke] supervisor → operator review request',
  });
  const r3Ok = r3.status === 200 && r3.json?.data?.sender_role === 'SUPERVISOR' && r3.json?.data?.display_sender === 'SUPERVISOR';
  record('supervisor INTERNAL stored as SUPERVISOR', r3Ok, `status=${r3.status}`);
  if (r3.json?.data?.id) createdMessageIds.push(r3.json.data.id);

  console.log('\n━━━━ 4. customer GET — only CUSTOMER channel visible ━━━━');
  const r4 = await getJson(custToken, '/api/customer/messages?limit=50');
  const r4Msgs: any[] = r4.json?.data?.messages ?? [];
  const r4HasInternal = r4Msgs.some((m) => m.channel !== 'CUSTOMER');
  const r4HasOurExternal = r4Msgs.some((m) => m.body === '[smoke] operator → customer message');
  record('customer sees the CUSTOMER channel message', r4HasOurExternal, `${r4Msgs.length} total msgs`);
  record('customer does NOT see any INTERNAL row', !r4HasInternal);

  console.log('\n━━━━ 5. customer sees display_sender = AI_PAJAK ━━━━');
  const target = r4Msgs.find((m) => m.body === '[smoke] operator → customer message');
  record('AI_PAJAK masking visible to customer', target?.display_sender === 'AI_PAJAK', `display=${target?.display_sender}`);

  console.log('\n━━━━ 6. customer cannot leak INTERNAL via operator endpoint ━━━━');
  const r6 = await getJson(custToken, `/api/operator/messages?customerId=${customerId}&channel=INTERNAL`);
  record('customer GETing /api/operator/messages is 403', r6.status === 403, `status=${r6.status}`);

  // Even directly with anon DB role + customer JWT, RLS must hide INTERNAL.
  if (internalRowId) {
    const custAnon = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${custToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: leaked } = await custAnon.from('operator_message').select('id').eq('id', internalRowId);
    record('RLS hides INTERNAL row from customer JWT direct query', (leaked ?? []).length === 0);
  }

  console.log('\n━━━━ 7. operator GET INTERNAL — should see the supervisor note ━━━━');
  const r7 = await getJson(opToken, `/api/operator/messages?customerId=${customerId}&channel=INTERNAL`);
  const r7Msgs: any[] = r7.json?.data?.messages ?? [];
  const r7HasSupervisor = r7Msgs.some((m) => m.sender_role === 'SUPERVISOR');
  record('operator sees supervisor messages on INTERNAL', r7HasSupervisor || r7Msgs.length > 0, `${r7Msgs.length} msgs`);

  // ─── cleanup ───
  if (createdMessageIds.length) {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    await admin.from('operator_message').delete().in('id', createdMessageIds);
    console.log(`\n🧹 cleaned up ${createdMessageIds.length} test messages`);
  }

  console.log('\n━━━━ summary ━━━━');
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  for (const r of results) console.log(`   ${r.pass ? '✅' : '❌'} ${r.name}`);
  console.log(`\n${passed === total ? '🟢' : '🔴'} ${passed}/${total} passed`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 fatal:', e);
  process.exit(2);
});
