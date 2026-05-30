/**
 * Validate that cleanCell + raw:true changes (PPh23 fix) didn't regress the
 * PPh21 import flow. PPh21 has its own importer flow (different from PPh23
 * wholesale) but shares parseTabularFile + findBestHeaderRow.
 *
 * Mimics what handleExcelUpload + handleConfirmMapping do in the page.tsx:
 *   1. parseTabularFile → headers + dataRows
 *   2. findBestHeaderRow(allRows, PPH21_HINTS) → adjust header index
 *   3. KEYWORD_MAP auto-map → mapped columns
 *   4. rowsToCsv with mapped headers → CSV blob
 *
 * Does NOT POST to /api/tax/employees/import (we just want to verify the
 * parser + mapping pipeline is clean — server side is unchanged).
 */

import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { parseTabularFile, findBestHeaderRow, rowsToCsv } from '../src/lib/tax/bulk-import/client-file-parser';

const PPH21_FILE = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - PPh 21 CALCULATION 2026.xlsx';

// Inspect all sheet names + first sheet structure first
const buf = readFileSync(PPH21_FILE);
const wbInspect = XLSX.read(buf, { type: 'buffer', cellDates: true });
console.log(`\n📂 ${PPH21_FILE}`);
console.log(`📋 sheets: ${wbInspect.SheetNames.join(', ')}\n`);

async function main() {
  // Wrap as File so parseTabularFile (which expects File) works
  const file = new File([buf], 'PPh21-2026.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  let parsed;
  try {
    parsed = await parseTabularFile(file);
  } catch (e) {
    console.error(`✗ parseTabularFile failed:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log(`✅ Step 1: parseTabularFile — ${parsed.headers.length} headers, ${parsed.dataRows.length} data rows`);
  console.log(`   headers (raw, first 12): ${parsed.headers.slice(0, 12).map((h) => `'${h.slice(0, 22)}'`).join(', ')}`);
  console.log(`   first 3 data rows:`);
  parsed.dataRows.slice(0, 3).forEach((r, i) => {
    console.log(`     [${i}] ${r.slice(0, 12).map((c) => `'${c.slice(0, 16)}'`).join(', ')}`);
  });

  // Step 2: findBestHeaderRow with PPh21 hints (same as page.tsx)
  const PPH21_HINTS = [
    /^(name|nama|이름|emp\s*id|employee)/i,
    /^npwp$/i,
    /^nik$/i,
    /^(gaji|salary|gross|기본급)/i,
    /^(tunjangan|allowance|수당)/i,
    /^(tax\s*status|ptkp|status)$/i,
    /^(status\s*pegawai|worker|jenis)/i,
    /^(honorarium|honor|bonus|thr)/i,
    /^(jht|jp|bpjs|kesehatan|pensiun)/i,
  ];
  const allRows = [parsed.headers, ...parsed.dataRows];
  const headerIdx = findBestHeaderRow(allRows, PPH21_HINTS);
  const header = allRows[headerIdx];
  console.log(`\n✅ Step 2: findBestHeaderRow → row ${headerIdx}`);
  console.log(`   header at that row: ${header.slice(0, 16).map((h) => `'${h.slice(0, 22)}'`).join(', ')}`);

  const dataRowsAfterHeader = allRows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== ''));
  console.log(`   data rows after header: ${dataRowsAfterHeader.length}`);

  // Step 3: keyword auto-map (same KEYWORD_MAP as page.tsx)
  const KEYWORD_MAP: Record<string, string[]> = {
    employee_name: ['nama', 'name', 'karyawan', 'pegawai', '이름', 'employee', 'emp_name'],
    employee_npwp: ['npwp', 'tax_id', 'tax id'],
    employee_nik: ['nik', 'ktp', 'no ktp', 'identitas'],
    ptkp_category: ['ptkp', 'tax status', 'status pajak', 'kategori ptkp'],
    gross_salary: ['gaji', 'salary', 'basic', 'pokok', 'base', '기본급', 'gross', 'gapok', 'gaji pokok', 'pendapatan', 'monthly salary'],
    position_allowance: ['jabatan', 'position', '직책', 'tunjangan jabatan'],
    overtime_pay: ['lembur', 'overtime', '초과', 'uang lembur'],
    meal_allowance: ['makan', 'meal', '식대', 'tunjangan makan', 'uang makan'],
    transport_allowance: ['transport', '교통', 'tunjangan transport', 'transportasi'],
    other_allowances: ['tunjangan lain', 'tunjangan lainnya', 'allowance', '수당', 'honorarium', 'imbalan', 'tunjangan'],
    bonus: ['bonus', '보너스', 'tantiem', 'gratifikasi'],
    thr: ['thr', 'hari raya', 'tunjangan hari raya'],
    jht_employee: ['jht', 'hari tua', 'jaminan hari tua', 'iuran jht'],
    jp_employee: ['jp', 'pensiun', 'jaminan pensiun', 'iuran pensiun'],
    bpjs_kesehatan: ['bpjs', 'kesehatan', 'bpjs kesehatan', 'asuransi kesehatan'],
    other_deductions: ['potongan', 'deduction', '공제', 'pemotongan', 'iuran lain'],
    worker_type: ['type', 'tipe', 'jenis', '유형', 'status pegawai', 'worker type', 'pegawai tetap'],
  };

  const usedTargets = new Set<string>();
  const mappings = header.map((h) => {
    const lower = h.toLowerCase();
    for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
      if (usedTargets.has(field)) continue;
      if (keywords.some((kw) => lower.includes(kw) || kw.includes(lower))) {
        usedTargets.add(field);
        return { sourceColumn: h, targetField: field };
      }
    }
    return { sourceColumn: h, targetField: '' };
  });

  const matchedCount = mappings.filter((m) => m.targetField).length;
  const hasName = mappings.some((m) => m.targetField === 'employee_name');
  const hasSalary = mappings.some((m) => m.targetField === 'gross_salary');
  const rate = matchedCount / Math.max(header.length, 1);

  console.log(`\n✅ Step 3: auto-mapping — ${matchedCount}/${header.length} matched (${(rate * 100).toFixed(0)}%)`);
  console.log(`   required: employee_name=${hasName}, gross_salary=${hasSalary}`);
  console.log(`   mappings (first 12):`);
  mappings.slice(0, 12).forEach((m) => {
    const icon = m.targetField ? '✓' : '×';
    console.log(`     ${icon} '${m.sourceColumn.slice(0, 22)}' → ${m.targetField || '(skipped)'}`);
  });

  // Step 4: rowsToCsv with mapped headers
  const mappedHeaders = mappings.map((m) => m.targetField || 'SKIP');
  const csv = rowsToCsv(mappedHeaders, dataRowsAfterHeader.slice(0, 10));
  console.log(`\n✅ Step 4: rowsToCsv preview (first 10 data rows):`);
  csv.split('\n').slice(0, 6).forEach((l) => console.log(`     ${l.slice(0, 200)}`));

  // Verdict
  console.log(`\n📊 verdict:`);
  if (hasName && hasSalary && rate >= 0.5) {
    console.log(`   🎉 PASS — parser + auto-map yields usable mapping (would auto-import in UI)`);
  } else if (hasName && hasSalary) {
    console.log(`   ⚠ PARTIAL — required fields present but match rate ${(rate * 100).toFixed(0)}% < 70% — UI would prompt manual mapping`);
  } else {
    console.log(`   ✗ FAIL — required fields missing (name=${hasName}, salary=${hasSalary}) — UI would block`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('💥', e instanceof Error ? e.stack : e);
  process.exit(1);
});
