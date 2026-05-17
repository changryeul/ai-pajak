/**
 * Map closing_document.ocr_extracted (from the classifier) into the EmpRow[]
 * shape used by the 1721 A1 inline form (ClosingEbupotInline.tsx).
 *
 * Two paths:
 *   1. payrollRows[] — when the classifier explicitly extracted employee-level
 *      rows (preferred, full fidelity).
 *   2. lineItems[]   — fallback for older OCR runs that only have
 *      { description, amount } per row. We treat each description as the
 *      employee name and amount as gross_salary; PTKP defaults to TK0.
 *
 * The result is always safe to merge into the form. Caller can show a banner
 * indicating how many rows came from OCR and which source.
 */

import type { ClosingClassificationResult, PayrollEmployeeRow } from '@/lib/ai/closing-document-classifier';

export interface EbupotEmpDraft {
  name: string;
  npwp: string;
  nik: string;
  ptkp: string;
  salary: number;
  jht: number;
  jp: number;
}

const VALID_PTKP_SET = new Set([
  'TK0', 'TK1', 'TK2', 'TK3',
  'K0', 'K1', 'K2', 'K3',
  // Older PTKP variants ("K/I/0" etc.) are normalized to TK0 because the
  // ebupot form's dropdown only accepts the 8 canonical codes.
]);

export type EbupotPrefillSource = 'payrollRows' | 'lineItems' | 'none';

export interface EbupotPrefillResult {
  employees: EbupotEmpDraft[];
  source: EbupotPrefillSource;
  /** Confidence (0~1) from the originating OCR run. null if no source. */
  ocrConfidence: number | null;
  /** True when the OCR confidence is below a recommended threshold. */
  lowConfidence: boolean;
}

const LOW_CONFIDENCE = 0.6;

function normalizePtkp(raw: string | null): string {
  if (!raw) return 'TK0';
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (VALID_PTKP_SET.has(t)) return t;
  return 'TK0';
}

function fromPayrollRow(p: PayrollEmployeeRow): EbupotEmpDraft {
  return {
    name: p.employeeName,
    npwp: p.npwp ?? '',
    nik: p.nik ?? '',
    ptkp: normalizePtkp(p.ptkpCode),
    salary: p.grossSalary ?? 0,
    jht: p.jht ?? 0,
    jp: p.jp ?? 0,
  };
}

function fromLineItem(item: { description: string; amount: number | null }): EbupotEmpDraft {
  return {
    name: item.description,
    npwp: '',
    nik: '',
    ptkp: 'TK0',
    salary: item.amount ?? 0,
    jht: 0,
    jp: 0,
  };
}

/**
 * Build the prefill result from one OCR extraction object. Returns empty
 * employees when the document is not a PAYROLL category or no rows are
 * present.
 */
export function mapClosingOcrToEmployees(
  extracted: Partial<ClosingClassificationResult> | null | undefined,
): EbupotPrefillResult {
  const empty: EbupotPrefillResult = {
    employees: [],
    source: 'none',
    ocrConfidence: null,
    lowConfidence: false,
  };
  if (!extracted) return empty;
  if (extracted.category !== 'PAYROLL') return empty;

  const confidence = typeof extracted.confidence === 'number' ? extracted.confidence : null;
  const lowConfidence = confidence !== null && confidence < LOW_CONFIDENCE;

  const payroll = Array.isArray(extracted.payrollRows) ? extracted.payrollRows : null;
  if (payroll && payroll.length > 0) {
    return {
      employees: payroll.filter((p) => p.employeeName).map(fromPayrollRow),
      source: 'payrollRows',
      ocrConfidence: confidence,
      lowConfidence,
    };
  }

  const items = Array.isArray(extracted.lineItems) ? extracted.lineItems : null;
  if (items && items.length > 0) {
    return {
      employees: items.filter((it) => it.description?.trim()).map(fromLineItem),
      source: 'lineItems',
      ocrConfidence: confidence,
      lowConfidence,
    };
  }

  return empty;
}
