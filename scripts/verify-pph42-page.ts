/**
 * Verify the PPh 4(2) partial view: GET /api/tax/pph23-transactions?regime=PPH4_2
 * returns ONLY tax_regime=PPH4_2 rows at 10% rate.
 *
 * Seeds 1 PPh23 + 1 PPh4(2) sentinel row directly into pph23_transaction,
 * then asserts both:
 *   - regime=PPH4_2 list returns 1 row (the 10% one)
 *   - regime=PPH23 list returns 1 row (the 2% jasa one)
 * Cleans up afterwards.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph42-page.ts
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
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const PERIOD = '2099-04';

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  let pass = 0, fail = 0;

  // 1. Login + customer
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (authErr || !auth.session) { console.error('✗ login:', authErr?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin.from('customer').select('id').eq('user_id', auth.user!.id).maybeSingle();
  if (!cust) { console.error('✗ no customer'); process.exit(1); }
  const customerId = cust.id;
  console.log(`✅ 1. login + customer ${customerId}`); pass++;

  // 2. Pre-cleanup
  await sbAdmin.from('pph23_transaction').delete().eq('customer_id', customerId).eq('tax_period', PERIOD);
  console.log(`✅ 2. pre-cleanup sentinel ${PERIOD}`); pass++;

  // 3. Seed 1 PPh23 jasa (2%) + 1 PPh4(2) sewa (10%)
  const seedRows = [
    {
      customer_id: customerId, tax_period: PERIOD, transaction_date: '2099-04-05',
      description: 'Jasa konsultasi', service_type: 'JASA_KONSULTAN', income_type: 'JASA_LAINNYA',
      tax_regime: 'PPH23', invoice_number: 'INV-A-001',
      gross_amount: 10_000_000, tax_rate: 0.02, tax_amount: 200_000,
      counterparty_name: 'PT Konsultan Demo', counterparty_npwp: '01.111.111.1-001.000',
    },
    {
      customer_id: customerId, tax_period: PERIOD, transaction_date: '2099-04-12',
      description: '[PPh4(2)] Sewa kantor April 2099', service_type: 'SEWA', income_type: 'SEWA',
      tax_regime: 'PPH4_2', rental_asset_type: 'BUILDING_LAND', invoice_number: 'INV-B-002',
      gross_amount: 30_000_000, tax_rate: 0.10, tax_amount: 3_000_000,
      counterparty_name: 'PT Gedung Demo', counterparty_npwp: '02.222.222.2-002.000',
    },
  ];
  const { error: seedErr } = await sbAdmin.from('pph23_transaction').insert(seedRows);
  if (seedErr) { console.error('✗ 3. seed:', seedErr.message); process.exit(1); }
  console.log(`✅ 3. seed 1 PPh23 (2%) + 1 PPh4(2) (10%)`); pass++;

  // 4. GET regime=PPH4_2 → only 1 row, must be 10%
  const r42 = await fetch(`${BASE_URL}/api/tax/pph23-transactions?customerId=${customerId}&period=${PERIOD}&regime=PPH4_2`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j42 = await r42.json();
  const list42 = j42?.data?.transactions || [];
  if (
    r42.status === 200 &&
    list42.length === 1 &&
    list42[0].tax_regime === 'PPH4_2' &&
    Number(list42[0].tax_rate) === 0.10 &&
    list42[0].counterparty_name === 'PT Gedung Demo'
  ) {
    console.log(`✅ 4. regime=PPH4_2 → 1 row (PT Gedung Demo @ 10%)`);
    pass++;
  } else {
    console.error(`✗ 4. regime=PPH4_2 unexpected — got ${list42.length} rows`, list42[0]);
    fail++;
  }

  // 5. GET regime=PPH23 → only 1 row, must be 2%
  const r23 = await fetch(`${BASE_URL}/api/tax/pph23-transactions?customerId=${customerId}&period=${PERIOD}&regime=PPH23`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j23 = await r23.json();
  const list23 = j23?.data?.transactions || [];
  if (
    r23.status === 200 &&
    list23.length === 1 &&
    list23[0].tax_regime !== 'PPH4_2' &&
    Number(list23[0].tax_rate) === 0.02 &&
    list23[0].counterparty_name === 'PT Konsultan Demo'
  ) {
    console.log(`✅ 5. regime=PPH23 → 1 row (PT Konsultan Demo @ 2%)`);
    pass++;
  } else {
    console.error(`✗ 5. regime=PPH23 unexpected — got ${list23.length} rows`, list23[0]);
    fail++;
  }

  // 6. GET no regime → both rows
  const rAll = await fetch(`${BASE_URL}/api/tax/pph23-transactions?customerId=${customerId}&period=${PERIOD}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const jAll = await rAll.json();
  const listAll = jAll?.data?.transactions || [];
  if (rAll.status === 200 && listAll.length === 2) {
    console.log(`✅ 6. no regime filter → 2 rows total`);
    pass++;
  } else {
    console.error(`✗ 6. expected 2 rows total, got ${listAll.length}`);
    fail++;
  }

  // 7. Cleanup
  await sbAdmin.from('pph23_transaction').delete().eq('customer_id', customerId).eq('tax_period', PERIOD);
  console.log(`✅ 7. cleanup`); pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
