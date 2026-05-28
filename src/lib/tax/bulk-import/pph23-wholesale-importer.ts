/**
 * Wholesale withholding ledger importer for PPh23.
 *
 * Accepts a real-world wholesale xlsx/csv (3-row header, free-text columns,
 * mixed tax types, Indo date format) and produces a clean CSV string ready
 * for POST /api/tax/pph23-transactions/import.
 *
 * Pipeline:
 *   parseTabularFile -> detectHeaderRow -> mapColumns -> filterByTaxType ->
 *   normalizeRow -> rowsToCsv -> WholesaleImportSummary
 *
 * Server endpoint / DB schema unchanged. PPh23-only - PPh4(2) / PPh26 /
 * PPh21 BP rows are skipped with explicit counts.
 */

import { parseTabularFile, rowsToCsv } from './client-file-parser';

export interface WholesaleImportSummary {
  imported: number;
  skippedByTaxType: number;
  skippedByValidation: number;
  errors: Array<{ rowNumber: number; reason: string }>;
  csvContent: string;
}

const PPH23_HEADERS = [
  'transaction_date',
  'service_type',
  'gross_amount',
  'counterparty_name',
  'counterparty_npwp',
  'invoice_number',
  'description',
] as const;
type Pph23Header = (typeof PPH23_HEADERS)[number];

// Header detection

const HEADER_HINTS = [
  /^biz\s*name$/i,
  /^npwp$/i,
  /^invoice\s*(amount|date|no\.?|number)/i,
  /^tax\s*(rate|base|method)/i,
  /^type\s*of\s*tax/i,
  /^transaction\s*(desc|description)/i,
  /^sub\s*transaction/i,
];

export function detectHeaderRow(rows: string[][], lookahead = 5): number {
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, lookahead); i++) {
    const score = rows[i].reduce(
      (acc, cell) => acc + (HEADER_HINTS.some((re) => re.test(cell)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

// Column map

export interface ColumnMap {
  opp_biz_name?: number;
  opp_npwp?: number;
  invoice_amount?: number;
  invoice_date?: number;
  invoice_no?: number;
  sub_transaction?: number;
  transaction_desc?: number;
  type_of_tax?: number;
}

export class ColumnMapError extends Error {
  public missing: string[];
  constructor(missing: string[]) {
    super(`Missing required columns: ${missing.join(', ')}`);
    this.name = 'ColumnMapError';
    this.missing = missing;
  }
}

export function mapColumns(header: string[]): ColumnMap {
  const map: ColumnMap = {};
  header.forEach((cell, idx) => {
    const c = cell.toLowerCase().trim();
    if (!c) return;
    if (/^biz\s*name$/.test(c) && map.opp_biz_name === undefined) map.opp_biz_name = idx;
    else if (/^npwp$/.test(c) && map.opp_npwp === undefined) map.opp_npwp = idx;
    else if (/^invoice\s*amount/.test(c) && map.invoice_amount === undefined) map.invoice_amount = idx;
    else if (/^invoice\s*date/.test(c)) map.invoice_date = idx;
    else if (/^invoice\s*(no\.?|number)/.test(c)) map.invoice_no = idx;
    else if (/^sub\s*transaction/.test(c)) map.sub_transaction = idx;
    else if (/^transaction\s*(desc|description)/.test(c)) map.transaction_desc = idx;
    else if (/^type\s*of\s*tax/.test(c)) map.type_of_tax = idx; // LAST match wins (withholding, not VAT)
  });

  const missing: string[] = [];
  if (map.opp_biz_name === undefined) missing.push('Biz Name');
  if (map.invoice_amount === undefined) missing.push('Invoice Amount');
  if (map.invoice_date === undefined) missing.push('Invoice Date');
  if (map.type_of_tax === undefined) missing.push('Type of Tax');
  if (missing.length > 0) throw new ColumnMapError(missing);
  return map;
}

// Tax type filter

export type SkipReason = 'pph4_2' | 'pph26' | 'pph21bp' | 'unknown';

export function classifyTaxType(s: string): 'pph23_jasa' | 'pph23_sewa' | SkipReason {
  const t = s.toUpperCase().trim();
  if (/^PPH\s*23\s+SEWA/.test(t)) return 'pph23_sewa';
  if (/^PPH\s*23(\s+JASA)?/.test(t)) return 'pph23_jasa';
  if (/^PPH\s*4\s+AYAT\s+2/.test(t)) return 'pph4_2';
  if (/^PPH?\s*26/.test(t)) return 'pph26';
  if (/^PPH\s*21/.test(t)) return 'pph21bp';
  return 'unknown';
}

// Field normalisers

export function parseAmount(s: string): number {
  if (typeof s !== 'string') return NaN;
  const cleaned = s.replace(/[\s,.]/g, '');
  if (cleaned === '') return NaN;
  if (!/^\d+$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseIndoDate(s: string): string | null {
  if (!s) return null;
  const trimmed = s.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;

  const dMmmY = trimmed.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2}|\d{4})$/);
  if (dMmmY) {
    const day = Number(dMmmY[1]);
    const mon = MONTH_ABBR[dMmmY[2].toLowerCase()];
    let year = Number(dMmmY[3]);
    if (!mon || day < 1 || day > 31) return null;
    if (year < 100) year = year <= 30 ? 2000 + year : 1900 + year;
    return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dmy = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2}|\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const mon = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    if (year < 100) year = year <= 30 ? 2000 + year : 1900 + year;
    return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

export function classifyServiceType(
  typeOfTax: string,
  subTrans: string,
  desc: string,
): string {
  if (classifyTaxType(typeOfTax) === 'pph23_sewa') return 'SEWA';
  const blob = `${subTrans} ${desc}`.toLowerCase();
  if (/manajemen|management/.test(blob)) return 'JASA_MANAJEMEN';
  if (/konsultan|consultant|consulting/.test(blob)) return 'JASA_KONSULTAN';
  if (/teknik|telekom|internet|sambungan|software|hardware/.test(blob)) return 'JASA_TEKNIK';
  return 'JASA_LAINNYA';
}

// Pipeline

interface NormalizedRow {
  transaction_date: string;
  service_type: string;
  gross_amount: string;
  counterparty_name: string;
  counterparty_npwp: string;
  invoice_number: string;
  description: string;
}

function getCell(row: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return (row[idx] ?? '').toString().trim();
}

export async function importWholesaleFile(file: File): Promise<WholesaleImportSummary> {
  const parsed = await parseTabularFile(file);

  const allRows: string[][] = [parsed.headers, ...parsed.dataRows];
  const headerIdx = detectHeaderRow(allRows);
  const header = allRows[headerIdx];
  const dataRows = allRows.slice(headerIdx + 1);

  const columnMap = mapColumns(header);

  const normalized: NormalizedRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];
  let skippedByTaxType = 0;
  let skippedByValidation = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = headerIdx + i + 2; // 1-based, matches Excel row numbering

    const taxTypeStr = getCell(row, columnMap.type_of_tax);
    const taxCls = classifyTaxType(taxTypeStr);
    if (taxCls === 'pph4_2' || taxCls === 'pph26' || taxCls === 'pph21bp' || taxCls === 'unknown') {
      skippedByTaxType++;
      continue;
    }

    const counterparty_name = getCell(row, columnMap.opp_biz_name);
    if (!counterparty_name) {
      skippedByValidation++;
      errors.push({ rowNumber, reason: 'missing counterparty_name' });
      continue;
    }

    const amount = parseAmount(getCell(row, columnMap.invoice_amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      skippedByValidation++;
      errors.push({ rowNumber, reason: 'invalid gross_amount' });
      continue;
    }

    const dateRaw = getCell(row, columnMap.invoice_date);
    const date = parseIndoDate(dateRaw);
    if (!date) {
      skippedByValidation++;
      errors.push({ rowNumber, reason: `invalid date format: ${dateRaw}` });
      continue;
    }

    const subTrans = getCell(row, columnMap.sub_transaction);
    const desc = getCell(row, columnMap.transaction_desc);
    const service_type = classifyServiceType(taxTypeStr, subTrans, desc);

    normalized.push({
      transaction_date: date,
      service_type,
      gross_amount: String(amount),
      counterparty_name,
      counterparty_npwp: getCell(row, columnMap.opp_npwp),
      invoice_number: getCell(row, columnMap.invoice_no),
      description: desc,
    });
  }

  const csvContent = rowsToCsv(
    PPH23_HEADERS as unknown as string[],
    normalized.map((n) => PPH23_HEADERS.map((h) => n[h as Pph23Header])),
  );

  return {
    imported: normalized.length,
    skippedByTaxType,
    skippedByValidation,
    errors,
    csvContent,
  };
}
