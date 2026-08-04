/**
 * Run the PPh23 wholesale importer against the real BINTANG JAYA WHT file
 * (2601 January sheet) and report every failure point.
 *
 * Bypasses the browser File API — extracts the sheet via xlsx directly and
 * feeds raw rows through the importer's internal pipeline. Same logic as
 * importWholesaleFile(), but synchronous + introspectable.
 */

import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import {
  detectHeaderRow,
  mapColumns,
  classifyTaxType,
  classifyServiceType,
  parseAmount,
  parseIndoDate,
  ColumnMapError,
} from '../src/lib/tax/bulk-import/pph23-wholesale-importer';

const WHT_FILE = '/Users/winwaysystems/Downloads/BINTANG JAYA SOLUTIONS - WHT CALCULATION 2026.xlsx';
const SHEET = process.argv[2] ?? '2601';

const STRIP_QUOTES = /['"]/g;
const cleanCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return String(Math.round(v));
  }
  return String(v).trim().replace(STRIP_QUOTES, '');
};

console.log(`\n📂 Loading ${WHT_FILE}`);
const wb = XLSX.read(readFileSync(WHT_FILE), { type: 'buffer', cellDates: true });
const ws = wb.Sheets[SHEET];
if (!ws) {
  console.error(`✗ sheet '${SHEET}' not found. Available: ${wb.SheetNames.join(', ')}`);
  process.exit(1);
}

// Replicate parseTabularFile() output shape
const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });
const rawRows = aoa.map((row) => row.map(cleanCell));
while (rawRows.length > 0 && rawRows[rawRows.length - 1].every((c) => c === '')) rawRows.pop();
while (rawRows.length > 0 && rawRows[0].every((c) => c === '')) rawRows.shift();

console.log(`\n📋 Sheet '${SHEET}' — ${rawRows.length} rows after cleanup`);
console.log(`   First 6 rows:`);
rawRows.slice(0, 6).forEach((r, i) => {
  console.log(`   [${i}] ${r.slice(0, 10).map((c) => c.slice(0, 18)).join(' | ')}`);
});

// Step 1: detectHeaderRow (uses HEADER_HINTS, lookahead=5 by default)
console.log(`\n🔎 Step 1: detectHeaderRow(lookahead=5)`);
const headerIdx5 = detectHeaderRow(rawRows);
console.log(`   → returned index ${headerIdx5}`);
console.log(`   → row at that idx: ${(rawRows[headerIdx5] ?? []).slice(0, 10).join(' | ')}`);

// Try with wider lookahead — real headers at row 5
console.log(`\n🔎 Step 1b: detectHeaderRow(lookahead=10)`);
const headerIdx10 = detectHeaderRow(rawRows, 10);
console.log(`   → returned index ${headerIdx10}`);
console.log(`   → row at that idx: ${(rawRows[headerIdx10] ?? []).slice(0, 14).join(' | ')}`);

const headerIdx = headerIdx10;  // use the wider one for downstream tests
const header = rawRows[headerIdx];
const dataRows = rawRows.slice(headerIdx + 1);

// Step 2: mapColumns
console.log(`\n🔎 Step 2: mapColumns()`);
let columnMap;
try {
  columnMap = mapColumns(header);
  console.log(`   ✅ columnMap:`, columnMap);
} catch (e) {
  if (e instanceof ColumnMapError) {
    console.log(`   ❌ ColumnMapError — missing: ${e.missing.join(', ')}`);
    console.log(`   header was: ${header.slice(0, 14).join(' | ')}`);
  } else {
    console.log(`   ❌ unexpected error:`, e);
  }
  console.log(`\n→ Cannot proceed past mapColumns. Stopping.`);
  process.exit(1);
}

// Step 3: iterate dataRows, apply pipeline
console.log(`\n🔎 Step 3: per-row classify + normalize (${dataRows.length} rows)`);
let importedCount = 0;
let skippedByTaxType = 0;
let skippedByValidation = 0;
const errors: Array<{ row: number; reason: string }> = [];
const samples: Array<{ row: number; normalized: Record<string, string> }> = [];
const taxTypeCounts: Record<string, number> = {};

for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  const rowNumber = headerIdx + i + 2;

  const getCell = (idx: number | undefined) =>
    idx === undefined ? '' : (row[idx] ?? '').toString().trim();

  const taxTypeStr = getCell(columnMap.type_of_tax);
  const taxCls = classifyTaxType(taxTypeStr);
  taxTypeCounts[`${taxTypeStr || '(empty)'} → ${taxCls}`] =
    (taxTypeCounts[`${taxTypeStr || '(empty)'} → ${taxCls}`] ?? 0) + 1;

  if (taxCls === 'pph4_2' || taxCls === 'pph26' || taxCls === 'pph21bp' || taxCls === 'unknown') {
    skippedByTaxType++;
    continue;
  }

  const counterparty_name = getCell(columnMap.opp_biz_name);
  if (!counterparty_name) {
    skippedByValidation++;
    errors.push({ row: rowNumber, reason: 'missing counterparty_name' });
    continue;
  }

  const amount = parseAmount(getCell(columnMap.invoice_amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    skippedByValidation++;
    errors.push({ row: rowNumber, reason: `invalid gross_amount (raw=${getCell(columnMap.invoice_amount)})` });
    continue;
  }

  const dateRaw = getCell(columnMap.invoice_date);
  const date = parseIndoDate(dateRaw);
  if (!date) {
    skippedByValidation++;
    errors.push({ row: rowNumber, reason: `invalid date format: ${dateRaw.slice(0, 40)}` });
    continue;
  }

  const subTrans = getCell(columnMap.sub_transaction);
  const desc = getCell(columnMap.transaction_desc);
  const service_type = classifyServiceType(taxTypeStr, subTrans, desc);

  const normalized = {
    transaction_date: date,
    service_type,
    gross_amount: String(amount),
    counterparty_name,
    counterparty_npwp: getCell(columnMap.opp_npwp),
    invoice_number: getCell(columnMap.invoice_no),
    description: desc,
  };
  if (samples.length < 5) samples.push({ row: rowNumber, normalized });
  importedCount++;
}

console.log(`\n📊 Summary`);
console.log(`   imported:           ${importedCount}`);
console.log(`   skippedByTaxType:   ${skippedByTaxType}`);
console.log(`   skippedByValidation:${skippedByValidation}`);
console.log(`   total processed:    ${dataRows.length}`);

console.log(`\n📊 taxType counts:`);
Object.entries(taxTypeCounts).slice(0, 20).forEach(([k, v]) => console.log(`   ${v}× ${k}`));

if (errors.length > 0) {
  console.log(`\n⚠ first 10 validation errors:`);
  errors.slice(0, 10).forEach((e) => console.log(`   row ${e.row}: ${e.reason}`));
}

if (samples.length > 0) {
  console.log(`\n✅ first 5 normalized rows:`);
  samples.forEach((s) => {
    console.log(`   row ${s.row}: ${JSON.stringify(s.normalized)}`);
  });
}
