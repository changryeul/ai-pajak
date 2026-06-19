/**
 * Verify the server-side spt_masa_submission_request flow (옵션 B).
 *
 *   1. CUSTOMER GET (empty) → 200 data=null
 *   2. CUSTOMER POST → 200 (creates PENDING row)
 *   3. CUSTOMER GET → 200 status=PENDING
 *   4. CUSTOMER POST again → upsert (same row, requested_at refreshed)
 *   5. OPERATOR create SPT Masa → automatically marks request PROCESSED
 *   6. CUSTOMER GET → status=PROCESSED + filing_id set
 *   7. CUSTOMER DELETE on new period → CANCELLED row
 *   8. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-spt-masa-request.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`✗ ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUSTOMER_EMAIL = 'company.test@example.com';
const OPERATOR_EMAIL = 'operator.test@aipajak.com';
const TEST_PASSWORD = 'TestPassword123!';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';
const PERIOD = '2099-06';
const PERIOD_2 = '2099-07';

async function login(email: string, password: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login failed: ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  let pass = 0, fail = 0;

  // Pre-cleanup
  await sbAdmin.from('spt_masa_submission_request').delete()
    .eq('customer_id', CUSTOMER_ID).in('tax_period', [PERIOD, PERIOD_2]);
  await sbAdmin.from('tax_filing').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').in('tax_period', [PERIOD, PERIOD_2]);

  const customerToken = await login(CUSTOMER_EMAIL, TEST_PASSWORD);
  const operatorToken = await login(OPERATOR_EMAIL, TEST_PASSWORD);

  // 1. GET empty
  const r1 = await fetch(`${BASE_URL}/api/customer/spt-masa-request?taxType=PPh23&period=${PERIOD}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const j1 = await r1.json();
  if (r1.status === 200 && j1.data === null) { console.log('✅ 1. GET empty → data=null'); pass++; }
  else { console.error('✗ 1.', r1.status, j1); fail++; }

  // 2. POST → PENDING
  const r2 = await fetch(`${BASE_URL}/api/customer/spt-masa-request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taxType: 'PPh23', period: PERIOD }),
  });
  const j2 = await r2.json();
  if (r2.status === 200 && j2.data?.status === 'PENDING') {
    console.log(`✅ 2. POST → PENDING (${j2.data.id.slice(0,8)})`); pass++;
  } else { console.error('✗ 2.', r2.status, j2); fail++; }

  // 3. GET → PENDING
  const r3 = await fetch(`${BASE_URL}/api/customer/spt-masa-request?taxType=PPh23&period=${PERIOD}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const j3 = await r3.json();
  if (r3.status === 200 && j3.data?.status === 'PENDING' && j3.data.requested_at) {
    console.log('✅ 3. GET → PENDING + requested_at'); pass++;
  } else { console.error('✗ 3.', r3.status, j3); fail++; }
  const firstRequestedAt = j3.data?.requested_at;

  // 4. POST again → upsert, requested_at refreshed
  await new Promise((res) => setTimeout(res, 100));
  const r4 = await fetch(`${BASE_URL}/api/customer/spt-masa-request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taxType: 'PPh23', period: PERIOD }),
  });
  const j4 = await r4.json();
  const { count } = await sbAdmin.from('spt_masa_submission_request')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').eq('tax_period', PERIOD);
  if (r4.status === 200 && j4.data?.requested_at !== firstRequestedAt && count === 1) {
    console.log('✅ 4. POST upsert (same row, refreshed timestamp)'); pass++;
  } else {
    console.error('✗ 4. expected single row + refreshed ts, got count=', count, 'sameTs=', j4.data?.requested_at === firstRequestedAt);
    fail++;
  }

  // 5. OPERATOR creates SPT Masa → mark PROCESSED
  const r5 = await fetch(`${BASE_URL}/api/operator/spt-masa/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${operatorToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: CUSTOMER_ID, taxType: 'PPh23', period: PERIOD }),
  });
  const j5 = await r5.json();
  if (r5.status === 200 && j5.success && j5.filingId) {
    console.log(`✅ 5. operator SPT Masa created — filing ${String(j5.filingId).slice(0,8)}`); pass++;
  } else { console.error('✗ 5.', r5.status, j5); fail++; }

  // 6. GET → PROCESSED + filing_id set
  const r6 = await fetch(`${BASE_URL}/api/customer/spt-masa-request?taxType=PPh23&period=${PERIOD}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const j6 = await r6.json();
  if (r6.status === 200 && j6.data?.status === 'PROCESSED' && j6.data?.filing_id && j6.data?.processed_at) {
    console.log(`✅ 6. GET → PROCESSED + filing_id=${String(j6.data.filing_id).slice(0,8)}`); pass++;
  } else { console.error('✗ 6.', r6.status, j6); fail++; }

  // 7. DELETE on a fresh period (PENDING → CANCELLED)
  await fetch(`${BASE_URL}/api/customer/spt-masa-request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ taxType: 'PPh23', period: PERIOD_2 }),
  });
  const r7 = await fetch(`${BASE_URL}/api/customer/spt-masa-request?taxType=PPh23&period=${PERIOD_2}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const r7g = await fetch(`${BASE_URL}/api/customer/spt-masa-request?taxType=PPh23&period=${PERIOD_2}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const j7g = await r7g.json();
  if (r7.status === 200 && j7g.data?.status === 'CANCELLED') {
    console.log('✅ 7. DELETE → CANCELLED'); pass++;
  } else { console.error('✗ 7.', r7.status, r7g.status, j7g); fail++; }

  // 8. Cleanup
  await sbAdmin.from('spt_masa_submission_request').delete()
    .eq('customer_id', CUSTOMER_ID).in('tax_period', [PERIOD, PERIOD_2]);
  await sbAdmin.from('tax_filing').delete()
    .eq('customer_id', CUSTOMER_ID).eq('tax_type', 'PPh23').in('tax_period', [PERIOD, PERIOD_2]);
  console.log('✅ 8. cleanup'); pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
