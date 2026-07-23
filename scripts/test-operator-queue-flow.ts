/**
 * Operator queue smoke test:
 *   1. Insert a synthetic queue row at PENDING for company.test
 *   2. supervisor.test calls /api/operator/queue PUT with action=review,
 *      then request-approval, then reject (to verify the reject action
 *      that the page UI was missing).
 *   3. Walk to PAYMENT_PENDING (Coretax era 실질 종료 상태) and assert the
 *      legacy verify-payment action is rejected with 400 (납부 = 신고).
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-operator-queue-flow.ts
 *
 * Cleans up the synthetic row at the end.
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

async function login(email: string): Promise<string | null> {
  const c = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`);
    return null;
  }
  return data.session.access_token;
}

async function callQueueAction(token: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/operator/queue`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let json: { success?: boolean; error?: string; data?: { status?: string } };
  try {
    json = await res.json();
  } catch {
    json = { error: await res.text() };
  }
  return { status: res.status, json };
}

async function main() {
  console.log('🧾 Operator queue + payment-proof smoke test\n');

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── Setup: get the COMPANY customer + supervisor user ───
  const { data: customer } = await admin
    .from('customer')
    .select('id, full_name')
    .eq('email', 'company.test@example.com')
    .maybeSingle();
  if (!customer) {
    console.error('❌ company.test customer not found');
    process.exit(1);
  }
  console.log(`📌 customer: ${customer.full_name} (${customer.id})`);

  // Insert a synthetic queue row at PENDING. Use unique tax_period to avoid
  // the unique constraint on (customer_id, tax_type, tax_period_*).
  const period = 99; // sentinel month
  const year = 9999;
  // Cleanup any leftovers from previous failed runs
  await admin
    .from('djp_submission_queue')
    .delete()
    .eq('customer_id', customer.id)
    .eq('tax_period_month', period)
    .eq('tax_period_year', year);

  const { data: queueRow, error: insertErr } = await admin
    .from('djp_submission_queue')
    .insert({
      customer_id: customer.id,
      tax_type: 'PPh21',
      tax_period_month: period,
      tax_period_year: year,
      amount: 1_000_000,
      status: 'PENDING',
    })
    .select('id, status')
    .single();

  if (insertErr || !queueRow) {
    console.error('❌ insert error:', insertErr?.message);
    process.exit(1);
  }
  console.log(`📦 queue row: ${queueRow.id} (${queueRow.status})`);
  const queueItemId = queueRow.id;

  // ─── Step 1: supervisor calls review (PENDING → DATA_REVIEW) ───
  console.log('\n━━ 1. supervisor.test → review ━━');
  const supervisorToken = await login('supervisor.test@aipajak.com');
  if (!supervisorToken) return;
  const r1 = await callQueueAction(supervisorToken, { id: queueItemId, action: 'review' });
  console.log(`   ${r1.status}  →  status=${r1.json.data?.status ?? '—'}  ${r1.json.error ?? ''}`);

  // ─── Step 2: request-approval (DATA_REVIEW → PENDING_APPROVAL) ───
  console.log('\n━━ 2. supervisor.test → request-approval ━━');
  const r2 = await callQueueAction(supervisorToken, { id: queueItemId, action: 'request-approval' });
  console.log(`   ${r2.status}  →  status=${r2.json.data?.status ?? '—'}  ${r2.json.error ?? ''}`);

  // ─── Step 3: reject (PENDING_APPROVAL → DATA_REVIEW) — the action whose UI was missing ───
  console.log('\n━━ 3. supervisor.test → reject (UI was missing) ━━');
  const r3 = await callQueueAction(supervisorToken, {
    id: queueItemId,
    action: 'reject',
    rejectedReason: 'Smoke test rejection — non-real data',
  });
  console.log(`   ${r3.status}  →  status=${r3.json.data?.status ?? '—'}  ${r3.json.error ?? ''}`);

  // ─── Step 4: re-approve flow → bring it to PAYMENT_PENDING so customer can upload proof ───
  console.log('\n━━ 4. Walk through to PAYMENT_PENDING ━━');
  await callQueueAction(supervisorToken, { id: queueItemId, action: 'request-approval' });
  await callQueueAction(supervisorToken, { id: queueItemId, action: 'approve' });
  await callQueueAction(supervisorToken, {
    id: queueItemId,
    action: 'generate-ebilling',
    ebillingCode: 'TEST-EBILL-001',
  });
  const r5 = await callQueueAction(supervisorToken, { id: queueItemId, action: 'notify-customer' });
  console.log(`   notify-customer → status=${r5.json.data?.status ?? '—'}`);

  // ─── Step 5: Coretax era 계약 검증 — 구방식 액션은 400 으로 거부돼야 한다 ───
  console.log('\n━━ 5. 구방식 legacy 액션 거부 검증 (verify-payment → 400) ━━');
  const legacyRes = await callQueueAction(supervisorToken, { id: queueItemId, action: 'verify-payment' });
  if (legacyRes.status === 400) {
    console.log(`   ✓ verify-payment 거부됨 (${legacyRes.status}): ${legacyRes.json.error ?? ''}`);
  } else {
    console.error(`   ❌ verify-payment 가 거부되지 않음 — status ${legacyRes.status}`);
    process.exit(1);
  }

  // ─── Verify final DB state — PAYMENT_PENDING 이 실질 종료 상태 ───
  const { data: finalRow } = await admin
    .from('djp_submission_queue')
    .select('id, status, ebilling_code')
    .eq('id', queueItemId)
    .maybeSingle();
  console.log(`\n📊 final row: status=${finalRow?.status}, ebilling=${finalRow?.ebilling_code}`);
  if (finalRow?.status !== 'PAYMENT_PENDING') {
    console.error(`   ❌ expected PAYMENT_PENDING, got ${finalRow?.status}`);
    process.exit(1);
  }

  // ─── Cleanup ───
  console.log('\n🧹 Cleanup');
  await admin.from('djp_submission_queue').delete().eq('id', queueItemId);
  console.log(`   deleted queue row ${queueItemId}`);

  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
