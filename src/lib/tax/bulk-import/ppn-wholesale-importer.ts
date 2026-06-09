/**
 * Wholesale VAT compliance importer for PPN.
 *
 * Accepts a real-world VAT compliance xlsx (one sheet per month, with both
 * VAT OUT (PPN KELUARAN) and VAT IN (PPN MASUKAN) sections stacked vertically)
 * and produces TWO clean CSV strings ready for POST /api/tax/ppn-bulk-import.
 *
 * Pipeline:
 *   parseTabularFile → findBestHeaderRow (OUT) → findVatInHeader (IN) →
 *   mapPpnColumns → normalizeRow (skip footers / Notes) → rowsToCsv (×2) →
 *   PpnWholesaleSummary
 *
 * Re-uses parseIndoDate + parseAmount from pph23-wholesale-importer — stable
 * date/amount normalisation.
 *
 * Q1 = (a) single upload extracts both sections.
 * Q2 = (a) TAX BASE as-is (no DPP Nilai Lain 11/12 adjustment in bulk).
 * Q3 = (B) new dedicated endpoint avoids the existing single-faktur
 *          endpoint's hard-coded 0.11 rate.
 *
 * Phase 3.1 (2026-06-01): also captures OTHER TAX BASE column when present
 * → dpp_nilai_lain in normalized row. Empty when source file lacks the column;
 * server-side PPNCalculator.adjustDPP fills the gap.
 */

import { parseTabularFile, rowsToCsv, findBestHeaderRow } from './client-file-parser';
import { parseIndoDate, parseAmount } from './pph23-wholesale-importer';

const PPN_CSV_HEADERS = [
  'faktur_date',       // EFAKTUR DATE
  'faktur_number',     // EFAKTUR NO
  'counterparty_name', // NAME
  'counterparty_npwp', // NPWP
  'dpp',               // TAX BASE
  'dpp_nilai_lain',    // OTHER TAX BASE (PMK 131/2024 adjusted DPP, optional)
  'ppn',               // VAT (raw from file — rate may be 11% or 12%)
  'description',       // DESC
] as const;
type PpnCsvHeader = (typeof PPN_CSV_HEADERS)[number];

// Header detection — these regexes match cells in a typical PPN VAT compliance
// row header (NO | NPWP | NAME | ADDRESS | DESC | EFAKTUR NO | INVOICE NO |
// EFAKTUR DATE | TAX BASE | OTHER TAX BASE | TAX RATE | VAT | ...).
export const HEADER_HINTS = [
  /^npwp$/i,
  /^name$/i,
  /^desc(ription)?$/i,
  /^efaktur\s*(no\.?|number)/i,
  /^efaktur\s*date/i,
  /^tax\s*base/i,
  /^(vat|ppn)$/i,
];

// ── Errors ──────────────────────────────────────────────────────────────

export class PpnColumnMapError extends Error {
  public missing: string[];
  constructor(missing: string[]) {
    super(`Missing required PPN columns: ${missing.join(', ')}`);
    this.name = 'PpnColumnMapError';
    this.missing = missing;
  }
}

// ── Column mapping ──────────────────────────────────────────────────────

export interface PpnColumnMap {
  no?: number;
  npwp?: number;
  name?: number;
  desc?: number;
  efaktur_no?: number;
  efaktur_date?: number;
  tax_base?: number;
  other_tax_base?: number;  // PMK 131/2024 adjusted DPP (optional)
  vat?: number;
}

export function mapPpnColumns(header: string[]): PpnColumnMap {
  const map: PpnColumnMap = {};
  header.forEach((cell, idx) => {
    const c = cell.toLowerCase().trim();
    if (!c) return;
    if (c === 'no' && map.no === undefined) map.no = idx;
    else if (c === 'npwp' && map.npwp === undefined) map.npwp = idx;
    else if (c === 'name' && map.name === undefined) map.name = idx;
    else if (/^desc(ription)?$/.test(c) && map.desc === undefined) map.desc = idx;
    else if (/^efaktur\s*(no\.?|number)/.test(c) && map.efaktur_no === undefined) map.efaktur_no = idx;
    else if (/^efaktur\s*date/.test(c) && map.efaktur_date === undefined) map.efaktur_date = idx;
    // 'TAX BASE' matches FIRST. 'OTHER TAX BASE' is also a column but starts
    // with 'other', so the `^tax\s*base` anchor protects us.
    else if (/^tax\s*base/.test(c) && map.tax_base === undefined) map.tax_base = idx;
    // OTHER TAX BASE = PMK 131/2024 adjusted DPP (dpp × 11/12). Also matches
    // 'DPP Nilai Lain' literal as a synonym (some templates label the same
    // column with the Indonesian term).
    else if (/^(other\s*tax\s*base|dpp\s*nilai\s*lain)/.test(c) && map.other_tax_base === undefined) map.other_tax_base = idx;
    else if (/^(vat|ppn)$/.test(c) && map.vat === undefined) map.vat = idx;
  });

  const missing: string[] = [];
  if (map.name === undefined) missing.push('NAME');
  if (map.tax_base === undefined) missing.push('TAX BASE');
  if (map.efaktur_date === undefined) missing.push('EFAKTUR DATE');
  if (missing.length > 0) throw new PpnColumnMapError(missing);
  return map;
}

// ── Section detection ───────────────────────────────────────────────────

/**
 * Find the column-header row of the VAT IN section.
 *
 * The BINTANG JAYA layout (and similar) places a literal 'VAT IN / PPN MASUKAN'
 * title row between the two sections, then the actual column header on the
 * next non-blank line that scores ≥2 HEADER_HINTS.
 *
 * Returns null if no VAT IN section is present (some months only have OUT).
 */
export function findVatInHeader(
  allRows: string[][],
  outHeaderIdx: number,
  hints: RegExp[] = HEADER_HINTS,
  lookAhead = 4,
): number | null {
  for (let i = outHeaderIdx + 1; i < allRows.length; i++) {
    const rowText = allRows[i].join(' ').toLowerCase();
    if (/vat\s*in|masukan/.test(rowText)) {
      // Found the section title — scan forward up to `lookAhead` rows for
      // the hint-rich column header.
      for (let j = i + 1; j < Math.min(i + 1 + lookAhead, allRows.length); j++) {
        const score = allRows[j].reduce(
          (acc, cell) => acc + (hints.some((re) => re.test(cell)) ? 1 : 0),
          0,
        );
        if (score >= 2) return j;
      }
    }
  }
  return null;
}

// ── Footer / Notes detection ────────────────────────────────────────────

/**
 * Detect non-data rows that appear between/below the two sections:
 *   - row containing TOTAL/NIHIL/KURANG/LEBIH/OVERPAID/NOTES/PERIOD literal
 *     (BINTANG JAYA-style Notes section: NO column has 'Notes:' as label, name
 *     is blank — still a footer)
 *   - blank NO + blank NAME (pure spacer)
 *   - a real numbered row that has the literal 'TOTAL' / 'NIHIL' inside
 *     a non-data cell (defensive)
 *
 * Returning true means: skip this row, do not count as validation error.
 *
 * Conservative rule: a row with a non-empty NAME column that is NOT a known
 * label keyword is treated as a data candidate (so a real data row whose
 * description happens to contain "total" in narrative won't be skipped —
 * we check the NAME-or-NO cells, not the description body).
 */
const FOOTER_KEYWORDS = /^(total|nihil|kurang|lebih|overpaid|notes?|period|catatan)/i;

/**
 * Detect template-skeleton rows: NO column has a plain integer but every
 * data column (NAME/NPWP/TAX BASE/EFAKTUR DATE/VAT) is blank. JTC's official
 * VAT template pre-numbers 1..4 slots; if the user only fills slot 1, slots
 * 2-4 are NOT validation errors — they're untouched template scaffolding.
 */
function isEmptySlotRow(row: string[], colMap: PpnColumnMap): boolean {
  const no = colMap.no !== undefined ? (row[colMap.no] ?? '').toString().trim() : '';
  if (!/^\d+$/.test(no)) return false;
  const keys: (keyof PpnColumnMap)[] = ['name', 'npwp', 'tax_base', 'efaktur_date', 'vat'];
  for (const k of keys) {
    const idx = colMap[k];
    if (idx === undefined) continue;
    const v = (row[idx] ?? '').toString().trim();
    if (v) return false;
  }
  return true;
}

function isFooterRow(row: string[], colMap: PpnColumnMap): boolean {
  const no = colMap.no !== undefined ? (row[colMap.no] ?? '').toString().trim() : '';
  const name = colMap.name !== undefined ? (row[colMap.name] ?? '').toString().trim() : '';

  // Pure spacer — never has data.
  if (no === '' && name === '') {
    // Also check rest of row for keyword (TOTAL row often puts the label in
    // a deeper column when NO + NAME are both blank).
    const rest = row.join(' ').toLowerCase();
    if (rest.trim() === '' || FOOTER_KEYWORDS.test(rest)) return true;
    // Blank NO + blank NAME + non-empty other cells (e.g. a totals row with
    // amounts only) — treat as footer since we can't link it to a counterparty.
    return true;
  }

  // NO or NAME column is a known footer label ('Notes:', 'TOTAL', 'KURANG BAYAR', etc.)
  if (FOOTER_KEYWORDS.test(no) || FOOTER_KEYWORDS.test(name)) return true;

  return false;
}

// ── Per-row normalisation ───────────────────────────────────────────────

function getCell(row: string[], idx: number | undefined): string {
  if (idx === undefined) return '';
  return (row[idx] ?? '').toString().trim();
}

export interface NormalizedPpnRow {
  faktur_date: string;
  faktur_number: string;
  counterparty_name: string;
  counterparty_npwp: string;
  dpp: string;
  dpp_nilai_lain: string;  // empty when source file lacks OTHER TAX BASE
  ppn: string;
  description: string;
}

export interface PpnRowError {
  rowNumber: number;
  section: 'OUT' | 'IN';
  reason: string;
}

interface SectionResult {
  normalized: NormalizedPpnRow[];
  errors: PpnRowError[];
  skipped: number;       // skipped by validation
  skippedFooters: number; // skipped as footer/notes/blank
}

function processSection(
  dataRows: string[][],
  colMap: PpnColumnMap,
  excelRowNumbers: number[],
  section: 'OUT' | 'IN',
): SectionResult {
  const normalized: NormalizedPpnRow[] = [];
  const errors: PpnRowError[] = [];
  let skipped = 0;
  let skippedFooters = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = excelRowNumbers[i];

    if (isFooterRow(row, colMap) || isEmptySlotRow(row, colMap)) {
      skippedFooters++;
      continue;
    }

    const counterparty_name = getCell(row, colMap.name);
    if (!counterparty_name) {
      skipped++;
      errors.push({ rowNumber, section, reason: 'missing counterparty_name' });
      continue;
    }

    const dpp = parseAmount(getCell(row, colMap.tax_base));
    if (!Number.isFinite(dpp) || dpp <= 0) {
      skipped++;
      errors.push({
        rowNumber, section,
        reason: `invalid tax_base (raw=${getCell(row, colMap.tax_base)})`,
      });
      continue;
    }

    const dateRaw = getCell(row, colMap.efaktur_date);
    const date = parseIndoDate(dateRaw);
    if (!date) {
      skipped++;
      errors.push({ rowNumber, section, reason: `invalid date format: ${dateRaw}` });
      continue;
    }

    // VAT (PPN) — file value as-is when present; empty/zero handled server-side.
    const vatRaw = getCell(row, colMap.vat);
    const vat = parseAmount(vatRaw);
    const ppn = Number.isFinite(vat) ? String(vat) : '';

    // OTHER TAX BASE (PMK 131/2024 adjusted DPP) — optional column.
    // If present and > 0, preserve; otherwise leave empty so server-side
    // PPNCalculator.adjustDPP fallback can derive it.
    const dppNilaiLainRaw = colMap.other_tax_base !== undefined ? getCell(row, colMap.other_tax_base) : '';
    const dppNilaiLain = dppNilaiLainRaw ? parseAmount(dppNilaiLainRaw) : NaN;

    normalized.push({
      faktur_date: date,
      faktur_number: getCell(row, colMap.efaktur_no),
      counterparty_name,
      counterparty_npwp: getCell(row, colMap.npwp),
      dpp: String(dpp),
      dpp_nilai_lain: Number.isFinite(dppNilaiLain) && dppNilaiLain > 0 ? String(dppNilaiLain) : '',
      ppn,
      description: getCell(row, colMap.desc),
    });
  }

  return { normalized, errors, skipped, skippedFooters };
}

// ── Public summary type ─────────────────────────────────────────────────

export interface PpnWholesaleSummary {
  outImported: number;
  inImported: number;
  outCsv: string;
  inCsv: string;
  skippedByValidation: number;
  skippedFooters: number;
  errors: PpnRowError[];
}

function toCsv(rows: NormalizedPpnRow[]): string {
  return rowsToCsv(
    PPN_CSV_HEADERS as unknown as string[],
    rows.map((n) => PPN_CSV_HEADERS.map((h) => n[h as PpnCsvHeader])),
  );
}

// ── Main entry point ────────────────────────────────────────────────────

export async function importPpnWholesaleFile(file: File): Promise<PpnWholesaleSummary> {
  const parsed = await parseTabularFile(file, { preserveRowIndices: true });
  const allRows: string[][] = [parsed.headers, ...parsed.dataRows];

  // Build a parallel array mapping each allRows index → original 1-based
  // Excel row. allRows[0] is the kept `headers` (originalIndex = headerOriginalIndex);
  // allRows[1+i] is `dataRows[i]` (originalIndex = originalRowIndices[i]).
  // Fall back to identity mapping when preserveRowIndices wasn't honored
  // (defensive — opts is hard-coded above, but type-safety).
  const allRowExcel: number[] = (() => {
    const headerIdx = parsed.headerOriginalIndex ?? 0;
    const dataIdx = parsed.originalRowIndices ?? parsed.dataRows.map((_, i) => i + 1);
    return [headerIdx + 1, ...dataIdx.map((i) => i + 1)];
  })();

  // Locate OUT header. lookahead=10 because customer files commonly stack
  // 4-6 meta rows (NAME / NPWP / ADDRESS / PERIOD / blank / VAT OUT title)
  // before the actual column header.
  const outHeaderIdx = findBestHeaderRow(allRows, HEADER_HINTS, 10);
  if (outHeaderIdx === 0 && allRows[0]) {
    // findBestHeaderRow returns 0 both when row 0 is the header AND when
    // no row scores ≥2 hints. Disambiguate by re-scoring row 0.
    const score = allRows[0].reduce(
      (acc, cell) => acc + (HEADER_HINTS.some((re) => re.test(cell)) ? 1 : 0),
      0,
    );
    if (score < 2) throw new PpnColumnMapError(['VAT OUT header row not found']);
  }

  const outHeader = allRows[outHeaderIdx];
  const outColMap = mapPpnColumns(outHeader);

  const inHeaderIdx = findVatInHeader(allRows, outHeaderIdx);
  const inColMap = inHeaderIdx !== null ? mapPpnColumns(allRows[inHeaderIdx]) : null;

  // Slice data rows for each section.
  const outEndExclusive = inHeaderIdx !== null
    ? Math.max(outHeaderIdx + 1, inHeaderIdx - 1)
    : allRows.length;
  const outDataRows = allRows.slice(outHeaderIdx + 1, outEndExclusive);
  const outExcelRows = allRowExcel.slice(outHeaderIdx + 1, outEndExclusive);

  const outResult = processSection(outDataRows, outColMap, outExcelRows, 'OUT');

  let inResult: SectionResult = { normalized: [], errors: [], skipped: 0, skippedFooters: 0 };
  if (inHeaderIdx !== null && inColMap) {
    const inDataRows = allRows.slice(inHeaderIdx + 1);
    const inExcelRows = allRowExcel.slice(inHeaderIdx + 1);
    inResult = processSection(inDataRows, inColMap, inExcelRows, 'IN');
  }

  return {
    outImported: outResult.normalized.length,
    inImported: inResult.normalized.length,
    outCsv: toCsv(outResult.normalized),
    inCsv: toCsv(inResult.normalized),
    skippedByValidation: outResult.skipped + inResult.skipped,
    skippedFooters: outResult.skippedFooters + inResult.skippedFooters,
    errors: [...outResult.errors, ...inResult.errors],
  };
}
