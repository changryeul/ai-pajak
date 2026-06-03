/**
 * Verify GET /api/tax/annual-closing/[id]/auto-credits contract:
 *
 *   1. Login as company.test (COMPANY customer) + sanity check
 *   2. Pre-cleanup sentinel year 2098 + create sentinel closing_session
 *   3. Seed: 2× pph23_transaction (tax_amount 100k + 200k) + 1× pph26_transaction
 *      (tax_amount 50k) + 3× tax_monthly_payment (PPh25 amount_paid 1m each)
 *   4. GET /auto-credits → 200, success=true, pph23=300k, pph25=3m, pph26=50k,
 *      sources.pph23.rowCount=2 / sources.pph26.rowCount=1 / sources.pph25.rowCount=3
 *   5. Cleanup (closing_session + 3 source tables)
 *
 * Uses sentinel fiscal_year 2098 + tax_period '2098-MM' to avoid colliding
 * with real prod monthly filings.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-closing-auto-credits.ts
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
const FISCAL_YEAR = 2098; // sentinel
const PERIOD_PREFIX = `${FISCAL_YEAR}-`;

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  let pass = 0;
  let fail = 0;

  // 1. Auth
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

  // 2. Pre-cleanup + create sentinel closing_session
  await sbAdmin.from('pph23_transaction').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('pph26_transaction').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('tax_monthly_payment').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('tax_closing_session').delete()
    .eq('customer_id', cust.id).eq('fiscal_year', FISCAL_YEAR);

  const { data: sess, error: sessErr } = await sbAdmin
    .from('tax_closing_session')
    .insert({
      customer_id: cust.id,
      fiscal_year: FISCAL_YEAR,
      closing_type: 'PPH25',
      current_step: 'credit',
      status: 'IN_PROGRESS',
      data: {},
      signed_statements_uploaded: false,
    })
    .select()
    .single();
  if (sessErr || !sess) {
    console.error('✗ 2. create closing_session:', sessErr?.message);
    process.exit(1);
  }
  console.log(`✅ 2. pre-cleanup + sentinel closing_session ${sess.id} (fiscal_year=${FISCAL_YEAR})`);
  pass++;

  // 3. Seed source rows
  const seeds = await Promise.all([
    sbAdmin.from('pph23_transaction').insert([
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}01`,
        transaction_date: `${FISCAL_YEAR}-01-15`,
        counterparty_name: 'TEST COUNTERPARTY A',
        service_type: 'jasa_lain',
        gross_amount: 5_000_000,
        tax_rate: 0.02,
        tax_amount: 100_000,
      },
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}02`,
        transaction_date: `${FISCAL_YEAR}-02-15`,
        counterparty_name: 'TEST COUNTERPARTY B',
        service_type: 'jasa_lain',
        gross_amount: 10_000_000,
        tax_rate: 0.02,
        tax_amount: 200_000,
      },
    ]),
    sbAdmin.from('pph26_transaction').insert([
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}03`,
        transaction_date: `${FISCAL_YEAR}-03-15`,
        income_type: 'service',
        gross_amount: 2_500_000,
        tax_amount: 50_000,
        applied_rate: 0.20,
        recipient_name: 'TEST NON-RESIDENT',
      },
    ]),
    sbAdmin.from('tax_monthly_payment').insert([
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}01`,
        tax_type: 'PPh25',
        tax_year: FISCAL_YEAR,
        amount_due: 1_000_000,
        amount_paid: 1_000_000,
        status: 'PAID',
      },
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}02`,
        tax_type: 'PPh25',
        tax_year: FISCAL_YEAR,
        amount_due: 1_000_000,
        amount_paid: 1_000_000,
        status: 'PAID',
      },
      {
        customer_id: cust.id,
        tax_period: `${PERIOD_PREFIX}03`,
        tax_type: 'PPh25',
        tax_year: FISCAL_YEAR,
        amount_due: 1_000_000,
        amount_paid: 1_000_000,
        status: 'PAID',
      },
    ]),
  ]);
  const seedErr = seeds.find((r) => r.error)?.error;
  if (seedErr) {
    console.error('✗ 3. seed:', seedErr.message);
    await sbAdmin.from('tax_closing_session').delete().eq('id', sess.id);
    process.exit(1);
  }
  console.log('✅ 3. seed 2×pph23 + 1×pph26 + 3×pph25 payments');
  pass++;

  // 4. GET /auto-credits → verify shape
  const res = await fetch(`${BASE_URL}/api/tax/annual-closing/${sess.id}/auto-credits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: {
      pph22?: number;
      pph23?: number;
      pph25?: number;
      pph26?: number;
      sources?: Record<string, { table: string; rowCount: number }>;
      computedAt?: string;
    };
  };

  if (!res.ok || !json.success || !json.data) {
    console.error(
      `✗ 4. GET — status=${res.status} body=${JSON.stringify(json).slice(0, 300)}`,
    );
    fail++;
  } else {
    const d = json.data;
    const ok =
      d.pph23 === 300_000 &&
      d.pph25 === 3_000_000 &&
      d.pph26 === 50_000 &&
      d.sources?.pph23?.rowCount === 2 &&
      d.sources?.pph23?.table === 'pph23_transaction' &&
      d.sources?.pph26?.rowCount === 1 &&
      d.sources?.pph26?.table === 'pph26_transaction' &&
      d.sources?.pph25?.rowCount === 3 &&
      d.sources?.pph25?.table === 'tax_monthly_payment' &&
      typeof d.computedAt === 'string';
    if (ok) {
      console.log(
        `✅ 4. shape OK: pph23=${d.pph23} pph25=${d.pph25} pph26=${d.pph26} ` +
          `rows(23/25/26)=${d.sources?.pph23.rowCount}/${d.sources?.pph25.rowCount}/${d.sources?.pph26.rowCount}`,
      );
      pass++;
    } else {
      console.error('✗ 4. shape mismatch:', JSON.stringify(d).slice(0, 400));
      fail++;
    }
  }

  // 5. Cleanup
  await sbAdmin.from('pph23_transaction').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('pph26_transaction').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('tax_monthly_payment').delete()
    .eq('customer_id', cust.id).like('tax_period', `${PERIOD_PREFIX}%`);
  await sbAdmin.from('tax_closing_session').delete().eq('id', sess.id);
  console.log('✅ 5. cleanup');
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
