/**
 * Verify GET /api/operator/spt-masa-requests — operator 의 검토 대기 list.
 *
 *   1. CONSULTANT GET → 403
 *   2. CUSTOMER GET → 403
 *   3. OPERATOR GET (empty) → 200 data array
 *   4. seed 2 PENDING + 1 PROCESSED for this customer
 *   5. OPERATOR GET status=PENDING → 2 rows visible (sentinel customer)
 *   6. OPERATOR GET status=PENDING with taxType filter → 1 row
 *   7. OPERATOR GET status=ALL → 3 rows
 *   8. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-operator-spt-masa-requests-list.ts
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
const CUSTOMER_ID = '00000000-0000-4000-8000-000000000011';
const PERIOD_PEND_1 = '2099-08';
const PERIOD_PEND_2 = '2099-09';
const PERIOD_PROC = '2099-10';

async function login(email: string, password: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`login failed: ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function main() {
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  let pass = 0, fail = 0;

  // Pre-cleanup our 3 sentinel rows.
  await sbAdmin.from('spt_masa_submission_request').delete()
    .eq('customer_id', CUSTOMER_ID)
    .in('tax_period', [PERIOD_PEND_1, PERIOD_PEND_2, PERIOD_PROC]);

  // 1. CONSULTANT GET → 403
  const consultantToken = await login('external.consultant@mitrapajak.com', 'TestPassword123!');
  const r1 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=PENDING`, {
    headers: { Authorization: `Bearer ${consultantToken}` },
  });
  if (r1.status === 403) { console.log('✅ 1. CONSULTANT GET → 403'); pass++; }
  else { console.error('✗ 1. status=', r1.status); fail++; }

  // 2. CUSTOMER GET → 403
  const customerToken = await login('company.test@example.com', 'TestPassword123!');
  const r2 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=PENDING`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  if (r2.status === 403) { console.log('✅ 2. CUSTOMER GET → 403'); pass++; }
  else { console.error('✗ 2. status=', r2.status); fail++; }

  // 3. OPERATOR GET → 200 + data array
  const operatorToken = await login('operator.test@aipajak.com', 'TestPassword123!');
  const r3 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=PENDING&limit=200`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  const j3 = await r3.json();
  if (r3.status === 200 && Array.isArray(j3.data)) {
    console.log(`✅ 3. OPERATOR GET → ${j3.data.length} pending (global)`); pass++;
  } else { console.error('✗ 3.', r3.status, j3); fail++; }

  // 4. Seed 2 PENDING (PPh23 + PPh21) + 1 PROCESSED (PPN)
  await sbAdmin.from('spt_masa_submission_request').insert([
    { customer_id: CUSTOMER_ID, tax_type: 'PPh23', tax_period: PERIOD_PEND_1, status: 'PENDING' },
    { customer_id: CUSTOMER_ID, tax_type: 'PPh21', tax_period: PERIOD_PEND_2, status: 'PENDING' },
    { customer_id: CUSTOMER_ID, tax_type: 'PPN',   tax_period: PERIOD_PROC,   status: 'PROCESSED', processed_at: new Date().toISOString() },
  ]);
  console.log('✅ 4. seed 2 PENDING + 1 PROCESSED'); pass++;

  // 5. OPERATOR GET status=PENDING → sentinel customer 2 rows present
  const r5 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=PENDING&limit=200`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  const j5 = await r5.json();
  const sentinelPending = (j5.data ?? []).filter((r: { customerId: string; taxPeriod: string }) =>
    r.customerId === CUSTOMER_ID && [PERIOD_PEND_1, PERIOD_PEND_2].includes(r.taxPeriod),
  );
  if (r5.status === 200 && sentinelPending.length === 2) {
    console.log('✅ 5. PENDING filter → 2 sentinel rows visible'); pass++;
  } else { console.error('✗ 5. got', sentinelPending.length, 'sentinel pending'); fail++; }

  // 6. taxType filter
  // 2026-06-26: prod 에 sentinel customer 의 실 PPh21 PENDING 행이 함께 있을
  // 수 있어 sentinel period 까지 filter (PERIOD_PEND_2 = '2099-09', 우리 seed 만 매칭).
  const r6 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=PENDING&taxType=PPh21&limit=200`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  const j6 = await r6.json();
  const sentinel6 = (j6.data ?? []).filter((r: { customerId: string; taxType: string; taxPeriod: string }) =>
    r.customerId === CUSTOMER_ID && r.taxType === 'PPh21' && r.taxPeriod === PERIOD_PEND_2,
  );
  if (r6.status === 200 && sentinel6.length === 1) {
    console.log('✅ 6. taxType=PPh21 filter → 1 sentinel'); pass++;
  } else { console.error('✗ 6. got', sentinel6.length); fail++; }

  // 7. status=ALL
  const r7 = await fetch(`${BASE_URL}/api/operator/spt-masa-requests?status=ALL&limit=200`, {
    headers: { Authorization: `Bearer ${operatorToken}` },
  });
  const j7 = await r7.json();
  const sentinel7 = (j7.data ?? []).filter((r: { customerId: string; taxPeriod: string }) =>
    r.customerId === CUSTOMER_ID && [PERIOD_PEND_1, PERIOD_PEND_2, PERIOD_PROC].includes(r.taxPeriod),
  );
  if (r7.status === 200 && sentinel7.length === 3) {
    console.log('✅ 7. status=ALL → all 3 sentinel rows'); pass++;
  } else { console.error('✗ 7. got', sentinel7.length); fail++; }

  // 8. Cleanup
  await sbAdmin.from('spt_masa_submission_request').delete()
    .eq('customer_id', CUSTOMER_ID)
    .in('tax_period', [PERIOD_PEND_1, PERIOD_PEND_2, PERIOD_PROC]);
  console.log('✅ 8. cleanup'); pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
