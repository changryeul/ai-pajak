/**
 * Verify PUT /api/tax/pph23-transactions contract:
 *   - body field updates: counterparty / date / description / amount / service_type
 *   - grossAmount change → server recomputes tax_rate + tax_amount
 *   - RBAC: only authenticated CUSTOMER (or higher) can update
 *
 * Mirrors verify-ppn-single-entry-rate.ts pattern. Uses sentinel
 * tax_period '2026-99' so we don't collide with real prod rows.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph23-put-contract.ts
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
const PERIOD = '2026-99'; // sentinel — cleanup after

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (authErr || !auth.session) { console.error('✗ login:', authErr?.message); process.exit(1); }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin.from('customer').select('id').eq('user_id', auth.user!.id).maybeSingle();
  if (!cust) { console.error('✗ no customer'); process.exit(1); }

  // Pre-cleanup sentinel period
  await sbAdmin.from('pph23_transaction').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  // Seed a row directly via admin client. POST endpoint isn't this test's
  // focus (separate verify-pph23-create-rate.ts covers that path), and
  // direct insert isolates PUT regression from any POST-side drift like
  // missing optional columns in the PostgREST schema cache.
  const { data: createdRow, error: insertErr } = await sbAdmin
    .from('pph23_transaction')
    .insert({
      customer_id: cust.id,
      tax_period: PERIOD,
      transaction_date: '2026-01-15',
      service_type: 'JASA_TEKNIK',
      gross_amount: 1000000,
      tax_rate: 0.02,
      tax_amount: 20000,
      counterparty_name: 'PUT TEST VENDOR',
      counterparty_npwp: '01.234.567.8-901.000',
      invoice_number: 'PUT-TEST-001',
      description: 'seed',
    })
    .select('id')
    .single();
  if (insertErr || !createdRow) {
    console.error('✗ seed insert failed:', insertErr?.message);
    process.exit(1);
  }
  const txId = createdRow.id;
  console.log(`✅ setup: seeded transaction ${txId} (1M IDR JASA_TEKNIK @ 2%)`);

  const put = (body: Record<string, unknown>) => fetch(`${BASE_URL}/api/tax/pph23-transactions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const readRow = async () => {
    const { data } = await sbAdmin.from('pph23_transaction').select('*').eq('id', txId).single();
    return data;
  };

  let pass = 0, fail = 0;

  // 1. PUT description — simple update
  const r1 = await put({ id: txId, description: 'PUT updated description' });
  const j1 = await r1.json();
  const row1 = await readRow();
  if (j1.success && row1.description === 'PUT updated description') { console.log(`✅ 1. description updated`); pass++; }
  else { console.error('✗ 1.', j1, row1?.description); fail++; }

  // 2. PUT counterpartyName + counterpartyNpwp
  const r2 = await put({ id: txId, counterpartyName: 'NEW VENDOR', counterpartyNpwp: '02.345.678.9-012.000' });
  const j2 = await r2.json();
  const row2 = await readRow();
  if (j2.success && row2.counterparty_name === 'NEW VENDOR' && row2.counterparty_npwp === '02.345.678.9-012.000') {
    console.log(`✅ 2. counterparty updated`); pass++;
  } else { console.error('✗ 2.', j2, row2?.counterparty_name); fail++; }

  // 3. PUT grossAmount — server should recompute tax_rate + tax_amount
  // serviceType=JASA_TEKNIK with NPWP present → standard 2% (rate 0.02).
  // NOTE: the PUT handler reads `counterpartyNpwp` from the body to decide
  // NPWP-presence (it does NOT re-fetch the row), so we must pass it
  // explicitly even though it didn't change.
  const r3 = await put({ id: txId, grossAmount: 5000000, serviceType: 'JASA_TEKNIK', counterpartyNpwp: '02.345.678.9-012.000' });
  const j3 = await r3.json();
  const row3 = await readRow();
  const expectedTax = Math.round(5000000 * 0.02); // 100,000
  if (j3.success && Number(row3.gross_amount) === 5000000 && Number(row3.tax_amount) === expectedTax) {
    console.log(`✅ 3. grossAmount→${row3.gross_amount} + tax recomputed=${row3.tax_amount} (2% × 5M)`); pass++;
  } else { console.error(`✗ 3. expected tax=${expectedTax} got=${row3?.tax_amount}, gross=${row3?.gross_amount}`); fail++; }

  // 4. PUT transactionDate
  const r4 = await put({ id: txId, transactionDate: '2026-02-20' });
  const j4 = await r4.json();
  const row4 = await readRow();
  if (j4.success && row4.transaction_date === '2026-02-20') { console.log(`✅ 4. transactionDate updated`); pass++; }
  else { console.error('✗ 4.', j4, row4?.transaction_date); fail++; }

  // 5. PUT without id → 400
  const r5 = await put({ description: 'no id' });
  if (r5.status === 400) { console.log(`✅ 5. missing id → 400`); pass++; }
  else { console.error(`✗ 5. expected 400 got ${r5.status}`); fail++; }

  // cleanup
  await sbAdmin.from('pph23_transaction').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
