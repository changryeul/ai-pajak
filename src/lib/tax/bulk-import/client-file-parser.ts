/**
 * Client-side tabular file parser for bulk-import flows (PPh21 / PPh23 / etc).
 *
 * Handles CSV + XLSX/XLS uniformly. Uses dynamic `xlsx` import so the
 * 500KB+ library only loads when the user actually picks a file — main
 * bundle stays lean.
 *
 * Returns rows as string[] (everything stringified) so downstream code
 * (column mapping UI, server submit) can stay uniform across formats.
 */

export interface ParsedTabular {
  /** Header row (first row), trimmed, BOM stripped, quotes stripped. */
  headers: string[];
  /** All non-empty data rows after the header, each as string[]. */
  dataRows: string[][];
  /** First few data rows for UI preview (≤3 rows). */
  preview: string[][];
}

const STRIP_QUOTES = /['"]/g;

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(STRIP_QUOTES, '');
}

function isExcel(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.xlsx') || name.endsWith('.xls');
}

/**
 * Parse a CSV or Excel file into headers + rows.
 *
 * - CSV: read as UTF-8 text, strip BOM, split on newlines + commas.
 * - XLSX/XLS: read as ArrayBuffer, parse via xlsx library, take the first
 *   sheet, convert rows to string arrays.
 *
 * Throws on empty file or no data rows.
 */
export async function parseTabularFile(file: File): Promise<ParsedTabular> {
  let rawRows: string[][];

  if (isExcel(file)) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Excel file has no sheets');
    // header: 1 → array-of-arrays; defval: '' → undefined cells become empty;
    // raw: false → dates/numbers get formatted to strings already.
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false });
    rawRows = aoa.map((row) => row.map(cleanCell));
  } else {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    rawRows = lines.map((line) =>
      line.replace(/^﻿/, '').split(',').map(cleanCell),
    );
  }

  // Drop fully empty trailing rows (Excel often pads).
  while (rawRows.length > 0 && rawRows[rawRows.length - 1].every((c) => c === '')) {
    rawRows.pop();
  }
  // Drop leading empty rows.
  while (rawRows.length > 0 && rawRows[0].every((c) => c === '')) {
    rawRows.shift();
  }

  if (rawRows.length < 2) {
    throw new Error('No data rows (need header + at least 1 data row)');
  }

  const headers = rawRows[0];
  const dataRows = rawRows.slice(1).filter((r) => r.some((c) => c !== ''));
  const preview = dataRows.slice(0, 3);

  return { headers, dataRows, preview };
}

/**
 * Find the row most likely to be the header by scoring against the provided
 * regex hint set. Returns 0 if no row scores ≥2 hints (so existing behavior
 * — first row is header — is preserved when the file is already well-formed).
 *
 * Used by PPh21 + future PPh23/PPN imports to skip meta header rows like
 * "YEAR / 2023" or "Input Data / expected" that appear above the real column
 * names in customer-provided xlsx files.
 */
export function findBestHeaderRow(
  rows: string[][],
  hints: RegExp[],
  lookahead = 5,
): number {
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, lookahead); i++) {
    const score = rows[i].reduce(
      (acc, cell) => acc + (hints.some((re) => re.test(cell)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

/**
 * Serialise parsed rows back into CSV text (for sites that POST CSV to the server).
 * Quotes any cell containing comma/newline/quote, escapes inner quotes by doubling.
 */
export function rowsToCsv(headers: string[], dataRows: string[][]): string {
  const escapeCell = (v: string): string => {
    if (/[",\r\n]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines = [headers, ...dataRows].map((row) => row.map(escapeCell).join(','));
  return lines.join('\n');
}
