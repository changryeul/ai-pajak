/**
 * Smoke test the corporate-plan and consultant-plan billing endpoints.
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-billing-flow.ts
 *
 * What it covers (the parts we can automate without a real browser):
 *   1. Sign in as a COMPANY customer → POST /api/billing/corporate-plan with planId
 *      → expect HTTP 200 + { snapToken } + new customer_subscription PENDING_PAYMENT row
 *   2. Sign in as the EXTERNAL consultant → POST /api/billing/consultant-plan with tierId
 *      → expect HTTP 200 + { snapToken } + new tax_partner_subscription PENDING_PAYMENT row
 *
 * What it does NOT cover (requires manual or webhook simulation):
 *   - Actual Midtrans checkout in the browser
 *   - The signed webhook flipping rows from PENDING_PAYMENT → ACTIVE
 *
 * Cleanup: leaves the PENDING_PAYMENT rows behind so you can manually
 * walk the UI through them. Run cleanupPendingSubscriptions() afterwards.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 ${envFile}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');

console.log(`🌐 base URL: ${baseUrl}`);

const PASSWORD = 'TestPassword123!';

async function login(email: string): Promise<string | null> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) {
    console.error(`   ❌ login failed for ${email}: ${error?.message ?? 'no session'}`);
    return null;
  }
  return data.session.access_token;
}

async function testCorporatePlan() {
  console.log('\n━━━━ 1. Corporate plan (BASIC) ━━━━');
  const email = 'company.test@example.com';
  const token = await login(email);
  if (!token) return;
  console.log(`   ✅ logged in as ${email}`);

  // Hit the API
  const res = await fetch(`${baseUrl}/api/billing/corporate-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId: 'BASIC', billingCycle: 'MONTHLY' }),
  });

  console.log(`   📡 POST /api/billing/corporate-plan → ${res.status}`);
  let body: { success?: boolean; data?: { subscriptionId?: string; orderId?: string; snapToken?: string }; error?: string };
  try {
    body = await res.json();
  } catch {
    body = { error: await res.text() };
  }

  if (res.status !== 200) {
    console.error(`   ❌ unexpected status: ${res.status}`);
    console.error(`      body: ${JSON.stringify(body).slice(0, 200)}`);
    return;
  }

  if (!body?.data?.snapToken) {
    console.error('   ❌ response missing snapToken');
    console.error(`      body: ${JSON.stringify(body).slice(0, 200)}`);
    return;
  }

  console.log(`   ✅ subscriptionId: ${body.data.subscriptionId}`);
  console.log(`   ✅ orderId: ${body.data.orderId}`);
  console.log(`   ✅ snapToken: ${body.data.snapToken.slice(0, 24)}…`);

  // Verify the row exists in customer_subscription as PENDING_PAYMENT
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: row } = await admin
    .from('customer_subscription')
    .select('id, status, plan_id, midtrans_order_id')
    .eq('id', body.data.subscriptionId)
    .maybeSingle();
  if (row?.status === 'PENDING_PAYMENT') {
    console.log(`   ✅ DB row PENDING_PAYMENT, plan_id=${row.plan_id}, midtrans_order_id=${row.midtrans_order_id}`);
  } else {
    console.error(`   ⚠️  DB row state: ${JSON.stringify(row)}`);
  }
}

async function testConsultantPlan() {
  console.log('\n━━━━ 2. Consultant tier (GROWTH) ━━━━');
  const email = 'external.consultant@mitrapajak.com';
  const token = await login(email);
  if (!token) return;
  console.log(`   ✅ logged in as ${email}`);

  const res = await fetch(`${baseUrl}/api/billing/consultant-plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tierId: 'GROWTH', billingCycle: 'MONTHLY' }),
  });

  console.log(`   📡 POST /api/billing/consultant-plan → ${res.status}`);
  let body: { success?: boolean; data?: { subscriptionId?: string; orderId?: string; snapToken?: string }; error?: string };
  try {
    body = await res.json();
  } catch {
    body = { error: await res.text() };
  }

  if (res.status !== 200) {
    console.error(`   ❌ unexpected status: ${res.status}`);
    console.error(`      body: ${JSON.stringify(body).slice(0, 200)}`);
    return;
  }

  if (!body?.data?.snapToken) {
    console.error('   ❌ response missing snapToken');
    console.error(`      body: ${JSON.stringify(body).slice(0, 200)}`);
    return;
  }

  console.log(`   ✅ subscriptionId: ${body.data.subscriptionId}`);
  console.log(`   ✅ orderId: ${body.data.orderId}`);
  console.log(`   ✅ snapToken: ${body.data.snapToken.slice(0, 24)}…`);

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: row } = await admin
    .from('tax_partner_subscription')
    .select('id, status, tier_id, midtrans_order_id')
    .eq('id', body.data.subscriptionId)
    .maybeSingle();
  if (row?.status === 'PENDING_PAYMENT') {
    console.log(`   ✅ DB row PENDING_PAYMENT, tier_id=${row.tier_id}, midtrans_order_id=${row.midtrans_order_id}`);
  } else {
    console.error(`   ⚠️  DB row state: ${JSON.stringify(row)}`);
  }
}

async function main() {
  console.log('💳 Billing flow smoke test\n');
  await testCorporatePlan();
  await testConsultantPlan();
  console.log('\n✨ Done.');
  console.log('\nNote: PENDING_PAYMENT rows remain in DB. Use the snapToken in a browser');
  console.log('with Midtrans Snap to complete the payment, or the rows will time out.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
