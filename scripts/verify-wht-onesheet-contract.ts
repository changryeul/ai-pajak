/**
 * Verify POST /api/tax/wht-import contract.
 *
 * Sends 5 synthesized ClassifiedRows (no xlsx parse — directly POSTed):
 *   A. PPh23 jasa  + PPN     (vendor with valid NPWP)
 *   B. PPh23 sewa   (no VAT) (vehicle rental)
 *   C. PPh4(2) sewa + PPN    (T&B rental)
 *   D. PPh23 jasa, NPWP missing (still classified, warning only)
 *   E. PPh26 foreign vendor, no NPWP, 20% WHT (Pasal 26)
 *
 * Asserts:
 *   1. login + customer
 *   2. pre-cleanup sentinel '2099-08'
 *   3. POST 200 + insertedPph23=3 (A+B+D), insertedPph42=1 (C), insertedPpn=2 (A+C), insertedPph26=1 (E)
 *   4. failed.length = 0
 *   5. DB read back: 4 pph23_transaction rows (3 pure + 1 [PPh4(2)] marker)
 *   6. DB read back: 2 ppn_faktur_monthly rows
 *   7. DB read back: 1 pph26_transaction row @ 20% with empty NPWP
 *   8. cleanup
 *
 *   SEED_TARGET=prod npx tsx scripts/verify-wht-onesheet-contract.ts
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
const PERIOD = '2099-08';

interface ClassifiedRowMock {
  no: number;
  vendor: { alamat: string; nama: string; npwp: string };
  invoice: { description: string; invoiceNo: string; fakturNo: string };
  dates: { invoice: string | null; due: string | null; payment: string | null };
  type: { pphLabel: string; pph42Label: string };
  vat: { dpp: number; ppn: number };
  wht: { base: number; amount: number };
  materai: number;
  miscFee: number;
  vendorPaid: number;
  notes: string;
  classified: 'pph23_jasa' | 'pph23_sewa' | 'pph4_2_sewa' | 'pph26' | 'unknown';
  vatInsert: boolean;
  expectedRate: number;
  expectedAmount: number;
  warnings: string[];
  include?: boolean;
}

function mockRow(over: Partial<ClassifiedRowMock>): ClassifiedRowMock {
  return {
    no: 1,
    vendor: { alamat: '', nama: 'VENDOR A', npwp: '12.345.678.9-001.000' },
    invoice: { description: 'desc', invoiceNo: 'INV-001', fakturNo: '' },
    dates: { invoice: '2099-08-10', due: null, payment: null },
    type: { pphLabel: '', pph42Label: '' },
    vat: { dpp: 0, ppn: 0 },
    wht: { base: 0, amount: 0 },
    materai: 0,
    miscFee: 0,
    vendorPaid: 0,
    notes: '',
    classified: 'unknown',
    vatInsert: false,
    expectedRate: 0,
    expectedAmount: 0,
    warnings: [],
    ...over,
  };
}

async function main() {
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

  let pass = 0;
  let fail = 0;

  // 1. Login + customer
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

  const cleanup = async () => {
    await sbAdmin.from('pph23_transaction').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);
    await sbAdmin.from('pph26_transaction').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);
    await sbAdmin.from('ppn_faktur_monthly').delete().eq('customer_id', cust.id).eq('tax_period', PERIOD);
  };

  // 2. Pre-cleanup
  await cleanup();
  console.log(`✅ 2. pre-cleanup sentinel ${PERIOD}`);
  pass++;

  // 3. Build 4 ClassifiedRow + POST
  const rows: ClassifiedRowMock[] = [
    // A. PPh23 jasa + PPN
    mockRow({
      no: 1,
      vendor: { alamat: '', nama: 'PT JASA A', npwp: '12.345.678.9-001.000' },
      invoice: { description: 'service A', invoiceNo: 'INV-A-001', fakturNo: 'FK-A-001' },
      dates: { invoice: '2099-08-05', due: null, payment: null },
      vat: { dpp: 1_000_000, ppn: 110_000 },
      wht: { base: 1_000_000, amount: 20_000 },
      classified: 'pph23_jasa',
      vatInsert: true,
      expectedRate: 0.02,
      expectedAmount: 20_000,
    }),
    // B. PPh23 sewa (vehicle), no VAT
    mockRow({
      no: 2,
      vendor: { alamat: '', nama: 'CV SEWA MOBIL', npwp: '98.765.432.1-002.000' },
      invoice: { description: 'vehicle rental', invoiceNo: 'INV-B-002', fakturNo: '' },
      dates: { invoice: '2099-08-10', due: null, payment: null },
      vat: { dpp: 0, ppn: 0 },
      wht: { base: 15_000_000, amount: 300_000 },
      classified: 'pph23_sewa',
      vatInsert: false,
      expectedRate: 0.02,
      expectedAmount: 300_000,
    }),
    // C. PPh4(2) sewa T&B + PPN
    mockRow({
      no: 3,
      vendor: { alamat: '', nama: 'PT TANAH BANGUNAN', npwp: '11.222.333.4-003.000' },
      invoice: { description: 'office rent Aug', invoiceNo: 'INV-C-003', fakturNo: 'FK-C-003' },
      dates: { invoice: '2099-08-15', due: null, payment: null },
      vat: { dpp: 10_000_000, ppn: 1_100_000 },
      wht: { base: 10_000_000, amount: 1_000_000 },
      classified: 'pph4_2_sewa',
      vatInsert: true,
      expectedRate: 0.10,
      expectedAmount: 1_000_000,
    }),
    // D. PPh23 jasa, NPWP missing (warning but still classified)
    mockRow({
      no: 4,
      vendor: { alamat: '', nama: 'NO NPWP VENDOR', npwp: '' },
      invoice: { description: 'consulting', invoiceNo: 'INV-D-004', fakturNo: '' },
      dates: { invoice: '2099-08-20', due: null, payment: null },
      vat: { dpp: 0, ppn: 0 },
      wht: { base: 2_000_000, amount: 40_000 },
      classified: 'pph23_jasa',
      vatInsert: false,
      expectedRate: 0.02,
      expectedAmount: 40_000,
      warnings: ['consider pph26'],
    }),
    // E. PPh26 foreign vendor — 20% WHT, empty NPWP expected (Pasal 26).
    mockRow({
      no: 5,
      vendor: { alamat: 'Singapore', nama: 'Global Tech Pte Ltd', npwp: '' },
      invoice: { description: 'Cross-border IT consulting', invoiceNo: 'INV-E-005', fakturNo: '' },
      dates: { invoice: '2099-08-25', due: null, payment: null },
      vat: { dpp: 0, ppn: 0 },
      wht: { base: 5_000_000, amount: 1_000_000 },
      type: { pphLabel: 'PPh26', pph42Label: '' },
      classified: 'pph26',
      vatInsert: false,
      expectedRate: 0.20,
      expectedAmount: 1_000_000,
    }),
  ];

  const importRes = await fetch(`${BASE_URL}/api/tax/wht-import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: cust.id, taxPeriod: PERIOD, rows }),
  });
  const importJson = await importRes.json().catch(() => ({}));
  const d = importJson?.data;

  if (
    importRes.ok &&
    importJson.success === true &&
    d?.insertedPph23 === 3 &&
    d?.insertedPph42 === 1 &&
    d?.insertedPpn === 2 &&
    d?.insertedPph26 === 1
  ) {
    console.log(
      `✅ 3. POST 200 — pph23=${d.insertedPph23}, pph42=${d.insertedPph42}, ppn=${d.insertedPpn}, pph26=${d.insertedPph26}`,
    );
    pass++;
  } else {
    console.error(
      `✗ 3. POST — status=${importRes.status} body=${JSON.stringify(importJson).slice(0, 400)}`,
    );
    fail++;
  }

  // 4. failed.length = 0
  if (Array.isArray(d?.failed) && d.failed.length === 0) {
    console.log(`✅ 4. failed.length=0`);
    pass++;
  } else {
    console.error(`✗ 4. failed=${JSON.stringify(d?.failed)}`);
    fail++;
  }

  // 5. DB read back: 3 pph23_transaction (A + B + D) including 1 with description starting [PPh4(2)]
  const { data: pphRows } = await sbAdmin
    .from('pph23_transaction')
    .select('description,gross_amount,tax_rate,tax_amount,counterparty_name,counterparty_npwp,service_type,tax_regime,rental_asset_type')
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD)
    .order('transaction_date', { ascending: true });

  const pphCount = pphRows?.length ?? 0;
  const pph42Marker = pphRows?.filter((r) => String(r.description).startsWith('[PPh4(2)]')).length ?? 0;
  const pph23PureCount = pphCount - pph42Marker;
  // 4 rows total: 2 pph23_jasa (A, D) + 1 pph23_sewa (B) + 1 pph4_2 marker (C)
  if (pphCount === 4 && pph42Marker === 1 && pph23PureCount === 3) {
    console.log(
      `✅ 5. pph23_transaction rows persisted (4 total: 3 pure PPh23 + 1 [PPh4(2)] marker)`,
    );
    pass++;
  } else {
    console.error(
      `✗ 5. expected 4 pph23 rows (3 pure + 1 PPh4(2)), got total=${pphCount} marker=${pph42Marker}`,
    );
    console.error('   rows:', pphRows);
    fail++;
  }

  // 6. DB read back: 2 ppn_faktur_monthly rows (A + C, both MASUKAN)
  const { data: ppnRows } = await sbAdmin
    .from('ppn_faktur_monthly')
    .select('faktur_type,counterparty_name,counterparty_npwp,dpp,ppn,faktur_number')
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD);

  const ppnCount = ppnRows?.length ?? 0;
  const allMasukan = ppnRows?.every((r) => r.faktur_type === 'MASUKAN') ?? false;
  if (ppnCount === 2 && allMasukan) {
    console.log(`✅ 6. ppn_faktur_monthly rows persisted (2 MASUKAN)`);
    pass++;
  } else {
    console.error(`✗ 6. expected 2 MASUKAN ppn rows, got count=${ppnCount} allMasukan=${allMasukan}`);
    console.error('   rows:', ppnRows);
    fail++;
  }

  // 7. DB read back: 1 pph26_transaction row (E) — 20% rate, empty NPWP
  const { data: pph26Rows } = await sbAdmin
    .from('pph26_transaction')
    .select('recipient_name,recipient_npwp,gross_amount,applied_rate,tax_amount,income_type')
    .eq('customer_id', cust.id)
    .eq('tax_period', PERIOD);

  const pph26Count = pph26Rows?.length ?? 0;
  const pph26Row = pph26Rows?.[0];
  const pph26Ok =
    pph26Count === 1 &&
    pph26Row?.recipient_name === 'Global Tech Pte Ltd' &&
    pph26Row?.recipient_npwp === null &&
    Number(pph26Row?.gross_amount) === 5_000_000 &&
    Number(pph26Row?.applied_rate) === 0.2 &&
    Number(pph26Row?.tax_amount) === 1_000_000;
  if (pph26Ok) {
    console.log(`✅ 7. pph26_transaction row persisted (Global Tech Pte Ltd, 5M @ 20% = 1M, NPWP null)`);
    pass++;
  } else {
    console.error(`✗ 7. expected 1 pph26 row matching foreign vendor contract, got count=${pph26Count}`);
    console.error('   row:', pph26Row);
    fail++;
  }

  // 8. Cleanup
  await cleanup();
  console.log(`✅ 8. cleanup`);
  pass++;

  console.log(`\n— ${pass} pass / ${fail} fail —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
