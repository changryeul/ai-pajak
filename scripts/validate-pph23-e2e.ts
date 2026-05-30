/**
 * End-to-end PPh23 import validation:
 *   xlsx → importWholesaleFile() → csvContent → POST /import → DB insert →
 *   verify count → cleanup.
 *
 * Mimics the UI flow exactly: same exported importer, same endpoint, same
 * customer auth. Catches gaps the unit-level script misses (csv-parser,
 * validatePPh23Rows, server insert path).
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/validate-pph23-e2e.ts [sheetName]
 */

import { readFileSync, existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { importWholesaleFile } from '../src/lib/tax/bulk-import/pph23-wholesale-importer';

const envFile = process.env.SEED_TARGET === 'prod' ? '.env.production.local' : '.env.local';
if (!existsSync(envFile)) {
  console.error(`✗ ${envFile} not found`);
  process.exit(1);
}
loadEnv({ path: envFile });

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHEET = process.argv[2] ?? '2601';
const WHT_FILE = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - WHT CALCULATION 2026.xlsx';
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

console.log(`\n📄 file: ${WHT_FILE}`);
console.log(`📋 sheet: ${SHEET}`);
console.log(`🌐 base: ${BASE_URL}\n`);

async function main() {
  // ── Step 1: Read xlsx as File (Node 20+ has File global) ──────────────
  const buf = readFileSync(WHT_FILE);
  // We need to inject sheet selection into the importer. The importer's
  // parseTabularFile only reads the first sheet. To test sheet 2601 (which IS
  // the first sheet — verified earlier), we can wrap as-is.
  // For other sheets, we'd need to re-export just that sheet — out of scope
  // (the real UI also imports just one sheet at a time).
  const file = new File([buf], `WHT-${SHEET}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  console.log(`✅ Step 1: file wrapped (${buf.length} bytes)`);

  // ── Step 2: Run importer ──────────────────────────────────────────────
  let summary;
  try {
    summary = await importWholesaleFile(file);
  } catch (e) {
    console.error(`✗ Step 2 importer failed:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log(`✅ Step 2: importer ran — imported=${summary.imported}, skippedByTaxType=${summary.skippedByTaxType}, skippedByValidation=${summary.skippedByValidation}`);
  if (summary.errors.length > 0) {
    console.log(`   first 5 errors:`);
    summary.errors.slice(0, 5).forEach((e) => console.log(`     row ${e.rowNumber}: ${e.reason}`));
  }
  if (summary.imported === 0) {
    console.error(`✗ no rows imported — nothing to POST`);
    process.exit(1);
  }
  console.log(`   CSV preview:\n${summary.csvContent.split('\n').slice(0, 4).map((l) => '     ' + l).join('\n')}\n     ...`);

  // ── Step 3: Login as COMPANY customer ─────────────────────────────────
  const sbAnon = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authErr || !auth.session) {
    console.error(`✗ Step 3 login failed:`, authErr?.message);
    process.exit(1);
  }
  const token = auth.session.access_token;
  console.log(`✅ Step 3: logged in as ${TEST_EMAIL}`);

  // ── Step 4: Look up customer id (via admin to avoid RLS chicken/egg) ───
  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: customer } = await sbAdmin
    .from('customer')
    .select('id')
    .eq('user_id', auth.user!.id)
    .maybeSingle();
  if (!customer) {
    console.error(`✗ Step 4: no customer row for user_id=${auth.user!.id}`);
    process.exit(1);
  }
  const customerId = customer.id;
  console.log(`✅ Step 4: customer_id=${customerId}`);

  // ── Step 5: Pre-cleanup any PPh23 rows for the test period ────────────
  const taxPeriod = `2026-${SHEET.slice(2)}`; // '2601' → '2026-01'
  const { count: preCount } = await sbAdmin
    .from('pph23_transaction')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod);
  console.log(`✅ Step 5: pre-cleanup deleted ${preCount ?? 0} existing rows for ${taxPeriod}`);

  // ── Step 6: POST /api/tax/pph23-transactions/import ───────────────────
  const importRes = await fetch(`${BASE_URL}/api/tax/pph23-transactions/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      taxPeriod,
      csvContent: summary.csvContent,
    }),
  });
  const importBody = await importRes.json();
  console.log(`✅ Step 6: POST → ${importRes.status}`);
  console.log(`   response: ${JSON.stringify(importBody, null, 2).slice(0, 600)}`);

  if (importRes.status !== 200 || !importBody.success) {
    console.error(`✗ import endpoint failed`);
    process.exit(1);
  }

  // ── Step 7: Verify rows in DB ─────────────────────────────────────────
  const { data: rows, count } = await sbAdmin
    .from('pph23_transaction')
    .select('id, transaction_date, counterparty_name, gross_amount, service_type, tax_amount', { count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod)
    .order('transaction_date');
  console.log(`✅ Step 7: DB has ${count ?? 0} rows for ${taxPeriod}`);
  if (rows) {
    rows.forEach((r) => {
      console.log(`   • ${r.transaction_date} | ${r.counterparty_name} | ${r.service_type} | gross=${r.gross_amount} | tax=${r.tax_amount}`);
    });
  }

  // ── Step 8: Cleanup ───────────────────────────────────────────────────
  const { count: cleaned } = await sbAdmin
    .from('pph23_transaction')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod);
  console.log(`✅ Step 8: cleanup deleted ${cleaned ?? 0} rows\n`);

  // ── Verdict ───────────────────────────────────────────────────────────
  const insertedCount = importBody.data?.insertedCount ?? 0;
  if (insertedCount === summary.imported && (count ?? 0) === summary.imported) {
    console.log(`🎉 PASS — importer ${summary.imported} → endpoint inserted ${insertedCount} → DB verified ${count}`);
  } else {
    console.log(`✗ MISMATCH — importer=${summary.imported}, inserted=${insertedCount}, DB=${count}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.stack : e);
  process.exit(1);
});
