/**
 * WHT One-Sheet integrated parser — JTC 21-col 통합 매입 ledger.
 *
 * 한 row = 한 매입 invoice, 여러 tax type 가 함께 (PPh23 / PPh26 / PPh4(2) / PPN).
 * 기존 importer 는 tax type 별 ledger 였음. 새 흐름: 한 xlsx 가 한 달 모든 매입
 * invoice → 자동 분류 + preview override + bulk insert.
 *
 * Template column map (A..U = 21):
 *   A NO / B ALAMAT / C NAMA / D NPWP
 *   E DESKRIPSI / F NO. INVOICE / G NO. FAKTUR / H TGL INVOICE
 *   I TGL JTH TEMPO / J TGL PEMBAYARAN / K PPh 21/23/26 / L PPh 4(2)
 *   M DPP PPN / N PPN / O DPP PIHAK KETIGA / P PPh AMOUNT
 *   Q MATERAI / R BIAYA LAIN / S JUMLAH DIBAYAR / T NOTES / U (unused)
 *
 * Row 0-4: meta. Row 5-6: 2-row header. Row 7+: data.
 */

import * as XLSX from 'xlsx';

export interface WHTLedgerRow {
  no: number;
  vendor: { alamat: string; nama: string; npwp: string };
  invoice: { description: string; invoiceNo: string; fakturNo: string };
  dates: { invoice: string | null; due: string | null; payment: string | null };
  type: { pphLabel: string; pph42Label: string };
  vat: { dpp: number; ppn: number };
  wht: { base: number; amount: number };
  materai: number;
  miscFee: number;
  vendorPaid: number;
  notes: string;
}

export type ClassifiedType =
  | 'pph23_jasa'
  | 'pph23_sewa'
  | 'pph23_royalti'   // PPh23 15% — royalti / dividen / bunga / hadiah / 사용료
  | 'pph4_2_sewa'
  | 'pph26'
  | 'unknown';

export interface ClassifiedRow extends WHTLedgerRow {
  classified: ClassifiedType;
  vatInsert: boolean;
  expectedRate: number;
  expectedAmount: number;
  warnings: string[];
}

export interface WHTParseSummary {
  rows: ClassifiedRow[];
  totalRows: number;
  byType: Record<ClassifiedType, number>;
  warnings: string[];
}

// -----------------------------------------------------------------------------
// Field normalisers
// -----------------------------------------------------------------------------

/**
 * Parse Indo / JTC amount strings.
 *   '15,200,000.00' (US, JTC convention)  → 15200000
 *   '15.200.000'    (Indo legacy)         → 15200000
 *   'Rp 1.234'                            → 1234
 *   negative / blank                      → 0
 *   already a number                      → as-is (non-finite/neg → 0)
 */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (value === null || value === undefined) return 0;
  let s = String(value).trim();
  if (s === '' || s === '-') return 0;

  // Strip currency markers
  s = s.replace(/Rp\.?\s*/gi, '').replace(/IDR\s*/gi, '').replace(/\s+/g, '');

  if (s.startsWith('(') && s.endsWith(')')) return 0; // accounting negative
  if (s.startsWith('-')) return 0;

  // Determine decimal separator. If the string contains both '.' and ',' the
  // last separator is the decimal point (en-US: ',' thousands, '.' decimal;
  // id-ID: '.' thousands, ',' decimal). If only one separator and it appears
  // multiple times, it's a thousand separator. If only one '.' or ',' and
  // followed by 1-2 digits, treat as decimal.
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma) {
      // '.': decimal (US). Strip ',' as thousand sep.
      s = s.replace(/,/g, '');
    } else {
      // ',': decimal (Indo). Strip '.' as thousand sep, swap ',' → '.'.
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(',');
    // ',' with single trailing 1-2 digit group → decimal (e.g. '1234,50')
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0] + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasDot && !hasComma) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      // single '.' with 1-2 trailing digits → decimal
      // leave alone
    } else {
      // multiple '.': thousand sep (Indo)
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Parse a JTC-style date string.
 *
 *   '11/7/25'  → '2025-11-07' (MM/DD/YY, JTC convention)
 *   '25/11/7'  → null (treated as ambiguous, returns null when month > 12)
 *   '15/3/25'  → '2025-03-15' (when first part > 12 → swap to DD/MM/YY)
 *   '2025-11-07' → as-is
 *
 * Also handles Excel serial numbers (when value is a Date object — XLSX with
 * cellDates: true).
 */
export function parseJtcDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  // Excel cellDates=true → Date object
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const s = String(value).trim();
  if (!s) return null;

  // ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  // M/D/YY  or  M/D/YYYY  or  D/M/YY (when first part > 12)
  const slash = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2}|\d{4})$/);
  if (slash) {
    let first = Number(slash[1]);
    let second = Number(slash[2]);
    let year = Number(slash[3]);

    // Swap if first looks like a day (> 12) and second is a valid month
    if (first > 12 && second <= 12) {
      const tmp = first; first = second; second = tmp;
    }

    // Now first = month, second = day
    if (first < 1 || first > 12 || second < 1 || second > 31) return null;

    if (year < 100) year = year <= 50 ? 2000 + year : 1900 + year;

    return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
  }

  return null;
}

function getCell(row: unknown[], idx: number): unknown {
  return row && idx < row.length ? row[idx] : undefined;
}
function getStr(row: unknown[], idx: number): string {
  const v = getCell(row, idx);
  return v === null || v === undefined ? '' : String(v).trim();
}

// -----------------------------------------------------------------------------
// Header detection
// -----------------------------------------------------------------------------

function isHeaderRow(row: unknown[]): boolean {
  if (!row || row.length < 4) return false;
  const cells = row.map((c) => (c === null || c === undefined ? '' : String(c).toUpperCase()));
  const blob = cells.join(' ');
  return blob.includes('NO') && blob.includes('NAMA') && blob.includes('NPWP');
}

/** Find header row index, scanning rows 0..maxScan. Returns -1 if not found. */
function findHeaderRow(rows: unknown[][], maxScan = 10): number {
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    if (isHeaderRow(rows[i])) return i;
  }
  return -1;
}

// -----------------------------------------------------------------------------
// Classifier
// -----------------------------------------------------------------------------

/**
 * NPWP is "valid" if it has at least 15 digits (with separators stripped) and
 * is not a placeholder of all zeros.
 */
function isValidNpwp(npwp: string): boolean {
  const digits = npwp.replace(/\D/g, '');
  if (digits.length < 15) return false;
  if (/^0+$/.test(digits)) return false;
  return true;
}

export function classifyWHTRow(raw: WHTLedgerRow): ClassifiedRow {
  const warnings: string[] = [];

  const pphRaw = (raw.type.pphLabel || '').trim().toLowerCase();
  const pph42Raw = (raw.type.pph42Label || '').trim();

  let classified: ClassifiedType = 'unknown';
  let expectedRate = 0;

  // Branch 1: PPh4(2) wins if L (pph42Label) is non-empty
  if (pph42Raw !== '') {
    classified = 'pph4_2_sewa';
    expectedRate = 0.10;
    if (pphRaw !== '') {
      warnings.push('dualType'); // K and L both filled → user check
    }
  } else if (/pph[\s\-]*26|pasal[\s\-]*26/.test(pphRaw)) {
    // PPh26 wins over jasa/sewa keyword: "pph 26 jasa konsultan" → pph26.
    // Foreign vendor 20% WHT (UU PPh Pasal 26).
    classified = 'pph26';
    expectedRate = 0.20;
  } else if (/royalt|사용료|dividen|dividend|배당|bunga|interest|이자|hadiah|prize|상금|penghargaan/.test(pphRaw)) {
    // PPh23 15% — royalti, dividen, bunga, hadiah (UU PPh Pasal 23).
    // 사용료 / 배당 / 이자 / 상금 등 한국어도 인식.
    classified = 'pph23_royalti';
    expectedRate = 0.15;
  } else if (pphRaw.includes('jasa')) {
    classified = 'pph23_jasa';
    expectedRate = 0.02;
  } else if (pphRaw.includes('sewa')) {
    classified = 'pph23_sewa';
    expectedRate = 0.02;
  } else {
    classified = 'unknown';
    expectedRate = 0;
    warnings.push('unknownType');
  }

  // NPWP validity. PPh26 is for foreign vendors who typically have no
  // Indonesian NPWP → skip the npwpMissing nudge for that class.
  if (raw.vendor.npwp !== '' && !isValidNpwp(raw.vendor.npwp)) {
    warnings.push('npwpInvalid');
  } else if (
    raw.vendor.npwp === '' &&
    classified !== 'unknown' &&
    classified !== 'pph26'
  ) {
    warnings.push('npwpMissing');
  }

  // VAT companion insert
  const vatInsert = raw.vat.dpp > 0 || raw.vat.ppn > 0;

  // Expected WHT amount mismatch warning (5% tolerance)
  const expectedAmount = Math.round(raw.wht.base * expectedRate);
  if (raw.wht.base > 0 && raw.wht.amount > 0 && expectedAmount > 0) {
    const denom = Math.max(expectedAmount, 1);
    const drift = Math.abs(raw.wht.amount - expectedAmount) / denom;
    if (drift > 0.05) {
      warnings.push('amountMismatch');
    }
  }

  return { ...raw, classified, vatInsert, expectedRate, expectedAmount, warnings };
}

// -----------------------------------------------------------------------------
// Top-level entry
// -----------------------------------------------------------------------------

/**
 * Parse the WHT one-sheet xlsx buffer into classified rows.
 *
 * Throws if no sheet is found or header row cannot be detected.
 */
export function parseWHTOneSheet(buffer: ArrayBuffer): WHTParseSummary {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (!wb.SheetNames.length) throw new Error('Empty workbook');

  // Prefer 'Sheet1' if present, else first sheet
  const sheetName = wb.SheetNames.includes('Sheet1') ? 'Sheet1' : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, defval: null, blankrows: false, raw: true,
  });

  const headerIdx = findHeaderRow(allRows, 10);
  if (headerIdx < 0) {
    throw new Error('Header row not found (expected row with NO + NAMA + NPWP)');
  }

  // Data starts after the header. JTC template has a 2-row header (row 5+6),
  // so detect a continuation row (mostly text headers without numeric NO).
  let dataStart = headerIdx + 1;
  while (dataStart < allRows.length) {
    const r = allRows[dataStart];
    const noCell = getCell(r, 0);
    const nameCell = getStr(r, 2);
    // Continuation header row: NO empty AND NAMA empty AND row has any text
    if ((noCell === null || noCell === undefined || noCell === '') && !nameCell) {
      dataStart++;
      continue;
    }
    break;
  }

  const summary: WHTParseSummary = {
    rows: [],
    totalRows: 0,
    byType: { pph23_jasa: 0, pph23_sewa: 0, pph23_royalti: 0, pph4_2_sewa: 0, pph26: 0, unknown: 0 },
    warnings: [],
  };

  for (let i = dataStart; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.length === 0) continue;

    const noVal = getCell(row, 0);
    const nameVal = getStr(row, 2);
    // Skip rows where NO is missing OR not numeric, AND no vendor name
    const noNum = typeof noVal === 'number' ? noVal : Number(noVal);
    if ((!Number.isFinite(noNum) || noNum <= 0) && !nameVal) continue;
    if (!nameVal) continue;

    const raw: WHTLedgerRow = {
      no: Number.isFinite(noNum) && noNum > 0 ? noNum : summary.totalRows + 1,
      vendor: {
        alamat: getStr(row, 1),
        nama: nameVal,
        npwp: getStr(row, 3),
      },
      invoice: {
        description: getStr(row, 4),
        invoiceNo: getStr(row, 5),
        fakturNo: getStr(row, 6),
      },
      dates: {
        invoice: parseJtcDate(getCell(row, 7)),
        due: parseJtcDate(getCell(row, 8)),
        payment: parseJtcDate(getCell(row, 9)),
      },
      type: {
        pphLabel: getStr(row, 10),
        pph42Label: getStr(row, 11),
      },
      vat: {
        dpp: parseAmount(getCell(row, 12)),
        ppn: parseAmount(getCell(row, 13)),
      },
      wht: {
        base: parseAmount(getCell(row, 14)),
        amount: parseAmount(getCell(row, 15)),
      },
      materai: parseAmount(getCell(row, 16)),
      miscFee: parseAmount(getCell(row, 17)),
      vendorPaid: parseAmount(getCell(row, 18)),
      notes: getStr(row, 19),
    };

    const classified = classifyWHTRow(raw);
    summary.rows.push(classified);
    summary.byType[classified.classified]++;
    summary.totalRows++;
    if (classified.warnings.length > 0) {
      for (const w of classified.warnings) {
        if (!summary.warnings.includes(w)) summary.warnings.push(w);
      }
    }
  }

  return summary;
}
