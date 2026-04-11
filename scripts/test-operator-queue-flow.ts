/**
 * Operator queue smoke test:
 *   1. Insert a synthetic queue row at PENDING for company.test
 *   2. supervisor.test calls /api/operator/queue PUT with action=review,
 *      then request-approval, then reject (to verify the reject action
 *      that the page UI was missing).
 *   3. Customer (company.test) uploads payment proof via the
 *      /api/customer/payment-proof endpoint to verify the column-name fix.
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

  // ─── Step 5: customer uploads payment proof — this exercises the
  //     payment-proof fix (updated_by removed, audit_log columns corrected)
  console.log('\n━━ 5. company.test → /api/customer/payment-proof (PAYMENT_PENDING → PAYMENT_UPLOADED) ━━');
  const customerToken = await login('company.test@example.com');
  if (!customerToken) return;
  const proofRes = await fetch(`${baseUrl}/api/customer/payment-proof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({
      queueItemId,
      paymentAmount: 1_000_000,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentProofUrl: 'https://example.com/receipt-test.pdf',
    }),
  });
  const proofJson = await proofRes.json();
  console.log(`   ${proofRes.status}  →  ${JSON.stringify(proofJson).slice(0, 200)}`);

  // ─── Verify final DB state ───
  const { data: finalRow } = await admin
    .from('djp_submission_queue')
    .select('id, status, payment_proof_url, payment_amount')
    .eq('id', queueItemId)
    .maybeSingle();
  console.log(`\n📊 final row: status=${finalRow?.status}, proof=${finalRow?.payment_proof_url}, amount=${finalRow?.payment_amount}`);

  // Was an audit_log row inserted?
  const { data: auditRows } = await admin
    .from('audit_log')
    .select('activity_type, activity_details')
    .eq('actor_user_id', (await admin.auth.admin.getUserById(
      (await admin.from('customer').select('user_id').eq('id', customer.id).single()).data?.user_id || ''
    )).data?.user?.id || '')
    .order('created_at', { ascending: false })
    .limit(3);
  if (auditRows && auditRows.length > 0) {
    console.log(`\n📝 latest audit_log rows for company.test:`);
    auditRows.forEach((r) => console.log(`   - ${r.activity_type}: ${JSON.stringify(r.activity_details).slice(0, 80)}`));
  } else {
    console.log('\n📝 no audit_log rows found (insert may have silently failed)');
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
