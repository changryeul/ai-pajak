/**
 * Verify POST /api/tax/pph26-transactions/import contract:
 *   1. Auth + customer lookup
 *   2. Pre-cleanup sentinel period 2026-94
 *   3. POST 3-row CSV via /import → 200, insertedCount=3
 *   4. GET rows back via /api/tax/pph26-transactions → 3 rows w/ income_type +
 *      tax_amount = round(gross * 0.20)
 *   5. Cleanup
 *
 * Mirrors the verify-pph23-put-contract.ts pattern. Uses sentinel
 * tax_period '2026-94' so we don't collide with real prod rows.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-pph26-import-contract.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) {
  console.error(`✗ ${envFile} not found`);
  process.exit(1);
}
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';
const PERIOD = '2026-94'; // sentinel — cleanup after

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  let pass = 0;
  let fail = 0;

  // 1. Auth + customer lookup
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error('✗ login:', authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;
  const { data: cust } = await sbAdmin
    .from('customer')
    .select('id')
    .eq('user_id', auth.user!.id)
    .maybeSingle();
  if (!cust) {
    console.error('✗ no customer');
    process.exit(1);
  }
  console.log(`✅ 1. login + customer ${cust.id}`);
  pass++;

  // 2. Pre-cleanup sentinel period
  await sbAdmin
    .from('pph26_transaction')
    .delete()
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD);
  console.log(`✅ 2. pre-cleanup sentinel ${PERIOD}`);
  pass++;

  // 3. Build small CSV + POST /import
  const csv = [
    'transaction_date,income_type,gross_amount,counterparty_name,counterparty_npwp,invoice_number,description',
    '2026-01-15,DIVIDEND,10000000,GOOGLE LLC,,INV-D-001,Quarterly dividend',
    '2026-01-20,INTEREST,5000000,BANK OF TOKYO,,INV-I-001,Loan interest',
    '2026-01-25,ROYALTY,7500000,MICROSOFT INC,,INV-R-001,Software royalty',
  ].join('\n');

  const importRes = await fetch(`${BASE_URL}/api/tax/pph26-transactions/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId: cust.id, taxPeriod: PERIOD, csvContent: csv }),
  });
  const importJson = await importRes.json().catch(() => ({}));
  if (importRes.ok && importJson.success && importJson.data?.insertedCount === 3) {
    console.log(`✅ 3. POST /import insertedCount=3 (total=${importJson.data.totalRows})`);
    pass++;
  } else {
    console.error(
      `✗ 3. POST /import — status=${importRes.status} success=${importJson.success} inserted=${importJson.data?.insertedCount} body=${JSON.stringify(importJson).slice(0, 300)}`,
    );
    fail++;
  }

  // 4. GET back from DB → 3 rows with income_type + tax_amount = round(gross * 0.20)
  const { data: rows, error: readErr } = await sbAdmin
    .from('pph26_transaction')
    .select('income_type,gross_amount,tax_amount,recipient_name,applied_rate')
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD)
    .order('transaction_date', { ascending: true });

  if (readErr) {
    console.error(`✗ 4. read back failed:`, readErr.message);
    fail++;
  } else if (!rows || rows.length !== 3) {
    console.error(`✗ 4. expected 3 rows, got ${rows?.length ?? 0}`);
    fail++;
  } else {
    const ok = rows.every((r) => {
      const expectedTax = Math.round(Number(r.gross_amount) * 0.20);
      const taxOk = Math.round(Number(r.tax_amount)) === expectedTax;
      const typeOk = ['dividend', 'interest', 'royalty', 'service', 'other'].includes(
        String(r.income_type),
      );
      const rateOk = Math.abs(Number(r.applied_rate) - 0.20) < 0.001;
      return taxOk && typeOk && rateOk;
    });
    if (ok) {
      const summary = rows
        .map((r) => `${r.income_type}=${Math.round(Number(r.tax_amount))}`)
        .join(', ');
      console.log(`✅ 4. 3 rows persisted (${summary})`);
      pass++;
    } else {
      console.error(`✗ 4. row contents wrong:`, rows);
      fail++;
    }
  }

  // 5. Cleanup
  await sbAdmin
    .from('pph26_transaction')
    .delete()
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD);
  console.log(`✅ 5. cleanup`);
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
