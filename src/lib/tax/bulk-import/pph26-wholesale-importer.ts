/**
 * Wholesale withholding ledger importer for PPh26 (non-resident).
 *
 * Mirrors `pph23-wholesale-importer.ts` shape. Accepts the same
 * real-world wholesale xlsx/csv (3-row header, free-text columns,
 * mixed tax types, Indo date format) and produces a clean CSV string
 * ready for POST /api/tax/pph26-transactions/import.
 *
 * Pipeline:
 *   parseTabularFile -> detectHeaderRow -> mapColumns -> classifyPph26TaxType ->
 *   normalizeRow -> rowsToCsv -> Pph26WholesaleImportSummary
 *
 * PPh26-only — PPh23 / PPh4(2) / PPh21 BP rows are skipped with explicit
 * skipByTaxType counts. The bulk path applies the flat 20% standard rate
 * (treaty rates require Certificate-of-Domicile lookup, kept out of v1).
 *
 * Helpers (detectHeaderRow / mapColumns / parseAmount / parseIndoDate /
 * ColumnMap) are intentionally re-implemented as light wrappers around the
 * PPh23 module so that:
 *   - both importers stay in lockstep on the wholesale ledger format
 *   - test files don't need to cross-import to assert helper behavior
 *   - if PPh23 ever forks its mapColumns (e.g. add SEWA-specific column), the
 *     PPh26 importer keeps the simpler shape without a coupling break.
 */

import { parseTabularFile, rowsToCsv } from './client-file-parser';
import {
  detectHeaderRow,
  mapColumns,
  parseAmount,
  parseIndoDate,
  ColumnMapError as Pph23ColumnMapError,
  type ColumnMap,
} from './pph23-wholesale-importer';

export interface Pph26WholesaleImportSummary {
  imported: number;
  skippedByTaxType: number;
  skippedByValidation: number;
  errors: Array<{ rowNumber: number; reason: string }>;
  csvContent: string;
}

const PPH26_HEADERS = [
  'transaction_date',
  'income_type',
  'gross_amount',
  'counterparty_name',
  'counterparty_npwp',
  'invoice_number',
  'description',
] as const;
type Pph26Header = (typeof PPH26_HEADERS)[number];

// Re-export shared helpers so consumers + tests can pull everything from
// one module without coupling to PPh23 internals directly.
export { detectHeaderRow, mapColumns, parseAmount, parseIndoDate };
export type { ColumnMap };

/**
 * Standalone PPh26 ColumnMapError so callers can `instanceof` it without
 * accidentally widening to the PPh23 error type. Subclasses the PPh23 one
 * so `instanceof Pph23ColumnMapError` still works for shared catch blocks.
 */
export class Pph26ColumnMapError extends Pph23ColumnMapError {
  constructor(missing: string[]) {
    super(missing);
    this.name = 'Pph26ColumnMapError';
  }
}

// Tax type filter — PPh26 keep + skip reasons for everything else.

export type Pph26IncomeKind = 'DIVIDEND' | 'INTEREST' | 'ROYALTY' | 'SERVICE' | 'OTHER';
export type Pph26SkipReason = 'pph23' | 'pph4_2' | 'pph21' | 'unknown';

/**
 * Classify a wholesale ledger row's `Type of Tax` (+ sub-transaction text)
 * into a PPh26 income_type, or a skip reason. The returned UPPERCASE
 * `Pph26IncomeKind` values are written directly into the normalised CSV
 * `income_type` column — the server endpoint accepts them as-is without
 * lower→upper translation.
 *
 * income_type derivation looks at the sub-transaction text (description
 * column) using keywords that appear in real Indo wholesale ledgers:
 *   - dividen → DIVIDEND
 *   - bunga / interest → INTEREST
 *   - royalti / royalty → ROYALTY
 *   - jasa / service / teknik / manajemen → SERVICE
 *   - everything else → OTHER
 */
export function classifyPph26TaxType(
  typeOfTax: string,
  subTrans: string = '',
): Pph26IncomeKind | Pph26SkipReason {
  const t = typeOfTax.toUpperCase().trim();
  if (!/^PPH\s*26/i.test(t)) {
    // Map non-PPh26 to skip reason for accurate skipByTaxType count.
    if (/^PPH\s*23/.test(t)) return 'pph23';
    if (/^PPH\s*4\s*AYAT\s*2/.test(t)) return 'pph4_2';
    if (/^PPH\s*21/.test(t)) return 'pph21';
    return 'unknown';
  }
  const blob = subTrans.toLowerCase();
  if (/dividen/.test(blob)) return 'DIVIDEND';
  if (/bunga|interest/.test(blob)) return 'INTEREST';
  if (/royalti|royalty/.test(blob)) return 'ROYALTY';
  if (/jasa|service|teknik|manajemen/.test(blob)) return 'SERVICE';
  return 'OTHER';
}

const SKIP_REASONS: ReadonlySet<Pph26SkipReason> = new Set<Pph26SkipReason>([
  'pph23',
  'pph4_2',
  'pph21',
  'unknown',
]);

function isSkipReason(v: Pph26IncomeKind | Pph26SkipReason): v is Pph26SkipReason {
  return SKIP_REASONS.has(v as Pph26SkipReason);
}

interface NormalizedRow {
  transaction_date: string;
  income_type: string;
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

export async function importPph26WholesaleFile(file: File): Promise<Pph26WholesaleImportSummary> {
  const parsed = await parseTabularFile(file);

  const allRows: string[][] = [parsed.headers, ...parsed.dataRows];
  const headerIdx = detectHeaderRow(allRows);
  const header = allRows[headerIdx];
  const dataRows = allRows.slice(headerIdx + 1);

  // Throw the PPh26-flavored error (still instanceof Pph23ColumnMapError)
  // so callers can catch on either type. mapColumns from the PPh23 module
  // throws its own ColumnMapError — rewrap into our subclass.
  let columnMap: ColumnMap;
  try {
    columnMap = mapColumns(header);
  } catch (e) {
    if (e instanceof Pph23ColumnMapError) {
      throw new Pph26ColumnMapError(e.missing);
    }
    throw e;
  }

  const normalized: NormalizedRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];
  let skippedByTaxType = 0;
  let skippedByValidation = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = headerIdx + i + 2; // 1-based, matches Excel row numbering

    const taxTypeStr = getCell(row, columnMap.type_of_tax);
    const subTrans = getCell(row, columnMap.sub_transaction);
    const desc = getCell(row, columnMap.transaction_desc);
    const cls = classifyPph26TaxType(taxTypeStr, `${subTrans} ${desc}`);
    if (isSkipReason(cls)) {
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

    normalized.push({
      transaction_date: date,
      income_type: cls,
      gross_amount: String(amount),
      counterparty_name,
      counterparty_npwp: getCell(row, columnMap.opp_npwp),
      invoice_number: getCell(row, columnMap.invoice_no),
      description: desc,
    });
  }

  const csvContent = rowsToCsv(
    PPH26_HEADERS as unknown as string[],
    normalized.map((n) => PPH26_HEADERS.map((h) => n[h as Pph26Header])),
  );

  return {
    imported: normalized.length,
    skippedByTaxType,
    skippedByValidation,
    errors,
    csvContent,
  };
}
