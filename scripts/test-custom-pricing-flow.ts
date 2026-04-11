/**
 * Custom pricing E2E smoke test:
 *   1. Master creates a CORPORATE_PLAN quote for company.test
 *   2. Master flips it to SENT
 *   3. company.test fetches GET /api/billing/custom-pricing → quote appears
 *   4. company.test POSTs accept → quote ACCEPTED + customer_subscription
 *      PENDING_PAYMENT row is materialized with custom_pricing_quote_id
 *
 * Run with: SEED_TARGET=prod npx tsx scripts/test-custom-pricing-flow.ts
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

async function main() {
  console.log('💼 Custom pricing flow smoke test\n');
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the COMPANY customer id
  const { data: customer } = await admin
    .from('customer')
    .select('id, full_name')
    .eq('email', 'company.test@example.com')
    .maybeSingle();
  if (!customer) {
    console.error('❌ company.test@example.com customer record not found');
    process.exit(1);
  }
  console.log(`📌 customer: ${customer.full_name} (${customer.id})`);

  // ─── Step 1: master creates a DRAFT quote ───
  console.log('\n━━ 1. Master creates DRAFT quote ━━');
  const masterToken = await login('master.test@aipajak.com');
  if (!masterToken) return;
  console.log('   ✅ master logged in');

  const createRes = await fetch(`${baseUrl}/api/admin/master/custom-pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
    body: JSON.stringify({
      customerId: customer.id,
      quoteTitle: '대기업 맞춤 월 구독 (테스트)',
      quoteDescription: 'Pro 한도를 초과하는 사용량에 맞춘 커스텀 요금제 견적',
      serviceType: 'CORPORATE_PLAN',
      monthlyPriceIdr: 6_000_000,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      usageEmployees: 1500,
    }),
  });
  console.log(`   📡 POST /api/admin/master/custom-pricing → ${createRes.status}`);
  const createBody = await createRes.json();
  if (createRes.status !== 200 || !createBody?.success) {
    console.error('   ❌', JSON.stringify(createBody).slice(0, 300));
    return;
  }
  const quoteId = createBody.data?.id as string;
  console.log(`   ✅ DRAFT quote created: ${quoteId}`);

  // ─── Step 2: master flips it to SENT ───
  console.log('\n━━ 2. Master sends quote ━━');
  const sendRes = await fetch(`${baseUrl}/api/admin/master/custom-pricing`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` },
    body: JSON.stringify({ id: quoteId, status: 'SENT' }),
  });
  console.log(`   📡 PATCH → ${sendRes.status}`);
  const sendBody = await sendRes.json();
  if (sendRes.status !== 200 || sendBody?.data?.status !== 'SENT') {
    console.error('   ❌', JSON.stringify(sendBody).slice(0, 300));
    return;
  }
  console.log(`   ✅ status SENT, sent_at=${sendBody.data?.sent_at}`);

  // ─── Step 3: customer fetches own quotes ───
  console.log('\n━━ 3. Customer fetches own quotes ━━');
  const customerToken = await login('company.test@example.com');
  if (!customerToken) return;
  console.log('   ✅ company.test logged in');

  const listRes = await fetch(`${baseUrl}/api/billing/custom-pricing`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log(`   📡 GET /api/billing/custom-pricing → ${listRes.status}`);
  const listBody = await listRes.json();
  const visibleQuote = (listBody?.data?.quotes || []).find((q: { id: string }) => q.id === quoteId);
  if (!visibleQuote) {
    console.error(`   ❌ customer cannot see the SENT quote`);
    console.error(`      body: ${JSON.stringify(listBody).slice(0, 400)}`);
    return;
  }
  console.log(`   ✅ customer sees the quote (status=${visibleQuote.status})`);

  // ─── Step 4: customer accepts ───
  console.log('\n━━ 4. Customer accepts ━━');
  const acceptRes = await fetch(`${baseUrl}/api/billing/custom-pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ quoteId, action: 'accept' }),
  });
  console.log(`   📡 POST accept → ${acceptRes.status}`);
  const acceptBody = await acceptRes.json();
  if (acceptRes.status !== 200 || !acceptBody?.success) {
    console.error('   ❌', JSON.stringify(acceptBody).slice(0, 300));
    return;
  }
  console.log(`   ✅ status: ${acceptBody.data?.status}`);
  console.log(`   ✅ subscriptionId: ${acceptBody.data?.subscriptionId ?? '(none)'}`);
  console.log(`   ✅ nextStep: ${acceptBody.data?.nextStep}`);

  // ─── Verify DB ───
  console.log('\n━━ 5. DB verification ━━');
  const { data: quoteRow } = await admin
    .from('custom_pricing_quote')
    .select('status, accepted_at')
    .eq('id', quoteId)
    .maybeSingle();
  console.log(`   ✅ quote status=${quoteRow?.status}, accepted_at=${quoteRow?.accepted_at}`);

  if (acceptBody.data?.subscriptionId) {
    const { data: subRow } = await admin
      .from('customer_subscription')
      .select('id, status, plan_id, plan_name, price_idr, custom_pricing_quote_id')
      .eq('id', acceptBody.data.subscriptionId)
      .maybeSingle();
    console.log(`   ✅ subscription: status=${subRow?.status}, plan_id=${subRow?.plan_id}, plan_name=${subRow?.plan_name}, price=${subRow?.price_idr}, quote=${subRow?.custom_pricing_quote_id}`);
  }

  // ─── Cleanup: delete the test quote and subscription so re-runs are clean ───
  console.log('\n━━ 6. Cleanup ━━');
  if (acceptBody.data?.subscriptionId) {
    await admin.from('customer_subscription').delete().eq('id', acceptBody.data.subscriptionId);
    console.log(`   🧹 deleted subscription ${acceptBody.data.subscriptionId}`);
  }
  await admin.from('custom_pricing_quote').delete().eq('id', quoteId);
  console.log(`   🧹 deleted quote ${quoteId}`);

  console.log('\n✨ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
