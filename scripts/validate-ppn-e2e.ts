/**
 * End-to-end PPN wholesale import validation:
 *   xlsx → importPpnWholesaleFile() → outCsv + inCsv → POST /ppn-bulk-import →
 *   DB insert (ppn_faktur_monthly) → verify counts → cleanup.
 *
 * Mimics the UI flow: same exported importer, same endpoint, same customer
 * auth. Catches gaps the unit tests + offline script miss (csv-parser,
 * validatePPNRows, server insert path, RLS).
 *
 * Usage:
 *   SEED_TARGET=prod npx tsx scripts/validate-ppn-e2e.ts [sheetName]
 */

import { readFileSync, existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { importPpnWholesaleFile } from '../src/lib/tax/bulk-import/ppn-wholesale-importer';

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
const SHEET = process.argv[2] ?? '2601';
const SRC = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - VAT COMPLIANCE 2026.xlsx';
const TEST_EMAIL = 'company.test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

// Graceful skip when the customer xlsx isn't present (CI / fresh checkout).
// The smoke runner treats exit-0 as PASS, so this won't fail integrated runs.
if (!existsSync(SRC)) {
  console.log(`⏭  SKIPPED — fixture not present (${SRC})`);
  console.log(`   (this validator needs the real BINTANG JAYA xlsx — only runs locally)`);
  process.exit(0);
}

console.log(`\n📄 file: ${SRC}`);
console.log(`📋 sheet: ${SHEET}`);
console.log(`🌐 base: ${BASE_URL}\n`);

async function main() {
  // ── Step 1: Read xlsx + extract chosen sheet ──────────────────────────
  const wb = XLSX.read(readFileSync(SRC), { type: 'buffer', cellDates: true });
  if (!wb.Sheets[SHEET]) {
    console.error(`✗ sheet '${SHEET}' missing. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, wb.Sheets[SHEET], SHEET);
  const buf = XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const file = new File(
    [Uint8Array.from(buf)],
    `BINTANG-JAYA-${SHEET}.xlsx`,
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
  console.log(`✅ Step 1: file wrapped (${buf.length} bytes, sheet '${SHEET}')`);

  // ── Step 2: Run importer ──────────────────────────────────────────────
  let summary;
  try {
    summary = await importPpnWholesaleFile(file);
  } catch (e) {
    console.error(`✗ Step 2 importer failed:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log(
    `✅ Step 2: importer ran — out=${summary.outImported}, in=${summary.inImported},` +
    ` skippedByValidation=${summary.skippedByValidation}, skippedFooters=${summary.skippedFooters}`,
  );
  if (summary.errors.length > 0) {
    console.log(`   first 5 errors:`);
    summary.errors.slice(0, 5).forEach((e) =>
      console.log(`     [${e.section}] row ${e.rowNumber}: ${e.reason}`),
    );
  }
  if (summary.outImported === 0 && summary.inImported === 0) {
    console.error(`✗ no rows to POST`);
    process.exit(1);
  }

  // ── Step 3: Login ─────────────────────────────────────────────────────
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

  // ── Step 4: customer lookup ───────────────────────────────────────────
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

  // ── Step 5: Pre-cleanup ───────────────────────────────────────────────
  const taxPeriod = `2026-${SHEET.slice(2)}`; // '2601' → '2026-01'
  const { count: preCount } = await sbAdmin
    .from('ppn_faktur_monthly')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod);
  console.log(`✅ Step 5: pre-cleanup deleted ${preCount ?? 0} existing rows for ${taxPeriod}`);

  // ── Step 6: POST /api/tax/ppn-bulk-import ─────────────────────────────
  const importRes = await fetch(`${BASE_URL}/api/tax/ppn-bulk-import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      taxPeriod,
      outCsv: summary.outCsv,
      inCsv: summary.inCsv,
    }),
  });
  const importBody = await importRes.json();
  console.log(`✅ Step 6: POST → ${importRes.status}`);
  console.log(`   response: ${JSON.stringify(importBody, null, 2).slice(0, 700)}`);

  if (importRes.status !== 200 || !importBody.success) {
    console.error(`✗ import endpoint failed`);
    process.exit(1);
  }

  // ── Step 7: Verify DB ─────────────────────────────────────────────────
  const { data: rows, count } = await sbAdmin
    .from('ppn_faktur_monthly')
    .select('id, faktur_type, faktur_date, counterparty_name, dpp, ppn', { count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod)
    .order('faktur_date');
  const outCount = rows?.filter((r) => r.faktur_type === 'KELUARAN').length ?? 0;
  const inCount = rows?.filter((r) => r.faktur_type === 'MASUKAN').length ?? 0;
  console.log(`✅ Step 7: DB has ${count ?? 0} rows for ${taxPeriod} (OUT=${outCount}, IN=${inCount})`);
  rows?.slice(0, 5).forEach((r) => {
    console.log(`   • [${r.faktur_type}] ${r.faktur_date} | ${r.counterparty_name} | dpp=${r.dpp} ppn=${r.ppn}`);
  });
  if (rows && rows.length > 5) console.log(`   … +${rows.length - 5} more`);

  // ── Step 8: Cleanup ───────────────────────────────────────────────────
  const { count: cleaned } = await sbAdmin
    .from('ppn_faktur_monthly')
    .delete({ count: 'exact' })
    .eq('customer_id', customerId)
    .eq('tax_period', taxPeriod);
  console.log(`✅ Step 8: cleanup deleted ${cleaned ?? 0} rows\n`);

  // ── Verdict ───────────────────────────────────────────────────────────
  const outInserted = importBody.data?.outInserted ?? 0;
  const inInserted = importBody.data?.inInserted ?? 0;
  const responseErrors = importBody.data?.errors ?? [];
  if (
    outInserted === summary.outImported &&
    inInserted === summary.inImported &&
    outCount === summary.outImported &&
    inCount === summary.inImported &&
    responseErrors.length === 0
  ) {
    console.log(
      `🎉 PASS — importer ${summary.outImported}+${summary.inImported} → endpoint inserted ${outInserted}+${inInserted}` +
      ` → DB verified ${outCount}+${inCount}`,
    );
  } else {
    console.log(
      `✗ MISMATCH — importer=${summary.outImported}+${summary.inImported},` +
      ` inserted=${outInserted}+${inInserted}, DB=${outCount}+${inCount}, errors=${responseErrors.length}`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.stack : e);
  process.exit(1);
});
