/**
 * Seed demo data for the INDIVIDUAL test customer.
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/seed-individual-demo.ts
 *   npx tsx scripts/seed-individual-demo.ts                # local
 *
 * What it creates for customer.test@example.com:
 *   - 3 tax_filing rows (2023/2024/2025 SPT Pribadi, all ACCEPTED) so
 *     RecentFilingsCard shows green "완료" badges.
 *   - 3 years × 4 asset_snapshot rows (CASH_BANK, INVESTMENT, VEHICLE,
 *     BUILDING) — mix of domestic + foreign (is_foreign=true on one
 *     INVESTMENT row so the foreign-asset threshold card has data).
 *   - 3 years × 2 liability_snapshot rows (BANK_LOAN + CREDIT_CARD).
 *   - 3 years × 1 income_snapshot row (EMPLOYMENT, growing ~10% YoY).
 *
 * The numbers are deliberately plausible for a Jakarta office worker:
 *   - Annual income: Rp 180M → 200M → 220M
 *   - Assets ramping from Rp 500M → Rp 720M
 *   - Liabilities shrinking from Rp 250M → Rp 180M as the mortgage
 *     amortises
 *
 * Safe to re-run — uses upsert-like semantics (delete-first-then-insert
 * for snapshots; filings get year+type idempotency key).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📄 Loaded env from ${envFile}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

const CUSTOMER_EMAIL = 'customer.test@example.com';

async function resolveCustomer() {
  const { data } = await admin
    .from('customer')
    .select('id, full_name, customer_type')
    .eq('email', CUSTOMER_EMAIL)
    .maybeSingle();
  if (!data) {
    throw new Error(`Customer ${CUSTOMER_EMAIL} not found — run seed-test-users.ts first`);
  }
  if (data.customer_type !== 'INDIVIDUAL') {
    throw new Error(`${CUSTOMER_EMAIL} is ${data.customer_type}, not INDIVIDUAL`);
  }
  return data;
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 3, currentYear - 2, currentYear - 1]; // 2023/2024/2025 at time of writing

// Income growth ~10% YoY
const INCOME_BY_YEAR = {
  [YEARS[0]]: 180_000_000,
  [YEARS[1]]: 200_000_000,
  [YEARS[2]]: 220_000_000,
};

const WITHHELD_BY_YEAR = {
  [YEARS[0]]: 14_000_000,
  [YEARS[1]]: 17_500_000,
  [YEARS[2]]: 21_500_000,
};

// Assets ramp from Rp 500M → 720M
const ASSET_ROWS = [
  // year-0 (earliest)
  { year: YEARS[0], category: 'CASH_BANK', amount: 120_000_000, label: 'BCA 주거래', is_foreign: false },
  { year: YEARS[0], category: 'INVESTMENT', amount: 80_000_000, label: 'Reksa Dana BNI', is_foreign: false },
  { year: YEARS[0], category: 'VEHICLE', amount: 150_000_000, label: 'Honda Brio 2022', is_foreign: false },
  { year: YEARS[0], category: 'BUILDING', amount: 150_000_000, label: '주택 지분 20%', is_foreign: false },
  // year-1
  { year: YEARS[1], category: 'CASH_BANK', amount: 150_000_000, label: 'BCA 주거래', is_foreign: false },
  { year: YEARS[1], category: 'INVESTMENT', amount: 120_000_000, label: 'Reksa Dana BNI', is_foreign: false },
  { year: YEARS[1], category: 'VEHICLE', amount: 135_000_000, label: 'Honda Brio 2022', is_foreign: false },
  { year: YEARS[1], category: 'BUILDING', amount: 195_000_000, label: '주택 지분 30%', is_foreign: false },
  // year-2 (most recent)
  { year: YEARS[2], category: 'CASH_BANK', amount: 180_000_000, label: 'BCA 주거래', is_foreign: false },
  { year: YEARS[2], category: 'INVESTMENT', amount: 150_000_000, label: 'Reksa Dana BNI', is_foreign: false },
  // Foreign asset — Korean brokerage ≈ Rp 60M
  { year: YEARS[2], category: 'INVESTMENT', amount: 60_000_000, label: '한국 증권계좌', is_foreign: true },
  { year: YEARS[2], category: 'VEHICLE', amount: 120_000_000, label: 'Honda Brio 2022', is_foreign: false },
  { year: YEARS[2], category: 'BUILDING', amount: 210_000_000, label: '주택 지분 40%', is_foreign: false },
];

// Liabilities decrease as mortgage amortises
const LIABILITY_ROWS = [
  { year: YEARS[0], category: 'BANK_LOAN', amount: 220_000_000, creditor: 'Bank Mandiri', label: '주택담보 대출' },
  { year: YEARS[0], category: 'CREDIT_CARD', amount: 30_000_000, creditor: 'BCA Visa', label: '일반 카드' },
  { year: YEARS[1], category: 'BANK_LOAN', amount: 195_000_000, creditor: 'Bank Mandiri', label: '주택담보 대출' },
  { year: YEARS[1], category: 'CREDIT_CARD', amount: 15_000_000, creditor: 'BCA Visa', label: '일반 카드' },
  { year: YEARS[2], category: 'BANK_LOAN', amount: 170_000_000, creditor: 'Bank Mandiri', label: '주택담보 대출' },
  { year: YEARS[2], category: 'CREDIT_CARD', amount: 10_000_000, creditor: 'BCA Visa', label: '일반 카드' },
];

async function seedFilings(customerId: string) {
  console.log('\n▶ Seeding tax_filing rows for 3 years...');

  // Need a consultant_id for the filing row (schema NOT NULL).
  // Use the first active JTC tax advisor as the filer.
  const { data: consultant } = await admin
    .from('consultant')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!consultant) {
    console.log('  ✗ No active consultant found — skipping filings');
    return;
  }

  // Delete any existing demo SPT Tahunan filings
  await admin.from('tax_filing').delete()
    .eq('customer_id', customerId)
    .eq('tax_type', 'SPT_TAHUNAN');

  for (const year of YEARS) {
    // Form variant encoded in tax_data — tax_type enum only distinguishes
    // masa vs tahunan.
    const sptForm = year === YEARS[2] ? '1770' : '1770S';
    const { error } = await admin.from('tax_filing').insert({
      customer_id: customerId,
      consultant_id: consultant.id,
      tax_type: 'SPT_TAHUNAN',
      tax_period: String(year),
      status: 'FILED',
      tax_data: {
        spt_form: sptForm,
        gross_income: INCOME_BY_YEAR[year],
        pph_withheld: WITHHELD_BY_YEAR[year],
      },
      filed_at: new Date(`${year + 1}-03-15`).toISOString(),
    });
    if (error) {
      console.log(`  ✗ ${year}: ${error.message}`);
    } else {
      console.log(`  ✓ ${year}: SPT_TAHUNAN (${sptForm}) FILED`);
    }
  }
}

async function seedSnapshots(customerId: string) {
  console.log('\n▶ Seeding asset/liability/income snapshots...');

  // Nuke existing snapshots for those years (safe-to-re-run)
  await admin.from('asset_snapshot').delete().eq('customer_id', customerId).in('snapshot_year', YEARS);
  await admin.from('liability_snapshot').delete().eq('customer_id', customerId).in('snapshot_year', YEARS);
  await admin.from('income_snapshot').delete().eq('customer_id', customerId).in('snapshot_year', YEARS);

  for (const row of ASSET_ROWS) {
    const { error } = await admin.from('asset_snapshot').insert({
      customer_id: customerId,
      snapshot_year: row.year,
      category: row.category,
      amount_idr: row.amount,
      label: row.label,
      is_foreign: row.is_foreign,
      currency: row.is_foreign ? 'KRW' : 'IDR',
    });
    if (error) console.log(`  ✗ asset ${row.year} ${row.category}: ${error.message}`);
  }

  for (const row of LIABILITY_ROWS) {
    const { error } = await admin.from('liability_snapshot').insert({
      customer_id: customerId,
      snapshot_year: row.year,
      category: row.category,
      amount_idr: row.amount,
      creditor_name: row.creditor,
      label: row.label,
    });
    if (error) console.log(`  ✗ liability ${row.year} ${row.category}: ${error.message}`);
  }

  for (const year of YEARS) {
    const { error } = await admin.from('income_snapshot').insert({
      customer_id: customerId,
      snapshot_year: year,
      source: 'EMPLOYMENT',
      gross_income_idr: INCOME_BY_YEAR[year],
      withheld_idr: WITHHELD_BY_YEAR[year],
      label: 'PT Demo Indonesia',
    });
    if (error) console.log(`  ✗ income ${year}: ${error.message}`);
  }

  console.log(`  ✓ ${ASSET_ROWS.length} assets, ${LIABILITY_ROWS.length} liabilities, ${YEARS.length} income rows`);
}

async function run() {
  const c = await resolveCustomer();
  console.log(`✓ Resolved customer ${c.full_name} (${c.id})`);

  await seedFilings(c.id);
  await seedSnapshots(c.id);

  console.log('\n✅ INDIVIDUAL demo seed complete.');
  console.log(`   Sign in as ${CUSTOMER_EMAIL} to see:`);
  console.log('     RecentFilingsCard → 3 years, all "완료"');
  console.log('     AssetsLiabilitiesCard → Rp 720M assets / Rp 180M liabilities');
  console.log('     ForeignAssetReportingCard → 1 foreign INVESTMENT row');
  console.log('     GrowthAnomalyCard → 3-year income/asset trend');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
