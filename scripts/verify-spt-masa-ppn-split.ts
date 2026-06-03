/**
 * Verify SPT Masa PPN endpoint returns PMK 131/2024 luxury/essential split.
 *
 * - Seeds 3 ppn_faktur_monthly rows (2 essential sales + 1 luxury purchase)
 *   at sentinel period 2099-12.
 * - POST /api/tax/spt-masa with taxType=PPN as the COMPANY test customer.
 * - Assert HTTP 200, correct 4-bucket split totals, and PMK 131/2024
 *   legal_basis on the response.
 *
 * Mirrors verify-ppn-put-contract.ts pattern. Sentinel cleaned up in finally.
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-spt-masa-ppn-split.ts
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) { console.error(`x ${envFile} not found`); process.exit(1); }
loadEnv({ path: envFile });

const BASE_URL =
  process.env.TEST_BASE_URL ||
  (envFile === '.env.production.local' ? 'https://ai-pajak.vercel.app' : 'http://localhost:3000');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// Sentinel — far future month so it can't collide with real-data filings.
const PERIOD = '2099-12';
// Use a CONSULTANT_JTC login. The route's handler queries the `consultant`
// table by session.userId regardless of role, so a plain CUSTOMER login
// 404s with "Consultant not found" (pre-existing handler quirk, not in
// scope of this spec). consultant.test is pre-assigned to PT Example
// Indonesia in prod seeds.
const TEST_EMAIL = 'consultant.test@jakartatax.co.id';
const TEST_PASSWORD = 'TestPassword123!';
// Target COMPANY customer pre-assigned to consultant.test (seed UUID).
const TARGET_CUSTOMER_ID = '00000000-0000-0000-0000-000000000011';

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error('x login:', authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;

  const { data: cust } = await sbAdmin
    .from('customer')
    .select('id, customer_type')
    .eq('id', TARGET_CUSTOMER_ID)
    .maybeSingle();
  if (!cust) {
    console.error('x target customer not found:', TARGET_CUSTOMER_ID);
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;

  // Pre-cleanup sentinel period (and a defensive cleanup of the auto-enqueued
  // queue row + draft filing in case a previous run left them behind).
  await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);
  await sbAdmin
    .from('tax_filing')
    .delete()
    .eq('customer_id', cust.id)
    .eq('tax_type', 'PPN')
    .eq('tax_period', PERIOD);
  await sbAdmin
    .from('djp_submission_queue')
    .delete()
    .eq('customer_id', cust.id)
    .eq('tax_type', 'PPN')
    .eq('tax_period_year', 2099)
    .eq('tax_period_month', 12);

  try {
    // Seed 3 fakturs covering 2 of the 4 buckets we care about.
    const rows = [
      // 2 essential sales — dpp_nilai_lain ≠ dpp (PMK 11/12 adjust)
      {
        customer_id: cust.id,
        tax_period: PERIOD,
        faktur_type: 'KELUARAN',
        faktur_date: '2099-12-15',
        faktur_number: 'SMOKE-E1',
        counterparty_name: 'Essential Buyer 1',
        dpp: 1_200_000,
        dpp_nilai_lain: 1_100_000,
        ppn: 132_000,
        is_luxury: false,
        status: 'PENDING',
      },
      {
        customer_id: cust.id,
        tax_period: PERIOD,
        faktur_type: 'KELUARAN',
        faktur_date: '2099-12-16',
        faktur_number: 'SMOKE-E2',
        counterparty_name: 'Essential Buyer 2',
        dpp: 2_400_000,
        dpp_nilai_lain: 2_200_000,
        ppn: 264_000,
        is_luxury: false,
        status: 'PENDING',
      },
      // 1 luxury purchase — dpp_nilai_lain == dpp (no 11/12 adjust)
      {
        customer_id: cust.id,
        tax_period: PERIOD,
        faktur_type: 'MASUKAN',
        faktur_date: '2099-12-17',
        faktur_number: 'SMOKE-L1',
        counterparty_name: 'Luxury Supplier',
        dpp: 5_000_000,
        dpp_nilai_lain: 5_000_000,
        ppn: 600_000,
        is_luxury: true,
        status: 'PENDING',
      },
    ];
    const { error: seedErr } = await sbAdmin.from('ppn_faktur_monthly').insert(rows);
    if (seedErr) {
      console.error('x seed insert failed:', seedErr.message);
      process.exit(1);
    }
    console.log(`-- seeded ${rows.length} fakturs at period ${PERIOD}`);

    // Call endpoint.
    const res = await fetch(`${BASE_URL}/api/tax/spt-masa`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: cust.id, taxType: 'PPN', period: PERIOD }),
    });
    const data = await res.json();

    // 1. HTTP 200
    if (res.status === 200) {
      console.log(`OK 1. HTTP 200`);
      pass++;
    } else {
      console.error(`x  1. expected 200 got ${res.status}`, JSON.stringify(data).slice(0, 500));
      fail++;
    }

    const splits = data?.breakdown?.splits;

    // 2. sales_essential split — 2 fakturs, dpp 3.6M, dnl 3.3M, ppn 396K
    const se = splits?.sales_essential;
    if (
      se?.count === 2 &&
      Number(se.total_dpp) === 3_600_000 &&
      Number(se.total_dpp_nilai_lain) === 3_300_000 &&
      Number(se.total_ppn) === 396_000
    ) {
      console.log(`OK 2. sales_essential split correct (2 faktur, DPP 3.6M, DNL 3.3M, PPN 396K)`);
      pass++;
    } else {
      console.error(`x  2. sales_essential mismatch`, se);
      fail++;
    }

    // 3. purchase_luxury split — 1 faktur, dpp = dnl = 5M, no 11/12 adjust
    const pl = splits?.purchase_luxury;
    if (
      pl?.count === 1 &&
      Number(pl.total_dpp) === 5_000_000 &&
      Number(pl.total_dpp_nilai_lain) === 5_000_000 &&
      Number(pl.total_ppn) === 600_000
    ) {
      console.log(`OK 3. purchase_luxury split correct (no 11/12 adjust)`);
      pass++;
    } else {
      console.error(`x  3. purchase_luxury mismatch`, pl);
      fail++;
    }

    // 4. legal_basis present and references PMK 131/2024
    const legal = data?.breakdown?.legal_basis;
    if (typeof legal === 'string' && legal.includes('PMK 131/2024')) {
      console.log(`OK 4. legal_basis present: "${legal.slice(0, 60)}..."`);
      pass++;
    } else {
      console.error(`x  4. legal_basis missing or wrong:`, legal);
      fail++;
    }
  } finally {
    // Cleanup — keep sentinel period clean for next run.
    await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);
    await sbAdmin
      .from('tax_filing')
      .delete()
      .eq('customer_id', cust.id)
      .eq('tax_type', 'PPN')
      .eq('tax_period', PERIOD);
    await sbAdmin
      .from('djp_submission_queue')
      .delete()
      .eq('customer_id', cust.id)
      .eq('tax_type', 'PPN')
      .eq('tax_period_year', 2099)
      .eq('tax_period_month', 12);
  }

  console.log(`\n-- ${pass} pass / ${fail} fail --`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('!!', e); process.exit(1); });
