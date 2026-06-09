/**
 * Verify the PPN wholesale importer's contract against the JTC official
 * 13-col VAT template shape. Pure in-memory test — no DB, no network, no
 * file dependency. Always runs in smoke (optional: false).
 *
 * Asserts the silent quality fixes:
 *   1. Pre-numbered empty slots (NO=2,3,4 with all other cells blank)
 *      are skipped silently, NOT reported as missing-name errors.
 *   2. errors[].rowNumber cites the ORIGINAL Excel row (1-based), not the
 *      post-filter compressed index.
 *   3. The JTC template's VAT IN section omitting DPP NILAI LAIN does NOT
 *      reject the file — only OUT carries the optional column.
 *   4. DPP NILAI LAIN (PMK 131/2024) is correctly captured in the OUT CSV.
 *
 *   npx tsx scripts/verify-ppn-jtc-template-contract.ts
 */

import XLSX from 'xlsx';
import { importPpnWholesaleFile } from '../src/lib/tax/bulk-import/ppn-wholesale-importer';

function makeXlsxFile(aoa: unknown[][], name = 'jtc-template.xlsx'): File {
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'FEB');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const u8 = Uint8Array.from(buf);
  return {
    name,
    arrayBuffer: async () => u8.buffer as ArrayBuffer,
    text: async () => '',
  } as unknown as File;
}

const JTC_OUT_HEADER = ['NO', 'NPWP', 'NAME', 'ADDRESS', 'INVOICE NO', 'DESC', 'EFAKTUR NO', 'EFAKTUR DATE', 'TAX BASE', 'DPP NILAI LAIN', 'TAX RATE', 'VAT', 'NOTES'];
const JTC_IN_HEADER  = ['NO', 'NPWP', 'NAME', 'ADDRESS', 'INVOICE NO', 'DESC', 'EFAKTUR NO', 'EFAKTUR DATE', 'TAX BASE', '',                  'TAX RATE', 'VAT', 'NOTES'];

const JTC_TEMPLATE_AOA: unknown[][] = [
  ['NAME', ': PT JTC TEST'],
  ['NPWP', ': 99.999.999.9-999.000'],
  ['ADDRESS', ': Jakarta'],
  ['PERIOD', ': FEBRUARY 2026'],
  [''],
  ['VAT OUT'],
  JTC_OUT_HEADER,
  [1, '01.000.001.0-001.000', 'pt angin ribut', 'jl. Suharto', 'k/2025/01', 'jualan kulit sinterik 2Meter', '04000000', '2025-01-11', 8000000, 7333333, 0.12, 880000, ''],
  [2, '', '', '', '', '', '', '', '', '', '', '', ''],
  [3, '', '', '', '', '', '', '', '', '', '', '', ''],
  [4, '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', 'TOTAL VAT OUT', '', '', '', 880000, ''],
  [''],
  ['VAT IN'],
  JTC_IN_HEADER,
  [1, '', '', '', '', '', '', '', '', '', '', '', ''],
  [2, '', '', '', '', '', '', '', '', '', '', '', ''],
  [3, '', '', '', '', '', '', '', '', '', '', '', ''],
  [4, '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', 'VAT IN', '', '', '', 0, ''],
  [''],
  ['', '', '', '', '', '', '', 'CALCULATION:'],
  ['', '', '', '', '', '', '', 'TOTAL VAT OUT', '', '', '', 880000, ''],
  ['', '', '', '', '', '', '', 'VAT IN', '', '', '', 0, ''],
  ['', '', '', '', '', '', '', 'OVERPAID ON JANUARY 2026', '', '', '', 0, ''],
  ['', '', '', '', '', '', '', 'TOTAL VAT IN', '', '', '', 0, ''],
  ['', '', '', '', '', '', '', 'VAT PAYABLE', '', '', '', 880000, ''],
];

interface Assertion { ok: boolean; label: string; detail?: string; }
const results: Assertion[] = [];
function assert(ok: boolean, label: string, detail?: string) {
  results.push({ ok, label, detail });
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('\n=== JTC VAT template contract (offline, in-memory) ===\n');

  const file = makeXlsxFile(JTC_TEMPLATE_AOA);
  const summary = await importPpnWholesaleFile(file);

  // 1. Single data row imported into OUT.
  assert(summary.outImported === 1, 'outImported === 1', `got ${summary.outImported}`);

  // 2. VAT IN has no data — template's IN slots all blank, no error.
  assert(summary.inImported === 0, 'inImported === 0', `got ${summary.inImported}`);

  // 3. THE silent-quality fix: empty pre-numbered slots produce 0 validation errors.
  assert(summary.skippedByValidation === 0, 'skippedByValidation === 0',
    `got ${summary.skippedByValidation}`);
  assert(summary.errors.length === 0, 'errors.length === 0',
    `got ${summary.errors.length}: ${JSON.stringify(summary.errors)}`);

  // 4. DPP NILAI LAIN (PMK 131/2024) captured in OUT CSV.
  const outLines = summary.outCsv.split('\n');
  const dataLine = outLines[1] ?? '';
  assert(dataLine.includes('7333333'), 'OUT CSV contains dpp_nilai_lain (7333333)',
    `dataLine="${dataLine}"`);
  assert(dataLine.includes('8000000'), 'OUT CSV contains dpp (8000000)');
  assert(dataLine.includes('880000'), 'OUT CSV contains ppn (880000)');
  assert(dataLine.includes('pt angin ribut'), 'OUT CSV contains counterparty_name');

  // 5. rowNumber preservation: synthesize a fault case with leading-blank
  //    rows and assert the error cites the ORIGINAL Excel row, not the
  //    post-filter index.
  const faultAoa: unknown[][] = [
    [''],          // Excel row 1 — leading blank
    [''],          // Excel row 2 — leading blank
    JTC_OUT_HEADER,// Excel row 3 — header
    [1, 'NPWP-1', '', 'X', '', '', '', '2026-05-05', 100000, 0, 0.12, 12000, ''], // row 4 — missing NAME
  ];
  const fault = await importPpnWholesaleFile(makeXlsxFile(faultAoa));
  assert(fault.errors.length === 1, 'fault case → 1 validation error', `got ${fault.errors.length}`);
  if (fault.errors.length === 1) {
    assert(fault.errors[0].rowNumber === 4,
      'fault rowNumber === 4 (original Excel row, not post-filter index 2)',
      `got rowNumber=${fault.errors[0].rowNumber}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✅ PASS' : '❌ FAIL'} — ${results.length - failed.length}/${results.length} assertions\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
