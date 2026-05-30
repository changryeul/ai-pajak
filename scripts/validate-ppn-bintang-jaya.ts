/**
 * Run the PPN wholesale importer against the real BINTANG JAYA VAT
 * COMPLIANCE 2026 file and report counts + first rows.
 *
 * Bypasses the browser File API — reads the chosen sheet via xlsx, re-packs
 * it as a single-sheet workbook so the importer (which always reads
 * sheet[0]) operates on the intended month.
 *
 * Usage:
 *   npx tsx scripts/validate-ppn-bintang-jaya.ts            # default 2601
 *   npx tsx scripts/validate-ppn-bintang-jaya.ts 2602       # February sheet
 */

import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { importPpnWholesaleFile } from '../src/lib/tax/bulk-import/ppn-wholesale-importer';

const SRC = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - VAT COMPLIANCE 2026.xlsx';
const SHEET = process.argv[2] ?? '2601';

async function main() {
  console.log(`\n📂 Loading ${SRC}`);
  const wb = XLSX.read(readFileSync(SRC), { type: 'buffer', cellDates: true });
  if (!wb.Sheets[SHEET]) {
    console.error(`✗ sheet '${SHEET}' not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  console.log(`📋 Available sheets: ${wb.SheetNames.join(', ')}`);

  // Re-pack as a single-sheet workbook — importer reads sheet[0].
  const newWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWb, wb.Sheets[SHEET], SHEET);
  const buf = XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = Uint8Array.from(buf);
  const file = {
    name: `BINTANG-JAYA-${SHEET}.xlsx`,
    arrayBuffer: async () => u8.buffer as ArrayBuffer,
    text: async () => '',
  } as unknown as File;

  console.log(`\n🔎 Running importPpnWholesaleFile on sheet '${SHEET}' (${buf.length} bytes)`);
  let summary;
  try {
    summary = await importPpnWholesaleFile(file);
  } catch (e) {
    console.error(`\n✗ importer threw:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log(`\n📊 Summary`);
  console.log(`   outImported:        ${summary.outImported}`);
  console.log(`   inImported:         ${summary.inImported}`);
  console.log(`   skippedByValidation:${summary.skippedByValidation}`);
  console.log(`   skippedFooters:     ${summary.skippedFooters}`);
  console.log(`   total normalised:   ${summary.outImported + summary.inImported}`);

  if (summary.errors.length > 0) {
    console.log(`\n⚠ Validation errors (first 10):`);
    summary.errors.slice(0, 10).forEach((e) =>
      console.log(`   [${e.section}] row ${e.rowNumber}: ${e.reason}`),
    );
  }

  console.log(`\n✅ First 5 OUT rows:`);
  summary.outCsv.split('\n').slice(0, 6).forEach((l) => console.log(`   ${l}`));

  console.log(`\n✅ First 5 IN rows:`);
  summary.inCsv.split('\n').slice(0, 6).forEach((l) => console.log(`   ${l}`));

  const expected = { '2601': { out: 6, in: 19 } } as Record<string, { out: number; in: number }>;
  const exp = expected[SHEET];
  if (exp) {
    if (summary.outImported === exp.out && summary.inImported === exp.in) {
      console.log(`\n🎉 PASS — ${SHEET} matches expected counts (out=${exp.out} + in=${exp.in})`);
    } else {
      console.log(`\n✗ MISMATCH — expected out=${exp.out} in=${exp.in}, got out=${summary.outImported} in=${summary.inImported}`);
      process.exit(1);
    }
  } else {
    console.log(`\nℹ no expected counts registered for sheet '${SHEET}'; report-only.`);
  }
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.stack : e);
  process.exit(1);
});
